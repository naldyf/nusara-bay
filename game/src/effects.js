// Skid smoke, muzzle flashes and the shake that sells speed and impacts.
// Everything is pooled up front — nothing is allocated inside the frame
// loop, so a long chase never stutters on garbage collection.
import * as THREE from 'three';

function puffTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const g = canvas.getContext('2d');
  const fade = g.createRadialGradient(32, 32, 4, 32, 32, 30);
  // Warm dusk smoke, lit by the low sun rather than grey-blue.
  fade.addColorStop(0, 'rgba(232,200,168,0.55)');
  fade.addColorStop(1, 'rgba(232,200,168,0)');
  g.fillStyle = fade;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

export function createEffects(scene, rng) {
  // Smoke drifts off the seeded stream when one is given, so staged frames
  // stay reproducible; live play passes its own stream too. Without one,
  // fall back to Math.random.
  const draw = rng ? () => rng.next() : Math.random;
  const tex = puffTexture();
  // The pool: 48 sprites, built once, reused forever — nothing is allocated
  // inside the frame loop, so a long chase never stutters on collection.
  const pool = Array.from({ length: 48 }, () => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false }),
    );
    sprite.visible = false;
    scene.add(sprite);
    return { sprite, life: 0, vx: 0, vy: 0, vz: 0 };
  });
  const flash = new THREE.PointLight(0xffd27a, 0, 12);
  scene.add(flash);

  function placePuff(p, x, z) {
    p.life = 0.9;
    p.sprite.visible = true;
    p.sprite.position.set(x + (draw() - 0.5) * 1.5, 0.4, z + (draw() - 0.5) * 1.5);
    p.sprite.scale.set(1.6, 1.6, 1);
    p.vx = (draw() - 0.5) * 1.5;
    p.vy = 0.8 + draw();
    p.vz = (draw() - 0.5) * 1.5;
  }

  return {
    spawnSmoke(x, z, count = 4) {
      let placed = 0;
      for (const p of pool) {
        if (placed >= count) break;
        if (p.life > 0) continue;
        placePuff(p, x, z);
        placed++;
      }
    },
    muzzleFlash(x, y, z) {
      flash.position.set(x, y, z);
      flash.intensity = 60;
    },
    update(dt) {
      for (const p of pool) {
        if (p.life <= 0) continue;
        p.life -= dt;
        p.sprite.position.x += p.vx * dt;
        p.sprite.position.y += p.vy * dt;
        p.sprite.position.z += p.vz * dt;
        const grown = p.sprite.scale.x + dt * 2.2;
        p.sprite.scale.set(grown, grown, 1);
        p.sprite.material.opacity = Math.max(0, p.life * 0.6);
        if (p.life <= 0) p.sprite.visible = false;
      }
      flash.intensity = Math.max(0, flash.intensity - dt * 400);
    },
  };
}
