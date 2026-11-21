// Nusara Bay — the entry packer for the gta6-01 bounty.
//
// The entry itself is just static files: game/ (index.html, its ES modules
// and vendored three.js) plus screenshots/ (the four frames). Nothing is
// built or bundled here — this program gathers those two directories from
// the repository into the output directory the grader reads, then writes
// the dossier the judge reads (dossier.json) with the kit's own library,
// vendor/makefun-game.ts, which is kept byte-identical to the kit copy.
//
// Run it the way the grader does:
//   node main.ts
// Or point it somewhere harmless for a local check:
//   MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The limits below are the bounty's own gate limits (kit gate.json): the
// dossier text is capped at 160 KiB, at most four screenshots of at most
// 256 KiB each, and game/ at most 993 entries and 48 MiB, with no path
// longer than 1,000 bytes. This program refuses exactly where the sealed
// scorer would refuse the entry, so a clean run here means the entry is
// hand-in shaped.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root is wherever this file sits.
const here = fileURLToPath(new URL('.', import.meta.url));

// The grader reads /output; a local run can aim somewhere else instead.
const destination = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's limits, mirrored here so the packer and the scorer agree.
const LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// Start from an empty output directory, so a stale file from an older
// build can never ride along with the entry.
function freshOutput(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

// Carry one directory tree — game/ or screenshots/ — into the output.
// game/ must be there: an entry with no game is not an entry, and failing
// here is better than handing the scorer an empty one. screenshots/ is
// optional; an entry without shots is legal, just weaker.
function copyTree(folder, mustExist) {
  const source = join(here, folder);
  const target = join(destination, folder);
  if (!existsSync(source)) {
    if (mustExist) throw new Error(`missing ${folder}/ — refusing to pack an entry with no game`);
    return false;
  }
  cpSync(source, target, { recursive: true });
  return true;
}

freshOutput(destination);
copyTree('game', true);
copyTree('screenshots', false);

// Build the dossier from the files just copied, so what the judge reads is
// exactly what the grader's container holds.
writeFileSync(join(destination, 'dossier.json'), buildDossier(destination, LIMITS));
