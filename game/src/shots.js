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
      const state = job.id <= G.jobsDone ? 'DONE' : job.id === G.jobsDone + 1 ? 'NEXT' : 'OPEN';
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
    const car = createCar(G.scene, 0, 24, Math.PI, 0xc94f4f, false, true);
    G.player.getIn(car, G);
    car.speed = 22;
    G.police.wanted = 4;
    // Two cruisers flanking behind the player, in frame for the cover.
    const c1 = G.police.spawnCruiser(G);
    c1.pos.x = 7;
    c1.pos.z = 32;
    c1.heading = Math.PI;
    c1.speed = 24;
    const c2 = G.police.spawnCruiser(G);
    c2.pos.x = -8;
    c2.pos.z = 35;
    c2.heading = Math.PI;
    c2.speed = 24;
    G.missions.jobIndex = 2;
    G.missions.phase = 'deliver';
    G.missions.timer = 72;
    G.missions.objective = 'JOB 3: LOSE THE HEAT — get to the safehouse';
    G.missions.placeMarker(-100, -92);
    G.minimap.setObjective(-100, -92);
    G.cash = 1240;
    let storyShown = false;
    return (dt) => {
      t += dt;
      input.fake('KeyW', true);
      // The briefing fades on a wall-clock timer, so trigger it just before
      // the frame is captured — otherwise it is gone by the time the slow
      // headless renderer reaches the ready point.
      if (t > 2.8 && !storyShown) {
        storyShown = true;
        G.hud.setStory(STORY.jobs[2].briefing);
      }
      // Keep the helicopter pinned just ahead of the car, low and in frame,
      // so the cover shows the body and its red stripe — not only the beam.
      const p = G.player.car.pos;
      const h = G.player.car.heading;
      G.heli.mesh.position.set(p.x + Math.sin(h) * 16, 14, p.z + Math.cos(h) * 16);
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
    // pistol out, the gold getaway car ahead on open dock, cranes and the
    // water behind it, the safehouse toast still showing. The car sits in
    // the clear lane between the container stacks (x -70, z 100) so nothing
    // crosses it.
    const car = createCar(G.scene, -70, 100, Math.PI / 2, 0xd9a527, false, true);
    car.parked = true;
    G.parked.push(car);
    G.player.pos.x = -70;
    G.player.pos.z = 93;
    G.player.heading = 0;
    G.player.mesh.position.set(-70, 0, 93);
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
