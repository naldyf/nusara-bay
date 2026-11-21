// Nusara Bay — all tuning in one place. Every number the game balances on lives
// here so a tuning pass touches one file and nothing else.
//
// Iteration 3 re-lights the city for golden hour: the dusk-purple palette of
// v2 is replaced by the Golden Hour Kings palette — a warm low sun, peach
// haze the same colour as the horizon, and cool blue sky fill. The numbers
// below are the whole look; city.js turns them into sky, fog and lights.
export const WORLD = {
  half: 170, // city ground spans -170..170 on x and z
  streetGap: 40, // streets every 40 units
  streets: [-120, -80, -40, 0, 40, 80, 120],
  roadWidth: 10,
  waterZ: 118, // teal water starts south of this line
  beachZ: 100, // sand strip between beachZ and waterZ
};

export const CAR = {
  topSpeed: 30,
  reverseSpeed: 11,
  accel: 16,
  brake: 34,
  steerMax: 0.55, // radians of front-wheel angle at low speed
  grip: 6.5, // lateral grip; lower = more slide
  handbrakeGrip: 1.6,
  radius: 1.7,
};

export const FOOT = { walk: 5.2, run: 8.4, radius: 0.55 };

export const POLICE = {
  cruiserTop: 27,
  cruiserAccel: 15,
  ramDamage: 9,
  spawnDist: 70,
  maxCruisers: 5,
  decayDelay: 10, // seconds with no police near before wanted drops
  bustedRange: 3.0,
  bustedTime: 3,
};

export const TRAFFIC = { count: 18, topSpeed: 12 };
export const PEDS = { count: 34 };

export const PLAYER = { healthMax: 100, cashStart: 250 };

export const JOB_TIME = { pickup: 999, deliver: 90 };

export const SAVE_KEY = 'nusara-bay-save-v1';

// Golden-hour palette — one object, used by sky, fog, lights and materials.
// No hex code for the light lives anywhere else in the scene.
export const GOLDEN_HOUR = {
  skyZenith: 0x3b2d6b, // deeper top of sky so buildings & neon pop against it
  skyHorizon: 0xff8642, // richer golden-orange horizon
  fog: 0xe8a87c, // cleaner warm haze, does not wash the frame out
  sun: 0xffc878, // warm golden key light
  sunIntensity: 3.4, // firmer sun for realistic shadows & highlights
  hemiSky: 0x7eb6ff, // cool blue sky fill on the shadow side
  hemiGround: 0x5c3d2e, // darker warm bounce from asphalt, more contrast
  hemiIntensity: 0.65,
  exposure: 1.15, // ACES Filmic exposure, balanced (not overexposed)
  fogDensity: 0.0052, // down from 0.009: distant streets & towers stay crisp
  sunElevation: 17, // degrees; slightly lower sun, longer cinematic shadows
};

// Dusk tropical palette: teal water, amber sodium light, magenta/cyan neon,
// low golden sun and long shadows — deliberately not the pale Mediterranean
// look, and not the flat purple dusk of v2.
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
  asphalt: 0x262630, // slightly darker asphalt so road markings & headlights pop
  sidewalk: 0x454152,
  downtownGlass: [0x5f9cc0, 0x4a7fa5, 0x7fb8d4, 0x3d6f92],
  downtownLit: 0xffd27a,
  house: [0xd98a5f, 0xc96f4a, 0xe8b07a, 0xb85c6e, 0x7a9e7e],
  container: [0xd95f2e, 0x2e7dd9, 0x3da55c, 0xc9a227, 0x8a4f9e],
  neon: [0xff2e88, 0x00e5ff, 0xffd21f, 0x7cff4f],
};
