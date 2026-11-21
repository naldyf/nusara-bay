# Nusara Bay — a getaway story

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/naldyf/nusara-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/naldyf/nusara-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

You are **Dara**, a getaway driver in **Nusara Bay** — an invented tropical
archipelago city at dusk, all glass towers, container harbor, neon night
market, old town and teal beach water. Dara owes **Madame Sari**, the harbor
boss, **$6,400**, and the only way out is the wheel. Eight jobs stand between
Dara and a clean slate: a first fare, a courier run, a gold-sedan steal, a
dockside lift, a three-stop night-market run, a race against the rival driver
Viko, a run from the debt collector's enforcers, and one last five-star
getaway at the harbor. Finish them all and the debt is paid.

Built for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01): a
complete open-world crime game that plays offline in a desktop browser from
static files. Three.js is vendored as minified files under `game/vendor/`,
the code is vanilla JavaScript with no build step, and nothing reaches the
network while it runs. Every texture, every sound and every building is
generated in code — there are no image or audio files to download.

## Play it

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

Or open `game/index.html` straight from disk. Desktop keyboard and mouse;
no touch controls yet.

| Key | Does |
| --- | --- |
| WASD / arrows | Walk and drive |
| E | Get in a car, steal one, get out |
| Space | Handbrake |
| Shift | NOS boost while driving |
| F / click | Fire the pistol on foot |
| M | Cycle the radio: off → BAY FM → DUSK FM |
| Esc | Pause |
| C (title screen) | Continue a save |

The safehouse at the south-west corner saves automatically when Dara stands
close to it on foot.

## What is in the world

- **A city with districts**: glass downtown, neon night market, old town,
  container harbor with gantry cranes, and a beach with rippling teal water.
  Golden-hour light throughout — a low warm sun, peach haze, a visible sun
  disc, and a procedural environment map so the paint and glass reflect the
  sky instead of looking like plastic.
- **Traffic and pedestrians**: cars that keep their lane, turn at
  intersections and brake for the car ahead; walkers who stroll the
  sidewalks and run from a fast car.
- **A wanted system**: one to five stars, cruisers that chase and ram,
  roadblocks from three stars, a helicopter with a searchlight from four,
  and a bust if the NCPD catches Dara on foot. Stars fade after quiet time
  away from the law.
- **Eight story jobs** with pickup, a clock, drop-offs, steals, heat, a
  three-stop run and a head-to-head race against Viko.
- **A HUD that talks**: job card with a stage bar and countdown, wanted
  stars, cash and debt, health, a live dispatch panel with police chatter,
  a speedometer with gear and NOS, the radio label, a live minimap, toasts
  and story beats from Madame Sari.
- **Sound, all synthesized**: two procedural radio stations, an engine hum
  that follows speed, a two-tone siren, a car alarm, gunshots and payout
  chimes — WebAudio only, no files.

## The files

```
game/
  index.html          the page and the whole HUD
  vendor/             three.js, vendored
  src/
    main.js           boot, the fixed-step loop, the chase camera
    config.js         every tuning number and the golden-hour palette
    city.js           the island: districts, textures, lights, palms
    vehicles.js       sculpted cars, hero-car paint, arcade handling
    player.js         Dara on foot, and the shared person mesh
    missions.js       the job state machine
    story.js          the eight jobs and the dispatch lines
    traffic.js        AI cars on the grid
    pedestrians.js    walkers on the sidewalks
    police.js         wanted level, cruisers, roadblocks, busts
    helicopter.js     the searchlight helicopter
    combat.js         the pistol: tracers, three hits disables a cruiser
    audio.js          WebAudio: radio, engine, siren, blips
    hud.js            every DOM panel, ticked every frame
    minimap.js        the live 2D map
    effects.js        smoke and muzzle flashes, pooled
    shots.js          deterministic staging for the four screenshots
    save.js           one localStorage slot for the campaign
    input.js          keyboard and mouse, edge-triggered actions
    random.js         the seeded stream the whole city is built from
main.ts               the entry packer (Node 22, stdlib only)
serve.ts              a tiny static server for local play
shots.json            the four screenshots and what each one shows
```

## Screenshots

The four frames in `screenshots/` are staged by `shots.js` from the real
game, not posed: `?shot=chase&seed=1` is Job 3 four stars deep downtown,
`?shot=steal&seed=1` is Dara about to lift a car in the night market,
`?shot=harbor&seed=1` is the five-star finale at the dock, and
`?shot=start&seed=1` is the title screen over the city.

## License

MIT — see `LICENSE`.
