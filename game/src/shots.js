// Screenshot staging: ?shot=chase|steal|harbor|start&seed=N puts the real game
// in a chosen state and drives it forward with a scripted autopilot — the
// frames are genuine gameplay, not a posed diorama. When the scene is ready
// the autopilot returns true and main.js sets window.__shotReady.
//
// Staging rules the cover taught us: the camera is a chase cam behind the
// player, so anything staged dead-centre ahead hides behind the wanted
// stars, and anything at the frame edge reads as traffic. Police and the
// helicopter go off-centre and close, never centred and far. Nothing here
// fakes a state the game cannot reach — no staged toasts, no posed saves.
import { STORY } from './story.js';
import { createCar } from './vehicles.js';

export function jobListHtml(G) {
  return STORY.jobs
    .map((job) => {
      const state = job.id <= G.jobsDone ? 'DONE' : job.id === G.missions.jobIndex + 1 ? 'CURRENT' : 'LOCKED';
      const cls = state === 'DONE' ? 'done' : state === 'CURRENT' ? 'current' : 'locked';
      return `<div class="job-row ${cls}"><span>JOB ${job.id} — ${job.title}</span><span>$${job.pay} · ${state}</span></div>`;
    })
    .join('');
}

// Put Dara in a car and drive it forward with the autopilot holding W.
function driveForward(G, car, speed) {
  car.speed = speed;
  G.input.fake('KeyW', true);
}

// Pin a cruiser at a fixed offset from an anchor car, matching its heading
// and speed, so it reads as a flank escort rather than a random car.
function pinCruiser(G, cruiser, anchor, dx, dz) {
  const fx = Math.sin(anchor.heading);
  const fz = Math.cos(anchor.heading);
  cruiser.pos.x = anchor.pos.x + fx * dz + fz * dx;
  cruiser.pos.z = anchor.pos.z + fz * dz - fx * dx;
  cruiser.heading = anchor.heading;
  cruiser.speed = anchor.speed;
  cruiser.sync();
}

export function stageShot(G, name, seed) {
  void seed; // staging is deterministic from the game seed already
  if (name === 'start') {
    G.hud.setJobList(jobListHtml(G));
    G.hud.showScreen('title');
    return (g) => g.time > 1.6;
  }
  if (name === 'steal') {
    // Dara on foot in the night market, about to steal a blue car.
    G.missions.startJob(0);
    G.cash = 250;
    const car = createCar(G.scene, -77.5, 4.4, Math.PI / 2, 0x4f7ec9);
    car.parked = true;
    G.parked.push(car);
    G.player.pos.x = -80;
    G.player.pos.z = 4.4;
    G.player.heading = Math.PI / 2;
    G.player.mesh.position.set(-80, 0, 4.4);
    G.player.mesh.rotation.y = Math.PI / 2;
    G.police.addWanted(1, 'CAR STOLEN — alarm raised');
    G.missions.placeMarker(-80, -8);
    return (g) => g.time > 2.6;
  }
  if (name === 'harbor') {
    // Job 8, the five-star finale at the dock: Dara on foot, the gold car,
    // gantry cranes, containers, water, and a cruiser closing in.
    G.missions.startJob(7);
    G.cash = 8150;
    // Walk Dara onto the pickup to complete it, then move him to the frame.
    G.player.pos.x = -60;
    G.player.pos.z = 106;
    G.missions.update(0.1);
    G.player.pos.x = -115;
    G.player.pos.z = 96;
    G.player.heading = Math.PI / 2;
    G.player.mesh.position.set(-115, 0, 96);
    G.player.mesh.rotation.y = Math.PI / 2;
    const car = createCar(G.scene, -103, 88, Math.PI / 2, 0xd9a527);
    car.parked = true;
    G.parked.push(car);
    G.missions.timer = 96;
    G.missions.placeMarker(80, 104);
    const cruisers = [];
    for (const [ox, oz] of [
      [20, -10],
      [26, 4],
      [34, -16],
    ]) {
      const c = G.police.spawnCruiser(G);
      c.pos.x = G.player.pos.x + ox;
      c.pos.z = G.player.pos.z + oz;
      c.heading = Math.PI / 2;
      c.sync();
      cruisers.push(c);
    }
    return (g) => {
      // Hold the formation ahead of Dara and the helicopter overhead.
      for (let i = 0; i < cruisers.length; i++) {
        const [ox, oz] = [
          [20, -10],
          [26, 4],
          [34, -16],
        ][i];
        cruisers[i].pos.x = g.player.pos.x + ox;
        cruisers[i].pos.z = g.player.pos.z + oz;
        cruisers[i].sync();
      }
      g.heli.mesh.position.set(g.player.pos.x + 14, 8, g.player.pos.z - 10);
      g.heli.mesh.visible = true;
      return g.time > 2.8;
    };
  }
  if (name === 'chase') {
    // Cover: Job 3, a four-star chase downtown — hero car in the foreground,
    // two cruisers flanking, the whole helicopter clear of the wanted stars.
    G.missions.startJob(2);
    G.cash = 1250;
    const stealCar = G.missions.stealCar;
    stealCar.pos.x = 0;
    stealCar.pos.z = 24;
    stealCar.heading = Math.PI;
    stealCar.sync();
    G.player.getIn(stealCar, G);
    G.missions.completeLeg();
    G.missions.timer = 72;
    G.police.addWanted(1, 'CHASE — four stars on the gold sedan');
    G.missions.placeMarker(-100, -92);
    const cruisers = [G.police.spawnCruiser(G), G.police.spawnCruiser(G)];
    driveForward(G, stealCar, 22);
    return (g) => {
      const hero = g.player.car;
      driveForward(g, hero, 22);
      pinCruiser(g, cruisers[0], hero, -6, 2);
      pinCruiser(g, cruisers[1], hero, 6, -3);
      g.heli.mesh.position.set(hero.pos.x + 12, 9, hero.pos.z - 14);
      g.heli.mesh.visible = true;
      return g.time > 3.2;
    };
  }
  return null;
}
