// The live minimap: a 2D canvas, north-up, drawn every frame from the same
// world the 3D view shows — roads, water, the player arrow, police dots,
// the mission objective, and the safehouse. It is the cheapest visible proof
// of "open world" in every screenshot.
import { WORLD } from './config.js';

const SIZE = 168;
const SCALE = SIZE / (WORLD.half * 2 + 20);

export function createMinimap(canvas, city) {
  const ctx = canvas.getContext('2d');
  canvas.width = SIZE;
  canvas.height = SIZE;
  let objective = null;
  function toMap(x, z) {
    return [(x + WORLD.half + 10) * SCALE, (z + WORLD.half + 10) * SCALE];
  }
  return {
    setObjective(x, z) {
      objective = x === null ? null : { x, z };
    },
    draw(G) {
      ctx.clearRect(0, 0, SIZE, SIZE);
      // District blocks, drawn first so the roads sit on top of them: the
      // map reads as a city at a glance, not a bare grid. At contact-sheet
      // size the blocks are what survives — the thin roads do not.
      const [dx0, dy0] = toMap(-62, -62);
      const [dx1, dy1] = toMap(62, 62);
      ctx.fillStyle = '#232a3d'; // downtown
      ctx.fillRect(dx0, dy0, dx1 - dx0, dy1 - dy0);
      const [mx0, my0] = toMap(-170, -70);
      const [mx1, my1] = toMap(-40, 70);
      ctx.fillStyle = '#33222e'; // night market, west
      ctx.fillRect(mx0, my0, mx1 - mx0, my1 - my0);
      const [hx0, hy0] = toMap(-170, 96);
      const [hx1, hy1] = toMap(170, 170);
      ctx.fillStyle = '#2e2a24'; // harbor dock + beach strip, south
      ctx.fillRect(hx0, hy0, hx1 - hx0, hy1 - hy0);
      // Water along the south edge, sand above it.
      ctx.fillStyle = '#0e7d8a';
      ctx.fillRect(0, SIZE - 14, SIZE, 14);
      ctx.fillStyle = '#c9a06a';
      ctx.fillRect(0, SIZE - 22, SIZE, 8);
      // Roads.
      ctx.strokeStyle = '#565664';
      ctx.lineWidth = 3;
      for (const s of city.streets) {
        const [x1] = toMap(s, 0);
        const [, y1] = toMap(0, s);
        ctx.beginPath();
        ctx.moveTo(x1, 0);
        ctx.lineTo(x1, SIZE);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, y1);
        ctx.lineTo(SIZE, y1);
        ctx.stroke();
      }
      // Safehouse — bigger than before, with a dark edge so it reads at
      // contact-sheet size instead of vanishing into the roads.
      const [sx, sy] = toMap(city.safehousePos.x, city.safehousePos.z);
      ctx.fillStyle = '#7cff4f';
      ctx.fillRect(sx - 4, sy - 4, 8, 8);
      ctx.strokeStyle = '#0a2010';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sx - 4, sy - 4, 8, 8);
      // Mission objective, pulsing — larger, with a white ring, so it is
      // the first thing the eye finds on the map at any size.
      if (objective) {
        const [ox, oy] = toMap(objective.x, objective.z);
        const r = 7 + Math.sin(G.time * 5) * 1.6;
        ctx.fillStyle = '#ffd21f';
        ctx.beginPath();
        ctx.arc(ox, oy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      // Police cruisers — red dots with a dark edge.
      ctx.fillStyle = '#ff3344';
      for (const c of G.police.cruisers) {
        const [px, py] = toMap(c.pos.x, c.pos.z);
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#2a0505';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      // The helicopter, when it is up — a cyan diamond, a different colour
      // AND shape from the gold objective circle, so the two never read as
      // the same mark at contact-sheet size. The search-zone ring around
      // the player stays, so the heat reads on the map as well as the sky.
      if (G.heli && G.heli.mesh.visible) {
        const [hx, hy] = toMap(G.heli.mesh.position.x, G.heli.mesh.position.z);
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.moveTo(hx, hy - 6);
        ctx.lineTo(hx + 6, hy);
        ctx.lineTo(hx, hy + 6);
        ctx.lineTo(hx - 6, hy);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#062a33';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        const p = G.player.onFoot ? G.player.pos : G.player.car.pos;
        const [px, py] = toMap(p.x, p.z);
        ctx.strokeStyle = 'rgba(255,51,68,0.85)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(px, py, 35 * SCALE, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // Viko the rival, when he is racing Dara — pink, edged, bigger than
      // a cruiser dot so the race reads on the map.
      if (G.missions.rival) {
        const [rx, ry] = toMap(G.missions.rival.car.pos.x, G.missions.rival.car.pos.z);
        ctx.fillStyle = '#ff2e88';
        ctx.beginPath();
        ctx.arc(rx, ry, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#2a0518';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      // Player arrow, rotated by heading — larger, with a dark edge, so it
      // stays the clearest mark on the map when the whole minimap is small.
      const p = G.player.onFoot ? G.player.pos : G.player.car.pos;
      const heading = G.player.onFoot ? G.player.heading : G.player.car.heading;
      const [px, py] = toMap(p.x, p.z);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(heading);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(6, 7);
      ctx.lineTo(-6, 7);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      // Frame.
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, SIZE - 1, SIZE - 1);
    },
  };
}
