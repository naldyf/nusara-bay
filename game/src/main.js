// Nusara Bay — boot and the one loop. The world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints
// what is there. Screens: title, play, pause, game over — plus shot mode,
// which stages a scene deterministically for a screenshot and sets
// window.__shotReady when the frame is ready to capture.
import * as THREE from 'three';
import { WORLD, CAR, PLAYER } from './config.js';
import { createRandom } from './random.js';
import { createInput, ACTION_ENTER, ACTION_CONFIRM, ACTION_PAUSE, ACTION_RADIO } from './input.js';
import { buildCity, cameraClear } from './city.js';
import { createCar, spawnParkedCars } from './vehicles.js';
import { createPlayer } from './player.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createHelicopter } from './helicopter.js';
import { createMissions } from './missions.js';
import { STORY } from './story.js';
import { createCombat } from './combat.js';
import { createHud } from './hud.js';
import { createMinimap } from './minimap.js';
import { createAudio } from './audio.js';
import { createEffects } from './effects.js';
import { saveGame as persistSave, loadGame, hasSave } from './save.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261118;
window.__shotReady = false;

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 600);
camera.position.set(60, 40, 90);

const rng = createRandom(seed);
const input = createInput();
const city = buildCity(scene, rng);

const G = {
  scene,
  camera,
  renderer,
  rng,
  input,
  city,
  time: 0,
  cash: PLAYER.cashStart,
  health: PLAYER.healthMax,
  jobsDone: 0,
  screen: 'title',
  cameraYaw: 0,
  shake: 0,
  damageFlash: 0,
  overReason: '',
  audio: createAudio(),
  effects: null,
  hud: null,
  minimap: null,
  player: null,
  parked: [],
  traffic: null,
  peds: null,
  police: null,
  heli: null,
  missions: null,
  combat: null,
  saveGame() {
    return persistSave(G);
  },
  damage(n, reason) {
    if (G.screen !== 'play') return;
    G.health = Math.max(0, G.health - n);
    G.damageFlash = 0.85;
    G.shake = Math.min(0.7, G.shake + 0.4);
    if (reason) G.hud.toast(reason);
    if (G.health <= 0) G.gameOver('WASTED');
  },
  gameOver(kind) {
    if (G.screen === 'over') return;
    G.screen = 'over';
    G.overReason = kind;
    G.audio.engineStop();
    G.audio.setSiren(false);
    G.hud.showScreen('over', {
      title: kind,
      sub: kind === 'BUSTED' ? 'The NCPD caught Dara on foot. The debt is still due.' : 'Dara went down. Madame Sari is not pleased.',
    });
  },
};
G.effects = createEffects(scene);
G.hud = createHud();
G.minimap = createMinimap(document.getElementById('minimap'), city);
G.player = createPlayer(scene, city.spawn.market.x, city.spawn.market.z);
G.parked = spawnParkedCars(scene, rng, city, 10);
G.traffic = createTraffic(scene, rng, city);
G.peds = createPedestrians(scene, rng, city);
G.police = createPolice(scene, rng, city);
G.heli = createHelicopter(scene);
G.missions = createMissions(scene, G);
G.combat = createCombat(scene, G);
window.__nusara = G;

// --- title screen: job list, states, continue line -------------------------
function jobListHtml() {
  return STORY.jobs
    .map((job) => {
      const cls = job.id <= G.jobsDone ? 'done' : job.id === G.jobsDone + 1 ? 'next' : 'locked';
      const state = job.id <= G.jobsDone ? 'DONE' : job.id === G.jobsDone + 1 ? 'NEXT' : job.id <= 3 ? 'OPEN' : 'LOCKED — NEXT BUILD';
      return `<div class="${cls}">JOB ${job.id} — ${job.title} · $${job.pay} · ${state}</div>`;
    })
    .join('');
}
function showTitle() {
  G.screen = 'title';
  const save = loadGame();
  G.hud.showScreen('title', {
    joblist: jobListHtml(),
    hasSave: !!save,
  });
  if (save) {
    document.getElementById('continue-line').textContent =
      `CONTINUE — Job ${save.jobIndex + 1}, $${Math.floor(save.cash).toLocaleString('en-US')} — press ENTER`;
  }
}
function startGame() {
  const save = loadGame();
  if (save) {
    G.cash = save.cash;
    G.jobsDone = save.jobsDone || 0;
    G.health = save.health ?? PLAYER.healthMax;
    G.missions.jobIndex = save.jobIndex;
    G.missions.objective = `JOB ${save.jobIndex + 1}: ${STORY.jobs[save.jobIndex].title} — continue at the marker.`;
    G.missions.startJob(save.jobIndex);
  } else {
    G.cash = PLAYER.cashStart;
    G.jobsDone = 0;
    G.missions.startJob(0);
  }
  G.screen = 'play';
  G.hud.showScreen('play');
  G.audio.unlock();
}

// --- camera: chase cam behind the car, close follow on foot, orbit on title -
// The camera pulls in along its ray until it is out of every building, so it
// never clips into a wall. A single headlight spotlight follows the player's
// car and keeps it readable at dusk.
const camTarget = new THREE.Vector3();
const headlight = new THREE.SpotLight(0xffe9a8, 220, 48, 0.55, 0.5, 1.0);
headlight.visible = false;
scene.add(headlight);
scene.add(headlight.target);

function pullInFrom(px, pz, want) {
  const dx = want.x - px;
  const dy = want.y - 1.4;
  const dz = want.z - pz;
  for (const f of [1, 0.7, 0.5, 0.35, 0.22]) {
    const cx = px + dx * f;
    const cy = 1.4 + dy * f;
    const cz = pz + dz * f;
    if (cameraClear(cx, cy, cz, G.city.colliders)) {
      want.set(cx, cy, cz);
      return;
    }
  }
  want.set(px + dx * 0.22, 1.4 + dy * 0.22, pz + dz * 0.22);
}

function updateCamera(dt) {
  const p = G.player.onFoot ? G.player.pos : G.player.car.pos;
  const heading = G.player.onFoot ? G.player.heading : G.player.car.heading;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  let want = camTarget;
  if (G.screen === 'title') {
    const a = G.time * 0.05;
    camera.position.set(Math.sin(a) * 130, 60, Math.cos(a) * 130);
    camera.lookAt(0, 8, 0);
    headlight.visible = false;
    return;
  }
  if (G.player.onFoot) {
    want.set(p.x - fx * 7, 3.4, p.z - fz * 7);
    pullInFrom(p.x, p.z, want);
    camera.position.lerp(want, Math.min(1, dt * 7));
    camTarget.set(p.x + fx * 5, 1.4, p.z + fz * 5);
    headlight.visible = false;
  } else {
    const speed = Math.abs(G.player.car.speed);
    const back = 12 + speed * 0.18;
    want.set(p.x - fx * back, 5.2 + speed * 0.05, p.z - fz * back);
    pullInFrom(p.x, p.z, want);
    camera.position.lerp(want, Math.min(1, dt * 4.5));
    camTarget.set(p.x + fx * 12, 1.6, p.z + fz * 12);
    camera.fov = 68 + Math.min(10, speed * 0.35) + (input.run() ? 3 : 0);
    camera.updateProjectionMatrix();
    headlight.visible = true;
    headlight.position.set(p.x + fx * 2, 1.1, p.z + fz * 2);
    headlight.target.position.set(p.x + fx * 24, 0.4, p.z + fz * 24);
  }
  if (G.shake > 0.01) {
    camera.position.x += (Math.random() - 0.5) * G.shake * 0.5;
    camera.position.y += (Math.random() - 0.5) * G.shake * 0.4;
    G.shake = Math.max(0, G.shake - dt * 1.8);
  }
  camera.lookAt(camTarget);
  G.cameraYaw = Math.atan2(p.x - camera.position.x, p.z - camera.position.z);
}

// --- one fixed step ----------------------------------------------------------
function step(dt) {
  G.time += dt;
  if (G.screen === 'play' || G.screen === 'shot') {
    // Driving or walking.
    if (G.player.onFoot) {
      G.player.update(dt, input, G);
      const near = G.player.nearestCar(G);
      G.hud.setPrompt(near ? (near.playerOwned ? 'PRESS E TO ENTER YOUR CAR' : 'PRESS E TO STEAL THIS CAR') : null);
    } else {
      const car = G.player.car;
      const axis = input.axis();
      const boost = input.run() && axis.y > 0 ? 1.35 : 1;
      if (input.action(ACTION_ENTER)) G.player.getOut(G);
      car.drive(dt, { x: axis.x, y: axis.y, handbrake: input.handbrake() }, G.city.colliders, (lost) => {
        if (lost > 9) G.damage(Math.min(14, lost * 0.5), null);
      }, boost);
      if (input.handbrake() && Math.abs(car.speed) > 9) {
        G.effects.spawnSmoke(car.pos.x - Math.sin(car.heading) * 1.6, car.pos.z - Math.cos(car.heading) * 1.6, 1);
      }
      G.hud.setPrompt(null);
      G.audio.setEngine(Math.min(1, Math.abs(car.speed) / CAR.topSpeed), input.handbrake());
    }
    G.traffic.update(dt, G);
    G.peds.update(dt, G);
    G.police.update(dt, G);
    G.heli.update(dt, G);
    G.missions.update(dt);
    G.combat.update(dt, input);
    G.audio.setSiren(G.police.wanted > 0 && G.police.cruisers.length > 0);
    // Health comes back slowly once the heat is off.
    if (G.police.wanted === 0 && G.health < PLAYER.healthMax) {
      G.health = Math.min(PLAYER.healthMax, G.health + 3 * dt);
    }
    // Safehouse: step inside the green glow and the game saves.
    const sh = city.safehousePos;
    if (Math.hypot(G.player.pos.x - sh.x, G.player.pos.z - sh.z) < 9 && !G._savedAt) {
      if (persistSave(G)) G.hud.toast('PROGRESS SAVED — safehouse');
      G._savedAt = G.time + 10;
    }
    if (G._savedAt && G.time > G._savedAt) G._savedAt = 0;
    G.damageFlash = Math.max(0, G.damageFlash - dt * 1.4);
    G.hud.setDamage(Math.max(G.damageFlash, G.health < 35 ? 0.3 : 0));
  } else if (G.screen === 'title') {
    // The city stays alive behind the title screen.
    G.traffic.update(dt, G);
    G.peds.update(dt, G);
  }
  G.effects.update(dt);
  if (input.action(ACTION_RADIO)) G.audio.toggleRadio();
  input.endFrame();
}

// --- shot staging ------------------------------------------------------------
let autopilot = null;
if (shotName) {
  G.screen = 'shot';
  autopilot = stageShot(G, shotName, seed);
}

// --- screens: Enter starts, Esc pauses, Enter on game-over reloads -----------
window.addEventListener('keydown', (e) => {
  G.audio.unlock();
  if (e.code === 'Enter' && G.screen === 'title') startGame();
  else if (e.code === 'Enter' && G.screen === 'over') window.location.reload();
  else if (e.code === 'Escape' && G.screen === 'play') {
    G.screen = 'pause';
    G.hud.showScreen('pause');
  } else if (e.code === 'Escape' && G.screen === 'pause') {
    G.screen = 'play';
    G.hud.showScreen('play');
  }
});
window.addEventListener('mousedown', () => {
  G.audio.unlock();
  if (G.screen === 'title') startGame();
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- the loop ----------------------------------------------------------------
let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const frameDt = Math.min(MAX_FRAME, (now - last) / 1000);
  last = now;
  acc += frameDt;
  let guard = 0;
  while (acc >= STEP && guard++ < 8) {
    step(STEP);
    acc -= STEP;
    if (autopilot && !window.__shotReady) {
      if (autopilot(STEP)) {
        renderer.render(scene, camera);
        window.__shotReady = true;
      }
    }
  }
  updateCamera(frameDt);
  renderer.render(scene, camera);
  G.minimap.draw(G);
  G.hud.update(G);
}

if (shotName && shotName !== 'start') {
  G.hud.showScreen('none');
} else if (!shotName) {
  showTitle();
}
requestAnimationFrame(frame);
