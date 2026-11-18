// Cars: a boxy low-poly build from shared geometry, and arcade handling.
// No physics engine — speed, steering and slide are integrated by hand, which
// keeps the code small, fully authored, and deterministic for screenshots.
import * as THREE from 'three';
import { CAR } from './config.js';
import { collideCircle, clampToWorld } from './city.js';

const bodyGeo = new THREE.BoxGeometry(1.9, 0.62, 4.1);
const cabinGeo = new THREE.BoxGeometry(1.6, 0.55, 2.0);
const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
const lightGeo = new THREE.BoxGeometry(0.32, 0.16, 0.08);

export function makeCarMesh(color, police = false) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.35,
    metalness: 0.6,
  });
  const body = new THREE.Mesh(bodyGeo, paint);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(
    cabinGeo,
    new THREE.MeshStandardMaterial({ color: 0x18222e, roughness: 0.15, metalness: 0.7 }),
  );
  cabin.position.set(0, 1.08, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 1 });
  const wheels = [];
  for (const [x, z] of [
    [-0.95, 1.35],
    [0.95, 1.35],
    [-0.95, -1.35],
    [0.95, -1.35],
  ]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.36, z);
    group.add(w);
    wheels.push(w);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: police ? 0xff4444 : 0xffe9a8 });
  for (const x of [-0.6, 0.6]) {
    const h = new THREE.Mesh(lightGeo, headMat);
    h.position.set(x, 0.62, 2.06);
    group.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const x of [-0.6, 0.6]) {
    const t = new THREE.Mesh(lightGeo, tailMat);
    t.position.set(x, 0.62, -2.06);
    group.add(t);
  }
  if (police) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.14, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x2233ff, emissiveIntensity: 2 }),
    );
    bar.position.set(0, 1.42, -0.2);
    group.add(bar);
    group.userData.lightBar = bar;
  }
  group.userData.wheels = wheels;
  return group;
}

// One drivable car: position, heading, speed and a sideways slide vector.
export function createCar(scene, x, z, heading, color, police = false) {
  const mesh = makeCarMesh(color, police);
  scene.add(mesh);
  const car = {
    mesh,
    police,
    pos: { x, z },
    heading,
    speed: 0,
    slideX: 0,
    slideZ: 0,
    steer: 0,
    dead: false,
    parked: false,
    // Drive it with an input axis {x: steer -1..1, y: throttle -1..1}.
    // boost multiplies the top speed (NOS).
    drive(dt, input, colliders, onHit, boost = 1) {
      const top = CAR.topSpeed * boost;
      const target = input.y >= 0 ? input.y * top : input.y * CAR.reverseSpeed;
      const rate = input.y > 0 ? CAR.accel : CAR.brake;
      this.speed += Math.max(-rate * dt, Math.min(rate * dt, target - this.speed));
      const grip = input.handbrake ? CAR.handbrakeGrip : CAR.grip;
      const steerTarget = input.x * CAR.steerMax * (1 - Math.min(Math.abs(this.speed) / top, 1) * 0.55);
      this.steer += (steerTarget - this.steer) * Math.min(1, dt * 8);
      const turnRate = this.steer * Math.max(0.25, Math.abs(this.speed) / top);
      this.heading += turnRate * Math.sign(this.speed || 1) * dt * 2.2;
      const fx = Math.sin(this.heading);
      const fz = Math.cos(this.heading);
      // Steering at speed throws the tail out; grip bleeds the slide away.
      const slideAmount = this.steer * this.speed * dt * (input.handbrake ? 1.6 : 0.55);
      this.slideX += -fz * slideAmount;
      this.slideZ += fx * slideAmount;
      const decay = Math.exp(-grip * dt);
      this.slideX *= decay;
      this.slideZ *= decay;
      this.pos.x += (fx * this.speed + this.slideX) * dt;
      this.pos.z += (fz * this.speed + this.slideZ) * dt;
      clampToWorld(this.pos, CAR.radius);
      if (collideCircle(this.pos, CAR.radius, colliders)) {
        const lost = Math.abs(this.speed) * 0.45;
        this.speed *= 0.55;
        this.slideX *= 0.4;
        this.slideZ *= 0.4;
        if (lost > 6 && onHit) onHit(lost);
      }
      this.sync();
    },
    sync() {
      this.mesh.position.set(this.pos.x, 0, this.pos.z);
      this.mesh.rotation.y = this.heading;
      const spin = this.speed * 0.12;
      for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
      this.mesh.userData.wheels[0].rotation.y = this.steer * 0.7;
      this.mesh.userData.wheels[1].rotation.y = this.steer * 0.7;
    },
    remove() {
      scene.remove(this.mesh);
    },
  };
  car.sync();
  return car;
}

// Parked cars along the streets, waiting to be stolen.
export function spawnParkedCars(scene, rng, city, count) {
  const colors = [0xc94f4f, 0x4f7ec9, 0xd9c24f, 0x7a4fc9, 0x4fc97a, 0xd9d9d9, 0x2e2e38];
  const parked = [];
  for (let i = 0; i < count; i++) {
    const horizontal = rng.next() < 0.5;
    const street = rng.pick(city.streets);
    const along = rng.range(-140, 140);
    const side = rng.next() < 0.5 ? 1 : -1;
    const x = horizontal ? along : street + side * 4.4;
    const z = horizontal ? street + side * 4.4 : along;
    const heading = horizontal ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : side > 0 ? Math.PI : 0;
    const car = createCar(scene, x, z, heading, rng.pick(colors));
    car.parked = true;
    parked.push(car);
  }
  return parked;
}
