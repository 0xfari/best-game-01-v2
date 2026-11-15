// STARDRIFT — tuning and definitions. Every number the game balances on lives here,
// so a balance pass touches one file. The game is an arena survival roguelite: one
// pilot, a starstorm that never stops, ten waves, and a Tyrant at the end of it.
export const FIELD = { width: 1280, height: 800 };
export const STEP = 1 / 60;
export const WAVES = 10;
export const WAVE_DURATION = 45;
export const BREATHER = 6;
export const MAX_ENEMIES = 90;
export const MAX_PROJECTILES = 240;
export const MAX_PARTICLES = 420;

export const PLAYER = {
  radius: 16,
  speed: 265,
  maxHp: 100,
  dashSpeed: 760,
  dashTime: 0.18,
  dashCooldown: 2.4,
  dashIframes: 0.35,
  magnetRadius: 95,
  pickupRadius: 28,
  contactGrace: 0.5,
};

// How much experience each level costs: level n needs xpForLevel(n) shards.
export function xpForLevel(level) {
  return 8 + level * 6 + Math.floor(level * level * 0.8);
}

// Combo: kills chained inside COMBO_WINDOW raise the score multiplier, up to x2.
export const COMBO_WINDOW = 2.5;
export const COMBO_MAX = 50;

// Four weapons. Each has 5 levels; every level is a real change, not a number bump.
export const WEAPONS = {
  pulse: {
    name: 'Pulse Blaster',
    blurb: 'Aimed bolts at the cursor. Fast, honest, always useful.',
    damage: 14, rate: 4.5, speed: 660, pierce: 0, color: '#7fe7ff',
  },
  orbit: {
    name: 'Orbit Blades',
    blurb: 'Blades circle the ship and shred whatever closes in.',
    damage: 11, blades: 2, radius: 95, spin: 3.4, color: '#ffd166',
  },
  nova: {
    name: 'Nova Missiles',
    blurb: 'Homing missiles that hunt the strongest thing on screen.',
    damage: 24, rate: 0.85, speed: 420, turn: 6.5, color: '#ff7ad9',
  },
  tesla: {
    name: 'Tesla Arc',
    blurb: 'Lightning that chains between nearby enemies. No aiming needed.',
    damage: 17, rate: 1.15, chains: 3, range: 330, color: '#b7ff6b',
  },
};

// Six passives, each stacking to level 5.
export const PASSIVES = {
  hull: { name: 'Reinforced Hull', blurb: '+25 max hull and repair 25 now.' },
  thrusters: { name: 'Ion Thrusters', blurb: '+12% move speed.' },
  magnet: { name: 'Tractor Web', blurb: '+45% pickup radius.' },
  plating: { name: 'Ablative Plating', blurb: 'Take 1 less damage from every hit (min 1).' },
  overclock: { name: 'Overclock', blurb: '+10% fire rate on every weapon.' },
  reactor: { name: 'Shard Reactor', blurb: '+15% experience from shards.' },
};

// Eight enemy kinds plus two bosses. hp/speed scale with the wave (see world.js).
export const ENEMIES = {
  mote: { name: 'Dust Mote', hp: 12, speed: 72, damage: 6, radius: 12, score: 10, color: '#9db8ff', shards: 1 },
  weaver: { name: 'Star Weaver', hp: 22, speed: 96, damage: 8, radius: 13, score: 15, color: '#c792ff', shards: 1 },
  splitter: { name: 'Splitter', hp: 30, speed: 58, damage: 8, radius: 16, score: 20, color: '#ff9d6b', shards: 2 },
  dasher: { name: 'Void Dasher', hp: 20, speed: 82, damage: 10, radius: 12, score: 20, color: '#ff6b81', shards: 1 },
  spitter: { name: 'Spore Spitter', hp: 26, speed: 54, damage: 8, radius: 14, score: 25, color: '#7dffb2', shards: 2 },
  brute: { name: 'Hull Brute', hp: 100, speed: 44, damage: 14, radius: 23, score: 40, color: '#ffb347', shards: 3 },
  wisp: { name: 'Comet Wisp', hp: 15, speed: 138, damage: 6, radius: 10, score: 15, color: '#8afff0', shards: 1 },
  leviathan: { name: 'Void Leviathan', hp: 1500, speed: 56, damage: 20, radius: 48, score: 500, color: '#e26bff', shards: 12, boss: true },
  tyrant: { name: 'Star Tyrant', hp: 2800, speed: 50, damage: 24, radius: 60, score: 1500, color: '#ff4d6d', shards: 20, boss: true },
};

// What each wave throws at the pilot: mix weights, trickle rate, elites, boss.
export const WAVE_TABLE = [
  { mix: [['mote', 1]], interval: 1.15, elite: 0 },
  { mix: [['mote', 0.7], ['weaver', 0.3]], interval: 1.0, elite: 0 },
  { mix: [['mote', 0.5], ['weaver', 0.3], ['splitter', 0.2]], interval: 0.9, elite: 0.04 },
  { mix: [['mote', 0.4], ['weaver', 0.25], ['splitter', 0.2], ['dasher', 0.15]], interval: 0.82, elite: 0.06 },
  { mix: [['mote', 0.5], ['weaver', 0.25], ['dasher', 0.25]], interval: 0.8, elite: 0.08, boss: 'leviathan' },
  { mix: [['weaver', 0.3], ['splitter', 0.25], ['spitter', 0.25], ['dasher', 0.2]], interval: 0.74, elite: 0.1 },
  { mix: [['splitter', 0.25], ['spitter', 0.25], ['brute', 0.25], ['dasher', 0.25]], interval: 0.68, elite: 0.12 },
  { mix: [['wisp', 0.35], ['dasher', 0.25], ['brute', 0.2], ['spitter', 0.2]], interval: 0.62, elite: 0.14 },
  { mix: [['brute', 0.3], ['wisp', 0.3], ['spitter', 0.2], ['splitter', 0.2]], interval: 0.56, elite: 0.18 },
  { mix: [['brute', 0.3], ['wisp', 0.3], ['dasher', 0.2], ['spitter', 0.2]], interval: 0.55, elite: 0.2, boss: 'tyrant' },
];

// Pickup drops: what an enemy leaves behind, and how often.
export const DROPS = { salvage: 0.22, heart: 0.04, magnet: 0.02, bomb: 0.015 };
export const SALVAGE_VALUE = 1;
export const REROLL_COST = 5;
