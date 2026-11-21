// Cars: a sculpted stylized build from shared geometry, reflective clearcoat
// hero paint, metallic rims, and deterministic arcade handling.
// No physics engine — speed, steering and slide are integrated by hand, which
// keeps the code small, fully authored, and deterministic for screenshots.
//
// Stage 2: every car is a layered silhouette — lower chassis, hood and trunk,
// grille, front/rear bumpers, mirrors, dark reflective glass, dual exhausts,
// rear plate — instead of two boxes. Wheels are 18-segment tires with chrome
// rims and hubs. The hero car keeps the clearcoat + glow treatment; any car
// Dara steals becomes the hero car and the previous one drops back to
// ordinary paint. Traffic brake lights are wired through userData.tailMat so
// traffic.js can flare them when braking, and the police light bar stays on
// userData.lightBar so police.js can strobe it.
import * as THREE from 'three';
import { CAR } from './config.js';
import { collideCircle, clampToWorld } from './city.js';

const bodyGeo = new THREE.BoxGeometry(1.92, 0.52, 4.15);
const hoodGeo = new THREE.BoxGeometry(1.76, 0.14, 1.35);
const cabinGeo = new THREE.BoxGeometry(1.58, 0.52, 1.92);
const roofGeo = new THREE.BoxGeometry(1.48, 0.07, 1.56);
const bumperGeo = new THREE.BoxGeometry(1.96, 0.22, 0.24);
const grilleGeo = new THREE.BoxGeometry(1.05, 0.2, 0.08);
const mirrorGeo = new THREE.BoxGeometry(0.18, 0.1, 0.14);
const plateGeo = new THREE.BoxGeometry(0.52, 0.16, 0.04);
const exhaustGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.18, 10);
const tireGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 18);
const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.3, 12);
const hubGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.31, 8);
const lightGeo = new THREE.BoxGeometry(0.36, 0.14, 0.08);

const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0x101824,
  roughness: 0.08,
  metalness: 0.45,
  clearcoat: 1,
  clearcoatRoughness: 0.06,
});
const trimMat = new THREE.MeshStandardMaterial({ color: 0x181a20, roughness: 0.65, metalness: 0.25 });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd8dde6, roughness: 0.2, metalness: 0.9 });
const tireMat = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.92 });
const plateMat = new THREE.MeshStandardMaterial({ color: 0xe8e4d0, roughness: 0.5 });

let glowTex = null;
function getGlowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,246,216,1)');
  grad.addColorStop(0.4, 'rgba(255,217,160,0.7)');
  grad.addColorStop(1, 'rgba(255,196,107,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

// Clearcoat paint for the hero car: a hard lacquer coat over the colour, so
// the golden-hour sun draws a long highlight along the body. Stage 1 added a
// procedural environment map, so the higher metalness (0.42) no longer goes
// black on the shadow side — the IBL gives the paint something to reflect.
function heroPaint(color) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.22,
    metalness: 0.42,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
  });
}

function addHeadlightGlow(group) {
  const sprites = [];
  for (const x of [-0.62, 0.62]) {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: getGlowTexture(),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.62,
      }),
    );
    s.position.set(x, 0.58, 2.22);
    s.scale.set(1.35, 1.35, 1);
    group.add(s);
    sprites.push(s);
  }
  return sprites;
}

// The hero car's rear, lit at dusk: red glow sprites over brighter tail
// lights, so the car reads from behind — the chase camera's view — instead
// of a dark box. The tail material is brighter than ordinary cars for the
// same reason; traffic keeps the dimmer red and flares it only when braking.
function addRearGlow(group) {
  const sprites = [];
  for (const x of [-0.62, 0.62]) {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: getGlowTexture(),
        color: 0xff3b30,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.72,
      }),
    );
    s.position.set(x, 0.58, -2.22);
    s.scale.set(1.3, 1.3, 1);
    group.add(s);
    sprites.push(s);
  }
  return sprites;
}

export function makeCarMesh(color, police = false, hero = false) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.3,
    metalness: 0.52,
  });
  const activePaint = hero ? heroPaint(color) : paint;
  const paintMeshes = [];

  // 1. Main body (stays children[0] for compatibility).
  const body = new THREE.Mesh(bodyGeo, activePaint);
  body.position.y = 0.56;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  paintMeshes.push(body);

  // Hood slightly proud of the body + roof in body colour.
  const hood = new THREE.Mesh(hoodGeo, activePaint);
  hood.position.set(0, 0.85, 1.25);
  hood.castShadow = true;
  group.add(hood);
  paintMeshes.push(hood);

  // Dark reflective glass cabin.
  const cabin = new THREE.Mesh(cabinGeo, glassMat);
  cabin.position.set(0, 1.06, -0.22);
  cabin.castShadow = true;
  group.add(cabin);

  // Roof panel (white on police cars, body colour otherwise).
  const roof = new THREE.Mesh(roofGeo, police ? new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.35, metalness: 0.2 }) : activePaint);
  roof.position.set(0, 1.34, -0.24);
  roof.castShadow = true;
  group.add(roof);
  if (!police) paintMeshes.push(roof);

  // Front & rear bumpers, grille, mirrors, plate and exhausts.
  const frontBumper = new THREE.Mesh(bumperGeo, trimMat);
  frontBumper.position.set(0, 0.35, 2.04);
  group.add(frontBumper);

  const rearBumper = new THREE.Mesh(bumperGeo, trimMat);
  rearBumper.position.set(0, 0.35, -2.04);
  group.add(rearBumper);

  const grille = new THREE.Mesh(grilleGeo, trimMat);
  grille.position.set(0, 0.54, 2.08);
  group.add(grille);

  // Mirrors sit proud of the body sides (body half-width is 0.96).
  for (const sx of [-1.02, 1.02]) {
    const mirror = new THREE.Mesh(mirrorGeo, activePaint);
    mirror.position.set(sx, 0.96, 0.42);
    group.add(mirror);
    paintMeshes.push(mirror);
  }

  // Plate proud of the rear bumper face (-2.16), so it is not swallowed by it.
  const plate = new THREE.Mesh(plateGeo, plateMat);
  plate.position.set(0, 0.48, -2.17);
  group.add(plate);

  for (const ex of [-0.52, 0.52]) {
    const pipe = new THREE.Mesh(exhaustGeo, chromeMat);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(ex, 0.25, -2.12);
    group.add(pipe);
  }

  // Smooth round wheels with metallic rims. Each wheel is a pivot group so
  // sync() can spin it (rotation.x) and steer the front pair (rotation.y)
  // exactly like the old single-mesh wheels did.
  const wheels = [];
  for (const [x, z] of [
    [-0.96, 1.34],
    [0.96, 1.34],
    [-0.96, -1.34],
    [0.96, -1.34],
  ]) {
    const wheelPivot = new THREE.Group();
    wheelPivot.position.set(x, 0.36, z);

    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wheelPivot.add(tire);

    const rim = new THREE.Mesh(rimGeo, chromeMat);
    rim.rotation.z = Math.PI / 2;
    wheelPivot.add(rim);

    const hub = new THREE.Mesh(hubGeo, trimMat);
    hub.rotation.z = Math.PI / 2;
    wheelPivot.add(hub);

    group.add(wheelPivot);
    wheels.push(wheelPivot);
  }

  // Headlights & taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: police ? 0xffebe6 : 0xfff2c6 });
  for (const x of [-0.64, 0.64]) {
    const h = new THREE.Mesh(lightGeo, headMat);
    h.position.set(x, 0.6, 2.08);
    group.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({
    color: hero ? 0xff3830 : police ? 0xd92626 : 0x8c1616,
  });
  for (const x of [-0.64, 0.64]) {
    const t = new THREE.Mesh(lightGeo, tailMat);
    t.position.set(x, 0.6, -2.08);
    group.add(t);
  }

  // NCPD police details: bright light bar (kept on userData.lightBar so the
  // strobe in police.js keeps working), black-and-white livery, push-bar.
  if (police) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.26, 0.18, 0.36),
      new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x2244ff, emissiveIntensity: 3.4 }),
    );
    bar.position.set(0, 1.46, -0.22);
    group.add(bar);
    group.userData.lightBar = bar;

    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.35, metalness: 0.2 });
    // Stripe proud of the rear bumper face (-2.16), so it is not swallowed by it.
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.16, 0.06), whiteMat);
    stripe.position.set(0, 0.36, -2.18);
    group.add(stripe);

    // Push-bar (front protection bar) typical of patrol cars.
    const pushBar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.28, 0.14), trimMat);
    pushBar.position.set(0, 0.46, 2.18);
    group.add(pushBar);
  }

  group.userData.wheels = wheels;
  group.userData.tailMat = tailMat;
  group.userData.paint = paint;
  group.userData.paintMeshes = paintMeshes;
  group.userData.heroGlow = hero ? addHeadlightGlow(group) : null;
  group.userData.heroTailGlow = hero ? addRearGlow(group) : null;
  return group;
}

// The hero car: one car at a time carries the clearcoat + glow treatment.
// Stealing a car promotes it and demotes the old one — the camera's subject
// is always the shiniest thing in the frame.
let currentHero = null;
export function makeHero(car) {
  if (currentHero === car) return;
  if (currentHero) {
    const old = currentHero.mesh;
    for (const m of old.userData.paintMeshes || [old.children[0]]) {
      m.material = old.userData.paint;
    }
    if (old.userData.heroGlow) {
      for (const s of old.userData.heroGlow) old.remove(s);
      old.userData.heroGlow = null;
    }
    if (old.userData.heroTailGlow) {
      for (const s of old.userData.heroTailGlow) old.remove(s);
      old.userData.heroTailGlow = null;
    }
    old.userData.tailMat.color.setHex(0x8c1616);
    currentHero.hero = false;
  }
  currentHero = car;
  car.hero = true;
  const g = car.mesh;
  const hp = heroPaint(g.userData.paint.color.getHex());
  for (const m of g.userData.paintMeshes || [g.children[0]]) {
    m.material = hp;
  }
  g.userData.heroGlow = addHeadlightGlow(g);
  g.userData.heroTailGlow = addRearGlow(g);
  g.userData.tailMat.color.setHex(0xff3830);
}

// One drivable car: position, heading, speed and a sideways slide vector.
export function createCar(scene, x, z, heading, color, police = false, hero = false) {
  const mesh = makeCarMesh(color, police, hero);
  scene.add(mesh);
  const car = {
    mesh,
    police,
    hero,
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
      if (currentHero === this) currentHero = null;
      scene.remove(this.mesh);
    },
  };
  if (hero) currentHero = car;
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
