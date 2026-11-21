// Traffic: AI cars that stay on the road grid, keep to their lane, turn at
// intersections, and brake for the car ahead — including the player's.
import { TRAFFIC } from './config.js';
import { createCar } from './vehicles.js';

const COLORS = [0x8a8f96, 0x5a6b7a, 0x9a7a4a, 0x6a4a7a, 0xb8b0a0, 0x3a5a4a, 0x7a2a2a];

// Right-hand lanes: driving +x uses the +z side of the street, driving +z the -x side.
function laneOffset(axis, dir) {
  if (axis === 'x') return dir > 0 ? 2.6 : -2.6;
  return dir > 0 ? -2.6 : 2.6;
}

export function createTraffic(scene, rng, city) {
  const cars = [];
  // A traffic car is a wrapper around a drivable car: a lane (street and
  // axis), a speed, and a pause timer for yielding.
  function spawnCar() {
    const alongX = rng.next() < 0.5;
    const street = rng.pick(city.streets);
    const dir = rng.next() < 0.5 ? 1 : -1;
    const along = rng.range(-140, 140);
    const offset = laneOffset(alongX ? 'x' : 'z', dir);
    const x = alongX ? along : street + offset;
    const z = alongX ? street + offset : along;
    const heading = alongX ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI;
    const car = createCar(scene, x, z, heading, rng.pick(COLORS));
    car.parked = false;
    return { car, axis: alongX ? 'x' : 'z', dir, street, speed: rng.range(6, TRAFFIC.topSpeed), pause: 0 };
  }
  for (let i = 0; i < TRAFFIC.count; i++) cars.push(spawnCar());

  return {
    // A live getter: police and the player read the current fleet, not a
    // snapshot from startup.
    get cars() {
      return cars.map((t) => t.car);
    },
    // Move every traffic car to a fresh random lane. Used when a job starts,
    // so the streets are never empty where Dara is going.
    reposition() {
      for (const t of cars) {
        t.car.remove();
      }
      cars.length = 0;
      for (let i = 0; i < TRAFFIC.count; i++) cars.push(spawnCar());
    },
    removeCar(car) {
      const idx = cars.findIndex((t) => t.car === car);
      if (idx === -1) return;
      cars[idx].car.remove();
      cars.splice(idx, 1);
      cars.push(spawnCar());
    },
    // Drive each car along its street; at an intersection, sometimes turn
    // onto the crossing street. Brake when another car (or the player) is
    // ahead, and flare the brake lights while doing it.
    update(dt, G) {
      const obstacles = [
        ...cars.map((t) => t.car),
        ...(G.player.car ? [G.player.car] : []),
        ...G.police.cruisers,
      ];
      for (const t of cars) this.driveOne(t, dt, obstacles);
    },
    // One traffic car, one frame: pause, brake check, move, wrap, maybe turn.
    driveOne(t, dt, obstacles) {
      const c = t.car;
      if (t.pause > 0) {
        t.pause -= dt;
        c.sync();
        return;
      }
      const fx = Math.sin(c.heading);
      const fz = Math.cos(c.heading);
      // Look ahead 8 units for a car in front; brake if one is close.
      let blocked = false;
      for (const other of obstacles) {
        if (other === c) continue;
        const dx = other.pos.x - c.pos.x;
        const dz = other.pos.z - c.pos.z;
        const ahead = dx * fx + dz * fz;
        const side = Math.abs(dx * fz - dz * fx);
        if (ahead > 0 && ahead < 8 && side < 2.2) {
          blocked = true;
          break;
        }
      }
      if (blocked) {
        c.speed = Math.max(0, c.speed - dt * 12);
        c.mesh.userData.tailMat.color.setHex(0xff3830);
      } else {
        c.speed = Math.min(t.speed, c.speed + dt * 4);
        c.mesh.userData.tailMat.color.setHex(0x8c1616);
      }
      c.pos.x += fx * c.speed * dt;
      c.pos.z += fz * c.speed * dt;
      // Past the city edge, wrap to the far side on the same street.
      if (t.axis === 'x' && Math.abs(c.pos.x) > 150) c.pos.x = -Math.sign(c.pos.x) * 150;
      if (t.axis === 'z' && Math.abs(c.pos.z) > 150) c.pos.z = -Math.sign(c.pos.z) * 150;
      this.maybeTurn(t, c);
      c.sync();
    },
    // At an intersection, a small chance per frame to turn onto the crossing
    // street, keeping to the right-hand lane of the new street.
    maybeTurn(t, c) {
      const onStreet = city.streets.find((s) => Math.abs((t.axis === 'x' ? c.pos.z : c.pos.x) - s) < 1.5);
      const crossing = city.streets.find((s) => Math.abs((t.axis === 'x' ? c.pos.x : c.pos.z) - s) < 1.5);
      if (onStreet === undefined || crossing === undefined || rng.next() >= 0.003) return;
      const newAxis = t.axis === 'x' ? 'z' : 'x';
      const newDir = rng.next() < 0.5 ? 1 : -1;
      const offset = laneOffset(newAxis, newDir);
      if (newAxis === 'x') {
        c.pos.z = crossing + offset;
        c.heading = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        c.pos.x = crossing + offset;
        c.heading = newDir > 0 ? 0 : Math.PI;
      }
      t.axis = newAxis;
      t.dir = newDir;
      t.street = crossing;
    },
  };
}
