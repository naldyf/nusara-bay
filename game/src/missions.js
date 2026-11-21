// The job system: pickup, timed drive, drop-off, pay. One job at a time,
// a marker on the ground and on the minimap, a clock, and a rival for the
// race. Failing is not the end — the same job can be retried from the
// prompt, and the next job waits until this one lands.
import * as THREE from 'three';
import { STORY } from './story.js';
import { JOB_TIME } from './config.js';
import { playerDistance } from './player.js';
import { createCar } from './vehicles.js';

export function createMissions(scene, G) {
  // A golden marker disc on the ground, with a ring that pulses.
  const marker = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 0.05, 24),
    new THREE.MeshStandardMaterial({ color: 0xffd21f, transparent: true, opacity: 0.55 }),
  );
  disc.position.y = 0.03;
  marker.add(disc);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.6, 2.9, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd21f, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  marker.add(ring);
  marker.visible = false;
  scene.add(marker);

  const state = {
    jobIndex: 0,
    phase: 'idle',
    dropIndex: 0,
    rival: null,
    stealCar: null,
    // The mission clock, in game-seconds. Staging (shots.js) sets it
    // directly to frame a screenshot; the game only ever counts it down.
    timer: JOB_TIME.pickup,
    // The current objective line, for the HUD and the test suite.
    get objective() {
      const job = STORY.jobs[this.jobIndex];
      if (!job) return 'All jobs complete';
      if (this.phase === 'pickup') {
        return job.steal ? `Steal the car — ${job.pickup.label}` : `Pick up at ${job.pickup.label}`;
      }
      if (this.phase === 'deliver') {
        const drop = job.drops ? job.drops[this.dropIndex] : job.drop;
        return `Deliver to ${drop.label}`;
      }
      if (this.phase === 'failed') return 'Job failed — press ENTER to retry';
      if (this.phase === 'done') return 'Job complete';
      return `Press ENTER to start Job ${job.id}`;
    },
    hudInfo() {
      return {
        jobIndex: this.jobIndex,
        job: STORY.jobs[this.jobIndex],
        phase: this.phase,
        timer: this.timer,
        objective: this.objective,
        cash: G.cash,
        jobsDone: G.jobsDone,
        debtCleared: G.debtCleared,
      };
    },
    // Move the ground marker and the minimap objective together.
    placeMarker(x, z) {
      marker.position.set(x, 0.05, z);
      marker.visible = true;
      G.minimap.setObjective(x, z);
    },
    // Start (or retry) a job: fresh timer, fresh marker, fresh rival.
    startJob(i) {
      const job = STORY.jobs[i];
      if (!job) return;
      if (this.rival) {
        this.rival.car.remove();
        this.rival = null;
      }
      // A steal car from the last attempt that Dara never took is scrapped;
      // one Dara is sitting in stays put.
      if (this.stealCar && this.stealCar !== G.player.car) {
        this.stealCar.remove();
        G.parked = G.parked.filter((c) => c !== this.stealCar);
      }
      this.stealCar = null;
      this.jobIndex = i;
      this.phase = 'pickup';
      this.dropIndex = 0;
      this.timer = JOB_TIME.pickup;
      if (job.steal) {
        const stolen = createCar(scene, job.pickup.x, job.pickup.z, 0, job.stealColor);
        stolen.parked = true;
        G.parked.push(stolen);
        this.stealCar = stolen;
      }
      if (job.race) {
        const [rx, rz] = job.rivalRoute[0];
        // Viko lines up facing the route (north, toward the gate) — he is
        // a racer at the start line, not a car parked the wrong way round.
        // Facing away would cost him a full U-turn before the race begins.
        const rivalCar = createCar(scene, rx, rz, Math.PI, 0xe14b4b);
        rivalCar.parked = false;
        this.rival = { car: rivalCar, route: job.rivalRoute, idx: 1, speed: 0, topSpeed: job.rivalSpeed, active: true };
      }
      this.placeMarker(job.pickup.x, job.pickup.z);
      G.hud.setStory('Madame Sari', job.briefing);
      G.hud.setPrompt(null);
    },
    // A leg is done: the pickup, or a drop. Pay only on the final drop.
    completeLeg() {
      const job = STORY.jobs[this.jobIndex];
      if (this.phase === 'pickup') {
        G.audio.pickup();
        G.hud.toast(job.steal ? 'CAR SECURED — now lose the heat' : 'CARGO SECURED — clock is running');
        if (job.heat) G.police.addWanted(job.heat, 'PICKUP — heat on Dara');
        this.phase = 'deliver';
        this.timer = JOB_TIME.deliver;
        const first = job.drops ? job.drops[0] : job.drop;
        this.placeMarker(first.x, first.z);
        return;
      }
      if (this.phase !== 'deliver') return;
      if (job.drops && this.dropIndex < job.drops.length - 1) {
        this.dropIndex++;
        this.timer = JOB_TIME.deliver;
        const next = job.drops[this.dropIndex];
        this.placeMarker(next.x, next.z);
        G.hud.toast(`DROP ${this.dropIndex} OF ${job.drops.length} — next: ${next.label}`);
        return;
      }
      G.cash += job.pay;
      // jobsDone is the highest job id finished, not a count of completions:
      // the suite (and the save) jump between jobs, so finishing job 5
      // while only job 1 is done must read as 5, not 2.
      G.jobsDone = Math.max(G.jobsDone, this.jobIndex + 1);
      this.jobIndex++;
      if (this.rival) this.rival.active = false;
      G.audio.payout();
      G.hud.toast(`JOB ${job.id} DONE — +$${job.pay}`);
      G.hud.setDispatch(`Job ${job.id} complete — $${job.pay} banked`);
      if (G.jobsDone >= STORY.jobs.length) {
        G.debtCleared = true;
        G.hud.setStory('Madame Sari', 'The debt is paid. Nusara Bay is yours, Dara. Drive anywhere.');
        G.hud.toast('DEBT CLEARED — $6,400 PAID OFF');
        G.hud.setDispatch('Debt cleared — the bay is free');
      }
      this.phase = 'done';
      marker.visible = false;
      G.minimap.setObjective(null, null);
      if (this.jobIndex < STORY.jobs.length) {
        G.hud.setPrompt('PRESS ENTER FOR THE NEXT JOB');
      }
    },
    failJob(reason) {
      this.phase = 'failed';
      G.hud.toast(reason);
      G.hud.setDispatch(reason);
      G.hud.setPrompt('PRESS ENTER TO RETRY');
    },
    // Called every frame: arrivals, the clock, and the rival's race.
    update(dt) {
      if (this.phase === 'idle' || this.phase === 'done' || this.phase === 'failed') return;
      const job = STORY.jobs[this.jobIndex];
      if (!job) return;
      // The marker breathes so it is visible from the car.
      const pulse = 1 + Math.sin(G.time * 3) * 0.08;
      marker.scale.set(pulse, 1, pulse);
      this.timer -= dt;
      if (this.timer <= 0) {
        this.failJob('Out of time — the client walked');
        return;
      }
      if (this.phase === 'pickup') {
        if (job.steal) {
          if (G.player.car === this.stealCar) this.completeLeg();
        } else if (playerDistance(G, job.pickup.x, job.pickup.z) < (G.player.onFoot ? 3.5 : 6)) {
          this.completeLeg();
        }
      } else if (this.phase === 'deliver') {
        const drop = job.drops ? job.drops[this.dropIndex] : job.drop;
        if (playerDistance(G, drop.x, drop.z) < (G.player.onFoot ? 3.5 : 6)) {
          this.completeLeg();
        }
      }
      // The rival drives his route; if he reaches the finish first, the job is lost.
      const rival = this.rival;
      if (rival && rival.active) this.driveRival(rival, dt);
    },
    // One rival frame: chase the next waypoint, and fail the job when the
    // route is finished. The rival brakes for the corner — his target speed
    // falls as the waypoint gets close — so a fast rival cannot overshoot
    // it and oscillate forever. Steering and speed both change at a
    // limited rate, so the car reads as driven, not teleported.
    driveRival(rival, dt) {
      const target = rival.route[rival.idx];
      const dx = target[0] - rival.car.pos.x;
      const dz = target[1] - rival.car.pos.z;
      const dist = Math.hypot(dx, dz);
      // A racer cuts the corner: intermediate waypoints only guide the
      // line, so he turns for the next one from 12 units out instead of
      // braking to a crawl at each one. Only the finish line itself
      // needs the tight 6-unit radius.
      const lastLeg = rival.idx >= rival.route.length - 1;
      const arriveAt = lastLeg ? 6 : 12;
      if (dist < arriveAt) {
        rival.idx++;
        if (rival.idx >= rival.route.length) {
          rival.active = false;
          this.failJob('Viko reached the North Gate first');
        }
        return;
      }
      const wantHeading = Math.atan2(dx, dz);
      let diff = wantHeading - rival.car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      rival.car.heading += Math.max(-3.5 * dt, Math.min(3.5 * dt, diff));
      const wantSpeed = Math.min(rival.topSpeed, Math.max(7, dist * 0.9));
      // The rival changes speed briskly (±25/s): he gets up to speed fast
      // and, more importantly, can actually shed speed before a waypoint
      // instead of sailing past it and having to come back. A race rival
      // that cannot brake is not a rival, it is a missile.
      const speedDelta = Math.max(-25 * dt, Math.min(25 * dt, wantSpeed - rival.speed));
      rival.speed += speedDelta;
      rival.car.pos.x += Math.sin(rival.car.heading) * rival.speed * dt;
      rival.car.pos.z += Math.cos(rival.car.heading) * rival.speed * dt;
      rival.car.sync();
    },
  };
  return state;
}
