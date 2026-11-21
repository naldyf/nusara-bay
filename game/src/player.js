// Dara on foot: a detailed stylised character with articulated limbs, a
// readable kit and a natural walk and run animation. Pedestrians are built
// from the same person mesh, minus Dara's kit, through userData.legs.
//
// The body is assembled through one small helper — a mesh, a position, a
// parent — so every piece reads as one line of intent instead of three
// lines of plumbing. Same geometry, same kit, same animation; only the
// assembly is different.
import * as THREE from 'three';
import { FOOT } from './config.js';
import { collideCircle, clampToWorld } from './city.js';
import { ACTION_ENTER } from './input.js';
import { makeHero } from './vehicles.js';

// One mesh, placed, optionally spun, added to a parent. Returns the mesh so
// a caller can keep it (a shoulder pivot, a leg pivot) or ignore it.
function piece(geo, mat, parent, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (rx || ry || rz) m.rotation.set(rx, ry, rz);
  parent.add(m);
  return m;
}

function box(w, h, d) {
  return new THREE.BoxGeometry(w, h, d);
}
function ball(r, w = 12, h = 10) {
  return new THREE.SphereGeometry(r, w, h);
}
function tube(rTop, rBot, h, seg = 12) {
  return new THREE.CylinderGeometry(rTop, rBot, h, seg);
}

export function makePersonMesh(jacket = 0xe8a13a, skin = 0xc98a5f, kit = false) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const coat = new THREE.MeshStandardMaterial({ color: jacket, roughness: 0.62, metalness: 0.06 });
  const shirt = new THREE.MeshStandardMaterial({ color: kit ? 0xf2f4f8 : 0xd8dce3, roughness: 0.85 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.68 });
  const pants = new THREE.MeshStandardMaterial({ color: kit ? 0x222838 : 0x2c2c38, roughness: 0.82 });
  const shoes = new THREE.MeshStandardMaterial({ color: kit ? 0xf0f2f5 : 0x1e1e24, roughness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1c24, roughness: 0.7, metalness: 0.15 });

  // Layered torso: jacket over a shirt, collar on top, belt at the waist.
  const torso = piece(box(0.52, 0.62, 0.28), coat, body, 0, 1.07, 0);
  torso.castShadow = true;
  torso.receiveShadow = true;
  piece(box(0.18, 0.58, 0.295), shirt, body, 0, 1.07, 0.005);
  piece(tube(0.16, 0.19, 0.08), coat, body, 0, 1.39, 0);
  piece(box(0.53, 0.08, 0.3), dark, body, 0, 0.76, 0);

  // Neck and a smooth head, slightly taller than wide.
  piece(tube(0.085, 0.095, 0.12), skinMat, body, 0, 1.44, 0);
  const skull = new THREE.Group();
  skull.position.y = 1.63;
  body.add(skull);
  const head = piece(ball(0.21, 20, 16), skinMat, skull, 0, 0, 0);
  head.scale.set(0.95, 1.06, 0.98);
  head.castShadow = true;

  if (kit) {
    // Dara's black shades, so the facing direction reads at a glance.
    piece(
      box(0.32, 0.075, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x10141c, roughness: 0.15, metalness: 0.85 }),
      skull,
      0,
      0.02,
      0.18,
    );
    // Cyan cap: dome, brim and accent strip.
    const capMat = new THREE.MeshStandardMaterial({
      color: 0x3ef0df,
      roughness: 0.45,
      emissive: 0x0b3a36,
      emissiveIntensity: 0.35,
    });
    const dome = piece(new THREE.SphereGeometry(0.222, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), capMat, skull, 0, 0.05, 0);
    dome.castShadow = true;
    piece(box(0.32, 0.035, 0.22), capMat, skull, 0, 0.07, 0.22, 0.08);
    // Tactical backpack with shoulder straps and a reflective strip, so the
    // silhouette reads clearly from behind.
    const packMat = new THREE.MeshStandardMaterial({ color: 0x223645, roughness: 0.65 });
    const pack = piece(box(0.36, 0.46, 0.17), packMat, body, 0, 1.08, -0.21);
    pack.castShadow = true;
    piece(
      box(0.28, 0.045, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x7cffef, emissive: 0x4deee0, emissiveIntensity: 0.9, roughness: 0.3 }),
      body,
      0,
      1.18,
      -0.3,
    );
    for (const sx of [-0.15, 0.15]) piece(box(0.06, 0.44, 0.33), dark, body, sx, 1.12, -0.02);
  } else {
    // Plain hair for pedestrians, so they do not read as bald.
    piece(new THREE.SphereGeometry(0.218, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), dark, skull, 0, 0.03, -0.02);
  }

  // Arms hinged from the shoulders; Dara's right hand holds a pistol.
  const arms = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.34, 1.32, 0);
    const sleeve = piece(tube(0.085, 0.075, 0.42), coat, shoulder, 0, -0.21, 0);
    sleeve.castShadow = true;
    piece(ball(0.072, 10, 8), skinMat, shoulder, 0, -0.45, 0);
    if (kit && side === 1) {
      const gunMetal = new THREE.MeshStandardMaterial({ color: 0x1b1e26, roughness: 0.28, metalness: 0.85 });
      piece(box(0.065, 0.085, 0.28), gunMetal, shoulder, 0, -0.44, 0.14);
      piece(box(0.055, 0.13, 0.075), dark, shoulder, 0, -0.51, 0.04, -0.22);
    }
    body.add(shoulder);
    arms.push(shoulder);
  }

  // Legs hinged from the hips, with contrast shoes.
  const legs = [];
  for (const x of [-0.14, 0.14]) {
    const hip = new THREE.Group();
    hip.position.set(x, 0.72, 0);
    const trouser = piece(tube(0.095, 0.082, 0.62), pants, hip, 0, -0.31, 0);
    trouser.castShadow = true;
    const shoe = piece(box(0.17, 0.12, 0.28), shoes, hip, 0, -0.66, 0.045);
    shoe.castShadow = true;
    body.add(hip);
    legs.push(hip);
  }

  group.userData.body = body;
  group.userData.legs = legs;
  group.userData.arms = arms;
  return group;
}

// The walk and run cycle: legs scissor, arms counter-swing, the body bobs
// and leans into a run. Dara's right arm stays slightly raised, pistol in
// hand, instead of swinging free.
function animateWalk(mesh, phase, running, moving) {
  const amp = running ? 0.72 : 0.48;
  const swing = moving ? Math.sin(phase) * amp : 0;
  mesh.userData.legs[0].rotation.x = swing;
  mesh.userData.legs[1].rotation.x = -swing;
  if (mesh.userData.arms) {
    mesh.userData.arms[0].rotation.x = -swing * 0.75;
    mesh.userData.arms[1].rotation.x = moving ? swing * 0.45 - 0.35 : -0.25;
  }
  if (mesh.userData.body) {
    mesh.userData.body.position.y = moving ? Math.abs(Math.sin(phase)) * 0.06 : 0;
    mesh.userData.body.rotation.x = moving && running ? 0.12 : 0;
  }
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
      const pace = running ? FOOT.run : FOOT.walk;
      // Movement is relative to the camera yaw, so W always walks away.
      const yaw = G.cameraYaw;
      const mx = Math.sin(yaw) * axis.y + Math.cos(yaw) * axis.x;
      const mz = Math.cos(yaw) * axis.y - Math.sin(yaw) * axis.x;
      const len = Math.hypot(mx, mz);
      const moving = len > 0.01;
      if (moving) {
        this.heading = Math.atan2(mx, mz);
        this.pos.x += (mx / len) * pace * dt;
        this.pos.z += (mz / len) * pace * dt;
        this.walkPhase += dt * pace * 1.65;
      }
      clampToWorld(this.pos, FOOT.radius);
      collideCircle(this.pos, FOOT.radius, G.city.colliders);
      this.mesh.position.set(this.pos.x, 0, this.pos.z);
      this.mesh.rotation.y = this.heading;
      animateWalk(this.mesh, this.walkPhase, running, moving);
      if (input.action(ACTION_ENTER)) {
        return this.tryEnterCar(G);
      }
      return null;
    },
    // Nearest car within reach. Police cruisers cannot be stolen.
    nearestCar(G, range = 3.4) {
      const candidates = [...G.parked, ...G.traffic.cars];
      let best = null;
      let bestD = range;
      for (let i = 0; i < candidates.length; i++) {
        const car = candidates[i];
        if (car.police || car.dead) continue;
        const d = Math.hypot(car.pos.x - this.pos.x, car.pos.z - this.pos.z);
        if (d >= bestD) continue;
        bestD = d;
        best = car;
      }
      return best;
    },
    tryEnterCar(G) {
      const car = this.nearestCar(G);
      if (!car) return null;
      const fromTraffic = G.traffic.cars.includes(car);
      if (!car.parked && !fromTraffic) return null;
      if (fromTraffic) G.traffic.removeCar(car);
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
    // Step out beside the car, only when it is (almost) stopped. Dara
    // exits on the side away from the road, so he is not standing in
    // traffic the moment he gets out.
    getOut(G) {
      if (!this.car || Math.abs(this.car.speed) > 1.5) return false;
      const car = this.car;
      const exitAngle = car.heading + Math.PI / 2;
      this.pos.x = car.pos.x - Math.sin(exitAngle) * 2.4;
      this.pos.z = car.pos.z - Math.cos(exitAngle) * 2.4;
      this.heading = car.heading;
      this.car = null;
      this.onFoot = true;
      this.mesh.visible = true;
      this.mesh.position.set(this.pos.x, 0, this.pos.z);
      car.playerOwned = true;
      car.parked = true;
      G.parked.push(car);
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
