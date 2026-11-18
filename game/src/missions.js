// Missions: the job state machine. Pickup → timed drive → drop-off, with a
// glowing marker in the world, a blip on the minimap, and the objective line
// on the HUD. Each job adds its own twist on top of that loop: a steal (the
// pickup is a marked car), heat (stars the moment the cargo is grabbed),
// several drops in a row, or a rival driver racing the same route. Finish
// job 8 and the $6,400 debt is cleared.
import * as THREE from 'three';
import { STORY } from './story.js';
import { createCar } from './vehicles.js';
import { playerDistance } from './player.js';

export function createMissions(scene, G) {
  const ringGeo = new THREE.TorusGeometry(3.2, 0.25, 8, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd21f });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);
  const beamGeo = new THREE.CylinderGeometry(0.5, 0.5, 26, 8, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffd21f,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.visible = false;
  scene.add(beam);

  const missions = {
    jobIndex: 0, // 0-based; all 8 jobs playable
    phase: 'idle', // idle | pickup | deliver | done
    timer: 0,
    markedCar: null,
    markedCarJob: -1,
    dropList: null,
    dropIndex: 0,
    rival: null,
    objective: 'Free roam — steal a car, or start Job 1 at the marker.',
    startJob(i) {
      const job = STORY.jobs[i];
      this.jobIndex = i;
      this.phase = 'pickup';
      this.timer = 0;
      this.dropList = job.drops ? job.drops.slice() : null;
      this.dropIndex = 0;
      this.objective = `JOB ${job.id}: ${job.title} — go to ${job.pickup.label}`;
      G.hud.toast(`JOB ${job.id}: ${job.title}`);
      G.hud.setStory(job.briefing);
      this.clearRival();
      if (job.steal) this.spawnMarkedCar(job);
      if (job.race) this.spawnRival(job);
      this.placeMarker(job.pickup.x, job.pickup.z);
      G.minimap.setObjective(job.pickup.x, job.pickup.z);
    },
    // One marked car per steal job, in that job's own paint. The old one is
    // cleared when the next steal job starts — unless Dara is driving it.
    spawnMarkedCar(job) {
      if (this.markedCar) {
        const old = this.markedCar;
        if (G.player.car !== old && !old.playerOwned) {
          old.remove();
          G.parked = G.parked.filter((c) => c !== old);
        } else {
          // It is Dara's car now — keep it, just unmark it.
          old.marked = false;
        }
        this.markedCar = null;
      }
      const car = createCar(scene, job.pickup.x, job.pickup.z, Math.PI / 2, job.stealColor ?? 0xd9a527);
      car.parked = true;
      car.marked = true;
      G.parked.push(car);
      this.markedCar = car;
      this.markedCarJob = this.jobIndex;
    },
    // Viko's car waits beside the strip until the pickup, then drives the
    // route on the street grid. It never leaves the roads, so it needs no
    // collision handling — the waypoints are all on streets.
    spawnRival(job) {
      const [sx, sz] = job.rivalRoute[0];
      const car = createCar(scene, sx + 6, sz, Math.PI, 0xff6b2e);
      car.parked = true;
      this.rival = {
        car,
        route: job.rivalRoute,
        idx: 0,
        speed: 0,
        topSpeed: job.rivalSpeed ?? 16,
        active: false,
      };
    },
    clearRival() {
      if (this.rival) {
        this.rival.car.remove();
        this.rival = null;
      }
    },
    resetRival() {
      const r = this.rival;
      if (!r) return;
      const [sx, sz] = r.route[0];
      r.car.pos.x = sx + 6;
      r.car.pos.z = sz;
      r.car.heading = Math.PI;
      r.car.speed = 0;
      r.speed = 0;
      r.idx = 0;
      r.active = false;
      r.car.sync();
    },
    updateRival(dt) {
      const r = this.rival;
      if (!r || !r.active) return;
      const [tx, tz] = r.route[r.idx];
      const dx = tx - r.car.pos.x;
      const dz = tz - r.car.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 6) {
        r.idx++;
        if (r.idx >= r.route.length) {
          this.failJob('Viko reached the North Gate first');
          return;
        }
        return;
      }
      const wantHeading = Math.atan2(dx, dz);
      let diff = wantHeading - r.car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      r.car.heading += Math.max(-3.5 * dt, Math.min(3.5 * dt, diff));
      // Brake for the corner: a fast car cannot turn tight enough to catch
      // a waypoint, so the target speed drops as the waypoint gets close.
      // On a straight the rival still runs flat out.
      const wantSpeed = Math.min(r.topSpeed, Math.max(7, d * 0.9));
      r.speed += Math.max(-14 * dt, Math.min(14 * dt, wantSpeed - r.speed));
      r.car.pos.x += Math.sin(r.car.heading) * r.speed * dt;
      r.car.pos.z += Math.cos(r.car.heading) * r.speed * dt;
      r.car.sync();
    },
    placeMarker(x, z) {
      ring.position.set(x, 0.3, z);
      beam.position.set(x, 13, z);
      ring.visible = true;
      beam.visible = true;
      this.markerPos = { x, z };
    },
    hideMarker() {
      ring.visible = false;
      beam.visible = false;
      this.markerPos = null;
      G.minimap.setObjective(null);
    },
    currentDrop() {
      const job = STORY.jobs[this.jobIndex];
      if (this.dropList) return this.dropList[this.dropIndex];
      return job.drop;
    },
    // The pickup is done: the clock starts, the heat (if any) arrives, and
    // the rival starts his engine.
    onPickup() {
      const job = STORY.jobs[this.jobIndex];
      this.phase = 'deliver';
      this.timer = job.time;
      const drop = this.currentDrop();
      this.placeMarker(drop.x, drop.z);
      G.minimap.setObjective(drop.x, drop.z);
      if (job.heat) {
        G.police.addWanted(job.heat, job.heat >= 5 ? 'FIVE STARS — RUN' : 'WANTED — HEAT ON THE JOB');
        G.hud.toast(job.heat >= 5 ? 'FIVE STARS — LOSE THEM ALL' : 'HEAT ON THE JOB — DRIVE');
      }
      if (this.rival) {
        this.rival.active = true;
        G.hud.toast('VIKO IS RACING YOU — BEAT HIM TO THE GATE');
      }
      if (this.dropList) {
        G.hud.toast(`DROP 1 OF ${this.dropList.length} — drive!`);
      } else {
        G.hud.toast('PACKAGE SECURED — drive!');
      }
      G.audio.pickup();
    },
    completeJob() {
      const job = STORY.jobs[this.jobIndex];
      G.cash += job.pay;
      G.jobsDone = Math.max(G.jobsDone, this.jobIndex + 1);
      G.hud.toast(`JOB ${job.id} COMPLETE — $${job.pay}`);
      G.audio.payout();
      this.phase = 'done';
      this.hideMarker();
      this.clearRival();
      G.saveGame();
      if (this.jobIndex < STORY.jobs.length - 1) {
        this.objective = `Job ${job.id} done — $${job.pay} earned. Next job is waiting.`;
        setTimeout(() => this.startJob(this.jobIndex + 1), 2500);
      } else {
        // The finale: eight jobs, $6,400 paid off, Dara walks free.
        G.debtCleared = true;
        G.hud.setStory('Madame Sari: "The debt is paid, Dara. Eight jobs, clean. The bay is yours now."');
        G.hud.toast('DEBT CLEARED — $6,400 PAID. DARA IS FREE.');
        this.objective = 'DEBT CLEARED — $6,400 paid. Dara is free. Free roam!';
        G.saveGame();
      }
    },
    failJob(reason) {
      const job = STORY.jobs[this.jobIndex];
      G.hud.toast(`JOB ${job.id} FAILED — ${reason}`);
      this.phase = 'pickup';
      this.timer = 0;
      this.dropIndex = 0;
      this.resetRival();
      this.objective = `JOB ${job.id}: ${job.title} — go to ${job.pickup.label} to retry`;
      this.placeMarker(job.pickup.x, job.pickup.z);
      G.minimap.setObjective(job.pickup.x, job.pickup.z);
    },
    update(dt) {
      if (this.phase === 'idle' || this.phase === 'done') return;
      const job = STORY.jobs[this.jobIndex];
      if (this.phase === 'deliver') {
        this.timer -= dt;
        const t = Math.max(0, this.timer);
        const drop = this.currentDrop();
        const leg = this.dropList ? `DROP ${this.dropIndex + 1}/${this.dropList.length} — ` : '';
        this.objective = `JOB ${job.id}: ${leg}deliver to ${drop.label} — ${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
        if (this.timer <= 0) {
          this.failJob('too slow');
          return;
        }
        this.updateRival(dt);
        // The rival may have won the race and failed the job — stop here.
        if (this.phase !== 'deliver') return;
      }
      const target = this.phase === 'pickup' ? job.pickup : this.currentDrop();
      // Steal jobs: the pickup completes when Dara gets into the marked car.
      if (job.steal && this.phase === 'pickup') {
        if (G.player.car === this.markedCar) {
          this.onPickup();
          return;
        }
      } else if (playerDistance(G, target.x, target.z) < 7) {
        if (this.phase === 'pickup') {
          this.onPickup();
        } else if (this.dropList && this.dropIndex < this.dropList.length - 1) {
          // One drop down — the next marker goes up and the clock resets.
          this.dropIndex++;
          this.timer = job.time;
          const next = this.currentDrop();
          this.placeMarker(next.x, next.z);
          G.minimap.setObjective(next.x, next.z);
          G.hud.toast(`DROP ${this.dropIndex} OF ${this.dropList.length} DONE — next!`);
          G.audio.pickup();
        } else {
          this.completeJob();
        }
      }
      const pulse = 1 + Math.sin(G.time * 4) * 0.15;
      ring.scale.set(pulse, pulse, 1);
    },
  };
  return missions;
}
