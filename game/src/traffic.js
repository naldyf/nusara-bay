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
  function spawnOne() {
    const axis = rng.next() < 0.5 ? 'x' : 'z';
    const line = rng.pick(city.streets);
    const dir = rng.next() < 0.5 ? 1 : -1;
    const along = rng.range(-150, 150);
    const off = laneOffset(axis, dir);
    const x = axis === 'x' ? along : line + off;
    const z = axis === 'x' ? line + off : along;
    const heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? Math.PI : 0;
    const car = createCar(scene, x, z, heading, rng.pick(COLORS));
    cars.push({ car, axis, line, dir, speed: rng.range(8, TRAFFIC.topSpeed) });
  }
  for (let i = 0; i < TRAFFIC.count; i++) spawnOne();

  return {
    // The exposed list is a live view, not a snapshot: removeCar splices the
    // internal array, and readers (player.js nearestCar, tryEnterCar) must
    // see the current cars. The old code took cars.map(...) once at
    // construction, so a stolen traffic car stayed stealable forever and a
    // freshly spawned one never was.
    get cars() {
      return cars.map((t) => t.car);
    },
    removeCar(car) {
      const i = cars.findIndex((t) => t.car === car);
      if (i >= 0) cars.splice(i, 1);
    },
    update(dt, G) {
      for (const t of cars) {
        const c = t.car;
        // Brake if the player (or another car) is right ahead.
        let ahead = 99;
        const fx = Math.sin(c.heading);
        const fz = Math.cos(c.heading);
        for (const other of [...cars.map((o) => o.car), G.player.car].filter(Boolean)) {
          if (other === c) continue;
          const dx = other.pos.x - c.pos.x;
          const dz = other.pos.z - c.pos.z;
          const forward = dx * fx + dz * fz;
          const side = Math.abs(dx * fz - dz * fx);
          if (forward > 0 && forward < 10 && side < 2.6) ahead = Math.min(ahead, forward);
        }
        const want = ahead < 8 ? 0 : t.speed;
        c.speed += Math.max(-14 * dt, Math.min(14 * dt, want - c.speed));
        // Brake lights flare while the car is braking for traffic ahead.
        c.mesh.userData.tailMat.color.setHex(want === 0 && c.speed > 2 ? 0xff4444 : 0x881111);
        c.pos.x += fx * c.speed * dt;
        c.pos.z += fz * c.speed * dt;
        // At an intersection, sometimes turn onto the crossing street.
        const along = t.axis === 'x' ? c.pos.x : c.pos.z;
        const nearCross = G.city.streets.find((s) => Math.abs(along - s) < 1.2);
        if (nearCross !== undefined && rng.next() < dt * 0.5) {
          const cross = rng.pick(G.city.streets);
          const ndir = rng.next() < 0.5 ? 1 : -1;
          const noff = laneOffset(t.axis === 'x' ? 'z' : 'x', ndir);
          if (t.axis === 'x') {
            c.pos.z = nearCross + laneOffset('z', ndir);
            c.pos.x = cross + noff;
            c.heading = ndir > 0 ? Math.PI : 0;
            t.axis = 'z';
            t.line = cross;
            t.dir = ndir;
          } else {
            c.pos.x = nearCross + laneOffset('x', ndir);
            c.pos.z = cross + noff;
            c.heading = ndir > 0 ? Math.PI / 2 : -Math.PI / 2;
            t.axis = 'x';
            t.line = cross;
            t.dir = ndir;
          }
        }
        // Wrap around the city edge so traffic never runs out.
        if (c.pos.x > 165) c.pos.x = -165;
        if (c.pos.x < -165) c.pos.x = 165;
        if (c.pos.z > 165) c.pos.z = -165;
        if (c.pos.z < -165) c.pos.z = 165;
        c.sync();
      }
    },
  };
}
