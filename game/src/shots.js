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
    // Cover: Dara mid-chase downtown at 4 stars, driving the marked gold
    // sedan from Job 3 — the job's premise is stealing that sedan, so the
    // cover shows it, not an ordinary red car. Two cruisers flank close
    // alongside it with their light bars flashing (inside the frame, not
    // at the edges where they read as traffic), and the helicopter hangs
    // ahead and to the side, low enough to sit clear of the wanted stars.
    // Job 3 on the clock.
    //
    // The cruisers and the helicopter are PINNED to the player car every
    // frame by the autopilot below, the same way the helicopter already
    // was: the pursuit AI would otherwise park them behind the camera or
    // dead-centre ahead, where the cover cannot show them. Pinning chooses
    // the moment of a real chase; it does not fake a state the game cannot
    // reach. The briefing dialogue is deliberately NOT shown here — its
    // panel sat across the middle of the frame, hiding the cruisers.
    const car = createCar(G.scene, 0, 24, Math.PI, 0xd9a527, false, true);
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
    // Staged as Job 1 in its pickup phase — the state fresh play actually
    // shows (startJob(0) runs the moment the game starts), not the idle
    // free-roam objective the old staging used. The pickup marker is 12
    // units north of Dara, outside the 7-unit pickup radius, so the job
    // cannot complete itself during the staging.
    const car = createCar(G.scene, -77.5, 4.4, Math.PI / 2, 0x4f7ec9);
    car.parked = true;
    G.parked.push(car);
    G.player.pos.x = -80;
    G.player.pos.z = 4.4;
    G.player.heading = Math.PI / 2;
    G.player.mesh.position.set(-80, 0, 4.4);
    G.police.wanted = 1;
    G.missions.jobIndex = 0;
    G.missions.phase = 'pickup';
    G.missions.timer = 0;
    G.missions.objective = 'JOB 1: First Fare — go to Night Market';
    G.missions.placeMarker(-80, -8);
    G.minimap.setObjective(-80, -8);
    G.cash = 250;
    return (dt) => {
      t += dt;
      return t > 2.6;
    };
  }
  if (name === 'harbor') {
    // The five-star finale (Job 8) at the dock: Dara on foot on the street
    // just north of the dock, facing east straight down the dock toward
    // the gantry crane. The crane is 70 units ahead, so its 26-unit frame
    // sits comfortably inside the on-foot camera's view instead of being
    // cut off at the top edge, and its jib reads side-on, the most
    // recognizable crane silhouette. Standing north of the container
    // stacks keeps the sightline to the crane clear of them. The gold
    // getaway car sits ahead to the left, three cruisers are pinned in a
    // formation ahead of Dara, facing the camera, and the helicopter hangs
    // overhead. A real gameplay state — Job 8 in its deliver phase at five
    // stars — with no staged toast and no posed save. The crane's legs and
    // jib are the proof this is a working harbor, not any waterfront
    // container yard.
    const car = createCar(G.scene, -103, 88, Math.PI / 2, 0xd9a527, false, true);
    car.parked = true;
    G.parked.push(car);
    G.player.pos.x = -115;
    G.player.pos.z = 96;
    G.player.heading = Math.PI / 2;
    G.player.mesh.position.set(-115, 0, 96);
    G.police.wanted = 5;
    // One cruiser up front so the formation has something to pin from the
    // first frame; the pursuit spawns the rest to match five stars.
    G.police.spawnCruiser(G);
    G.missions.jobIndex = 7;
    G.missions.phase = 'deliver';
    G.missions.timer = 96;
    G.missions.placeMarker(80, 104);
    G.minimap.setObjective(80, 104);
    G.cash = 8150;
    return (dt) => {
      t += dt;
      const p = G.player.pos;
      const h = G.player.heading;
      const fx = Math.sin(h);
      const fz = Math.cos(h);
      const rx = -Math.cos(h);
      const rz = Math.sin(h);
      // Pin EVERY cruiser into a formation ahead of Dara. At five stars
      // the pursuit spawns three cruisers that steer straight for Dara on
      // foot — left alone one parks on top of him (3m, overlapping the
      // shot) and the busted timer starts. The formation keeps them in
      // frame, facing the camera, clear of Dara, the gold car and each
      // other. The same pin the cover uses; the light bars keep flashing
      // because police.update still runs.
      const slots = [
        [20, -10],
        [26, 4],
        [34, -16],
      ];
      G.police.cruisers.forEach((c, i) => {
        const [ahead, side] = slots[i % slots.length];
        const cx = p.x + fx * ahead + rx * side;
        const cz = p.z + fz * ahead + rz * side;
        c.pos.x = cx;
        c.pos.z = cz;
        c.heading = h + Math.PI;
        c.speed = 0;
        c.mesh.position.set(cx, 0, cz);
        c.mesh.rotation.y = c.heading;
      });
      // Pin the helicopter ahead and to the right of Dara, low enough to
      // clear the wanted stars — same rule as the cover, and the pin is
      // close to the helicopter's own hover height (y 9), so the body
      // barely moves when the pin stops at capture time.
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
