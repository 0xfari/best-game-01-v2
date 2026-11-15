// A small seeded generator (mulberry32) so the same seed always plays the same game:
// screenshots, replays and the determinism check all depend on it.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float in [min, max). */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** An integer in [min, max]. */
export function int(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** One element of an array, uniformly. */
export function pick(random, array) {
  return array[Math.floor(random() * array.length)];
}

/** A weighted pick from [[value, weight], ...]. */
export function weighted(random, pairs) {
  let total = 0;
  for (const [, weight] of pairs) total += weight;
  let roll = random() * total;
  for (const [value, weight] of pairs) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return pairs[pairs.length - 1][0];
}

/** A fresh array with the same elements in a random order. */
export function shuffle(random, array) {
  const out = array.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Clamp a number into [min, max]. */
export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
