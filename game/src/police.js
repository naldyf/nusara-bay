// The law: a wanted level from 1 to 5 stars, cruisers that chase and ram,
// roadblocks from 3 stars up, and a bust if they catch Dara on foot.
import { POLICE } from './config.js';
import { createCar } from './vehicles.js';
import { playerDistance } from './player.js';

export function createPolice(scene, rng, city) {
  const police = {
    wanted: 0,
    cruisers: [],
    roadblocks: [],
    decayTimer: 0,
    bustedTimer: 0,
    roadblockTimer: 0,
    addWanted(n, reason) {
      const before = this.wanted;
      this.wanted = Math.min(5, this.wanted + n);
      this.decayTimer = 0;
      if (this.wanted > before && reason) {
        if (window.__nusara) window.__nusara.dispatch = reason;
      }
    },
    // Spawn a cruiser at a random bearing around the player, within the
    // chase radius, and register it as an active unit.
    spawnCruiser(G) {
      const a = rng.range(0, Math.PI * 2);
      const p = G.player.onFoot ? G.player.pos : G.player.car.pos;
      const x = p.x + Math.sin(a) * POLICE.spawnDist;
      const z = p.z + Math.cos(a) * POLICE.spawnDist;
      const cruiser = createCar(scene, x, z, a, 0x222630, true);
      cruiser.parked = false;
      this.cruisers.push(cruiser);
      return cruiser;
    },
    // Bring the fleet up to the strength the wanted level demands.
    dispatchUnits(G) {
      const need = Math.min(POLICE.maxCruisers, this.wanted);
      while (this.cruisers.length < need) this.spawnCruiser(G);
    },
    // One cruiser, one frame: steer at the player, accelerate, strobe the
    // light bar, and ram on contact. Returns 'busted' when the bust lands,
    // true when the cruiser is touching the player, false otherwise.
    chaseOne(cruiser, dt, G, playerPos) {
      const dx = playerPos.x - cruiser.pos.x;
      const dz = playerPos.z - cruiser.pos.z;
      const dist = Math.hypot(dx, dz) || 1;
      const targetHeading = Math.atan2(dx, dz);
      let diff = targetHeading - cruiser.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      cruiser.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
      cruiser.speed = Math.min(POLICE.cruiserTop, cruiser.speed + POLICE.cruiserAccel * dt);
      cruiser.pos.x += Math.sin(cruiser.heading) * cruiser.speed * dt;
      cruiser.pos.z += Math.cos(cruiser.heading) * cruiser.speed * dt;
      // Strobe the light bar — the red/blue alternation is the chase's
      // visual signature, and the colour flip every 100 ms is the beat.
      if (cruiser.mesh.userData.lightBar) {
        const on = Math.floor(G.time * 10) % 2 === 0;
        cruiser.mesh.userData.lightBar.material.emissive.setHex(on ? 0xff2244 : 0x2244ff);
      }
      if (dist >= 2.6) {
        cruiser.sync();
        return false;
      }
      if (G.player.onFoot) {
        this.bustedTimer += dt;
        if (this.bustedTimer > POLICE.bustedTime) {
          G.gameOver('BUSTED — the NCPD caught you');
          return 'busted';
        }
        cruiser.sync();
        return true;
      }
      const hit = Math.min(30, cruiser.speed * 0.4);
      G.damage(hit);
      G.shake = Math.min(1, G.shake + 0.3);
      cruiser.speed *= 0.4;
      cruiser.pos.x -= Math.sin(cruiser.heading) * 3;
      cruiser.pos.z -= Math.cos(cruiser.heading) * 3;
      G.audio.gunshot();
      cruiser.sync();
      return true;
    },
    update(dt, G) {
      if (this.wanted === 0) return;
      this.dispatchUnits(G);
      const playerPos = G.player.onFoot ? G.player.pos : G.player.car.pos;
      // A cruiser rams by steering at the player; the faster the cruiser,
      // the harder the hit. The camera shake and damage flash sell it.
      let touching = false;
      for (const cruiser of [...this.cruisers]) {
        if (cruiser.dead) continue;
        const result = this.chaseOne(cruiser, dt, G, playerPos);
        if (result === 'busted') return;
        if (result) touching = true;
      }
      // The bust clock only runs while a cruiser is actually touching Dara;
      // breaking contact resets it.
      if (!touching) this.bustedTimer = 0;
      // Quiet time with no cruiser near lets a star fade.
      const nearest = Math.min(...this.cruisers.map((c) => Math.hypot(c.pos.x - playerPos.x, c.pos.z - playerPos.z)));
      if (nearest > 60) {
        this.decayTimer += dt;
        if (this.decayTimer > POLICE.decayDelay) {
          this.wanted--;
          this.decayTimer = 0;
        }
      } else {
        this.decayTimer = 0;
      }
      // Roadblocks from 3 stars up: two parked cruisers across the road,
      // every 12 seconds, at a random street ahead of the player.
      if (this.wanted >= 3) {
        this.roadblockTimer += dt;
        if (this.roadblockTimer > 12) {
          this.roadblockTimer = 0;
          const street = city.streets[Math.floor(rng.next() * city.streets.length)];
          const along = playerPos.z + 60;
          const cars = [];
          for (const [offset, angle] of [
            [-3, 0],
            [3, 0],
          ]) {
            const block = createCar(scene, street + offset, along, angle, 0x222630, true);
            block.parked = true;
            cars.push(block);
          }
          this.roadblocks.push({ cars });
        }
      }
      // A cruiser that is far from the player and out of the chase is
      // retired, so the fleet never grows without bound.
      for (const cruiser of [...this.cruisers]) {
        const d = Math.hypot(cruiser.pos.x - playerPos.x, cruiser.pos.z - playerPos.z);
        if (d > 160) {
          cruiser.remove();
          this.cruisers = this.cruisers.filter((c) => c !== cruiser);
        }
      }
    },
  };
  return police;
}
