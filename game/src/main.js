// Nusara Bay — boot and the one loop. The world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints
// what is there. Screens: title, play, pause, game over — plus shot mode,
// which stages a scene deterministically for a screenshot and sets
// window.__shotReady when the frame is ready to capture.
import * as THREE from 'three';
import { CAR, PLAYER, GOLDEN_HOUR } from './config.js';
import { createRandom } from './random.js';
import { createInput, ACTION_ENTER, ACTION_CONFIRM, ACTION_PAUSE, ACTION_RADIO } from './input.js';
import { buildCity, cameraClear } from './city.js';
import { spawnParkedCars } from './vehicles.js';
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
import { stageShot, jobListHtml } from './shots.js';

const STEP = 1 / 60;
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed')) || 1;

// --- renderer, scene, camera -----------------------------------------------
const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById('game'),
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = GOLDEN_HOUR.exposure;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 600);
camera.position.set(0, 3, -46);

const rng = createRandom(seed);
const input = createInput();
const city = buildCity(scene, rng);

// The golden-hour environment map: a 512x256 canvas gradient of the sky
// (violet zenith, orange horizon, peach haze) run through PMREM, so the
// clearcoat paint and the glass have a warm world to reflect. Without it
// the PBR materials read as matte plastic.
function setupEnvironment(scene, renderer) {
  const envCanvas = document.createElement('canvas');
  envCanvas.width = 512;
  envCanvas.height = 256;
  const g = envCanvas.getContext('2d');
  const wash = g.createLinearGradient(0, 0, 0, 256);
  wash.addColorStop(0, '#3b2d6b');
  wash.addColorStop(0.45, '#ff8642');
  wash.addColorStop(0.62, '#e8a87c');
  wash.addColorStop(1, '#5c3d2e');
  g.fillStyle = wash;
  g.fillRect(0, 0, 512, 256);
  // A hot sun blob on the horizon, so the reflections have a source.
  const sunBlob = g.createRadialGradient(128, 150, 4, 128, 150, 70);
  sunBlob.addColorStop(0, 'rgba(255, 220, 150, 1)');
  sunBlob.addColorStop(1, 'rgba(255, 200, 120, 0)');
  g.fillStyle = sunBlob;
  g.fillRect(0, 0, 512, 256);
  const envTex = new THREE.CanvasTexture(envCanvas);
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  envTex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(envTex).texture;
  scene.environmentIntensity = 0.85;
  envTex.dispose();
  pmrem.dispose();
  // Sharper shadows and max anisotropy on every texture in the scene.
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  scene.traverse((obj) => {
    if (!obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      for (const key of Object.keys(m)) {
        const v = m[key];
        if (v && v.isTexture) v.anisotropy = maxAniso;
      }
    }
    if (obj.isDirectionalLight) {
      obj.shadow.mapSize.set(2048, 2048);
      obj.shadow.normalBias = 0.035;
      obj.shadow.radius = 2.5;
    }
  });
}

setupEnvironment(scene, renderer);

// --- the world ---------------------------------------------------------------
const G = {
  scene,
  camera,
  rng,
  input,
  city,
  time: 0,
  screen: 'title',
  cash: PLAYER.cashStart,
  jobsDone: 0,
  debtCleared: false,
  health: PLAYER.healthMax,
  shake: 0,
  damageFlash: 0,
  overReason: '',
  nosActive: false,
  shotReady: false,
  _savedAt: -999,
  cameraYaw: 0,
  dispatch: '',
};

// Every system in one place, in dependency order: the world first, then the
// actors, then the systems that watch them.
function buildWorld(G) {
  G.parked = spawnParkedCars(scene, rng, city, 14);
  G.player = createPlayer(scene, 0, -40);
  G.traffic = createTraffic(scene, rng, city);
  G.peds = createPedestrians(scene, rng, city);
  G.police = createPolice(scene, rng, city);
  G.heli = createHelicopter(scene);
  G.audio = createAudio();
  G.effects = createEffects(scene, rng);
  G.hud = createHud();
  G.minimap = createMinimap(document.getElementById('minimap'), city);
  G.missions = createMissions(scene, G);
  G.combat = createCombat(scene, G);
  G.saveGame = () => persistSave(G);
  G.loadGame = loadGame;
}
buildWorld(G);

// --- damage, game over, starting ----------------------------------------------
G.damage = (amount) => {
  if (G.screen !== 'play') return;
  G.health = Math.max(0, G.health - amount);
  G.damageFlash = 1;
  G.hud.setDamage();
  if (G.health <= 0) G.gameOver('WASTED — Dara is down');
};

G.gameOver = (reason) => {
  if (G.screen === 'over') return;
  G.screen = 'over';
  G.overReason = reason;
  G.hud.setOver(reason, 'PRESS ENTER TO TRY AGAIN');
  G.hud.showScreen('over');
};

function startNewGame() {
  G.cash = PLAYER.cashStart;
  G.jobsDone = 0;
  G.debtCleared = false;
  G.health = PLAYER.healthMax;
  G.police.wanted = 0;
  G.screen = 'play';
  G.hud.showScreen('none');
  G.hud.setPrompt(null);
  G.missions.startJob(0);
  G.audio.unlock();
}

function startContinue() {
  const data = loadGame();
  if (!data) return;
  G.cash = data.cash;
  G.jobsDone = data.jobsDone;
  G.missions.jobIndex = data.jobIndex;
  G.missions.phase = 'idle';
  G.health = data.health ?? PLAYER.healthMax;
  G.player.pos.x = city.safehousePos.x;
  G.player.pos.z = city.safehousePos.z;
  G.player.mesh.position.set(city.safehousePos.x, 0, city.safehousePos.z);
  G.screen = 'play';
  G.hud.showScreen('none');
  G.hud.setStory('Madame Sari', 'Back to work, Dara. The next job is waiting.');
  G.hud.setPrompt('PRESS ENTER TO START THE NEXT JOB');
  G.hud.toast('SAVE LOADED');
  G.audio.unlock();
}

// --- the test hook --------------------------------------------------------------
// window.__nusara is the contract the headless suite reads: live objects and
// live getters, never snapshots, so a test that teleports the player or adds
// wanted stars sees the world move.
window.__nusara = {
  get screen() {
    return G.screen;
  },
  get time() {
    return G.time;
  },
  get cash() {
    return G.cash;
  },
  get jobsDone() {
    return G.jobsDone;
  },
  get debtCleared() {
    return G.debtCleared;
  },
  get parked() {
    return G.parked;
  },
  player: G.player,
  camera,
  audio: G.audio,
  missions: G.missions,
  police: G.police,
  heli: G.heli,
  minimap: G.minimap,
  hud: G.hud,
  city: G.city,
  traffic: G.traffic,
  effects: G.effects,
  saveGame: G.saveGame,
  loadGame: G.loadGame,
  dispatch: '',
};

// --- camera -------------------------------------------------------------------
// Chase camera: behind the player (or the car), looking a little ahead, with
// the yaw easing toward the heading so turns sweep instead of snapping. The
// camera pulls in along its ray until it is clear of buildings.
function updateCamera(dt) {
  const focus = G.player.onFoot ? G.player.pos : G.player.car.pos;
  const heading = G.player.onFoot ? G.player.heading : G.player.car.heading;
  let diff = heading - G.cameraYaw;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  G.cameraYaw += diff * Math.min(1, dt * 4);
  const speed = G.player.onFoot ? 0 : Math.abs(G.player.car.speed);
  const dist = G.player.onFoot ? 5.6 : 11.2 + speed * 0.16;
  const height = G.player.onFoot ? 2.75 : 3.4;
  const wantFov = G.player.onFoot ? 55 : Math.min(66, 58 + speed * 0.3);
  if (Math.abs(camera.fov - wantFov) > 0.05) {
    camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();
  }
  const fx = Math.sin(G.cameraYaw);
  const fz = Math.cos(G.cameraYaw);
  let back = dist;
  // Pull in until the camera is out of the buildings.
  while (back > 2) {
    const cx = focus.x - fx * back;
    const cz = focus.z - fz * back;
    if (cameraClear(cx, height, cz, city.colliders)) break;
    back -= 0.5;
  }
  const target = new THREE.Vector3(focus.x - fx * back, height, focus.z - fz * back);
  camera.position.lerp(target, Math.min(1, dt * 8));
  if (G.shake > 0) {
    camera.position.x += (rng.next() - 0.5) * G.shake * 0.5;
    camera.position.y += (rng.next() - 0.5) * G.shake * 0.4;
    G.shake = Math.max(0, G.shake - dt * 2);
  }
  camera.lookAt(focus.x + fx * 4, 1.5, focus.z + fz * 4);
}

// Driving: steer and throttle from the input, NOS on Shift, E to step out
// when the car is (almost) stopped. A hard hit shakes the camera and
// throws smoke.
function driveStep(G, dt, input) {
  const car = G.player.car;
  const axis = input.axis();
  const boost = input.run() ? 1.35 : 1;
  G.nosActive = boost > 1;
  car.drive(
    dt,
    { x: axis.x, y: axis.y, handbrake: input.handbrake() },
    G.city.colliders,
    (lost) => {
      G.damage(Math.min(20, lost * 0.4));
      G.shake = Math.min(1, G.shake + 0.3);
      G.effects.spawnSmoke(car.pos.x, car.pos.z, 3);
    },
    boost,
  );
  G.audio.setEngine(car.speed, CAR.topSpeed * boost);
  if (input.action(ACTION_ENTER)) {
    if (G.player.getOut(G)) {
      G.audio.engineStop();
      G.hud.toast('YOU ARE ON FOOT');
    }
  }
}

// --- one fixed step ---------------------------------------------------------------
function step(dt) {
  G.time += dt;
  if (G.screen === 'title') {
    if (input.action(ACTION_CONFIRM)) startNewGame();
  } else if (G.screen === 'over') {
    if (input.action(ACTION_CONFIRM)) startNewGame();
  } else if (G.screen === 'play') {
    if (input.action(ACTION_RADIO)) G.audio.toggleRadio();
    // ENTER starts the current job, retries a failed one, or moves on to the
    // next after a completed one.
    if (input.action(ACTION_CONFIRM)) {
      const phase = G.missions.phase;
      if ((phase === 'idle' || phase === 'done' || phase === 'failed') && G.missions.jobIndex < STORY.jobs.length) {
        G.missions.startJob(G.missions.jobIndex);
      }
    }
    if (G.player.onFoot) {
      G.player.update(dt, input, G);
      G.audio.setEngine(0, CAR.topSpeed);
      G.nosActive = false;
    } else {
      driveStep(G, dt, input);
    }
    G.traffic.update(dt, G);
    G.peds.update(dt, G);
    G.police.update(dt, G);
    G.heli.update(dt, G);
    G.missions.update(dt);
    G.combat.update(dt, input);
    G.effects.update(dt);
    G.audio.setSiren(G.police.wanted);
    // The safehouse saves: stand close to it on foot and the campaign is
    // written to localStorage, at most once every five seconds.
    if (G.player.onFoot) {
      const d = Math.hypot(G.player.pos.x - city.safehousePos.x, G.player.pos.z - city.safehousePos.z);
      if (d < 4 && G.time - G._savedAt > 5) {
        if (persistSave(G)) {
          G._savedAt = G.time;
          G.hud.toast('PROGRESS SAVED AT THE SAFEHOUSE');
        }
      }
    }
  }
  // The world breathes even on the title screen: dust drifts, water moves.
  city.updateAtmosphere(dt);
  updateCamera(dt);
  // Screenshot staging runs last, so its pins win over the AI: the cruisers
  // stay flanking, the helicopter stays overhead, the hero car holds 22.
  if (autopilot) {
    if (autopilot(G, dt) && !G.shotReady) {
      G.shotReady = true;
      window.__shotReady = true;
    }
  }
}

// --- boot -----------------------------------------------------------------------
let autopilot = null;
G.hud.setJobList(jobListHtml(G));
if (shotName && shotName !== 'start') {
  G.screen = 'play';
  G.hud.showScreen('none');
  autopilot = stageShot(G, shotName, seed);
} else if (shotName === 'start') {
  G.screen = 'title';
  autopilot = stageShot(G, shotName, seed);
} else {
  const saved = hasSave() ? loadGame() : null;
  G.hud.setContinue(
    saved
      ? `PRESS C TO CONTINUE — JOB ${saved.jobIndex + 1} · $${Math.floor(saved.cash).toLocaleString('en-US')}`
      : 'NO SAVE YET — PRESS ENTER TO START',
  );
  G.hud.showScreen('title');
}
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyC' && G.screen === 'title' && hasSave()) startContinue();
});
window.addEventListener('keydown', () => G.audio.unlock());
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// --- the loop ---------------------------------------------------------------------
let last = performance.now();
let acc = 0;
function animate(now) {
  requestAnimationFrame(animate);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  // Pause is checked here, not in step(), because step() does not run while
  // paused — the toggle has to live where the frame loop can reach it.
  if (input.action(ACTION_PAUSE)) {
    if (G.screen === 'play') {
      G.screen = 'pause';
      G.hud.showScreen('pause');
    } else if (G.screen === 'pause') {
      G.screen = 'play';
      G.hud.showScreen('none');
    }
    input.clear();
  }
  if (G.screen !== 'pause') {
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 5) {
      step(STEP);
      acc -= STEP;
      n++;
    }
    if (n === 5) acc = 0;
  }
  G.hud.update(G);
  G.minimap.draw(G);
  input.endFrame();
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);
