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
      this.wanted = Math.max(0, Math.min(5, this.wanted + n));
      if (this.wanted > before) {
        this.decayTimer = 0;
      }
    },
    spawnCruiser(G) {
      const p = G.player.onFoot ? G.player.pos : G.player.car.pos;
      const a = rng.range(0, Math.PI * 2);
      const x = p.x + Math.sin(a) * POLICE.spawnDist;
      const z = p.z + Math.cos(a) * POLICE.spawnDist;
      const cruiser = createCar(scene, x, z, a, 0x1a1a22, true);
      cruiser.health = 3;
      cruiser.ramCooldown = 0;
    cruiser.flashPhase = this.cruisers.length % 2; // alternate the light-bar
    // flash so two cruisers never blink in perfect sync — the bar reads as
    // separate vehicles, not one light copied twice.
      this.cruisers.push(cruiser);
      return cruiser;
    },
    spawnRoadblock(G) {
      const p = G.player.car ? G.player.car.pos : G.player.pos;
      const heading = G.player.car ? G.player.car.heading : G.player.heading;
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      const cx = p.x + fx * 26;
      const cz = p.z + fz * 26;
      const block = [];
      for (const off of [-3.4, 0, 3.4]) {
        const car = createCar(scene, cx - fz * off, cz + fx * off, heading + Math.PI / 2, 0x1a1a22, true);
        car.health = 3;
        car.parked = true;
        block.push(car);
      }
      this.roadblocks.push({ cars: block, ttl: 14 });
    },
    // Rows for the dispatch panel: callsign, live distance in metres, and
    // what that unit is doing right now. The HUD reads this every frame, so
    // the numbers tick — a panel that never moves reads as a mockup.
    dispatchUnits(G) {
      const p = G.player.onFoot ? G.player.pos : G.player.car.pos;
      const playerSpeed = G.player.car ? Math.abs(G.player.car.speed) : 0;
      const rows = this.cruisers.map((c, i) => {
        const dist = Math.round(Math.hypot(c.pos.x - p.x, c.pos.z - p.z));
        return {
          callsign: `NCPD-0${i + 1}`,
          dist,
          tag: dist < 6 && playerSpeed > 8 ? 'RAMMING' : 'PURSUE',
        };
      });
      if (this.roadblocks.length) {
        const b = this.roadblocks[0].cars[0];
        rows.push({
          callsign: 'BLOCK',
          dist: Math.round(Math.hypot(b.pos.x - p.x, b.pos.z - p.z)),
          tag: 'ROADBLOCK',
        });
      }
      return rows;
    },
    update(dt, G) {
      const p = G.player.onFoot ? G.player.pos : G.player.car.pos;
      const playerSpeed = G.player.car ? Math.abs(G.player.car.speed) : 0;
      // Cruiser count follows the wanted level.
      const want = this.wanted === 0 ? 0 : Math.min(1 + Math.floor(this.wanted / 2), POLICE.maxCruisers);
      while (this.cruisers.length < want) this.spawnCruiser(G);
      while (this.cruisers.length > want) {
        const c = this.cruisers.pop();
        c.remove();
      }
      // Roadblocks at 3+ stars, refreshed ahead of the player.
      this.roadblockTimer -= dt;
      if (this.wanted >= 3 && this.roadblockTimer <= 0 && this.roadblocks.length < 1) {
        this.spawnRoadblock(G);
        this.roadblockTimer = 9;
      }
      for (const block of this.roadblocks) block.ttl -= dt;
      while (this.roadblocks.length && this.roadblocks[0].ttl <= 0) {
        for (const c of this.roadblocks.shift().cars) c.remove();
      }
      // Pursuit: steer toward the player, ram on contact.
      for (const c of this.cruisers) {
        c.ramCooldown -= dt;
        const dx = p.x - c.pos.x;
        const dz = p.z - c.pos.z;
        const dist = Math.hypot(dx, dz);
        const wantHeading = Math.atan2(dx, dz);
        let diff = wantHeading - c.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        c.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
        const top = POLICE.cruiserTop + this.wanted * 0.7;
        c.speed += Math.max(-POLICE.cruiserAccel * dt, Math.min(POLICE.cruiserAccel * dt, top - c.speed));
        c.pos.x += Math.sin(c.heading) * c.speed * dt;
        c.pos.z += Math.cos(c.heading) * c.speed * dt;
        // Keep cruisers on the streets: slide them back inside the city.
        c.pos.x = Math.max(-168, Math.min(168, c.pos.x));
        c.pos.z = Math.max(-168, Math.min(168, c.pos.z));
        c.sync();
        // Flash the light bar red/blue.
        const bar = c.mesh.userData.lightBar;
        if (bar) bar.material.emissive.setHex(Math.floor(G.time * 6 + (c.flashPhase || 0)) % 2 ? 0xff2222 : 0x2244ff);
        // Ram: shove the player's car and hurt them.
        if (dist < 4.2 && c.ramCooldown <= 0) {
          c.ramCooldown = 1.2;
          if (G.player.car) {
            G.player.car.slideX += (dx / (dist || 1)) * -6;
            G.player.car.slideZ += (dz / (dist || 1)) * -6;
            G.player.car.speed *= 0.75;
            G.damage(POLICE.ramDamage, 'RAMMED BY POLICE');
          } else if (dist < POLICE.bustedRange) {
            this.bustedTimer += dt;
          }
          if (playerSpeed > 8) {
            c.health -= 1;
            if (c.health <= 0) this.disableCruiser(c, G);
          }
        }
      }
      // Busted: a cruiser standing on Dara while he is on foot.
      if (G.player.onFoot) {
        const near = this.cruisers.some((c) => playerDistance(G, c.pos.x, c.pos.z) < POLICE.bustedRange);
        if (near) {
          this.bustedTimer += dt;
          if (this.bustedTimer >= POLICE.bustedTime) G.gameOver('BUSTED');
        } else {
          this.bustedTimer = 0;
        }
      }
      // Wanted decays once the heat is off.
      if (this.wanted > 0) {
        const near = this.cruisers.some((c) => playerDistance(G, c.pos.x, c.pos.z) < 45);
        if (!near) {
          this.decayTimer += dt;
          if (this.decayTimer >= POLICE.decayDelay) {
            this.wanted -= 1;
            this.decayTimer = 0;
          }
        } else {
          this.decayTimer = 0;
        }
      }
    },
    disableCruiser(c, G) {
      c.dead = true;
      c.speed = 0;
      G.effects.spawnSmoke(c.pos.x, c.pos.z, 14);
      G.hud.toast('CRUISER DISABLED');
      const i = this.cruisers.indexOf(c);
      if (i >= 0) this.cruisers.splice(i, 1);
      setTimeout(() => c.remove(), 4000);
    },
  };
  return police;
}
