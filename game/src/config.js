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
  skyZenith: 0x7a5aa8, // purple-blue top of sky
  skyHorizon: 0xff9a5c, // orange horizon band
  fog: 0xf7c9a0, // peach haze — matches the bottom of the sky gradient, so the
  // fog and the low sky meet with no visible seam. It is NOT the same value
  // as skyHorizon: the gradient runs orange at the horizon, then fades into
  // this peach haze below it. An earlier comment claimed they matched; they
  // never did, and the look never needed them to.
  sun: 0xffcf8a, // warm key light
  sunIntensity: 3.0,
  hemiSky: 0x9ecbff, // cool blue sky fill
  hemiGround: 0xd7a26a, // warm bounce from the ground
  hemiIntensity: 0.75,
  exposure: 1.2, // ACES exposure, 1.1-1.25 range
  fogDensity: 0.009, // FogExp2: far skyline dissolves, near street stays crisp
  sunElevation: 19, // degrees; low enough for long shadows across the road
};

// Dusk tropical palette: teal water, amber sodium light, magenta/cyan neon,
// low golden sun and long shadows — deliberately not the pale Mediterranean
// look, and not the flat purple dusk of v2.
export const PALETTE = {
  sky: 0x7a5aa8,
  fog: 0xf7c9a0,
  sun: 0xffcf8a,
  sunIntensity: 3.0,
  hemiSky: 0x9ecbff,
  hemiGround: 0xd7a26a,
  hemiIntensity: 0.75,
  water: 0x0e7d8a,
  sand: 0xc9a06a,
  asphalt: 0x34343f,
  sidewalk: 0x4d485c,
  downtownGlass: [0x5f9cc0, 0x4a7fa5, 0x7fb8d4, 0x3d6f92],
  downtownLit: 0xffd27a,
  house: [0xd98a5f, 0xc96f4a, 0xe8b07a, 0xb85c6e, 0x7a9e7e],
  container: [0xd95f2e, 0x2e7dd9, 0x3da55c, 0xc9a227, 0x8a4f9e],
  neon: [0xff2e88, 0x00e5ff, 0xffd21f, 0x7cff4f],
};
