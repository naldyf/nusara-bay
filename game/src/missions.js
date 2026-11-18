// Missions: the job state machine. Pickup → timed drive → drop-off, with a
// glowing marker in the world, a blip on the minimap, and the objective line
// on the HUD. Job 3 is a steal: the pickup is a marked car, and getting in it
// starts the escape with three wanted stars.
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
    jobIndex: 0, // 0-based; jobs 1–3 playable in v1
    phase: 'idle', // idle | pickup | deliver | done
    timer: 0,
    markedCar: null,
    objective: 'Free roam — steal a car, or start Job 1 at the marker.',
    startJob(i) {
      const job = STORY.jobs[i];
      this.jobIndex = i;
      this.phase = 'pickup';
      this.timer = 0;
      this.objective = `JOB ${job.id}: ${job.title} — go to ${job.pickup.label}`;
      G.hud.toast(`JOB ${job.id}: ${job.title}`);
      G.hud.setStory(job.briefing);
      if (job.steal && !this.markedCar) {
        const car = createCar(scene, job.pickup.x, job.pickup.z, Math.PI / 2, 0xd9a527);
        car.parked = true;
        car.marked = true;
        G.parked.push(car);
        this.markedCar = car;
      }
      this.placeMarker(job.pickup.x, job.pickup.z);
      G.minimap.setObjective(job.pickup.x, job.pickup.z);
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
    completeJob() {
      const job = STORY.jobs[this.jobIndex];
      G.cash += job.pay;
      G.hud.toast(`JOB ${job.id} COMPLETE — $${job.pay}`);
      G.audio.payout();
      this.phase = 'done';
      this.hideMarker();
      G.saveGame();
      if (this.jobIndex < 2) {
        this.objective = `Job ${job.id} done — $${job.pay} earned. Next job is waiting.`;
        setTimeout(() => this.startJob(this.jobIndex + 1), 2500);
      } else {
        this.objective = 'V1 complete — jobs 4–8 arrive in the next build. Free roam!';
      }
    },
    failJob(reason) {
      const job = STORY.jobs[this.jobIndex];
      G.hud.toast(`JOB ${job.id} FAILED — ${reason}`);
      this.phase = 'pickup';
      this.timer = 0;
      this.objective = `JOB ${job.id}: ${job.title} — go to ${job.pickup.label} to retry`;
      this.placeMarker(job.pickup.x, job.pickup.z);
      G.minimap.setObjective(job.pickup.x, job.pickup.z);
    },
    update(dt) {
      if (this.phase === 'idle' || this.phase === 'done') return;
      const job = STORY.jobs[this.jobIndex];
      const target = this.phase === 'pickup' ? job.pickup : job.drop;
      if (this.phase === 'deliver') {
        this.timer -= dt;
        const t = Math.max(0, this.timer);
        this.objective = `JOB ${job.id}: deliver to ${job.drop.label} — ${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
        if (this.timer <= 0) {
          this.failJob('too slow');
          return;
        }
      }
      // Job 3: the pickup completes when Dara gets into the marked car.
      if (job.steal && this.phase === 'pickup') {
        if (G.player.car === this.markedCar) {
          this.phase = 'deliver';
          this.timer = job.time;
          this.placeMarker(job.drop.x, job.drop.z);
          G.minimap.setObjective(job.drop.x, job.drop.z);
          G.police.addWanted(3, 'WANTED — 3 STARS');
          G.hud.toast('LOSE THE HEAT — get to the safehouse!');
          return;
        }
      } else if (playerDistance(G, target.x, target.z) < 7) {
        if (this.phase === 'pickup') {
          this.phase = 'deliver';
          this.timer = job.time;
          this.placeMarker(job.drop.x, job.drop.z);
          G.minimap.setObjective(job.drop.x, job.drop.z);
          G.hud.toast('PACKAGE SECURED — drive!');
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
