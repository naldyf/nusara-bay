// Nusara Bay — every tuning number in one file, so a balance pass touches
// one place and nothing else. The look lives here too: the golden-hour
// palette is a single source of truth, and city.js, the renderer and the
// materials all read from it instead of hard-coding their own hex codes.

// The island: a square of ground with a street grid every 40 units.
export const WORLD = {
  half: 170, streetGap: 40, roadWidth: 10,
  streets: [-120, -80, -40, 0, 40, 80, 120],
  waterZ: 118, // teal sea begins south of this line
  beachZ: 100, // sand strip between the beach line and the water
};

// Arcade car handling: brisk acceleration, strong brakes, steering that
// fades as speed rises, and a handbrake that trades grip for slide.
export const CAR = {
  topSpeed: 30, reverseSpeed: 11, accel: 16, brake: 34,
  steerMax: 0.55, // front-wheel angle, in radians, at low speed
  grip: 6.5, // lateral grip — lower slides more
  handbrakeGrip: 1.6,
  radius: 1.7, // collision circle around the car
};

export const FOOT = { radius: 0.55, walk: 5.2, run: 8.4 };

// The law: how fast cruisers are, how hard they ram, how far away they
// appear, and how long Dara can be caught on foot before it is over.
export const POLICE = {
  cruiserTop: 27, cruiserAccel: 15, ramDamage: 9, spawnDist: 70,
  maxCruisers: 5,
  decayDelay: 10, // quiet seconds with no cruiser near before a star drops
  bustedRange: 3.0, bustedTime: 3,
};

export const TRAFFIC = { topSpeed: 12, count: 18 };
export const PEDS = { count: 34 };

export const PLAYER = { cashStart: 250, healthMax: 100 };

export const JOB_TIME = { deliver: 90, pickup: 999 };

export const SAVE_KEY = 'nusara-bay-save-v1';

// Golden hour: a warm low sun, peach haze the colour of the horizon, and a
// cool blue fill from the sky, so the shadow side never goes muddy.
export const GOLDEN_HOUR = {
  skyZenith: 0x3b2d6b, // deep violet top of the sky
  skyHorizon: 0xff8642, // rich golden-orange horizon band
  fog: 0xe8a87c, // warm haze; the far skyline dissolves into it
  sun: 0xffc878, // warm golden key light
  sunIntensity: 3.4,
  hemiSky: 0x7eb6ff, // cool blue sky fill
  hemiGround: 0x5c3d2e, // dark warm bounce off the asphalt
  hemiIntensity: 0.65,
  exposure: 1.15, // ACES Filmic exposure
  fogDensity: 0.0052, // thin enough that distant towers stay crisp
  sunElevation: 17, // degrees; a low sun throws long shadows
};

// The city's paint box: teal water, amber sodium light, magenta and cyan
// neon, warm sand, dark asphalt. Deliberately tropical dusk — not pale
// Mediterranean, not flat purple. The light numbers (sun, hemi) are kept
// beside the paint so the look reads as one palette, not two files.
export const PALETTE = {
  sky: 0x3b2d6b,
  fog: 0xe8a87c,
  sun: 0xffc878,
  sunIntensity: 3.4,
  hemiSky: 0x7eb6ff,
  hemiGround: 0x5c3d2e,
  hemiIntensity: 0.65,
  water: 0x0b6e7d,
  sand: 0xc99b63,
  asphalt: 0x262630, // dark enough that markings and headlights pop
  sidewalk: 0x454152,
  downtownGlass: [0x5f9cc0, 0x4a7fa5, 0x7fb8d4, 0x3d6f92],
  downtownLit: 0xffd27a,
  house: [0xd98a5f, 0xc96f4a, 0xe8b07a, 0xb85c6e, 0x7a9e7e],
  container: [0xd95f2e, 0x2e7dd9, 0x3da55c, 0xc9a227, 0x8a4f9e],
  neon: [0xff2e88, 0x00e5ff, 0xffd21f, 0x7cff4f],
};
