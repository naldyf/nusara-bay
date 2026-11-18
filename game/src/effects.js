// Effects: skid smoke puffs, muzzle flashes, and the screen shake that sells
// speed and impacts. All pooled — nothing is created inside the frame loop.
import * as THREE from 'three';

function smokeTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(200,200,210,0.55)');
  grad.addColorStop(1, 'rgba(200,200,210,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function createEffects(scene) {
  const tex = smokeTexture();
  const pool = [];
  for (let i = 0; i < 48; i++) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false }),
    );
    sprite.visible = false;
    scene.add(sprite);
    pool.push({ sprite, life: 0, vx: 0, vy: 0, vz: 0 });
  }
  const flashLight = new THREE.PointLight(0xffd27a, 0, 12);
  scene.add(flashLight);
  return {
    spawnSmoke(x, z, n = 4) {
      let made = 0;
      for (const p of pool) {
        if (made >= n) break;
        if (p.life > 0) continue;
        p.life = 0.9;
        p.sprite.visible = true;
        p.sprite.position.set(x + (Math.random() - 0.5) * 1.5, 0.4, z + (Math.random() - 0.5) * 1.5);
        p.sprite.scale.set(1.6, 1.6, 1);
        p.vx = (Math.random() - 0.5) * 1.5;
        p.vy = 0.8 + Math.random();
        p.vz = (Math.random() - 0.5) * 1.5;
        made++;
      }
    },
    muzzleFlash(x, y, z) {
      flashLight.position.set(x, y, z);
      flashLight.intensity = 60;
    },
    update(dt) {
      for (const p of pool) {
        if (p.life <= 0) continue;
        p.life -= dt;
        p.sprite.position.x += p.vx * dt;
        p.sprite.position.y += p.vy * dt;
        p.sprite.position.z += p.vz * dt;
        const s = p.sprite.scale.x + dt * 2.2;
        p.sprite.scale.set(s, s, 1);
        p.sprite.material.opacity = Math.max(0, p.life * 0.6);
        if (p.life <= 0) p.sprite.visible = false;
      }
      flashLight.intensity = Math.max(0, flashLight.intensity - dt * 400);
    },
  };
}
