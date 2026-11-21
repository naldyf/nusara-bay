// Cars: a sculpted stylised build from shared geometry, reflective clearcoat
// hero paint, metallic rims and hand-integrated arcade handling. No physics
// engine — speed, steering and slide are stepped by hand, which keeps the
// code small and the behaviour deterministic for screenshots.
//
// Every car is a layered silhouette — lower chassis, hood and trunk, grille,
// front and rear bumpers, mirrors, dark reflective glass, dual exhausts and
// a rear plate — instead of two boxes. Wheels are 18-segment tyres with
// chrome rims and hubs. The hero car keeps the clearcoat and glow
// treatment; any car Dara steals becomes the hero car and the previous one
// drops back to ordinary paint. Traffic brake lights run through
// userData.tailMat so traffic.js can flare them when braking, and the
// police light bar stays on userData.lightBar so police.js can strobe it.
//
// Assembly goes through one helper — a mesh, a position, a parent — so the
// body reads as a list of parts instead of pages of plumbing.
import * as THREE from 'three';
import { CAR } from './config.js';
import { collideCircle, clampToWorld } from './city.js';

// Shared geometry: every car in the city is built from these pieces.
const chassisGeo = new THREE.BoxGeometry(1.92, 0.52, 4.15);
const bonnetGeo = new THREE.BoxGeometry(1.76, 0.14, 1.35);
const glasshouseGeo = new THREE.BoxGeometry(1.58, 0.52, 1.92);
const roofPanelGeo = new THREE.BoxGeometry(1.48, 0.07, 1.56);
const bumperGeo = new THREE.BoxGeometry(1.96, 0.22, 0.24);
const grilleGeo = new THREE.BoxGeometry(1.05, 0.2, 0.08);
const mirrorGeo = new THREE.BoxGeometry(0.18, 0.1, 0.14);
const plateGeo = new THREE.BoxGeometry(0.52, 0.16, 0.04);
const pipeGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.18, 10);
const tyreGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 18);
const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.3, 12);
const hubGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.31, 8);
const lampGeo = new THREE.BoxGeometry(0.36, 0.14, 0.08);

const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0x101824,
  roughness: 0.08,
  metalness: 0.45,
  clearcoat: 1,
  clearcoatRoughness: 0.06,
});
const trimMat = new THREE.MeshStandardMaterial({ color: 0x181a20, roughness: 0.65, metalness: 0.25 });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd8dde6, roughness: 0.2, metalness: 0.9 });
const tyreMat = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.92 });
const plateMat = new THREE.MeshStandardMaterial({ color: 0xe8e4d0, roughness: 0.5 });

function part(geo, mat, parent, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (rx || ry || rz) m.rotation.set(rx, ry, rz);
  parent.add(m);
  return m;
}

let glowCanvas = null;
function glowTexture() {
  if (glowCanvas) return glowCanvas;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const fade = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  fade.addColorStop(0, 'rgba(255,246,216,1)');
  fade.addColorStop(0.4, 'rgba(255,217,160,0.7)');
  fade.addColorStop(1, 'rgba(255,196,107,0)');
  g.fillStyle = fade;
  g.fillRect(0, 0, 128, 128);
  glowCanvas = new THREE.CanvasTexture(c);
  glowCanvas.colorSpace = THREE.SRGBColorSpace;
  return glowCanvas;
}

// Clearcoat paint for the hero car: a hard lacquer coat over the colour, so
// the golden-hour sun draws a long highlight along the body. The procedural
// environment map gives the higher metalness something to reflect, so the
// shadow side no longer goes black.
function lacquerPaint(colour) {
  return new THREE.MeshPhysicalMaterial({
    color: colour,
    roughness: 0.22,
    metalness: 0.42,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
  });
}

function glowSprite(group, x, y, z, colour, opacity, size) {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(),
      color: colour,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity,
    }),
  );
  s.position.set(x, y, z);
  s.scale.set(size, size, 1);
  group.add(s);
  return s;
}

export function makeCarMesh(color, police = false, hero = false) {
  const group = new THREE.Group();
  const plainPaint = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.52 });
  const paint = hero ? lacquerPaint(color) : plainPaint;
  const paintedParts = [];

  // 1. Main body (stays children[0] for compatibility).
  const body = part(chassisGeo, paint, group, 0, 0.56, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  paintedParts.push(body);

  // Bonnet slightly proud of the body, plus a roof in body colour.
  const bonnet = part(bonnetGeo, paint, group, 0, 0.85, 1.25);
  bonnet.castShadow = true;
  paintedParts.push(bonnet);

  // Dark reflective glass cabin.
  const cabin = part(glasshouseGeo, glassMat, group, 0, 1.06, -0.22);
  cabin.castShadow = true;

  // Roof panel (white on police cars, body colour otherwise).
  const roofMat = police
    ? new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.35, metalness: 0.2 })
    : paint;
  const roof = part(roofPanelGeo, roofMat, group, 0, 1.34, -0.24);
  roof.castShadow = true;
  if (!police) paintedParts.push(roof);

  // Front and rear bumpers, grille, mirrors, plate and exhausts.
  part(bumperGeo, trimMat, group, 0, 0.35, 2.04);
  part(bumperGeo, trimMat, group, 0, 0.35, -2.04);
  part(grilleGeo, trimMat, group, 0, 0.54, 2.08);

  // Mirrors sit proud of the body sides (body half-width is 0.96).
  for (const sx of [-1.02, 1.02]) {
    paintedParts.push(part(mirrorGeo, paint, group, sx, 0.96, 0.42));
  }

  // Plate proud of the rear bumper face (-2.16), so it is not swallowed.
  part(plateGeo, plateMat, group, 0, 0.48, -2.17);
  for (const ex of [-0.52, 0.52]) part(pipeGeo, chromeMat, group, ex, 0.25, -2.12, Math.PI / 2);

  // Smooth round wheels with metallic rims. Each wheel is a pivot group so
  // sync() can spin it (rotation.x) and steer the front pair (rotation.y).
  const wheels = [];
  for (const [x, z] of [
    [-0.96, 1.34],
    [0.96, 1.34],
    [-0.96, -1.34],
    [0.96, -1.34],
  ]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.36, z);
    const tyre = part(tyreGeo, tyreMat, pivot, 0, 0, 0, 0, 0, Math.PI / 2);
    tyre.castShadow = true;
    part(rimGeo, chromeMat, pivot, 0, 0, 0, 0, 0, Math.PI / 2);
    part(hubGeo, trimMat, pivot, 0, 0, 0, 0, 0, Math.PI / 2);
    group.add(pivot);
    wheels.push(pivot);
  }

  // Headlights and taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: police ? 0xffebe6 : 0xfff2c6 });
  for (const x of [-0.64, 0.64]) part(lampGeo, headMat, group, x, 0.6, 2.08);
  const tailMat = new THREE.MeshBasicMaterial({
    color: hero ? 0xff3830 : police ? 0xd92626 : 0x8c1616,
  });
  for (const x of [-0.64, 0.64]) part(lampGeo, tailMat, group, x, 0.6, -2.08);

  // NCPD police details: a bright light bar (kept on userData.lightBar so
  // the strobe in police.js keeps working), black-and-white livery, push-bar.
  if (police) {
    const bar = part(
      new THREE.BoxGeometry(1.26, 0.18, 0.36),
      new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x2244ff, emissiveIntensity: 3.4 }),
      group,
      0,
      1.46,
      -0.22,
    );
    group.userData.lightBar = bar;
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.35, metalness: 0.2 });
    // Stripe proud of the rear bumper face (-2.16), so it is not swallowed.
    part(new THREE.BoxGeometry(1.94, 0.16, 0.06), whiteMat, group, 0, 0.36, -2.18);
    // Push-bar (front protection bar) typical of patrol cars.
    part(new THREE.BoxGeometry(1.1, 0.28, 0.14), trimMat, group, 0, 0.46, 2.18);
  }

  group.userData.wheels = wheels;
  group.userData.tailMat = tailMat;
  group.userData.paint = plainPaint;
  group.userData.paintMeshes = paintedParts;
  group.userData.heroGlow = hero
    ? [-0.62, 0.62].map((x) => glowSprite(group, x, 0.58, 2.22, 0xffffff, 0.62, 1.35))
    : null;
  group.userData.heroTailGlow = hero
    ? [-0.62, 0.62].map((x) => glowSprite(group, x, 0.58, -2.22, 0xff3b30, 0.72, 1.3))
    : null;
  return group;
}

// The hero car: one car at a time carries the clearcoat and glow treatment.
// Stealing a car promotes it and demotes the old one, so the camera's
// subject is always the shiniest car in the frame.
let heroCar = null;

function demoteHero(old) {
  for (const m of old.userData.paintMeshes || [old.children[0]]) {
    m.material = old.userData.paint;
  }
  for (const key of ['heroGlow', 'heroTailGlow']) {
    if (old.userData[key]) {
      for (const s of old.userData[key]) old.remove(s);
      old.userData[key] = null;
    }
  }
  old.userData.tailMat.color.setHex(0x8c1616);
}

function promoteHero(g) {
  const coat = lacquerPaint(g.userData.paint.color.getHex());
  for (const m of g.userData.paintMeshes || [g.children[0]]) {
    m.material = coat;
  }
  g.userData.heroGlow = [-0.62, 0.62].map((x) => glowSprite(g, x, 0.58, 2.22, 0xffffff, 0.62, 1.35));
  g.userData.heroTailGlow = [-0.62, 0.62].map((x) => glowSprite(g, x, 0.58, -2.22, 0xff3b30, 0.72, 1.3));
  g.userData.tailMat.color.setHex(0xff3830);
}

export function makeHero(car) {
  if (heroCar === car) return;
  if (heroCar) {
    demoteHero(heroCar.mesh);
    heroCar.hero = false;
  }
  heroCar = car;
  car.hero = true;
  promoteHero(car.mesh);
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
      // Throttle eases toward its target; braking is stronger than accelerating.
      const target = input.y >= 0 ? input.y * top : input.y * CAR.reverseSpeed;
      const rate = input.y > 0 ? CAR.accel : CAR.brake;
      this.speed += Math.max(-rate * dt, Math.min(rate * dt, target - this.speed));
      // Steering fades as speed rises, and the tail follows the wheel.
      const grip = input.handbrake ? CAR.handbrakeGrip : CAR.grip;
      const steerGoal = input.x * CAR.steerMax * (1 - Math.min(Math.abs(this.speed) / top, 1) * 0.55);
      this.steer += (steerGoal - this.steer) * Math.min(1, dt * 8);
      const turn = this.steer * Math.max(0.25, Math.abs(this.speed) / top);
      this.heading += turn * Math.sign(this.speed || 1) * dt * 2.2;
      // Steering at speed throws the tail out; grip bleeds the slide away.
      const fx = Math.sin(this.heading);
      const fz = Math.cos(this.heading);
      const push = this.steer * this.speed * dt * (input.handbrake ? 1.6 : 0.55);
      this.slideX += -fz * push;
      this.slideZ += fx * push;
      const bleed = Math.exp(-grip * dt);
      this.slideX *= bleed;
      this.slideZ *= bleed;
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
      const wheels = this.mesh.userData.wheels;
      for (let i = 0; i < wheels.length; i++) wheels[i].rotation.x += spin;
      // The front pair steers with the wheel.
      wheels[0].rotation.y = this.steer * 0.7;
      wheels[1].rotation.y = this.steer * 0.7;
    },
    remove() {
      if (heroCar === this) heroCar = null;
      scene.remove(this.mesh);
    },
  };
  if (hero) heroCar = car;
  car.sync();
  return car;
}

// Parked cars along the streets, waiting to be stolen. Each one sits on a
// street at a small offset, facing along it, so the row reads as parking.
export function spawnParkedCars(scene, rng, city, count) {
  const colours = [0xc94f4f, 0x4f7ec9, 0xd9c24f, 0x7a4fc9, 0x4fc97a, 0xd9d9d9, 0x2e2e38];
  return Array.from({ length: count }, () => {
    const across = rng.next() < 0.5;
    const street = rng.pick(city.streets);
    const along = rng.range(-140, 140);
    const side = rng.next() < 0.5 ? 1 : -1;
    const spot = across
      ? { x: along, z: street + side * 4.4, heading: side > 0 ? Math.PI / 2 : -Math.PI / 2 }
      : { x: street + side * 4.4, z: along, heading: side > 0 ? Math.PI : 0 };
    const car = createCar(scene, spot.x, spot.z, spot.heading, rng.pick(colours));
    car.parked = true;
    return car;
  });
}
