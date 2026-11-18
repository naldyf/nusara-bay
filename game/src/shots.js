// Screenshot staging: ?shot=chase|steal|harbor|start&seed=N puts the real game
// in a chosen state and drives it forward with a scripted autopilot — the
// frames are genuine gameplay, not a posed diorama. When the scene is ready
// the autopilot returns true and main.js sets window.__shotReady.
import { STORY } from './story.js';
import { createCar } from './vehicles.js';

function jobListHtml(G) {
  return STORY.jobs
    .map((job) => {
      const cls = job.id <= G.jobsDone ? 'done' : job.id === G.jobsDone + 1 ? 'next' : 'locked';
      const state = job.id <= G.jobsDone ? 'DONE' : job.id === G.jobsDone + 1 ? 'NEXT' : job.id <= 3 ? 'OPEN' : 'LOCKED — NEXT BUILD';
      return `<div class="${cls}">JOB ${job.id} — ${job.title} · $${job.pay} · ${state}</div>`;
    })
    .join('');
}

export function stageShot(G, name, seed) {
  const input = G.input;
  let t = 0;
  if (name === 'chase') {
    // Cover: Dara mid-drift downtown, 4 wanted stars, cruisers behind,
    // helicopter overhead, Job 3 on the clock, minimap full of blips.
    const car = createCar(G.scene, 0, 24, Math.PI, 0xc94f4f);
    G.player.getIn(car, G);
    car.speed = 22;
    G.police.wanted = 4;
    // Two cruisers right behind the player, in frame for the cover.
    const c1 = G.police.spawnCruiser(G);
    c1.pos.x = 4;
    c1.pos.z = 34;
    c1.heading = Math.PI;
    c1.speed = 24;
    const c2 = G.police.spawnCruiser(G);
    c2.pos.x = -5;
    c2.pos.z = 38;
    c2.heading = Math.PI;
    c2.speed = 24;
    G.missions.jobIndex = 2;
    G.missions.phase = 'deliver';
    G.missions.timer = 72;
    G.missions.objective = 'JOB 3: LOSE THE HEAT — get to the safehouse';
    G.missions.placeMarker(-100, -92);
    G.minimap.setObjective(-100, -92);
    G.cash = 1240;
    return (dt) => {
      t += dt;
      input.fake('KeyW', true);
      return t > 3.2;
    };
  }
  if (name === 'steal') {
    // On foot on the market street beside a parked car, prompt up, a cruiser
    // closing in the background, pedestrians scattering from passing traffic.
    const car = createCar(G.scene, -77.5, 4.4, Math.PI / 2, 0x4f7ec9);
    car.parked = true;
    G.parked.push(car);
    G.player.pos.x = -80;
    G.player.pos.z = 4.4;
    G.player.heading = Math.PI / 2;
    G.player.mesh.position.set(-80, 0, 4.4);
    G.police.wanted = 1;
    G.cash = 250;
    return (dt) => {
      t += dt;
      return t > 2.6;
    };
  }
  if (name === 'harbor') {
    // Job 3 in progress at the container yard: Dara on foot facing south,
    // pistol out, the gold getaway car ahead, cranes and the water behind it,
    // the safehouse toast still showing.
    const car = createCar(G.scene, -58, 101, Math.PI / 2, 0xd9a527);
    car.parked = true;
    G.parked.push(car);
    G.player.pos.x = -62;
    G.player.pos.z = 97;
    G.player.heading = Math.PI / 4;
    G.player.mesh.position.set(-62, 0, 97);
    G.police.wanted = 2;
    G.missions.jobIndex = 2;
    G.missions.phase = 'deliver';
    G.missions.timer = 60;
    G.missions.objective = 'JOB 3: LOSE THE HEAT — get to the safehouse — 1:00';
    G.missions.placeMarker(-100, -92);
    G.minimap.setObjective(-100, -92);
    G.cash = 2140;
    G.hud.toast('PROGRESS SAVED — safehouse');
    return (dt) => {
      t += dt;
      return t > 2.6;
    };
  }
  if (name === 'start') {
    // Title screen over the live city at dusk, job list and system line on show.
    G.screen = 'title';
    G.hud.showScreen('title', { joblist: jobListHtml(G), hasSave: false });
    return (dt) => {
      t += dt;
      return t > 1.6;
    };
  }
  return () => true;
}
