// Combat, v1 scope: a pistol on foot. Aim where Dara faces, pull the trigger,
// and the nearest police cruiser in the cone takes a hit — three hits disables
// it. Ramming a cruiser at speed counts too (see police.js).
import * as THREE from 'three';
import { ACTION_SHOOT } from './input.js';

export function createCombat(scene, G) {
  const tracerGeo = new THREE.BoxGeometry(0.06, 0.06, 1);
  const tracerMat = new THREE.MeshBasicMaterial({
    color: 0xffe9a8,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  // A tracer is a stretched box from the muzzle to the hit point, shown for
  // a fraction of a second. A pool of them is reused, never allocated.
  const tracers = [];
  for (let i = 0; i < 8; i++) {
    const t = new THREE.Mesh(tracerGeo, tracerMat.clone());
    t.visible = false;
    scene.add(t);
    tracers.push({ mesh: t, life: 0 });
  }
  let tracerIdx = 0;
  const hits = new Map();

  // A tracer is a stretched box from the muzzle to the hit point, shown for
  // a fraction of a second. A pool of them is reused, never allocated.
  function shootTracer(from, to) {
    const t = tracers[tracerIdx];
    tracerIdx = (tracerIdx + 1) % tracers.length;
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
    t.mesh.position.copy(mid);
    t.mesh.lookAt(to);
    t.mesh.scale.set(1, 1, len);
    t.mesh.visible = true;
    t.life = 0.12;
  }

  // The nearest live cruiser inside the firing cone (0.35 rad, 40 units),
  // or null. The angle is measured between Dara's facing and the cruiser.
  function findCruiserInCone(p, fx, fz) {
    let best = null;
    let bestD = 40;
    for (const cruiser of G.police.cruisers) {
      if (cruiser.dead) continue;
      const dx = cruiser.pos.x - p.x;
      const dz = cruiser.pos.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 40) continue;
      const angle = Math.abs(Math.atan2(dx * fz - dz * fx, dx * fx + dz * fz));
      if (angle < 0.35 && d < bestD) {
        bestD = d;
        best = cruiser;
      }
    }
    return best;
  }

  // Three hits disables a cruiser: it is dead, removed from the scene, and
  // leaves a smoke plume where it was.
  function disableCruiser(cruiser) {
    cruiser.dead = true;
    cruiser.remove();
    G.police.cruisers = G.police.cruisers.filter((c) => c !== cruiser);
    G.effects.spawnSmoke(cruiser.pos.x, cruiser.pos.z, 8);
  }

  return {
    // Fire once per trigger press. The muzzle is Dara's right hand; the
    // cone is 0.35 radians wide and 40 units deep, so a cruiser has to be
    // roughly in front of her. Three hits and it is dead.
    update(dt, input) {
      for (const t of tracers) {
        if (t.life <= 0) continue;
        t.life -= dt;
        if (t.life <= 0) t.mesh.visible = false;
      }
      if (!G.player.onFoot) return;
      if (!input.action(ACTION_SHOOT) && !input.mouseDown()) return;
      const p = G.player.pos;
      const fx = Math.sin(G.player.heading);
      const fz = Math.cos(G.player.heading);
      const from = new THREE.Vector3(p.x + fx * 0.5, 1.2, p.z + fz * 0.5);
      const to = new THREE.Vector3(p.x + fx * 40, 1.2, p.z + fz * 40);
      G.effects.muzzleFlash(from.x, from.y, from.z);
      G.audio.gunshot();
      shootTracer(from, to);
      const best = findCruiserInCone(p, fx, fz);
      if (best) {
        const n = (hits.get(best) || 0) + 1;
        hits.set(best, n);
        G.hud.toast(n >= 3 ? 'CRUISER DISABLED' : `HIT — cruiser ${n}/3`);
        if (n >= 3) disableCruiser(best);
      }
    },
  };
}
