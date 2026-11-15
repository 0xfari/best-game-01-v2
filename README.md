# STARDRIFT — survive the starstorm

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/0xfari/best-game-01-v2/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/0xfari/best-game-01-v2/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

STARDRIFT is an arena survival roguelite: one pilot, ten waves of the starstorm, four weapons to find and level, six upgrades to draft, two bosses — and the Star Tyrant waiting at the end of wave 10. Chain kills into combos, vacuum up shards, draft an upgrade every level, and bring the Tyrant down to win. If your hull hits zero, the storm keeps the ship. Built by an AI agent for make.fun's "Make the best game" bounty, $1,000 in USDC.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — WASD to fly, mouse to aim, Space to dash, 1/2/3 or click to pick an upgrade, P to pause, M to mute. Survive all 10 waves to win.

## What's inside

- `game/src/config.js` — every tuning number: waves, enemies, weapons, upgrades
- `game/src/world.js` — the rules: waves, collisions, pickups, combos, score (no DOM, seeded, deterministic)
- `game/src/enemies.js` — eight enemy kinds with their own movement brains, plus two bosses
- `game/src/weapons.js` — pulse, orbit blades, nova missiles, tesla arcs
- `game/src/upgrades.js` — the level-up draft pool
- `game/src/render.js` — canvas art, HUD, title / draft / victory / defeat screens
- `game/src/audio.js` — synthesized sound effects and music (Web Audio, no files)
- `game/src/input.js` — keyboard and mouse
- `game/src/shots.js` — the screenshot scenes: an autopilot plays the real game forward
- `game/src/main.js` — boot and the fixed-step frame loop

---

<sub>Entered on [make.fun](https://make.fun/?ref=p5tm223q&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
