// The four weapons: what they fire, how they level, and how their projectiles fly.
// Weapons live in the world state as { level, timer, angle }; this file only knows
// how to shoot them and how to move what they shot.
import { WEAPONS } from './config.js';
import { clamp } from './random.js';

export function newWeaponState() {
  return {
    pulse: { level: 1, timer: 0 },
    orbit: { level: 0, timer: 0, angle: 0 },
    nova: { level: 0, timer: 0 },
    tesla: { level: 0, timer: 0 },
  };
}

/** Per-level numbers for one weapon at its level (1-5). */
export function weaponStats(kind, level) {
  const base = WEAPONS[kind];
  if (kind === 'pulse') {
    return {
      damage: base.damage + (level - 1) * 5,
      rate: base.rate + (level - 1) * 0.7,
      speed: base.speed,
      pierce: level >= 3 ? 1 : 0,
      count: level >= 5 ? 2 : 1,
      color: base.color,
    };
  }
  if (kind === 'orbit') {
    return {
      damage: base.damage + (level - 1) * 4,
      blades: base.blades + (level - 1),
      radius: base.radius + (level - 1) * 12,
      spin: base.spin + (level - 1) * 0.35,
      color: base.color,
    };
  }
  if (kind === 'nova') {
    return {
      damage: base.damage + (level - 1) * 9,
      rate: base.rate + (level - 1) * 0.22,
      speed: base.speed,
      count: level >= 4 ? 2 : 1,
      color: base.color,
    };
  }
  return {
    damage: base.damage + (level - 1) * 7,
    rate: base.rate + (level - 1) * 0.25,
    chains: base.chains + (level >= 3 ? 1 : 0) + (level >= 5 ? 1 : 0),
    range: base.range + (level - 1) * 22,
    color: base.color,
  };
}

/** Fire every ready weapon. Returns event flags for sound. */
export function fireWeapons(world, dt, fireProjectile, fireArc) {
  const s = world.state;
  const p = s.player;
  const overclock = 1 + 0.1 * s.passives.overclock;
  let events = 0;

  const pulse = s.weapons.pulse;
  if (pulse.level > 0) {
    pulse.timer -= dt;
    if (pulse.timer <= 0) {
      const stats = weaponStats('pulse', pulse.level);
      pulse.timer = 1 / (stats.rate * overclock);
      const aim = Math.atan2(s.aimY - p.y, s.aimX - p.x);
      for (let i = 0; i < stats.count; i += 1) {
        const offset = (i - (stats.count - 1) / 2) * 0.12;
        fireProjectile(p.x, p.y, aim + offset, stats.speed, stats.damage, stats.pierce, stats.color, 5);
      }
      events |= 1;
    }
  }

  const nova = s.weapons.nova;
  if (nova.level > 0) {
    nova.timer -= dt;
    if (nova.timer <= 0) {
      const stats = weaponStats('nova', nova.level);
      nova.timer = 1 / (stats.rate * overclock);
      for (let i = 0; i < stats.count; i += 1) {
        fireProjectile(p.x, p.y, -Math.PI / 2 + (i - (stats.count - 1) / 2) * 0.5, stats.speed, stats.damage, 0, stats.color, 7, true);
      }
      events |= 1;
    }
  }

  const tesla = s.weapons.tesla;
  if (tesla.level > 0) {
    tesla.timer -= dt;
    if (tesla.timer <= 0) {
      const stats = weaponStats('tesla', tesla.level);
      tesla.timer = 1 / (stats.rate * overclock);
      fireArc(stats);
      events |= 1;
    }
  }

  const orbit = s.weapons.orbit;
  if (orbit.level > 0) {
    const stats = weaponStats('orbit', orbit.level);
    orbit.angle += stats.spin * dt;
  }
  return events;
}

/** Orbit blade positions for the current frame (drawn and collided in world.js). */
export function orbitBlades(world) {
  const s = world.state;
  const orbit = s.weapons.orbit;
  if (orbit.level === 0) return [];
  const stats = weaponStats('orbit', orbit.level);
  const blades = [];
  for (let i = 0; i < stats.blades; i += 1) {
    const a = orbit.angle + (i * Math.PI * 2) / stats.blades;
    blades.push({
      x: s.player.x + Math.cos(a) * stats.radius,
      y: s.player.y + Math.sin(a) * stats.radius,
      damage: stats.damage,
      radius: 16,
      color: stats.color,
    });
  }
  return blades;
}

/** Steer homing missiles toward the nearest living enemy. */
export function steerMissile(projectile, world, dt) {
  if (!projectile.homing) return;
  let best = null;
  let bestDist = Infinity;
  for (const enemy of world.state.enemies) {
    if (!enemy.active) continue;
    const d = (enemy.x - projectile.x) ** 2 + (enemy.y - projectile.y) ** 2;
    if (d < bestDist) { bestDist = d; best = enemy; }
  }
  if (!best) return;
  const want = Math.atan2(best.y - projectile.y, best.x - projectile.x);
  let diff = want - projectile.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  projectile.angle += clamp(diff, -6.5 * dt, 6.5 * dt);
  projectile.vx = Math.cos(projectile.angle) * projectile.speed;
  projectile.vy = Math.sin(projectile.angle) * projectile.speed;
}
