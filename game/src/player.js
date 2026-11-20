// Dara on foot: a low-poly walker who can enter, exit and steal cars.
// Stealing is the genre's core verb — it sets off the alarm and raises the
// wanted level by one, which is what turns a walk into a chase.
import * as THREE from 'three';
import { FOOT, CAR } from './config.js';
import { collideCircle, clampToWorld } from './city.js';
import { ACTION_ENTER } from './input.js';
import { makeHero } from './vehicles.js';

export function makePersonMesh(jacket = 0xe8a13a, skin = 0xc98a5f, kit = false) {
  const group = new THREE.Group();
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.7, 0.32),
    new THREE.MeshStandardMaterial({ color: jacket, roughness: 0.9 }),
  );
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 10, 8),
    new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 }),
  );
  head.position.y = 1.62;
  head.castShadow = true;
  group.add(head);
  // Dara's kit — a cyan cap and a dark backpack — so he reads as a person
  // from behind instead of merging with the car beside him. Pedestrians
  // keep the plain build; only Dara carries the kit.
  if (kit) {
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.26, 0.12, 10),
      new THREE.MeshStandardMaterial({ color: 0x7cffef, roughness: 0.7 }),
    );
    cap.position.y = 1.84;
    group.add(cap);
    const brim = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.04, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x7cffef, roughness: 0.7 }),
    );
    brim.position.set(0, 1.8, 0.26);
    group.add(brim);
    const pack = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.44, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x2e4a5a, roughness: 0.9 }),
    );
    pack.position.set(0, 1.08, -0.24);
    group.add(pack);
  }
  const legs = [];
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2a2a33, roughness: 1 });
  for (const x of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), legMat);
    leg.position.set(x, 0.35, 0);
    group.add(leg);
    legs.push(leg);
  }
  // Dara carries a pistol in his right hand.
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.14, 0.34),
    new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.4, metalness: 0.6 }),
  );
  gun.position.set(0.36, 0.95, 0.2);
  group.add(gun);
  group.userData.legs = legs;
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
      const speed = input.run() ? FOOT.run : FOOT.walk;
      // Movement is relative to the camera yaw so W always walks away from us.
      const yaw = G.cameraYaw;
      const mx = Math.sin(yaw) * axis.y + Math.cos(yaw) * axis.x;
      const mz = Math.cos(yaw) * axis.y - Math.sin(yaw) * axis.x;
      const len = Math.hypot(mx, mz);
      if (len > 0.01) {
        this.heading = Math.atan2(mx, mz);
        this.pos.x += (mx / len) * speed * dt;
        this.pos.z += (mz / len) * speed * dt;
        this.walkPhase += dt * speed * 1.6;
      }
      clampToWorld(this.pos, FOOT.radius);
      collideCircle(this.pos, FOOT.radius, G.city.colliders);
      this.mesh.position.set(this.pos.x, 0, this.pos.z);
      this.mesh.rotation.y = this.heading;
      const swing = len > 0.01 ? Math.sin(this.walkPhase) * 0.5 : 0;
      this.mesh.userData.legs[0].rotation.x = swing;
      this.mesh.userData.legs[1].rotation.x = -swing;
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
