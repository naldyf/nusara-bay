// Pedestrians: walkers on the sidewalks who stroll between random corners and
// run when a fast car — the player's, or a police cruiser — bears down on them.
import { PEDS } from './config.js';
import { makePersonMesh } from './player.js';
import { clampToWorld } from './city.js';

// Pedestrian jackets. Dara's amber (0xe8a13a) is deliberately NOT here —
// Dara must be the only amber jacket in any frame, so the player always
// reads as the player in a crowd.
const JACKETS = [0xc94f4f, 0x4f7ec9, 0xd9c24f, 0x7a4fc9, 0x4fc97a, 0xe8e8e8, 0x333338, 0x2e8a7a];

function sidewalkPoint(rng, city) {
  const street = rng.pick(city.streets);
  const along = rng.range(-150, 150);
  const side = rng.next() < 0.5 ? 7.5 : -7.5;
  return rng.next() < 0.5 ? { x: along, z: street + side } : { x: street + side, z: along };
}

export function createPedestrians(scene, rng, city) {
  const walkers = [];
  for (let i = 0; i < PEDS.count; i++) {
    const mesh = makePersonMesh(rng.pick(JACKETS), rng.pick([0xc98a5f, 0x8a5f3d, 0xe8b98a]), false);
    scene.add(mesh);
    const start = sidewalkPoint(rng, city);
    walkers.push({
      mesh,
      pos: { x: start.x, z: start.z },
      target: sidewalkPoint(rng, city),
      speed: rng.range(1.2, 2.2),
      phase: rng.range(0, Math.PI * 2),
      fleeing: false,
    });
  }
  // The flee vector: the sum of the away-directions of every fast car
  // within 8 units, normalised. Zero when nothing is threatening.
  function fleeDirection(w, G) {
    let fx = 0;
    let fz = 0;
    const threats = [...G.traffic.cars, ...G.police.cruisers, ...(G.player.car ? [G.player.car] : [])];
    for (const car of threats) {
      const cdx = w.pos.x - car.pos.x;
      const cdz = w.pos.z - car.pos.z;
      const cd = Math.hypot(cdx, cdz);
      if (cd < 8 && Math.abs(car.speed) > 8) {
        fx += cdx / (cd || 1);
        fz += cdz / (cd || 1);
      }
    }
    if (fx === 0 && fz === 0) return null;
    const fl = Math.hypot(fx, fz);
    return { x: fx / fl, z: fz / fl };
  }

  // Walk the legs (and arms, when the mesh has them) in time with the
  // pace, and face the direction of travel.
  function animateWalk(w, mx, mz, pace, dt) {
    w.phase += dt * pace * 2;
    const swing = Math.sin(w.phase) * 0.5;
    w.mesh.userData.legs[0].rotation.x = swing;
    w.mesh.userData.legs[1].rotation.x = -swing;
    if (w.mesh.userData.arms) {
      w.mesh.userData.arms[0].rotation.x = -swing * 0.6;
      w.mesh.userData.arms[1].rotation.x = swing * 0.6;
    }
    w.mesh.position.set(w.pos.x, 0, w.pos.z);
    w.mesh.rotation.y = Math.atan2(mx, mz);
  }

  return {
    // Walk toward the target corner; on arrival, pick a new one. A car
    // closing fast makes the walker run away from it for a few seconds.
    update(dt, G) {
      for (const w of walkers) {
        const dx = w.target.x - w.pos.x;
        const dz = w.target.z - w.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 1) {
          w.target = sidewalkPoint(rng, city);
          continue;
        }
        // Flee: a car within 8 units and closing at speed 8+ scares the walker.
        const flee = fleeDirection(w, G);
        let mx;
        let mz;
        let pace = w.speed;
        if (flee) {
          mx = flee.x;
          mz = flee.z;
          pace = 5.5;
          w.fleeing = true;
        } else {
          mx = dx / dist;
          mz = dz / dist;
          w.fleeing = false;
        }
        w.pos.x += mx * pace * dt;
        w.pos.z += mz * pace * dt;
        clampToWorld(w.pos, 0.5);
        animateWalk(w, mx, mz, pace, dt);
      }
    },
  };
}
