// The helicopter: from 4 stars up it hangs over Dara, its searchlight cone
// tracking the player, and its rotor is the sound of the heat not going away.
// It flies low and close — a pale body with a red beacon — so it reads
// against the dusk sky instead of hiding in it.
import * as THREE from 'three';

export function createHelicopter(scene) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.1, 4.2),
    new THREE.MeshStandardMaterial({
      color: 0x8a8fa0,
      roughness: 0.4,
      metalness: 0.4,
      emissive: 0x707080,
      emissiveIntensity: 0.8,
    }),
  );
  body.castShadow = true;
  group.add(body);
  // A red belt around the whole body — slightly larger than the body on
  // every side, so the stripe reads from the front, the flank and above,
  // instead of hiding flush inside the body's faces.
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 0.5, 4.3),
    new THREE.MeshStandardMaterial({
      color: 0xff3344,
      roughness: 0.5,
      emissive: 0xff2233,
      emissiveIntensity: 1.6,
    }),
  );
  stripe.position.set(0, 0.1, 0);
  group.add(stripe);
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff2222 }),
  );
  beacon.position.set(0, 0.95, 0);
  group.add(beacon);
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 3.4),
    new THREE.MeshStandardMaterial({ color: 0x8a8fa0, roughness: 0.5 }),
  );
  tail.position.set(0, 0.2, -3.4);
  group.add(tail);
  const rotor = new THREE.Mesh(
    new THREE.BoxGeometry(9, 0.08, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 }),
  );
  rotor.position.y = 0.8;
  group.add(rotor);
  // A blurred rotor disc: the thin box alone reads as a stick in a still
  // frame; the translucent disc is what a helicopter rotor looks like in a
  // photograph, and it catches the sun.
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(4.6, 24),
    new THREE.MeshBasicMaterial({
      color: 0x222226,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.82;
  group.add(disc);
  // Searchlight: a translucent cone plus a real spotlight aimed at the player.
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(3.2, 26, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xfff2b0,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  cone.position.y = -13;
  cone.rotation.x = Math.PI;
  group.add(cone);
  const spot = new THREE.SpotLight(0xfff2b0, 300, 60, 0.32, 0.5, 1.2);
  group.add(spot);
  group.add(spot.target);
  // The pool of light on the ground under the beam — the cone alone floats
  // in the air; the pool anchors it to the street.
  const poolTex = (() => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,242,176,0.9)');
    grad.addColorStop(1, 'rgba(255,242,176,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(5, 24),
    new THREE.MeshBasicMaterial({
      map: poolTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.6,
    }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.07;
  pool.visible = false;
  scene.add(pool);
  group.visible = false;
  scene.add(group);
  return {
    mesh: group,
    update(dt, G) {
      const active = G.police.wanted >= 4;
      group.visible = active;
      pool.visible = active;
      if (!active) return;
      const p = G.player.onFoot ? G.player.pos : G.player.car.pos;
      // Hang just ahead of the player, low enough to stay in the chase
      // camera's frame, so the body — not only the beam — is on screen.
      const heading = G.player.onFoot ? G.player.heading : G.player.car.heading;
      const tx = p.x + Math.sin(heading) * 20;
      const tz = p.z + Math.cos(heading) * 20;
      group.position.x += (tx - group.position.x) * Math.min(1, dt * 0.8);
      group.position.z += (tz - group.position.z) * Math.min(1, dt * 0.8);
      group.position.y = 17 + Math.sin(G.time * 0.7) * 1.5;
      group.rotation.y = Math.atan2(p.x - group.position.x, p.z - group.position.z);
      rotor.rotation.y += dt * 22;
      beacon.scale.setScalar(1 + 0.35 * Math.sin(G.time * 6));
      // The light pool stays glued to the ground under the player, tracking
      // the beam's target rather than the helicopter's bob.
      pool.position.set(p.x, 0.07, p.z);
      spot.target.position.set(p.x - group.position.x, -26, p.z - group.position.z);
    },
  };
}
