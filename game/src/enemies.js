// Enemy kinds, their movement brains, and boss behaviour. An enemy is a plain object
// in a pool the world owns; this file only knows how one behaves and how hard it hits.
// Every enemy chases the pilot, each in its own way; bosses add aimed bursts.
import { ENEMIES } from './config.js';
import { clamp, range } from './random.js';

export function makeEnemy(random, kind, x, y, wave, elite) {
  const def = ENEMIES[kind];
  const hpScale = 1 + 0.19 * (wave - 1) + (elite ? 3.2 : 0);
  const speedScale = Math.min(1.35, 1 + 0.02 * (wave - 1));
  return {
    active: true,
    kind,
    elite: !!elite,
    boss: !!def.boss,
    x, y,
    vx: 0, vy: 0,
    radius: def.radius * (elite ? 1.45 : 1),
    hp: def.hp * hpScale,
    maxHp: def.hp * hpScale,
    speed: def.speed * speedScale * (elite ? 0.92 : 1),
    damage: def.damage + Math.floor((wave - 1) / 3),
    score: def.score * (elite ? 5 : 1),
    shards: def.shards * (elite ? 4 : 1),
    color: def.color,
    angle: random() * Math.PI * 2,
    phase: random() * Math.PI * 2,
    dashTimer: range(random, 1.2, 2.6),
    dashing: 0,
    shootTimer: range(random, 1.5, 3),
    burst: 0,
    burstTimer: 0,
    flash: 0,
    knockX: 0,
    knockY: 0,
  };
}

/** Steer one enemy toward the pilot for dt seconds. Returns projectiles it fired. */
export function updateEnemy(enemy, player, dt, time, random, fireEnemyShot) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;
  let mx = nx;
  let my = ny;

  if (enemy.kind === 'weaver') {
    // Sine-weave across the chase line.
    const perpX = -ny;
    const perpY = nx;
    const sway = Math.sin(time * 3.1 + enemy.phase) * 0.85;
    mx = nx + perpX * sway;
    my = ny + perpY * sway;
  } else if (enemy.kind === 'dasher') {
    // Close in slowly, then lunge.
    enemy.dashTimer -= dt;
    if (enemy.dashing > 0) {
      enemy.dashing -= dt;
      mx = enemy.dashX;
      my = enemy.dashY;
    } else if (enemy.dashTimer <= 0 && dist < 260) {
      enemy.dashing = 0.42;
      enemy.dashX = nx;
      enemy.dashY = ny;
      enemy.dashTimer = range(random, 2.2, 3.4);
      mx = nx * 3.1;
      my = ny * 3.1;
    } else {
      mx = nx * 0.55;
      my = ny * 0.55;
    }
  } else if (enemy.kind === 'spitter') {
    // Keep a ring around the pilot and spit.
    const want = 260;
    const radial = dist > want + 30 ? 1 : dist < want - 30 ? -0.7 : 0;
    const orbit = Math.sin(time * 0.9 + enemy.phase) * 0.7;
    mx = nx * radial + -ny * orbit;
    my = ny * radial + nx * orbit;
    enemy.shootTimer -= dt;
    if (enemy.shootTimer <= 0 && dist < 520) {
      enemy.shootTimer = range(random, 2.4, 3.4);
      fireEnemyShot(enemy.x, enemy.y, nx, ny, 190, enemy.damage);
    }
  } else if (enemy.kind === 'splitter' || enemy.kind === 'brute') {
    // Slow, straight, relentless.
    mx = nx;
    my = ny;
  } else if (enemy.kind === 'wisp') {
    // Fast orbit that tightens as it closes.
    const orbit = 1.15;
    mx = nx * 0.55 + -ny * orbit;
    my = ny * 0.55 + nx * orbit;
  } else if (enemy.boss) {
    // Bosses strafe in a slow arc and fire aimed bursts.
    const orbit = Math.sin(time * 0.55 + enemy.phase) * 0.9;
    mx = nx * 0.35 + -ny * orbit;
    my = ny * 0.35 + nx * orbit;
    enemy.burstTimer -= dt;
    if (enemy.burstTimer <= 0) {
      enemy.burst = enemy.kind === 'tyrant' ? 5 : 3;
      enemy.burstTimer = enemy.kind === 'tyrant' ? 2.6 : 3.1;
    }
    if (enemy.burst > 0) {
      enemy.shootTimer -= dt;
      if (enemy.shootTimer <= 0) {
        enemy.shootTimer = 0.16;
        enemy.burst -= 1;
        const spread = (enemy.burst - 2) * 0.14;
        const cos = Math.cos(spread);
        const sin = Math.sin(spread);
        fireEnemyShot(enemy.x, enemy.y, nx * cos - ny * sin, nx * sin + ny * cos, 240, enemy.damage);
      }
    }
  }

  const len = Math.hypot(mx, my) || 1;
  const speed = enemy.kind === 'dasher' && enemy.dashing > 0 ? enemy.speed * 3.1 : enemy.speed;
  enemy.vx = (mx / len) * speed;
  enemy.vy = (my / len) * speed;
  enemy.x += (enemy.vx + enemy.knockX) * dt;
  enemy.y += (enemy.vy + enemy.knockY) * dt;
  enemy.knockX *= 0.86;
  enemy.knockY *= 0.86;
  enemy.angle = Math.atan2(dy, dx);
  if (enemy.flash > 0) enemy.flash -= dt;
  enemy.x = clamp(enemy.x, -80, 1360);
  enemy.y = clamp(enemy.y, -80, 880);
}

/** Children a splitter leaves behind when it dies. */
export function splitChildren(enemy) {
  return [
    { kind: 'mote', dx: -14, dy: 0 },
    { kind: 'mote', dx: 14, dy: 0 },
  ];
}
