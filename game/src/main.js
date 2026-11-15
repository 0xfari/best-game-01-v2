// STARDRIFT's boot and frame loop: the canvas, the fixed-step simulation, the screens,
// the sound hooks, and the ?shot= scenes the screenshots come from. The game runs at
// a fixed 60 Hz simulation no matter the display's refresh rate.
import { FIELD, STEP } from './config.js';
import { mulberry32 } from './random.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import {
  EVENT_ARC, EVENT_BOSS, EVENT_DASH, EVENT_HURT, EVENT_KILL, EVENT_LEVELUP,
  EVENT_OVER, EVENT_PICKUP, EVENT_SHOOT, EVENT_WAVECLEAR, EVENT_WIN,
  PHASE_DRAFT, PHASE_OVER, PHASE_PLAY, PHASE_TITLE, PHASE_WIN, createWorld,
} from './world.js';
import { draw } from './render.js';
import { stageShot } from './shots.js';

const BEST_KEY = 'stardrift-best-score';
const params = new URLSearchParams(window.location.search);
const seedParam = Number(params.get('seed') || '1');
const shotName = params.get('shot');
const seed = Number.isFinite(seedParam) && seedParam > 0 ? Math.floor(seedParam) : 1;

const canvas = document.getElementById('game');
canvas.width = FIELD.width;
canvas.height = FIELD.height;
const ctx = canvas.getContext('2d');

const random = mulberry32(seed * 2654435761);
const world = createWorld(random);
const input = createInput(canvas);
const audio = createAudio();

let best = 0;
try {
  best = Number(window.localStorage.getItem(BEST_KEY) || '0') || 0;
} catch {
  best = 0;
}
let paused = false;
let muted = false;
let started = false;

function saveBest() {
  if (world.state.score > best) {
    best = world.state.score;
    try {
      window.localStorage.setItem(BEST_KEY, String(best));
    } catch {
      // Private mode: the score just lives for this session.
    }
  }
}

function handleEvents(events) {
  if (events & EVENT_SHOOT) audio.shoot();
  if (events & EVENT_ARC) audio.shoot();
  if (events & EVENT_HIT) audio.hit();
  if (events & EVENT_KILL) audio.kill();
  if (events & EVENT_PICKUP) audio.pickup();
  if (events & EVENT_DASH) audio.dash();
  if (events & EVENT_HURT) audio.hurt();
  if (events & EVENT_LEVELUP) audio.levelup();
  if (events & EVENT_BOSS) audio.boss();
  if (events & EVENT_WAVECLEAR) audio.waveclear();
  if (events & EVENT_WIN) { audio.win(); saveBest(); }
  if (events & EVENT_OVER) { audio.over(); saveBest(); }
}

function startIfNeeded(edges) {
  const phase = world.state.phase;
  if (phase === PHASE_TITLE && (edges.confirm || input.mouseDown)) {
    audio.unlock();
    world.startGame();
    started = true;
    return true;
  }
  if ((phase === PHASE_WIN || phase === PHASE_OVER) && (edges.confirm || input.mouseDown)) {
    audio.unlock();
    world.startGame();
    return true;
  }
  return false;
}

function frame() {
  const edges = input.consumeEdges();
  if (edges.mute) {
    muted = !muted;
    audio.setMuted(muted);
  }
  if (edges.pause && (world.state.phase === PHASE_PLAY || paused)) {
    paused = !paused;
  }
  if (!startIfNeeded(edges)) {
    if (world.state.phase === PHASE_DRAFT) {
      if (edges.choice >= 0) world.chooseDraft(edges.choice);
      if (input.mouseDown) {
        // Click a draft card: cards are laid out in render.js — same geometry here.
        const cardW = 300;
        const cardH = 220;
        const gap = 36;
        const total = cardW * 3 + gap * 2;
        const x0 = (FIELD.width - total) / 2;
        const y0 = 230;
        const mx = input.mouseX;
        const my = input.mouseY;
        for (let i = 0; i < 3; i += 1) {
          const cx = x0 + i * (cardW + gap);
          if (mx >= cx && mx <= cx + cardW && my >= y0 && my <= y0 + cardH) {
            world.chooseDraft(i);
            break;
          }
        }
        // Reroll row under the cards.
        if (my >= y0 + cardH + 26 && my <= y0 + cardH + 66) world.rerollDraft();
      }
    }
  }
  let events = 0;
  if (!paused) {
    const stepInput = {
      moveX: input.moveX,
      moveY: input.moveY,
      mouseX: input.mouseX,
      mouseY: input.mouseY,
      dash: edges.dash,
    };
    events = world.step(STEP, stepInput);
  }
  handleEvents(events);
  draw(ctx, world, { paused, muted, best });
  requestAnimationFrame(frame);
}

if (shotName) {
  // Screenshot mode: stage the scene synchronously, then signal readiness.
  const shownBest = stageShot(shotName, world, {
    moveX: 0, moveY: 0, mouseX: FIELD.width / 2, mouseY: FIELD.height / 2 - 120, dash: false, choice: -1,
  });
  if (shotName === 'win' || world.state.phase === PHASE_OVER) saveBest();
  best = Math.max(best, shownBest);
  draw(ctx, world, { paused: false, muted: true, best });
  window.__shotReady = true;
} else {
  input.mouseX = FIELD.width / 2;
  input.mouseY = FIELD.height / 2 - 120;
  requestAnimationFrame(frame);
}
