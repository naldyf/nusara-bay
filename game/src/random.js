// Seeded randomness. mulberry32 is small, fast and deterministic: the same seed
// always deals the same city, the same traffic and the same screenshot staging.
export function createRandom(seed) {
  let a = seed >>> 0;
  return {
    next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    range(min, max) {
      return min + this.next() * (max - min);
    },
    int(min, max) {
      return Math.floor(this.range(min, max + 1));
    },
    pick(list) {
      return list[Math.floor(this.next() * list.length)];
    },
    // A value with a little deterministic wobble either side — rooftop
    // clutter, lamp spacing and palm lean all use it so nothing lines up.
    jitter(value, amount) {
      return value + (this.next() - 0.5) * 2 * amount;
    },
    // True with probability p — a coin flip off the same seeded stream, so a
    // call site reads as intent ("a coin flip") instead of a bare comparison
    // against next(), and it consumes exactly one stream value either way.
    bool(p = 0.5) {
      return this.next() < p;
    },
  };
}
