// Nusara Bay — the handoff program for the gta6-01 bounty (Node 22, stdlib only).
//
// The game itself is plain static files under game/: index.html plus its ES
// modules, with three.js vendored as minified files under game/vendor/ and no
// network request at run time. This program does the only job the bounty asks
// of it: it carries game/ and screenshots/ from this repository into the
// output directory the grader reads, and writes the dossier the judge reads
// (dossier.json) with the kit's own library, vendor/makefun-game.ts, which
// stays byte-identical to the kit copy.
//
// Run it the way the grader does:
//   node main.ts
// and to try it outside the grader, point it somewhere else:
//   MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The caps below are the bounty's own gate limits (see the kit's gate.json):
// the dossier text is capped at 160 KiB, at most 4 screenshots of at most
// 256 KiB each, and game/ at most 993 entries and 48 MiB. Passing them here
// makes this program fail exactly where the sealed scorer would refuse the
// entry, so a clean run here means the entry is hand-in shaped.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root is the directory this file lives in.
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

// Start from a clean output directory so a stale file from an older build
// can never ride along with the entry.
function freshDir(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

// Copy a whole directory tree, game/ or screenshots/, into the output.
function carry(name) {
  const from = join(repoRoot, name);
  const to = join(outDir, name);
  if (!existsSync(from)) return;
  cpSync(from, to, { recursive: true });
}

freshDir(outDir);
carry('game');
carry('screenshots');

// The dossier is built from the files just copied, so what the judge reads
// is exactly what the grader's container holds.
writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, GATE));
