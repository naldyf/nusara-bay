// Nusara Bay — entry packer for the gta6-01 bounty (Node 22, stdlib only).
//
// What the entry actually is: plain static files. index.html plus its ES
// modules under game/, three.js vendored as minified files under
// game/vendor/, and nothing that reaches the network while it runs. This
// program does not build or bundle anything — it gathers game/ and
// screenshots/ from this repository into the output directory the grader
// reads, then writes the dossier the judge reads (dossier.json) with the
// kit's own library, vendor/makefun-game.ts, which is kept byte-identical
// to the kit copy.
//
// How the grader runs it:
//   node main.ts
// To try it somewhere harmless instead of /output:
//   MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The caps below are the bounty's own gate limits (kit's gate.json): the
// dossier text is capped at 160 KiB, at most 4 screenshots of at most
// 256 KiB each, and game/ at most 993 entries and 48 MiB. This program
// refuses exactly where the sealed scorer would refuse the entry, so a
// clean run here means the entry is hand-in shaped.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The directory this file lives in is the repository root.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));

// The grader reads /output; a local run can point somewhere else instead.
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's own limits, so this program refuses what the scorer refuses.
const GATE = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// Wipe the output directory first, so a stale file from an older build can
// never ride along with the entry.
function freshDir(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

// Copy one directory tree — game/ or screenshots/ — into the output. game/
// must be there: an entry with no game is not an entry, and failing here is
// better than handing the scorer an empty one. screenshots/ is optional;
// an entry without shots is legal, just weaker.
function carry(name, required) {
  const from = join(repoRoot, name);
  const to = join(outDir, name);
  if (!existsSync(from)) {
    if (required) throw new Error(`missing ${name}/ — refusing to pack an entry with no game`);
    return;
  }
  cpSync(from, to, { recursive: true });
}

freshDir(outDir);
carry('game', true);
carry('screenshots', false);

// The dossier is built from the files just copied, so what the judge reads
// is exactly what the grader's container holds.
writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, GATE));
