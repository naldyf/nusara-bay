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

  const toMapX = (x) => (x + WORLD.half + 10) * SCALE;
  const toMapY = (z) => (z + WORLD.half + 10) * SCALE;

  function dot(x, y, r, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function diamond(x, y, r, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
    ctx.fill();
  }

  function drawGround() {
    // Dark glass panel, then the island.
    ctx.fillStyle = 'rgba(12, 14, 24, 0.82)';
    ctx.fillRect(0, 0, SIZE, SIZE);
    // Water along the south edge, sand between the beach line and the water.
    ctx.fillStyle = '#0b6e7d';
    ctx.fillRect(0, toMapY(WORLD.waterZ), SIZE, SIZE - toMapY(WORLD.waterZ));
    ctx.fillStyle = '#c99b63';
    ctx.fillRect(0, toMapY(WORLD.beachZ), SIZE, toMapY(WORLD.waterZ) - toMapY(WORLD.beachZ));
    // Roads, lighter than the panel.
    ctx.fillStyle = '#5a5a6a';
    for (const street of city.streets) {
      ctx.fillRect(0, toMapY(street) - 2, SIZE, 4);
      ctx.fillRect(toMapX(street) - 2, 0, 4, SIZE);
    }
  }

  function drawBlips(G) {
    // Safehouse: a green square, always visible.
    ctx.fillStyle = '#7cff4f';
    ctx.fillRect(toMapX(city.safehousePos.x) - 3, toMapY(city.safehousePos.z) - 3, 6, 6);
    // Mission objective: a pulsing gold diamond.
    if (objective) {
      const pulse = 1 + Math.sin(G.time * 4) * 0.2;
      diamond(toMapX(objective.x), toMapY(objective.z), 5 * pulse, '#ffd21f');
    }
    // Police cruisers: red dots, so the heat is visible at a glance.
    for (const cruiser of G.police.cruisers) {
      dot(toMapX(cruiser.pos.x), toMapY(cruiser.pos.z), 2.5, '#ff3b30');
    }
  }

  function drawPlayer(G) {
    // The player: a white arrow that turns with the heading.
    const p = G.player.onFoot ? G.player.pos : G.player.car.pos;
    ctx.save();
    ctx.translate(toMapX(p.x), toMapY(p.z));
    ctx.rotate(Math.atan2(Math.sin(G.player.heading), Math.cos(G.player.heading)));
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  return {
    // Set the objective blip, or clear it with (null, null).
    setObjective(x, z) {
      objective = x === null ? null : { x, z };
    },
    draw(G) {
      drawGround();
      drawBlips(G);
      drawPlayer(G);
    },
  };
}
