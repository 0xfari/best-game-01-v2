// The screenshot scenes behind ?shot=title|play|draft|boss|win. Each one plays the real
// rules forward from a fresh world, steered by a simple autopilot (chase the nearest
// shard, keep away from the nearest enemy, dash when crowded, always take the best
// draft card), so the frame is what a real game looks like and the same seed always
// gives the same frame. No state is ever set by hand: a scene the autopilot cannot
// reach honestly is a scene the game cannot show.
import { FIELD, STEP } from './config.js';
import { PHASE_BREATHER, PHASE_DRAFT, PHASE_OVER, PHASE_PLAY, PHASE_WIN } from './world.js';

/** The draft card the autopilot values most: area weapons first (they carry the late
 *  waves), then new weapons, then the highest level, then hull when hurt. */
export function autopilotChoice(world) {
  const draft = world.state.draft;
  if (!draft || draft.length === 0) return -1;
  const aoe = { orbit: 3, tesla: 3, nova: 2, pulse: 1 };
  let best = 0;
  let bestScore = -1;
  draft.forEach((choice, i) => {
    const level = choice.type === 'weapon'
      ? world.state.weapons[choice.kind].level
      : world.state.passives[choice.kind];
    let score = (level === 0 ? 10 : 0) + level;
    if (choice.type === 'weapon') score += aoe[choice.kind] || 0;
    if (choice.type === 'passive' && choice.kind === 'hull' && world.state.player.hp < 50) score += 6;
    if (choice.type === 'passive' && choice.kind === 'thrusters') score += 1;
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best;
}

/** Steer the ship for one step: shards first, danger second, dash when crowded. */
export function autopilot(world, input) {
  const s = world.state;
  const p = s.player;
  if (s.phase === PHASE_DRAFT) {
    input.choice = autopilotChoice(world);
    input.moveX = 0;
    input.moveY = 0;
    return;
  }
  if (s.phase !== PHASE_PLAY && s.phase !== PHASE_BREATHER) return;
  // Nearest shard, else nearest enemy to kite away from.
  let target = null;
  let targetD = Infinity;
  for (const pk of s.pickups) {
    if (!pk.active || pk.kind !== 'shard') continue;
    const d = (pk.x - p.x) ** 2 + (pk.y - p.y) ** 2;
    if (d < targetD) { targetD = d; target = pk; }
  }
  let mx = 0;
  let my = 0;
  if (target) {
    mx = target.x - p.x;
    my = target.y - p.y;
  }
  let dangerX = 0;
  let dangerY = 0;
  let dangerCount = 0;
  for (const e of s.enemies) {
    if (!e.active) continue;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 170) {
      dangerCount += 1;
      dangerX += (dx / d) * (170 - d);
      dangerY += (dy / d) * (170 - d);
    }
  }
  mx += dangerX * 1.6;
  my += dangerY * 1.6;
  // Hurt and crowded: run for open space instead of chasing shards.
  if (p.hp < 45 && dangerCount >= 3) {
    mx = dangerX * 3 + (FIELD.width / 2 - p.x) * 0.002;
    my = dangerY * 3 + (FIELD.height / 2 - p.y) * 0.002;
  }
  const len = Math.hypot(mx, my);
  if (len > 1) {
    input.moveX = mx / len;
    input.moveY = my / len;
  } else {
    // Drift in a slow circle so the ship never sits still.
    const a = s.time * 0.7;
    input.moveX = Math.cos(a) * 0.6;
    input.moveY = Math.sin(a) * 0.6;
  }
  // Aim at the nearest enemy so the pulse always has a target.
  let foe = null;
  let foeD = Infinity;
  for (const e of s.enemies) {
    if (!e.active) continue;
    const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d < foeD) { foeD = d; foe = e; }
  }
  if (foe) { input.mouseX = foe.x; input.mouseY = foe.y; }
  else { input.mouseX = p.x; input.mouseY = p.y - 120; }
  input.dash = dangerCount >= 5 && p.dashCooldown <= 0;
}

/**
 * Play forward until the named scene is reached. Returns the best score to show on
 * the title and end screens. Caps the simulation so a scene always returns.
 */
export function stageShot(name, world, input) {
  world.reset();
  if (name === 'title') {
    for (let i = 0; i < 5 / STEP; i += 1) world.step(STEP, input);
    return 0;
  }
  world.startGame();
  const capSeconds = name === 'win' ? 1500 : 600;
  let sinceDraft = 0;
  let bossSeen = false;
  for (let i = 0; i < capSeconds / STEP; i += 1) {
    const s = world.state;
    if (s.phase === PHASE_DRAFT) {
      sinceDraft += STEP;
      autopilot(world, input);
      if (sinceDraft > 0.2) {
        world.chooseDraft(input.choice);
        sinceDraft = 0;
      }
    } else {
      autopilot(world, input);
    }
    world.step(STEP, input);
    input.dash = false;
    input.choice = -1;
    if (s.phase === PHASE_OVER) break;
    if (s.phase === PHASE_WIN) break;
    if (name === 'play' && s.phase === PHASE_PLAY && s.wave >= 5 && s.waveTime > 15) {
      let active = 0;
      for (const e of s.enemies) if (e.active) active += 1;
      if (active >= 14) break;
    }
    if (name === 'draft' && s.phase === PHASE_DRAFT) break;
    if (name === 'boss' && s.boss) {
      bossSeen = true;
      let active = 0;
      for (const e of s.enemies) if (e.active) active += 1;
      if (active >= 6 && s.waveTime > 6) break;
    }
    if (name === 'boss' && bossSeen && !s.boss) break;
  }
  const s = world.state;
  if (s.phase === PHASE_WIN || s.phase === PHASE_OVER) return s.score;
  if (name === 'win' && s.phase !== PHASE_WIN) return s.score;
  return s.score;
}
