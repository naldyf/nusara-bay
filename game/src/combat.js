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
  const tracers = [];
  let cooldown = 0;
  let wantedCooldown = 0;
  return {
    update(dt, input) {
      cooldown -= dt;
      wantedCooldown -= dt;
      for (let i = tracers.length - 1; i >= 0; i--) {
        const t = tracers[i];
        t.life -= dt * 3;
        t.mesh.material.opacity = Math.max(0, t.life);
        if (t.life <= 0) {
          scene.remove(t.mesh);
          tracers.splice(i, 1);
        }
      }
      if (!G.player.onFoot) return;
      if (!input.action(ACTION_SHOOT)) return;
      if (cooldown > 0) return;
      cooldown = 0.28;
      this.fireWeapon();
    },
    fireWeapon() {
      const p = G.player.pos;
      const h = G.player.heading;
      const fx = Math.sin(h);
      const fz = Math.cos(h);
      const from = new THREE.Vector3(p.x, 1.3, p.z);
      const to = new THREE.Vector3(p.x + fx * 26, 1.3, p.z + fz * 26);
      // Nearest cruiser inside a narrow cone ahead.
      let best = null;
      let bestD = 26;
      for (const c of G.police.cruisers) {
        const dx = c.pos.x - p.x;
        const dz = c.pos.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d > 26) continue;
        const dot = (dx * fx + dz * fz) / (d || 1);
        if (dot > 0.92 && d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (best) {
        to.set(best.pos.x, 0.9, best.pos.z);
        best.health -= 1;
        G.effects.spawnSmoke(best.pos.x, best.pos.z, 6);
        if (best.health <= 0) G.police.disableCruiser(best, G);
        if (wantedCooldown <= 0) {
          G.police.addWanted(1, 'WANTED — SHOTS FIRED');
          wantedCooldown = 5;
        }
      }
      const len = from.distanceTo(to);
      const tracer = new THREE.Mesh(tracerGeo, tracerMat.clone());
      tracer.scale.z = len;
      tracer.position.copy(from).lerp(to, 0.5);
      tracer.lookAt(to);
      scene.add(tracer);
      tracers.push({ mesh: tracer, life: 1 });
      G.effects.muzzleFlash(from.x, from.y, from.z);
      G.audio.gunshot();
      G.shake = Math.min(0.5, G.shake + 0.25);
    },
  };
}
