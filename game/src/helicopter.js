// The helicopter: from 4 stars up it hangs over Dara, its searchlight cone
// tracking the player, and its rotor is the sound of the heat not going away.
import * as THREE from 'three';

export function createHelicopter(scene) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.1, 4.2),
    new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.5, metalness: 0.5 }),
  );
  body.castShadow = true;
  group.add(body);
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 3.4),
    new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.5 }),
  );
  tail.position.set(0, 0.2, -3.4);
  group.add(tail);
  const rotor = new THREE.Mesh(
    new THREE.BoxGeometry(9, 0.08, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 }),
  );
  rotor.position.y = 0.8;
  group.add(rotor);
  // Searchlight: a translucent cone plus a real spotlight aimed at the player.
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(3.2, 26, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xfff2b0,
      transparent: true,
      opacity: 0.18,
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
  group.visible = false;
  scene.add(group);
  return {
    mesh: group,
    update(dt, G) {
      const active = G.police.wanted >= 4;
      group.visible = active;
      if (!active) return;
      const p = G.player.onFoot ? G.player.pos : G.player.car.pos;
      // Hang ahead of the player so the searchlight cone is in the chase frame.
      const heading = G.player.onFoot ? G.player.heading : G.player.car.heading;
      const tx = p.x + Math.sin(heading) * 30;
      const tz = p.z + Math.cos(heading) * 30;
      group.position.x += (tx - group.position.x) * Math.min(1, dt * 0.8);
      group.position.z += (tz - group.position.z) * Math.min(1, dt * 0.8);
      group.position.y = 24 + Math.sin(G.time * 0.7) * 1.5;
      group.rotation.y = Math.atan2(p.x - group.position.x, p.z - group.position.z);
      rotor.rotation.y += dt * 22;
      spot.target.position.set(p.x - group.position.x, -26, p.z - group.position.z);
    },
  };
}
