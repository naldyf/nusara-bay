// The helicopter: from 4 stars up it hangs over Dara, its searchlight cone
// tracking the player, and its rotor is the sound of the heat not going away.
// It flies low and close — a pale body with a red beacon — so it reads
// against the dusk sky instead of hiding in it.
import * as THREE from 'three';

// One mesh, placed, added to a parent. Returns it so the caller can keep
// the moving parts (rotor, tail rotor, beacon, cone, spotlight).
function part(geo, mat, parent, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

export function createHelicopter(scene) {
  const group = new THREE.Group();
  const pale = new THREE.MeshStandardMaterial({ color: 0xb9c0cc, roughness: 0.4, metalness: 0.4 });
  const grey = new THREE.MeshStandardMaterial({ color: 0x9aa0ac, roughness: 0.5, metalness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.5, metalness: 0.6 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x101824, roughness: 0.08, metalness: 0.45, clearcoat: 1 });

  // A pale fuselage so the helicopter reads against the purple sky instead
  // of dissolving into it. The old grey (0x8a8fa0) was too dark at this sun
  // angle; the pale body also carries the red belt and beacon.
  const body = part(new THREE.BoxGeometry(2.2, 1.1, 4.2), pale, group, 0, 0, 0);
  body.castShadow = true;
  part(new THREE.BoxGeometry(0.7, 0.7, 4.6), grey, group, 0, 0.2, -4.2);
  part(new THREE.BoxGeometry(0.2, 1.6, 1.2), grey, group, 0, 0.9, -6.2);
  part(new THREE.BoxGeometry(1.8, 0.7, 1.6), glass, group, 0, 0.4, 1.4);
  part(
    new THREE.BoxGeometry(2.24, 0.25, 4.24),
    new THREE.MeshStandardMaterial({ color: 0xd92626, roughness: 0.5, metalness: 0.3 }),
    group,
    0,
    -0.1,
    0,
  );
  const beacon = part(
    new THREE.SphereGeometry(0.18, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 3 }),
    group,
    0,
    0.75,
    0,
  );
  part(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 6), dark, group, 0, 0.8, 0);

  // The main rotor: two crossed blades on a mast.
  const rotor = new THREE.Group();
  rotor.position.y = 1.05;
  const bladeGeo = new THREE.BoxGeometry(7.2, 0.06, 0.4);
  part(bladeGeo, dark, rotor, 0, 0, 0);
  const bladeB = part(bladeGeo, dark, rotor, 0, 0, 0);
  bladeB.rotation.y = Math.PI / 2;
  group.add(rotor);

  // The tail rotor: two small crossed blades on the fin.
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.5, 0.6, -6.4);
  const tailBladeGeo = new THREE.BoxGeometry(1.6, 0.08, 0.25);
  part(tailBladeGeo, dark, tailRotor, 0, 0, 0);
  const tailBladeB = part(tailBladeGeo, dark, tailRotor, 0, 0, 0);
  tailBladeB.rotation.x = Math.PI / 2;
  group.add(tailRotor);

  // The searchlight: a cone mesh plus a real spotlight, both tracking the
  // player. The cone is additive and faint — it reads as a beam, not a wall.
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfff2c6,
    transparent: true,
    opacity: 0.12,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const cone = part(new THREE.ConeGeometry(3.5, 14, 16, 1, true), coneMat, group, 0, -7, 0);
  const spot = new THREE.SpotLight(0xfff2c6, 80, 40, 0.35, 0.5, 1.2);
  spot.position.set(0, -0.5, 0);
  group.add(spot);
  group.add(spot.target);

  group.visible = false;
  scene.add(group);

  const heli = {
    mesh: group,
    rotor,
    tailRotor,
    cone,
    spot,
    beacon,
    // Hover above the player, searchlight on them, rotors spinning. The
    // helicopter drifts toward the player and holds a fixed height above
    // the ground, so it never clips a tower.
    update(dt, G) {
      const wanted = G.police.wanted;
      const show = wanted >= 4;
      this.mesh.visible = show;
      if (!show) return;
      const p = G.player.onFoot ? G.player.pos : G.player.car.pos;
      const tx = p.x + 6;
      const tz = p.z - 6;
      this.mesh.position.x += (tx - this.mesh.position.x) * Math.min(1, dt * 1.2);
      this.mesh.position.z += (tz - this.mesh.position.z) * Math.min(1, dt * 1.2);
      this.mesh.position.y = 12 + Math.sin(G.time * 0.8) * 0.8;
      this.mesh.rotation.y = Math.atan2(p.x - this.mesh.position.x, p.z - this.mesh.position.z);
      this.rotor.rotation.y += dt * 22;
      this.tailRotor.rotation.x += dt * 30;
      this.beacon.material.emissiveIntensity = Math.floor(G.time * 4) % 2 === 0 ? 3 : 0.2;
      // Point the cone and the spotlight at the player.
      this.spot.target.position.set(p.x - this.mesh.position.x, -this.mesh.position.y, p.z - this.mesh.position.z);
      this.cone.lookAt(p.x, 0, p.z);
      this.cone.rotateX(-Math.PI / 2);
    },
  };
  return heli;
}
