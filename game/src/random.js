// Deterministic dice for Nusara Bay. One mulberry32 stream per game: the
// same seed always builds the same streets, the same traffic and the same
// staged screenshots, while a different seed shuffles everything.
export function createRandom(seedValue) {
  let state = seedValue >>> 0;

  // The mulberry32 step, in its standard form: advance the state by the
  // golden-ratio constant, then avalanche it through two xor-shifts and
  // two multiplications. The stream is the same one the city was built
  // with; the step is written as a single chain here.
  function draw() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t = t ^ (t + Math.imul(t ^ (t >>> 7), t | 61));
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    // A float in [0, 1).
    next() {
      return draw();
    },
    // A float in [low, high).
    range(low, high) {
      return low + draw() * (high - low);
    },
    // A whole number in [low, high], both ends included.
    int(low, high) {
      return Math.floor(low + draw() * (high - low + 1));
    },
    // One element of the list, chosen uniformly.
    pick(list) {
      return list[Math.floor(draw() * list.length)];
    },
    // `value` wobbled by up to `amount` either way: rooftop clutter, palm
    // lean and lamp spacing all take their wobble from here.
    jitter(value, amount) {
      return value + (draw() - 0.5) * 2 * amount;
    },
    // A coin flip off the same stream, so a call reads as intent
    // ("a one-in-three chance") and still burns exactly one draw.
    bool(chance = 0.5) {
      return draw() < chance;
    },
  };
}
