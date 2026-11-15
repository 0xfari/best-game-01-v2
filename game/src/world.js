// STARDRIFT's rules and state, with no drawing and no browser in it: the pilot, the
// starstorm, the waves, the draft, the score. step() advances one fixed step and
// returns what happened as bit flags, so the caller can react (sound, screens) without
// the world knowing about them. Given the same seed and the same inputs, step() always
// plays the same game — screenshots and the determinism check depend on that.
import {
  BREATHER, COMBO_MAX, COMBO_WINDOW, DROPS, ENEMIES, FIELD, MAX_ENEMIES,
  MAX_PARTICLES, MAX_PROJECTILES, PLAYER, REROLL_COST, WAVE_DURATION, WAVES,
  WAVE_TABLE, xpForLevel,
} from './config.js';
import { clamp, int, pick, range, weighted } from './random.js';
import { makeEnemy, splitChildren, updateEnemy } from './enemies.js';
import { fireWeapons, newWeaponState, orbitBlades, steerMissile, weaponStats } from './weapons.js';
import { applyChoice, buildDraft } from './upgrades.js';

export const EVENT_SHOOT = 1;
export const EVENT_HIT = 2;
export const EVENT_KILL = 4;
export const EVENT_PICKUP = 8;
export const EVENT_LEVELUP = 16;
export const EVENT_WAVECLEAR = 32;
export const EVENT_BOSS = 64;
export const EVENT_WIN = 128;
export const EVENT_OVER = 256;
export const EVENT_DASH = 512;
export const EVENT_HURT = 1024;
export const EVENT_ARC = 2048;

export const PHASE_TITLE = 'title';
export const PHASE_PLAY = 'play';
export const PHASE_DRAFT = 'draft';
export const PHASE_BREATHER = 'breather';
export const PHASE_WIN = 'win';
export const PHASE_OVER = 'over';

function poolOf(make, count) {
  const out = [];
  for (let i = 0; i < count; i += 1) out.push(make());
  return out;
}

export function createWorld(random) {
  const state = {
    phase: PHASE_TITLE,
    time: 0,
    elapsed: 0,
    wave: 0,
    waveTime: 0,
    breatherTime: 0,
    spawnTimer: 0,
    bossSpawned: false,
    boss: null,
    player: {
      x: FIELD.width / 2, y: FIELD.height / 2,
      vx: 0, vy: 0, angle: -Math.PI / 2,
      hp: PLAYER.maxHp, maxHp: PLAYER.maxHp,
      radius: PLAYER.radius,
      dashTimer: 0, dashCooldown: 0, dashX: 0, dashY: 0, iframes: 0,
    },
    aimX: FIELD.width / 2, aimY: FIELD.height / 2 - 100,
    weapons: newWeaponState(),
    passives: { hull: 0, thrusters: 0, magnet: 0, plating: 0, overclock: 0, reactor: 0 },
    level: 1, xp: 0, xpNeed: xpForLevel(1),
    pendingLevels: 0, draft: null,
    salvage: 0, kills: 0, score: 0,
    combo: 0, comboTimer: 0, bestCombo: 0,
    magnetTimer: 0,
    shake: 0,
    enemies: poolOf(() => ({ active: false }), MAX_ENEMIES),
    projectiles: poolOf(() => ({ active: false }), MAX_PROJECTILES),
    enemyShots: poolOf(() => ({ active: false }), 120),
    pickups: poolOf(() => ({ active: false }), 220),
    particles: poolOf(() => ({ active: false }), MAX_PARTICLES),
    floaters: [],
    log: [],
    stats: { shots: 0, hits: 0, damage: 0 },
  };

  function free(list) {
    for (const item of list) if (!item.active) return item;
    return null;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const p = free(state.particles);
      if (!p) return;
      const a = random() * Math.PI * 2;
      const v = range(random, speed * 0.3, speed);
      p.active = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v;
      p.life = range(random, 0.3, 0.7);
      p.maxLife = p.life;
      p.size = range(random, 2, 5);
      p.color = color;
    }
  }

  function floater(x, y, text, color) {
    state.floaters.push({ x, y, text, color, life: 0.9 });
    if (state.floaters.length > 40) state.floaters.shift();
  }

  function addLog(line) {
    state.log.push(line);
    if (state.log.length > 6) state.log.shift();
  }

  function spawnPickup(x, y, kind) {
    const p = free(state.pickups);
    if (!p) return;
    p.active = true;
    p.kind = kind;
    p.x = clamp(x, 20, FIELD.width - 20);
    p.y = clamp(y, 20, FIELD.height - 20);
    p.vx = range(random, -30, 30);
    p.vy = range(random, -30, 30);
    p.life = kind === 'shard' ? 25 : 18;
    p.value = kind === 'shard' ? 1 : kind === 'salvage' ? 1 : 0;
  }

  function spawnEnemy(kind, elite) {
    const e = free(state.enemies);
    if (!e) return null;
    const side = int(random, 0, 3);
    let x;
    let y;
    if (side === 0) { x = range(random, 0, FIELD.width); y = -40; }
    else if (side === 1) { x = FIELD.width + 40; y = range(random, 0, FIELD.height); }
    else if (side === 2) { x = range(random, 0, FIELD.width); y = FIELD.height + 40; }
    else { x = -40; y = range(random, 0, FIELD.height); }
    const made = makeEnemy(random, kind, x, y, state.wave, elite);
    Object.assign(e, made);
    return e;
  }

  function fireProjectile(x, y, angle, speed, damage, pierce, color, radius, homing) {
    const pr = free(state.projectiles);
    if (!pr) return;
    pr.active = true;
    pr.x = x; pr.y = y;
    pr.angle = angle;
    pr.vx = Math.cos(angle) * speed;
    pr.vy = Math.sin(angle) * speed;
    pr.speed = speed;
    pr.damage = damage;
    pr.pierce = pierce;
    pr.color = color;
    pr.radius = radius;
    pr.homing = !!homing;
    pr.life = 1.6;
    state.stats.shots += 1;
  }

  function fireEnemyShot(x, y, nx, ny, speed, damage) {
    const s = free(state.enemyShots);
    if (!s) return;
    s.active = true;
    s.x = x; s.y = y;
    s.vx = nx * speed; s.vy = ny * speed;
    s.damage = damage;
    s.radius = 6;
    s.life = 4;
  }

  function fireArc(stats) {
    // Tesla: chain lightning to the nearest enemies, no projectile needed.
    let fromX = state.player.x;
    let fromY = state.player.y;
    const hit = new Set();
    let remaining = stats.chains;
    let target = nearestEnemy(fromX, fromY, stats.range, hit);
    let hops = 0;
    while (target && remaining > 0) {
      damageEnemy(target, stats.damage, fromX, fromY);
      burst(target.x, target.y, stats.color, 4, 120);
      hit.add(target);
      fromX = target.x;
      fromY = target.y;
      hops += 1;
      remaining -= 1;
      target = nearestEnemy(fromX, fromY, stats.range * 0.8, hit);
    }
    return hops;
  }

  function nearestEnemy(x, y, rangeLimit, exclude) {
    let best = null;
    let bestD = rangeLimit * rangeLimit;
    for (const e of state.enemies) {
      if (!e.active || (exclude && exclude.has(e))) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  function damageEnemy(enemy, amount, fromX, fromY) {
    enemy.hp -= amount;
    enemy.flash = 0.09;
    state.stats.damage += amount;
    state.stats.hits += 1;
    floater(enemy.x + range(random, -8, 8), enemy.y - enemy.radius - 6, String(Math.round(amount)), '#ffffff');
    const dx = enemy.x - fromX;
    const dy = enemy.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    enemy.knockX += (dx / d) * 60;
    enemy.knockY += (dy / d) * 60;
    burst(enemy.x, enemy.y, enemy.color, 2, 90);
    if (enemy.hp <= 0) killEnemy(enemy);
  }

  function killEnemy(enemy) {
    enemy.active = false;
    state.kills += 1;
    state.combo += 1;
    state.comboTimer = COMBO_WINDOW;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;
    const mult = 1 + Math.min(state.combo, COMBO_MAX) * 0.02;
    state.score += Math.round(enemy.score * mult);
    burst(enemy.x, enemy.y, enemy.color, enemy.boss ? 46 : 12, enemy.boss ? 320 : 180);
    if (enemy.kind === 'splitter') {
      for (const child of splitChildren(enemy)) {
        const c = spawnEnemy(child.kind, false);
        if (c) { c.x = enemy.x + child.dx; c.y = enemy.y + child.dy; }
      }
    }
    for (let i = 0; i < enemy.shards; i += 1) {
      spawnPickup(enemy.x + range(random, -18, 18), enemy.y + range(random, -18, 18), 'shard');
    }
    const roll = random();
    if (enemy.boss) {
      for (let i = 0; i < 10; i += 1) spawnPickup(enemy.x + range(random, -40, 40), enemy.y + range(random, -40, 40), 'salvage');
      spawnPickup(enemy.x, enemy.y - 30, 'heart');
      spawnPickup(enemy.x, enemy.y + 30, 'magnet');
    } else if (enemy.elite) {
      for (let i = 0; i < 5; i += 1) spawnPickup(enemy.x + range(random, -24, 24), enemy.y + range(random, -24, 24), 'salvage');
      spawnPickup(enemy.x, enemy.y, 'heart');
    } else if (roll < DROPS.heart) spawnPickup(enemy.x, enemy.y, 'heart');
    else if (roll < DROPS.heart + DROPS.magnet) spawnPickup(enemy.x, enemy.y, 'magnet');
    else if (roll < DROPS.heart + DROPS.magnet + DROPS.bomb) spawnPickup(enemy.x, enemy.y, 'bomb');
    else if (roll < DROPS.heart + DROPS.magnet + DROPS.bomb + DROPS.salvage) spawnPickup(enemy.x, enemy.y, 'salvage');
    if (enemy.boss) {
      state.boss = null;
      state.shake = Math.max(state.shake, 14);
    }
  }

  function gainXp(amount) {
    const gained = Math.round(amount * (1 + 0.15 * state.passives.reactor));
    state.xp += gained;
    while (state.xp >= state.xpNeed) {
      state.xp -= state.xpNeed;
      state.level += 1;
      state.xpNeed = xpForLevel(state.level);
      state.pendingLevels += 1;
    }
  }

  function damagePlayer(amount, fromX, fromY) {
    const p = state.player;
    if (p.iframes > 0 || p.dashTimer > 0) return false;
    const taken = Math.max(1, amount - state.passives.plating);
    p.hp -= taken;
    p.iframes = PLAYER.contactGrace;
    state.shake = Math.max(state.shake, 8);
    state.combo = 0;
    burst(p.x, p.y, '#ff5d73', 14, 220);
    floater(p.x, p.y - 26, `-${taken}`, '#ff8fa0');
    if (p.hp <= 0) {
      p.hp = 0;
      state.phase = PHASE_OVER;
      burst(p.x, p.y, '#7fe7ff', 60, 380);
    }
    return true;
  }

  function startWave(n) {
    state.wave = n;
    state.waveTime = 0;
    state.spawnTimer = 1;
    state.bossSpawned = false;
    const table = WAVE_TABLE[n - 1];
    if (table.boss) {
      const boss = spawnEnemy(table.boss, false);
      state.boss = boss;
      state.bossSpawned = true;
      addLog(`${ENEMIES[table.boss].name} has entered the storm.`);
      return EVENT_BOSS;
    }
    return 0;
  }

  function openDraft() {
    state.draft = buildDraft(state, random);
    state.phase = PHASE_DRAFT;
    return EVENT_LEVELUP;
  }

  function reset() {
    state.phase = PHASE_TITLE;
    state.time = 0;
    state.elapsed = 0;
    state.wave = 0;
    state.waveTime = 0;
    state.breatherTime = 0;
    state.spawnTimer = 0;
    state.bossSpawned = false;
    state.boss = null;
    state.player.x = FIELD.width / 2;
    state.player.y = FIELD.height / 2;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.angle = -Math.PI / 2;
    state.player.hp = PLAYER.maxHp;
    state.player.maxHp = PLAYER.maxHp;
    state.player.dashTimer = 0;
    state.player.dashCooldown = 0;
    state.player.iframes = 0;
    state.aimX = FIELD.width / 2;
    state.aimY = FIELD.height / 2 - 100;
    state.weapons = newWeaponState();
    state.passives = { hull: 0, thrusters: 0, magnet: 0, plating: 0, overclock: 0, reactor: 0 };
    state.level = 1;
    state.xp = 0;
    state.xpNeed = xpForLevel(1);
    state.pendingLevels = 0;
    state.draft = null;
    state.salvage = 0;
    state.kills = 0;
    state.score = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.bestCombo = 0;
    state.magnetTimer = 0;
    state.shake = 0;
    for (const list of [state.enemies, state.projectiles, state.enemyShots, state.pickups, state.particles]) {
      for (const item of list) item.active = false;
    }
    state.floaters.length = 0;
    state.log.length = 0;
    state.stats = { shots: 0, hits: 0, damage: 0 };
  }

  function startGame() {
    reset();
    state.phase = PHASE_PLAY;
    startWave(1);
    addLog('Survive all 10 waves. The Star Tyrant waits at the end.');
  }

  function chooseDraft(index) {
    if (state.phase !== PHASE_DRAFT || !state.draft || index < 0 || index >= state.draft.length) return false;
    const line = applyChoice(state, state.draft[index]);
    addLog(line);
    state.pendingLevels -= 1;
    if (state.pendingLevels > 0) {
      state.draft = buildDraft(state, random);
    } else {
      state.draft = null;
      state.phase = PHASE_PLAY;
    }
    return true;
  }

  function rerollDraft() {
    if (state.phase !== PHASE_DRAFT || state.salvage < REROLL_COST) return false;
    state.salvage -= REROLL_COST;
    state.draft = buildDraft(state, random);
    return true;
  }

  function step(dt, input) {
    let events = 0;
    state.time += dt;
    if (state.phase === PHASE_TITLE || state.phase === PHASE_WIN || state.phase === PHASE_OVER) {
      updateAmbient(dt);
      return events;
    }
    if (state.phase === PHASE_DRAFT) {
      updateAmbient(dt);
      return events;
    }

    const p = state.player;
    state.elapsed += dt;

    // --- pilot movement and dash ---
    const speed = PLAYER.speed * (1 + 0.12 * state.passives.thrusters);
    if (input.dash && p.dashCooldown <= 0 && (input.moveX !== 0 || input.moveY !== 0)) {
      p.dashTimer = PLAYER.dashTime;
      p.dashCooldown = PLAYER.dashCooldown;
      p.dashX = input.moveX;
      p.dashY = input.moveY;
      p.iframes = Math.max(p.iframes, PLAYER.dashIframes);
      events |= EVENT_DASH;
      burst(p.x, p.y, '#7fe7ff', 8, 160);
    }
    if (p.dashCooldown > 0) p.dashCooldown -= dt;
    if (p.iframes > 0) p.iframes -= dt;
    if (p.dashTimer > 0) {
      p.dashTimer -= dt;
      p.vx = p.dashX * PLAYER.dashSpeed;
      p.vy = p.dashY * PLAYER.dashSpeed;
    } else {
      p.vx = input.moveX * speed;
      p.vy = input.moveY * speed;
    }
    p.x = clamp(p.x + p.vx * dt, p.radius, FIELD.width - p.radius);
    p.y = clamp(p.y + p.vy * dt, p.radius, FIELD.height - p.radius);
    state.aimX = input.mouseX;
    state.aimY = input.mouseY;
    p.angle = Math.atan2(state.aimY - p.y, state.aimX - p.x);

    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    if (state.magnetTimer > 0) state.magnetTimer -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);

    // --- waves ---
    if (state.phase === PHASE_BREATHER) {
      state.breatherTime -= dt;
      if (state.breatherTime <= 0) {
        state.phase = PHASE_PLAY;
        events |= startWave(state.wave + 1);
      }
    } else if (state.phase === PHASE_PLAY) {
      state.waveTime += dt;
      const table = WAVE_TABLE[state.wave - 1];
      state.spawnTimer -= dt;
      const alive = countAlive(state.enemies);
      if (state.spawnTimer <= 0 && alive < MAX_ENEMIES && state.waveTime < WAVE_DURATION) {
        state.spawnTimer = table.interval;
        const batch = 1 + Math.floor(state.wave / 4);
        for (let i = 0; i < batch; i += 1) {
          const kind = weighted(random, table.mix);
          spawnEnemy(kind, random() < table.elite);
        }
      }
      const waveDone = state.waveTime >= WAVE_DURATION && alive === 0;
      const bossDead = table.boss && state.bossSpawned && !state.boss;
      if (state.wave >= WAVES && bossDead) {
        state.phase = PHASE_WIN;
        events |= EVENT_WIN;
        return events;
      }
      if (waveDone || (table.boss && bossDead && state.waveTime >= WAVE_DURATION)) {
        if (state.wave < WAVES) {
          state.phase = PHASE_BREATHER;
          state.breatherTime = BREATHER;
          p.hp = Math.min(p.maxHp, p.hp + 20);
          events |= EVENT_WAVECLEAR;
          addLog(`Wave ${state.wave} cleared. Hull patched +20.`);
        }
      }
    }

    // --- weapons ---
    const fired = fireWeapons({ state }, dt, fireProjectile, (stats) => {
      fireArc(stats);
      events |= EVENT_ARC;
    });
    if (fired) events |= EVENT_SHOOT;

    // --- projectiles ---
    for (const pr of state.projectiles) {
      if (!pr.active) continue;
      if (pr.homing) steerMissile(pr, { state }, dt);
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;
      if (pr.life <= 0 || pr.x < -30 || pr.x > FIELD.width + 30 || pr.y < -30 || pr.y > FIELD.height + 30) {
        pr.active = false;
        continue;
      }
      for (const e of state.enemies) {
        if (!e.active) continue;
        const d = (e.x - pr.x) ** 2 + (e.y - pr.y) ** 2;
        const rr = e.radius + pr.radius;
        if (d < rr * rr) {
          damageEnemy(e, pr.damage, p.x, p.y);
          events |= EVENT_HIT;
          if (pr.pierce > 0) { pr.pierce -= 1; }
          else { pr.active = false; }
          break;
        }
      }
    }

    // --- orbit blades ---
    for (const blade of orbitBlades({ state })) {
      for (const e of state.enemies) {
        if (!e.active) continue;
        const d = (e.x - blade.x) ** 2 + (e.y - blade.y) ** 2;
        const rr = e.radius + blade.radius;
        if (d < rr * rr) {
          damageEnemy(e, blade.damage, p.x, p.y);
          events |= EVENT_HIT;
        }
      }
    }

    // --- enemies ---
    for (const e of state.enemies) {
      if (!e.active) continue;
      updateEnemy(e, p, dt, state.time, random, fireEnemyShot);
      const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
      const rr = e.radius + p.radius;
      if (d < rr * rr) {
        if (damagePlayer(e.damage, e.x, e.y)) events |= EVENT_HURT;
        // Push the enemy back so one touch is not a blender.
        const dist = Math.sqrt(d) || 1;
        e.x = p.x + ((e.x - p.x) / dist) * (rr + 2);
        e.y = p.y + ((e.y - p.y) / dist) * (rr + 2);
      }
      if (state.phase === PHASE_OVER) return events;
    }

    // --- enemy shots ---
    for (const s of state.enemyShots) {
      if (!s.active) continue;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0 || s.x < -20 || s.x > FIELD.width + 20 || s.y < -20 || s.y > FIELD.height + 20) {
        s.active = false;
        continue;
      }
      const d = (s.x - p.x) ** 2 + (s.y - p.y) ** 2;
      const rr = s.radius + p.radius;
      if (d < rr * rr) {
        s.active = false;
        if (damagePlayer(s.damage, s.x, s.y)) events |= EVENT_HURT;
      }
      if (state.phase === PHASE_OVER) return events;
    }

    // --- pickups ---
    const magnetRadius = PLAYER.magnetRadius * (1 + 0.45 * state.passives.magnet);
    for (const pk of state.pickups) {
      if (!pk.active) continue;
      pk.life -= dt;
      if (pk.life <= 0) { pk.active = false; continue; }
      const dx = p.x - pk.x;
      const dy = p.y - pk.y;
      const d = Math.hypot(dx, dy) || 1;
      const pull = state.magnetTimer > 0 ? 900 : d < magnetRadius ? 420 : 0;
      if (pull > 0) {
        pk.vx += (dx / d) * pull * dt * 3;
        pk.vy += (dy / d) * pull * dt * 3;
      }
      pk.vx *= 0.94;
      pk.vy *= 0.94;
      pk.x += pk.vx * dt;
      pk.y += pk.vy * dt;
      if (d < PLAYER.pickupRadius + 8) {
        pk.active = false;
        events |= EVENT_PICKUP;
        if (pk.kind === 'shard') gainXp(1);
        else if (pk.kind === 'salvage') { state.salvage += 1; state.score += 5; }
        else if (pk.kind === 'heart') { p.hp = Math.min(p.maxHp, p.hp + 30); floater(p.x, p.y - 20, '+30', '#7dffb2'); }
        else if (pk.kind === 'magnet') { state.magnetTimer = 6; floater(p.x, p.y - 20, 'MAGNET', '#ffd166'); }
        else if (pk.kind === 'bomb') {
          floater(p.x, p.y - 20, 'NOVA BOMB', '#ff7ad9');
          for (const e of state.enemies) if (e.active && !e.boss) damageEnemy(e, 400, p.x, p.y);
          state.shake = Math.max(state.shake, 12);
        }
        burst(pk.x, pk.y, pk.kind === 'shard' ? '#7fe7ff' : '#ffd166', 4, 90);
      }
    }

    // --- particles and floaters ---
    updateAmbient(dt);

    // --- level-ups queue into the draft ---
    if (state.pendingLevels > 0 && state.phase === PHASE_PLAY) {
      events |= openDraft();
    }
    return events;
  }

  function updateAmbient(dt) {
    for (const pt of state.particles) {
      if (!pt.active) continue;
      pt.life -= dt;
      if (pt.life <= 0) { pt.active = false; continue; }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.96;
      pt.vy *= 0.96;
    }
    for (const f of state.floaters) f.life -= dt;
    state.floaters = state.floaters.filter((f) => f.life > 0);
  }

  function countAlive(list) {
    let n = 0;
    for (const item of list) if (item.active) n += 1;
    return n;
  }

  return {
    state,
    reset,
    startGame,
    startWave,
    step,
    chooseDraft,
    rerollDraft,
    gainXp,
    damagePlayer,
    countAlive: () => countAlive(state.enemies),
    aliveProjectiles: () => countAlive(state.projectiles),
  };
}
