// Pedestrians: walkers on the sidewalks who stroll between random corners and
// run when a fast car — the player's, or a police cruiser — bears down on them.
import { PEDS } from './config.js';
import { makePersonMesh } from './player.js';
import { clampToWorld } from './city.js';

const JACKETS = [0xc94f4f, 0x4f7ec9, 0xd9c24f, 0x7a4fc9, 0x4fc97a, 0xe8e8e8, 0x333338, 0x2e8a7a, 0xe8a13a];

function sidewalkPoint(rng, city) {
  const street = rng.pick(city.streets);
  const along = rng.range(-150, 150);
  const side = rng.next() < 0.5 ? 7.5 : -7.5;
  if (rng.next() < 0.5) return { x: along, z: street + side };
  return { x: street + side, z: along };
}

export function createPedestrians(scene, rng, city) {
  const peds = [];
  for (let i = 0; i < PEDS.count; i++) {
    const p = sidewalkPoint(rng, city);
    const mesh = makePersonMesh(rng.pick(JACKETS));
    // A little height variation so the crowd is not one repeated cutout.
    mesh.scale.setScalar(rng.range(0.95, 1.05));
    scene.add(mesh);
    peds.push({
      mesh,
      pos: { x: p.x, z: p.z },
      target: sidewalkPoint(rng, city),
      speed: rng.range(1.1, 2.0),
      fleeing: false,
      phase: rng.range(0, 6),
    });
  }
  return {
    count: peds.length,
    update(dt, G) {
      const threat = G.player.onFoot ? null : G.player.car;
      for (const p of peds) {
        // Flee from a fast car or a nearby police cruiser.
        let fx = 0;
        let fz = 0;
        let flee = false;
        const sources = [];
        if (threat && Math.abs(threat.speed) > 4) sources.push(threat.pos);
        for (const cruiser of G.police.cruisers) sources.push(cruiser.pos);
        for (const s of sources) {
          const dx = p.pos.x - s.x;
          const dz = p.pos.z - s.z;
          const d = Math.hypot(dx, dz);
          if (d < 9) {
            flee = true;
            fx += dx / (d || 1);
            fz += dz / (d || 1);
          }
        }
        p.fleeing = flee;
        let tx;
        let tz;
        let speed = p.speed;
        if (flee) {
          const l = Math.hypot(fx, fz) || 1;
          tx = p.pos.x + (fx / l) * 10;
          tz = p.pos.z + (fz / l) * 10;
          speed = 4.6;
        } else {
          tx = p.target.x;
          tz = p.target.z;
          if (Math.hypot(tx - p.pos.x, tz - p.pos.z) < 2) p.target = sidewalkPoint(rng, city);
        }
        const dx = tx - p.pos.x;
        const dz = tz - p.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.05) {
          p.pos.x += (dx / d) * speed * dt;
          p.pos.z += (dz / d) * speed * dt;
          p.mesh.rotation.y = Math.atan2(dx, dz);
          p.phase += dt * speed * 1.6;
        }
        clampToWorld(p.pos, 0.5);
        p.mesh.position.set(p.pos.x, 0, p.pos.z);
        const swing = d > 0.05 ? Math.sin(p.phase) * 0.5 : 0;
        p.mesh.userData.legs[0].rotation.x = swing;
        p.mesh.userData.legs[1].rotation.x = -swing;
      }
    },
  };
}
