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
      // Safehouse.
      const [sx, sy] = toMap(city.safehousePos.x, city.safehousePos.z);
      ctx.fillStyle = '#7cff4f';
      ctx.fillRect(sx - 3, sy - 3, 6, 6);
      // Mission objective, pulsing.
      if (objective) {
        const [ox, oy] = toMap(objective.x, objective.z);
        const r = 5 + Math.sin(G.time * 5) * 1.6;
        ctx.fillStyle = '#ffd21f';
        ctx.beginPath();
        ctx.arc(ox, oy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      // Police cruisers.
      ctx.fillStyle = '#ff3344';
      for (const c of G.police.cruisers) {
        const [px, py] = toMap(c.pos.x, c.pos.z);
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      // The helicopter, when it is up — a gold dot with a search-zone ring
      // around the player, so the heat reads on the map as well as the sky.
      if (G.heli && G.heli.mesh.visible) {
        const [hx, hy] = toMap(G.heli.mesh.position.x, G.heli.mesh.position.z);
        ctx.fillStyle = '#ffd21f';
        ctx.beginPath();
        ctx.arc(hx, hy, 4, 0, Math.PI * 2);
        ctx.fill();
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
      // Viko the rival, when he is racing Dara.
      if (G.missions.rival) {
        const [rx, ry] = toMap(G.missions.rival.car.pos.x, G.missions.rival.car.pos.z);
        ctx.fillStyle = '#ff2e88';
        ctx.beginPath();
        ctx.arc(rx, ry, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      // Player arrow, rotated by heading.
      const p = G.player.onFoot ? G.player.pos : G.player.car.pos;
      const heading = G.player.onFoot ? G.player.heading : G.player.car.heading;
      const [px, py] = toMap(p.x, p.z);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(heading);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(4.5, 5);
      ctx.lineTo(-4.5, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // Frame.
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, SIZE - 1, SIZE - 1);
    },
  };
}
