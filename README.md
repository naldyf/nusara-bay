# Nusara Bay — a getaway story

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/naldyf/nusara-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/naldyf/nusara-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

You are **Dara**, a getaway driver in **Nusara Bay** — an invented tropical
archipelago city at dusk: glass downtown towers, a harbor of containers and
cranes, a neon night market, a canal old town, and a beach of teal water.
Dara owes **Madame Sari**, the harbor boss, **$6,400**, and the only way out
is the wheel. Eight jobs stand between Dara and a clean slate — a first fare,
a courier run, a car steal, a harbor heist, a three-stop night-market run, a
race against the rival driver Viko, a run from the debt collector's
enforcers, and one last five-star getaway. Finish them all and the debt is
paid.

Built for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01): a
complete open-world crime game that plays offline in a desktop browser from
static files. Three.js (vendored as minified files under `game/vendor/`),
vanilla JavaScript, no build step, no network request at run time. Every
building, car, palm, neon sign, radio chord and engine note is procedural
and original — nothing is copied from any commercial game.

## Play

Serve the game folder and open it in desktop Chrome:

```sh
node serve.ts          # serves game/ on http://localhost:8080
```

or open `game/index.html` from any static server. Keyboard and mouse only;
there is nothing to install.

## Controls

| Key | Does |
| --- | --- |
| WASD / arrows | Drive, or walk on foot |
| E | Enter a car — or steal it, if it is not yours |
| Space | Handbrake |
| Shift | NOS boost |
| F / click | Shoot the pistol (on foot) |
| M | Radio: BAY FM → DUSK FM → off (both synthesized) |
| Esc | Pause / resume |
| Enter | Start from the title screen |

## The city

Nusara Bay is one procedural city, generated from a fixed seed, so the same
streets are there every run:

- **Downtown** — glass towers with lit windows, rooftop signs, the
  NUSARA BAY skyline sign.
- **Harbor** — container yard, gantry cranes, dock, and the teal sea beyond
  the beach.
- **Night market** — stalls with neon awnings, crowds, and parked cars to
  steal.
- **Old town** — low houses along the canal.
- **Beach** — sand, palms, and water at the south edge.

Dusk light throughout: a low amber sun, purple fog, streetlights and neon
after dark, and real-time shadows.

## Systems

- **Driving** — arcade physics written for this game: acceleration,
  braking, steering that tightens with speed, handbrake slides, NOS boost,
  collision with buildings, traffic, and the harbor edge. A chase camera
  follows the car and pulls in when a building would block it; a headlight
  spotlight keeps the road readable at dusk.
- **On foot** — walk the sidewalks, enter any car. Stealing a car sets off
  its alarm and raises the wanted level by one. Your own cars are free.
- **Traffic** — 14 AI cars follow the road graph, keep their lanes, turn at
  intersections, and brake for the player. 26 pedestrians stroll the
  sidewalks and scatter from fast cars and police.
- **Wanted 1–5 stars** — police cruisers chase and ram; at 3 stars they set
  roadblocks; at 4 a helicopter joins with a searchlight. Ram a cruiser
  hard, or land three pistol hits, and it is disabled. Wanted decays when
  you stay out of sight; get caught on foot and you are busted.
- **Jobs** — pickup → timed drive → drop-off, with a glowing marker in the
  world, a blip on the minimap, and an objective line on the HUD. All eight
  are playable, each with its own twist:
  1. First Fare — $400 · 2. The Courier — $600 · 3. Lose the Heat — $900
  (steal the marked gold car, lose 3 stars) · 4. Harbor Heist — $1,200
  (steal the green crate truck at the container yard) · 5. Night Market
  Run — $1,400 (three drops across the city, one clock per leg) ·
  6. The Rival — $1,600 (race Viko to the North Gate — he drives the same
  route, and the minimap shows him as a pink dot) · 7. The Debt
  Collector — $1,800 (grab the package at the East Pier, then outrun
  3 stars of enforcers) · 8. The Last Getaway — $2,500 (harbor pickup
  under five stars, beachfront finish). Completing job 8 clears the
  $6,400 debt and the title screen says so.
- **Combat** — a pistol on foot, with tracers, muzzle flash, and screen
  shake. Three hits disable a cruiser.
- **HUD + live minimap** — cash, wanted stars, speed, health, objective,
  radio state, and toasts; the minimap draws roads, the player, police,
  and the objective blip in real time.
- **Save** — progress (cash, job reached, jobs done) is stored in
  localStorage and saved at the safehouse; the title screen offers
  CONTINUE when a save exists.
- **Sound** — two synthesized radio stations (BAY FM, DUSK FM), engine and
  skid noise, sirens, alarms, gunshots, and payout blips — all WebAudio, no
  audio files.

## Screenshots

The four frames in `screenshots/` are real renders of the game, taken in
headless Chrome from deterministic stagings (`?shot=chase|steal|harbor|start`
with a fixed seed — see `game/src/shots.js`):

1. `chase.jpg` — the cover: a 4-star chase downtown, the helicopter body
   with its red stripe overhead, Job 3 on the clock.
2. `steal.jpg` — Dara on foot in the night market, about to steal a car.
3. `harbor.jpg` — Job 3 at the container yard, gold getaway car clear of
   the palms, safehouse toast.
4. `start.jpg` — the title screen over the city, with the job list — all
   eight jobs open.

## Layout

```
main.ts                  handoff program: copies game/ + screenshots/ to
                         /output and writes dossier.json (Node 22 stdlib)
serve.ts                 tiny static server for local play (node serve.ts)
game/
  index.html             the page: HUD DOM, import map for "three"
  src/                   the game, one file per system
    main.js              boot, fixed-timestep loop, camera, screens
    city.js              procedural dusk city + colliders
    config.js            tuning numbers + the dusk palette
    vehicles.js          car meshes + arcade driving physics
    player.js            on-foot movement + enter / steal
    traffic.js           AI cars on the road graph
    pedestrians.js       sidewalk walkers who flee
    police.js            wanted level, cruisers, roadblocks
    helicopter.js        4+ star helicopter + searchlight
    story.js             the 8-job arc (Dara vs Madame Sari)
    missions.js          pickup → timed drive → drop-off, ×8 jobs: steals,
                         multi-drops, heat, the rival race, the finale
    combat.js            pistol, tracers, cruiser damage
    hud.js               cash, stars, speed, health, objective, screens
    minimap.js           live 2D minimap canvas
    audio.js             BAY FM + DUSK FM, engine / siren / gunshot synthesis
    save.js              localStorage save / load
    effects.js           skid smoke, muzzle flash
    shots.js             deterministic screenshot staging + autopilot
    input.js             keyboard / mouse, edge-triggered actions
    random.js            seeded RNG (mulberry32)
  vendor/
    three.module.min.js  three.js r187 (minified, vendored)
    three.core.min.js    three.js core (minified, vendored)
    makefun-game.ts      kit library, byte-identical to the kit copy
screenshots/              the four frames above, 1280×720 JPEG
```

## License

MIT — see `LICENSE`.
