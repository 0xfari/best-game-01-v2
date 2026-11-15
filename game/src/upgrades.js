// The level-up draft: three choices that matter. New weapons open new playstyles,
// upgrades deepen the ones the pilot already has, and passives shore up weaknesses.
// The pool is weighted toward what the pilot is already building, without ever
// offering a maxed-out choice.
import { PASSIVES, WEAPONS } from './config.js';
import { shuffle } from './random.js';

const MAX_LEVEL = 5;

function weaponLabel(kind, level) {
  const base = WEAPONS[kind];
  if (level === 0) return { title: `New weapon: ${base.name}`, blurb: base.blurb, icon: '✦' };
  return { title: `${base.name} → Lv ${level + 1}`, blurb: levelUpBlurb(kind, level + 1), icon: '✦' };
}

function levelUpBlurb(kind, level) {
  if (kind === 'pulse') return level === 2 ? '+damage, +fire rate.' : level === 3 ? 'Bolts pierce through one enemy.' : level === 4 ? '+damage, +fire rate.' : 'Fires a twin bolt spread.';
  if (kind === 'orbit') return `+1 blade, wider orbit, faster spin.`;
  if (kind === 'nova') return level === 4 ? '+1 missile per volley.' : '+damage, faster launches.';
  return level === 3 ? 'Arcs chain to one more enemy.' : level === 5 ? 'Arcs chain to two more enemies.' : '+damage, faster arcs, longer reach.';
}

function passiveLabel(kind, level) {
  const base = PASSIVES[kind];
  return { title: `${base.name} → Lv ${level + 1}`, blurb: base.blurb, icon: '⬡' };
}

/** All choices the pilot could take right now, each with a weight. */
export function draftPool(state) {
  const pool = [];
  for (const kind of Object.keys(WEAPONS)) {
    const level = state.weapons[kind].level;
    if (level >= MAX_LEVEL) continue;
    const label = weaponLabel(kind, level);
    pool.push({
      type: 'weapon', kind, weight: level === 0 ? 3 : 5,
      ...label,
    });
  }
  for (const kind of Object.keys(PASSIVES)) {
    const level = state.passives[kind];
    if (level >= MAX_LEVEL) continue;
    const label = passiveLabel(kind, level);
    pool.push({
      type: 'passive', kind, weight: 4,
      ...label,
    });
  }
  return pool;
}

/** Three distinct choices for the draft screen. */
export function buildDraft(state, random) {
  const pool = shuffle(random, draftPool(state));
  const picked = [];
  const seen = new Set();
  for (const choice of pool) {
    const key = `${choice.type}:${choice.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(choice);
    if (picked.length >= 3) break;
  }
  return picked;
}

/** Apply one draft choice. Returns a short line for the log. */
export function applyChoice(state, choice) {
  if (choice.type === 'weapon') {
    state.weapons[choice.kind].level += 1;
    if (choice.kind === 'orbit') state.weapons.orbit.angle = 0;
    return `${WEAPONS[choice.kind].name} is now level ${state.weapons[choice.kind].level}.`;
  }
  state.passives[choice.kind] += 1;
  if (choice.kind === 'hull') {
    state.player.maxHp += 25;
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 25);
  }
  return `${PASSIVES[choice.kind].name} is now level ${state.passives[choice.kind]}.`;
}
