// Dara on foot: detailed stylized character with articulated limbs, readable kit,
// and natural walk/run animation. Compatible with pedestrians.js via userData.legs.
import * as THREE from 'three';
import { FOOT } from './config.js';
import { collideCircle, clampToWorld } from './city.js';
import { ACTION_ENTER } from './input.js';
import { makeHero } from './vehicles.js';

export function makePersonMesh(jacket = 0xe8a13a, skin = 0xc98a5f, kit = false) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const jacketMat = new THREE.MeshStandardMaterial({
    color: jacket,
    roughness: 0.62,
    metalness: 0.06,
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: kit ? 0xf2f4f8 : 0xd8dce3,
    roughness: 0.85,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: skin,
    roughness: 0.68,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: kit ? 0x222838 : 0x2c2c38,
    roughness: 0.82,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: kit ? 0xf0f2f5 : 0x1e1e24,
    roughness: 0.55,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1a1c24,
    roughness: 0.7,
    metalness: 0.15,
  });

  // --- Layered torso (jacket + inner shirt + collar + belt) ---
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.28), jacketMat);
  torso.position.y = 1.07;
  torso.castShadow = true;
  torso.receiveShadow = true;
  body.add(torso);

  const innerShirt = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.58, 0.295), shirtMat);
  innerShirt.position.set(0, 1.07, 0.005);
  body.add(innerShirt);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.08, 12), jacketMat);
  collar.position.y = 1.39;
  body.add(collar);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.53, 0.08, 0.3), darkMat);
  belt.position.y = 0.76;
  body.add(belt);

  // --- Neck & smooth head ---
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.12, 12), skinMat);
  neck.position.y = 1.44;
  body.add(neck);

  const headGroup = new THREE.Group();
  headGroup.position.y = 1.63;
  body.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 20, 16), skinMat);
  head.scale.set(0.95, 1.06, 0.98);
  head.castShadow = true;
  headGroup.add(head);

  if (kit) {
    // Dara's black shades, so the face direction reads at a glance.
    const shades = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.075, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x10141c, roughness: 0.15, metalness: 0.85 }),
    );
    shades.position.set(0, 0.02, 0.18);
    headGroup.add(shades);

    // Cyan cap + brim + accent strip.
    const capMat = new THREE.MeshStandardMaterial({
      color: 0x3ef0df,
      roughness: 0.45,
      emissive: 0x0b3a36,
      emissiveIntensity: 0.35,
    });
    const capDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.222, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
      capMat,
    );
    capDome.position.y = 0.05;
    capDome.castShadow = true;
    headGroup.add(capDome);

    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.035, 0.22), capMat);
    brim.position.set(0, 0.07, 0.22);
    brim.rotation.x = 0.08;
    headGroup.add(brim);

    // Tactical backpack + shoulder straps + reflective strip, so the
    // silhouette from behind reads clearly.
    const packMat = new THREE.MeshStandardMaterial({ color: 0x223645, roughness: 0.65 });
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.46, 0.17), packMat);
    pack.position.set(0, 1.08, -0.21);
    pack.castShadow = true;
    body.add(pack);

    const reflector = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.045, 0.02),
      new THREE.MeshStandardMaterial({
        color: 0x7cffef,
        emissive: 0x4deee0,
        emissiveIntensity: 0.9,
        roughness: 0.3,
      }),
    );
    reflector.position.set(0, 1.18, -0.3);
    body.add(reflector);

    for (const sx of [-0.15, 0.15]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.44, 0.33), darkMat);
      strap.position.set(sx, 1.12, -0.02);
      body.add(strap);
    }
  } else {
    // Simple hair for pedestrians so they don't read as plain bald.
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.218, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      darkMat,
    );
    hair.position.set(0, 0.03, -0.02);
    headGroup.add(hair);
  }

  // --- Arms hinged from the shoulders ---
  const arms = [];
  for (const side of [-1, 1]) {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.34, 1.32, 0);

    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.42, 12), jacketMat);
    sleeve.position.y = -0.21;
    sleeve.castShadow = true;
    armPivot.add(sleeve);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.072, 10, 8), skinMat);
    hand.position.y = -0.45;
    armPivot.add(hand);

    // Pistol in Dara's right hand.
    if (kit && side === 1) {
      const gunMetal = new THREE.MeshStandardMaterial({
        color: 0x1b1e26,
        roughness: 0.28,
        metalness: 0.85,
      });
      const slide = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.085, 0.28), gunMetal);
      slide.position.set(0, -0.44, 0.14);
      armPivot.add(slide);

      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.13, 0.075), darkMat);
      grip.position.set(0, -0.51, 0.04);
      grip.rotation.x = -0.22;
      armPivot.add(grip);
    }

    body.add(armPivot);
    arms.push(armPivot);
  }

  // --- Legs hinged from the hips + contrast shoes ---
  const legs = [];
  for (const x of [-0.14, 0.14]) {
    const legPivot = new THREE.Group();
    legPivot.position.set(x, 0.72, 0);

    const trouser = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.082, 0.62, 12), pantsMat);
    trouser.position.y = -0.31;
    trouser.castShadow = true;
    legPivot.add(trouser);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.12, 0.28), shoeMat);
    shoe.position.set(0, -0.66, 0.045);
    shoe.castShadow = true;
    legPivot.add(shoe);

    body.add(legPivot);
    legs.push(legPivot);
  }

  group.userData.body = body;
  group.userData.legs = legs;
  group.userData.arms = arms;
  return group;
}

export function createPlayer(scene, x, z) {
  const mesh = makePersonMesh(0xe8a13a, 0xc98a5f, true);
  scene.add(mesh);
  const player = {
    mesh,
    pos: { x, z },
    heading: 0,
    onFoot: true,
    car: null,
    walkPhase: 0,
    // Returns a stolen car, or null. G carries the world the player touches.
    update(dt, input, G) {
      if (!this.onFoot) return null;
      const axis = input.axis();
      const running = input.run();
      const speed = running ? FOOT.run : FOOT.walk;
      // Movement is relative to the camera yaw so W always walks away from us.
      const yaw = G.cameraYaw;
      const mx = Math.sin(yaw) * axis.y + Math.cos(yaw) * axis.x;
      const mz = Math.cos(yaw) * axis.y - Math.sin(yaw) * axis.x;
      const len = Math.hypot(mx, mz);
      if (len > 0.01) {
        this.heading = Math.atan2(mx, mz);
        this.pos.x += (mx / len) * speed * dt;
        this.pos.z += (mz / len) * speed * dt;
        this.walkPhase += dt * speed * 1.65;
      }
      clampToWorld(this.pos, FOOT.radius);
      collideCircle(this.pos, FOOT.radius, G.city.colliders);
      this.mesh.position.set(this.pos.x, 0, this.pos.z);
      this.mesh.rotation.y = this.heading;

      const moving = len > 0.01;
      const amp = running ? 0.72 : 0.48;
      const swing = moving ? Math.sin(this.walkPhase) * amp : 0;

      // Natural leg, arm and body-bob swing.
      this.mesh.userData.legs[0].rotation.x = swing;
      this.mesh.userData.legs[1].rotation.x = -swing;
      if (this.mesh.userData.arms) {
        this.mesh.userData.arms[0].rotation.x = -swing * 0.75;
        // Right arm slightly raised while holding the pistol.
        this.mesh.userData.arms[1].rotation.x = moving ? swing * 0.45 - 0.35 : -0.25;
      }
      if (this.mesh.userData.body) {
        this.mesh.userData.body.position.y = moving ? Math.abs(Math.sin(this.walkPhase)) * 0.06 : 0;
        this.mesh.userData.body.rotation.x = moving && running ? 0.12 : 0;
      }

      if (input.action(ACTION_ENTER)) {
        return this.tryEnterCar(G);
      }
      return null;
    },
    // Nearest car within reach. Police cruisers cannot be stolen.
    nearestCar(G, range = 3.4) {
      let best = null;
      let bestD = range;
      for (const car of [...G.parked, ...G.traffic.cars]) {
        if (car.police || car.dead) continue;
        const d = Math.hypot(car.pos.x - this.pos.x, car.pos.z - this.pos.z);
        if (d < bestD) {
          bestD = d;
          best = car;
        }
      }
      return best;
    },
    tryEnterCar(G) {
      const car = this.nearestCar(G);
      if (!car) return null;
      if (car.parked || G.traffic.cars.includes(car)) {
        if (G.traffic.cars.includes(car)) G.traffic.removeCar(car);
        else G.parked = G.parked.filter((c) => c !== car);
        car.parked = false;
        this.getIn(car, G);
        // Your own parked car is free. Any other car is a theft: alarm, +1 star.
        if (!car.playerOwned) {
          G.police.addWanted(1, 'CAR STOLEN — alarm raised');
          G.hud.toast('CAR STOLEN — the alarm is screaming');
          G.audio.alarm();
        }
        return car;
      }
      return null;
    },
    getIn(car, G) {
      this.car = car;
      this.onFoot = false;
      this.mesh.visible = false;
      // Whatever Dara just got into becomes the hero car — clearcoat paint
      // and headlight glow, so the camera's subject is always the shiniest
      // car in the frame.
      makeHero(car);
      G.audio.engineStart();
    },
    // Step out beside the car, only when it is (almost) stopped.
    getOut(G) {
      if (!this.car || Math.abs(this.car.speed) > 1.5) return false;
      const car = this.car;
      this.car = null;
      this.onFoot = true;
      this.pos.x = car.pos.x - Math.sin(car.heading + Math.PI / 2) * 2.4;
      this.pos.z = car.pos.z - Math.cos(car.heading + Math.PI / 2) * 2.4;
      this.heading = car.heading;
      this.mesh.visible = true;
      this.mesh.position.set(this.pos.x, 0, this.pos.z);
      car.playerOwned = true;
      G.parked.push(car);
      car.parked = true;
      return true;
    },
  };
  player.mesh.position.set(x, 0, z);
  return player;
}

// Distance from the player (on foot or in the car) to a point.
export function playerDistance(G, x, z) {
  const p = G.player.onFoot ? G.player.pos : G.player.car.pos;
  return Math.hypot(p.x - x, p.z - z);
}
