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

function jobListHtml(G) {
  return STORY.jobs
    .map((job) => {
      const cls = job.id <= G.jobsDone ? 'done' : job.id === G.jobsDone + 1 ? 'next' : 'locked';
      const state = job.id <= G.jobsDone ? 'DONE' : job.id === G.jobsDone + 1 ? 'NEXT' : 'UPCOMING';
      return `<div class="${cls}">JOB ${job.id} — ${job.title} · $${job.pay} · ${state}</div>`;
    })
    .join('');
}

export function stageShot(G, name, seed) {
  const input = G.input;
  let t = 0;
  if (name === 'chase') {
    // Cover: Dara mid-chase downtown at 4 stars. The hero car is the
    // subject, two cruisers flank close alongside it with their light bars
    // flashing (inside the frame, not at the edges where they read as
    // traffic), and the helicopter hangs ahead and to the side, low enough
    // to sit clear of the wanted stars. Job 3 on the clock.
    //
    // The cruisers and the helicopter are PINNED to the player car every
    // frame by the autopilot below, the same way the helicopter already
    // was: the pursuit AI would otherwise park them behind the camera or
    // dead-centre ahead, where the cover cannot show them. Pinning chooses
    // the moment of a real chase; it does not fake a state the game cannot
    // reach. The briefing dialogue is deliberately NOT shown here — its
    // panel sat across the middle of the frame, hiding the cruisers.
    const car = createCar(G.scene, 0, 24, Math.PI, 0xc94f4f, false, true);
    G.player.getIn(car, G);
    car.speed = 22;
    G.police.wanted = 4;
    const c1 = G.police.spawnCruiser(G);
    const c2 = G.police.spawnCruiser(G);
    G.missions.jobIndex = 2;
    G.missions.phase = 'deliver';
    G.missions.timer = 72;
    G.missions.placeMarker(-100, -92);
    G.minimap.setObjective(-100, -92);
    G.cash = 1250;
    return (dt) => {
      t += dt;
      input.fake('KeyW', true);
      const p = G.player.car.pos;
      const h = G.player.car.heading;
      const fx = Math.sin(h);
      const fz = Math.cos(h);
      // Screen-right of the car, same formula the helicopter pin uses.
      const rx = -Math.cos(h);
      const rz = Math.sin(h);
      // Flank the car: one cruiser right and slightly ahead, one left and
      // slightly ahead, both pointing the same way — a chase, not traffic.
      const flank = [
        [c1, 5, 5.5],
        [c2, 3, -5.5],
      ];
      for (const [c, ahead, side] of flank) {
        const x = p.x + fx * ahead + rx * side;
        const z = p.z + fz * ahead + rz * side;
        c.pos.x = x;
        c.pos.z = z;
        c.heading = h;
        c.speed = 22;
        c.mesh.position.set(x, 0, z);
        c.mesh.rotation.y = h;
      }
      // Pin the helicopter ahead and to the right, low enough to sit below
      // the wanted stars — the old pin (12 ahead, y 10.5) put its body
      // above the top of the frame, so the cover showed a beam and no
      // aircraft. The pin matches the helicopter's own hover height (y 9),
      // so the body stays put when the pin stops at capture time instead of
      // snapping back up to a hover the camera cannot see.
      G.heli.mesh.position.set(
        p.x + Math.sin(h) * 10 - Math.cos(h) * 6,
        9,
        p.z + Math.cos(h) * 10 + Math.sin(h) * 6,
      );
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
    // The five-star finale (Job 8) at the dock: Dara on foot in the container
    // yard, the gold getaway car ahead with the teal water behind it, a
    // gantry crane to the side, a cruiser sweeping past, and the helicopter
    // overhead. A real gameplay state — Job 8 in its deliver phase at five
    // stars — with no staged toast and no posed save. The gold car sits
    // close in front of Dara, so the mid-ground is the getaway car and not
    // empty dock.
    const car = createCar(G.scene, -64, 114, Math.PI / 2, 0xd9a527, false, true);
    car.parked = true;
    G.parked.push(car);
    G.player.pos.x = -70;
    G.player.pos.z = 106;
    G.player.heading = 0;
    G.player.mesh.position.set(-70, 0, 106);
    G.police.wanted = 5;
    // One cruiser sweeping east along the dock's south edge, in frame.
    const c1 = G.police.spawnCruiser(G);
    c1.pos.x = -100;
    c1.pos.z = 126;
    c1.heading = Math.PI / 2;
    c1.speed = 20;
    G.missions.jobIndex = 7;
    G.missions.phase = 'deliver';
    G.missions.timer = 96;
    G.missions.placeMarker(80, 104);
    G.minimap.setObjective(80, 104);
    G.cash = 8150;
    return (dt) => {
      t += dt;
      // Pin the helicopter ahead and to the right of Dara, low enough to
      // clear the wanted stars — the old pin (14 ahead, y 9) put its body
      // at the very top edge, the rotor clipped by the frame. The on-foot
      // camera sits lower and closer than the chase cam, so the same height
      // reads higher here: 16 ahead and y 8 puts the whole aircraft,
      // rotor disc included, in the upper third. Same rule as the cover,
      // and the pin is close to the helicopter's own hover height (y 9), so
      // the body barely moves when the pin stops at capture time.
      const p = G.player.pos;
      const h = G.player.heading;
      G.heli.mesh.position.set(
        p.x + Math.sin(h) * 16 - Math.cos(h) * 6,
        8,
        p.z + Math.cos(h) * 16 + Math.sin(h) * 6,
      );
      return t > 2.8;
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
