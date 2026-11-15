// Everything the eye sees: the starfield, the ships, the storm, the HUD and every
// screen (title, draft, breather, victory, defeat). The world never draws; this file
// never simulates. Colours are one coherent palette: deep indigo space, cyan player,
// gold pickups, magenta danger.
import { FIELD, PLAYER, WEAPONS } from './config.js';
import { mulberry32 } from './random.js';
import { PHASE_BREATHER, PHASE_DRAFT, PHASE_OVER, PHASE_PLAY, PHASE_TITLE, PHASE_WIN } from './world.js';

const STARS = [];
{
  const random = mulberry32(20261116);
  for (let i = 0; i < 190; i += 1) {
    STARS.push({
      x: random() * FIELD.width,
      y: random() * FIELD.height,
      size: 0.6 + random() * 1.9,
      layer: 0.25 + random() * 0.75,
      twinkle: random() * Math.PI * 2,
    });
  }
}

const NEBULAE = [
  { x: 220, y: 150, r: 260, color: 'rgba(88, 60, 180, 0.20)' },
  { x: 1050, y: 620, r: 300, color: 'rgba(20, 120, 160, 0.16)' },
  { x: 980, y: 130, r: 210, color: 'rgba(190, 60, 120, 0.12)' },
  { x: 180, y: 660, r: 220, color: 'rgba(40, 90, 200, 0.12)' },
];

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBackground(ctx, time, player) {
  const grad = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  grad.addColorStop(0, '#070a1e');
  grad.addColorStop(0.55, '#0b1030');
  grad.addColorStop(1, '#12082a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  for (const neb of NEBULAE) {
    const g = ctx.createRadialGradient(neb.x, neb.y, 0, neb.x, neb.y, neb.r);
    g.addColorStop(0, neb.color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(neb.x - neb.r, neb.y - neb.r, neb.r * 2, neb.r * 2);
  }
  const px = (player.x - FIELD.width / 2) * 0.02;
  const py = (player.y - FIELD.height / 2) * 0.02;
  for (const star of STARS) {
    const tw = 0.55 + 0.45 * Math.sin(time * 1.7 + star.twinkle);
    ctx.globalAlpha = tw * star.layer;
    ctx.fillStyle = '#dfe9ff';
    ctx.fillRect(star.x - px * star.layer - 1, star.y - py * star.layer - 1, star.size, star.size);
  }
  ctx.globalAlpha = 1;
}

function drawShip(ctx, x, y, angle, radius, color, flicker) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (flicker) ctx.globalAlpha = 0.45 + 0.4 * Math.sin(Date.now() / 60);
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(radius + 6, 0);
  ctx.lineTo(-radius * 0.8, radius * 0.75);
  ctx.lineTo(-radius * 0.35, 0);
  ctx.lineTo(-radius * 0.8, -radius * 0.75);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#0b1030';
  ctx.beginPath();
  ctx.arc(2, 0, radius * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEnemy(ctx, e, time) {
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.flash > 0) {
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 22;
    ctx.fillStyle = '#ffffff';
  } else {
    ctx.shadowColor = e.color;
    ctx.shadowBlur = e.elite ? 20 : 12;
    ctx.fillStyle = e.color;
  }
  const r = e.radius;
  const pulse = 1 + 0.06 * Math.sin(time * 5 + e.phase);
  ctx.beginPath();
  if (e.kind === 'mote' || e.kind === 'wisp') {
    ctx.arc(0, 0, r * pulse, 0, Math.PI * 2);
  } else if (e.kind === 'weaver') {
    for (let i = 0; i < 5; i += 1) {
      const a = (i * Math.PI * 2) / 5 + e.phase;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
  } else if (e.kind === 'splitter') {
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.moveTo(-r * 0.5, 0);
    ctx.arc(-r * 0.5, 0, r * 0.45, 0, Math.PI * 2);
    ctx.moveTo(r * 0.5, 0);
    ctx.arc(r * 0.5, 0, r * 0.45, 0, Math.PI * 2);
  } else if (e.kind === 'brute') {
    ctx.rect(-r, -r * 0.8, r * 2, r * 1.6);
  } else if (e.boss) {
    for (let i = 0; i < 8; i += 1) {
      const a = (i * Math.PI * 2) / 8 + time * 0.4;
      const rr = i % 2 === 0 ? r : r * 0.62;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
  } else {
    ctx.moveTo(r, 0);
    ctx.lineTo(-r * 0.7, r * 0.8);
    ctx.lineTo(-r * 0.7, -r * 0.8);
    ctx.closePath();
  }
  ctx.fill();
  ctx.shadowBlur = 0;
  if (e.elite) {
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r + 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (e.boss || e.hp < e.maxHp) {
    const w = e.boss ? 90 : 34;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(-w / 2, -r - 14, w, 5);
    ctx.fillStyle = e.boss ? '#ff4d6d' : '#7dffb2';
    ctx.fillRect(-w / 2, -r - 14, w * Math.max(0, e.hp / e.maxHp), 5);
  }
  ctx.restore();
}

function drawPickup(ctx, pk, time) {
  const bob = Math.sin(time * 4 + pk.x) * 2;
  ctx.save();
  ctx.translate(pk.x, pk.y + bob);
  ctx.shadowBlur = 10;
  if (pk.kind === 'shard') {
    ctx.shadowColor = '#7fe7ff';
    ctx.fillStyle = '#7fe7ff';
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-5, -5, 10, 10);
  } else if (pk.kind === 'salvage') {
    ctx.shadowColor = '#ffd166';
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a5200';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('S', 0, 0.5);
  } else if (pk.kind === 'heart') {
    ctx.shadowColor = '#ff6b81';
    ctx.fillStyle = '#ff6b81';
    ctx.beginPath();
    ctx.arc(-4, -2, 5, 0, Math.PI * 2);
    ctx.arc(4, -2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(0, 9);
    ctx.lineTo(8, 0);
    ctx.closePath();
    ctx.fill();
  } else if (pk.kind === 'magnet') {
    ctx.shadowColor = '#b7ff6b';
    ctx.strokeStyle = '#b7ff6b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 8, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 8, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  } else {
    ctx.shadowColor = '#ff7ad9';
    ctx.fillStyle = '#ff7ad9';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a0a24';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 0, 0.5);
  }
  ctx.restore();
}

function drawBar(ctx, x, y, w, h, frac, fill, back, border) {
  ctx.fillStyle = back;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = fill;
    roundRect(ctx, x, y, w * Math.min(1, frac), h, h / 2);
    ctx.fill();
  }
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.stroke();
  }
}

function drawHud(ctx, world) {
  const s = world.state;
  const p = s.player;
  ctx.textBaseline = 'alphabetic';
  // Top-left: hull, level, experience.
  ctx.fillStyle = 'rgba(5, 8, 24, 0.6)';
  roundRect(ctx, 14, 12, 300, 66, 10);
  ctx.fill();
  ctx.fillStyle = '#dfe9ff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`HULL ${Math.ceil(p.hp)} / ${p.maxHp}`, 26, 34);
  drawBar(ctx, 26, 42, 276, 10, p.hp / p.maxHp, p.hp / p.maxHp > 0.3 ? '#37e08b' : '#ff5d73', 'rgba(255,255,255,0.12)');
  ctx.fillStyle = '#9db8ff';
  ctx.font = '12px sans-serif';
  ctx.fillText(`LEVEL ${s.level}`, 26, 70);
  drawBar(ctx, 96, 60, 206, 8, s.xp / s.xpNeed, '#7fe7ff', 'rgba(255,255,255,0.12)');
  // Top-center: wave and timer, boss bar under it.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#dfe9ff';
  ctx.font = 'bold 20px sans-serif';
  const waveLabel = s.phase === PHASE_BREATHER ? `WAVE ${s.wave} CLEARED` : `WAVE ${Math.max(1, s.wave)} / 10`;
  ctx.fillText(waveLabel, FIELD.width / 2, 34);
  ctx.fillStyle = '#9db8ff';
  ctx.font = '13px sans-serif';
  const timer = s.phase === PHASE_BREATHER ? `next wave in ${Math.ceil(s.breatherTime)}s` : `${Math.max(0, Math.ceil(45 - s.waveTime))}s left · ${Math.floor(s.elapsed)}s survived`;
  ctx.fillText(timer, FIELD.width / 2, 54);
  if (s.boss) {
    ctx.fillStyle = '#ffb3c0';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(s.boss.kind === 'tyrant' ? '★ STAR TYRANT ★' : '★ VOID LEVIATHAN ★', FIELD.width / 2, 76);
    drawBar(ctx, FIELD.width / 2 - 180, 82, 360, 9, s.boss.hp / s.boss.maxHp, '#ff4d6d', 'rgba(255,255,255,0.12)');
  }
  // Top-right: score, kills, salvage, combo.
  ctx.fillStyle = 'rgba(5, 8, 24, 0.6)';
  roundRect(ctx, FIELD.width - 314, 12, 300, 66, 10);
  ctx.fill();
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(`${s.score.toLocaleString('en-US')} pts`, FIELD.width - 26, 36);
  ctx.fillStyle = '#dfe9ff';
  ctx.font = '13px sans-serif';
  ctx.fillText(`kills ${s.kills}   salvage ${s.salvage}   combo x${(1 + Math.min(s.combo, 50) * 0.02).toFixed(2)}`, FIELD.width - 26, 58);
  ctx.fillStyle = s.combo >= 10 ? '#ff7ad9' : '#9db8ff';
  ctx.fillText(s.combo >= 2 ? `${s.combo} kill streak` : 'no streak yet — chain kills for a multiplier', FIELD.width - 26, 74);
  // Bottom-left: weapons and passives.
  ctx.textAlign = 'left';
  let wx = 26;
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = '#9db8ff';
  ctx.fillText('WEAPONS', wx, FIELD.height - 58);
  for (const kind of Object.keys(WEAPONS)) {
    const level = s.weapons[kind].level;
    if (level === 0) continue;
    ctx.fillStyle = WEAPONS[kind].color;
    roundRect(ctx, wx, FIELD.height - 50, 30, 30, 7);
    ctx.fill();
    ctx.fillStyle = '#0b1030';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(kind === 'pulse' ? 'P' : kind === 'orbit' ? 'O' : kind === 'nova' ? 'N' : 'T', wx + 15, FIELD.height - 30);
    ctx.fillStyle = '#dfe9ff';
    ctx.font = '11px sans-serif';
    ctx.fillText(`Lv${level}`, wx + 4, FIELD.height - 10);
    ctx.textAlign = 'left';
    wx += 40;
  }
  // Bottom-right: dash and hints.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#9db8ff';
  ctx.font = '12px sans-serif';
  const dashReady = p.dashCooldown <= 0;
  ctx.fillStyle = dashReady ? '#7fe7ff' : '#5a6b9a';
  ctx.fillText(dashReady ? 'DASH ready [Space]' : `dash ${p.dashCooldown.toFixed(1)}s`, FIELD.width - 26, FIELD.height - 34);
  ctx.fillStyle = '#5a6b9a';
  ctx.fillText('WASD move · mouse aim · P pause · M mute', FIELD.width - 26, FIELD.height - 16);
  // Aim reticle.
  ctx.strokeStyle = 'rgba(127, 231, 255, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(s.aimX, s.aimY, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s.aimX - 14, s.aimY);
  ctx.lineTo(s.aimX - 6, s.aimY);
  ctx.moveTo(s.aimX + 6, s.aimY);
  ctx.lineTo(s.aimX + 14, s.aimY);
  ctx.moveTo(s.aimX, s.aimY - 14);
  ctx.lineTo(s.aimX, s.aimY - 6);
  ctx.moveTo(s.aimX, s.aimY + 6);
  ctx.lineTo(s.aimX, s.aimY + 14);
  ctx.stroke();
  // Recent event log, bottom-center.
  ctx.textAlign = 'center';
  ctx.font = '12px sans-serif';
  s.log.forEach((line, i) => {
    ctx.globalAlpha = 0.9 - i * 0.14;
    ctx.fillStyle = '#cdd9ff';
    ctx.fillText(line, FIELD.width / 2, FIELD.height - 46 - (s.log.length - 1 - i) * 16);
  });
  ctx.globalAlpha = 1;
}

function drawTitle(ctx, best) {
  ctx.fillStyle = 'rgba(4, 6, 18, 0.72)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7fe7ff';
  ctx.font = 'bold 84px sans-serif';
  ctx.shadowColor = '#37b6ff';
  ctx.shadowBlur = 34;
  ctx.fillText('STARDRIFT', FIELD.width / 2, 240);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('— survive the starstorm —', FIELD.width / 2, 286);
  ctx.fillStyle = '#dfe9ff';
  ctx.font = '19px sans-serif';
  ctx.fillText('One pilot. Ten waves. Four weapons, six upgrades, two bosses.', FIELD.width / 2, 340);
  ctx.fillText('Chain kills into combos, draft upgrades between waves, and bring down', FIELD.width / 2, 368);
  ctx.fillText('the Star Tyrant to win. If your hull hits zero, the storm keeps the ship.', FIELD.width / 2, 396);
  ctx.fillStyle = '#9db8ff';
  ctx.font = '16px sans-serif';
  ctx.fillText('WASD / arrows — fly      Mouse — aim      Space — dash (brief shield)', FIELD.width / 2, 452);
  ctx.fillText('1 / 2 / 3 or click — pick an upgrade      P — pause      M — mute', FIELD.width / 2, 480);
  ctx.fillStyle = '#7fe7ff';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('Press ENTER or click to launch', FIELD.width / 2, 556);
  if (best > 0) {
    ctx.fillStyle = '#ffd166';
    ctx.font = '17px sans-serif';
    ctx.fillText(`Best run so far: ${best.toLocaleString('en-US')} points`, FIELD.width / 2, 596);
  }
  ctx.fillStyle = '#5a6b9a';
  ctx.font = '14px sans-serif';
  ctx.fillText('A complete game: goal, 10 waves, draft choices, bosses, score, win and loss screens.', FIELD.width / 2, 648);
}

function drawDraft(ctx, world) {
  const s = world.state;
  ctx.fillStyle = 'rgba(4, 6, 18, 0.66)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText(`LEVEL ${s.level} — choose an upgrade`, FIELD.width / 2, 150);
  ctx.fillStyle = '#9db8ff';
  ctx.font = '16px sans-serif';
  ctx.fillText('Each choice changes how the ship fights. There is no wrong pick — only a build.', FIELD.width / 2, 184);
  const cardW = 300;
  const cardH = 220;
  const gap = 36;
  const total = cardW * 3 + gap * 2;
  let x = (FIELD.width - total) / 2;
  const y = 230;
  (s.draft || []).forEach((choice, i) => {
    ctx.fillStyle = 'rgba(13, 20, 48, 0.95)';
    roundRect(ctx, x, y, cardW, cardH, 14);
    ctx.fill();
    ctx.strokeStyle = '#7fe7ff';
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, cardW, cardH, 14);
    ctx.stroke();
    ctx.fillStyle = '#7fe7ff';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`PRESS ${i + 1}  ·  ${choice.icon}`, x + cardW / 2, y + 36);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    wrapText(ctx, choice.title, x + cardW / 2, y + 72, cardW - 36, 24);
    ctx.fillStyle = '#cdd9ff';
    ctx.font = '15px sans-serif';
    wrapText(ctx, choice.blurb, x + cardW / 2, y + 128, cardW - 36, 20);
    x += cardW + gap;
  });
  ctx.fillStyle = '#9db8ff';
  ctx.font = '15px sans-serif';
  const reroll = `R — reroll the three cards (${5} salvage, you have ${s.salvage})`;
  ctx.fillText(reroll, FIELD.width / 2, y + cardH + 46);
}

function wrapText(ctx, text, cx, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  const lines = [''];
  for (const word of words) {
    const test = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && lines[lines.length - 1]) lines.push(word);
    else lines[lines.length - 1] = test;
  }
  lines.forEach((line, i) => ctx.fillText(line, cx, y + i * lineHeight));
}

function drawEnd(ctx, world, won, best) {
  const s = world.state;
  ctx.fillStyle = won ? 'rgba(6, 26, 16, 0.78)' : 'rgba(26, 6, 14, 0.78)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = won ? '#7dffb2' : '#ff8fa0';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(won ? 'THE STORM BREAKS' : 'THE STORM KEEPS YOU', FIELD.width / 2, 230);
  ctx.fillStyle = '#dfe9ff';
  ctx.font = '22px sans-serif';
  ctx.fillText(won
    ? 'The Star Tyrant is scrap, and the lane home is clear. You survived all ten waves.'
    : 'Your hull gave out under the starstorm — but the storm can be flown again.', FIELD.width / 2, 286);
  const rows = [
    ['Final score', `${s.score.toLocaleString('en-US')} points`],
    ['Best score', `${Math.max(best, s.score).toLocaleString('en-US')} points`],
    ['Waves reached', `${s.wave} / 10`],
    ['Kills', `${s.kills}`],
    ['Level reached', `${s.level}`],
    ['Best kill streak', `${s.bestCombo}`],
    ['Time survived', `${Math.floor(s.elapsed / 60)}:${String(Math.floor(s.elapsed % 60)).padStart(2, '0')}`],
  ];
  ctx.font = '18px sans-serif';
  rows.forEach(([label, value], i) => {
    const y = 350 + i * 32;
    ctx.fillStyle = '#9db8ff';
    ctx.textAlign = 'right';
    ctx.fillText(label, FIELD.width / 2 - 12, y);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(value, FIELD.width / 2 + 12, y);
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7fe7ff';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('Press ENTER or click to fly again', FIELD.width / 2, 620);
}

function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(4, 6, 18, 0.7)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#dfe9ff';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText('PAUSED', FIELD.width / 2, 380);
  ctx.fillStyle = '#9db8ff';
  ctx.font = '18px sans-serif';
  ctx.fillText('Press P or Escape to keep flying', FIELD.width / 2, 424);
}

export function draw(ctx, world, ui) {
  const s = world.state;
  ctx.save();
  if (s.shake > 0.5) {
    ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);
  }
  drawBackground(ctx, s.time, s.player);
  // Pickups under everything else.
  for (const pk of s.pickups) if (pk.active) drawPickup(ctx, pk, s.time);
  // Projectiles.
  for (const pr of s.projectiles) {
    if (!pr.active) continue;
    ctx.save();
    ctx.shadowColor = pr.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = pr.color;
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, pr.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Enemy shots.
  for (const sh of s.enemyShots) {
    if (!sh.active) continue;
    ctx.save();
    ctx.shadowColor = '#ff5d73';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ff8fa0';
    ctx.beginPath();
    ctx.arc(sh.x, sh.y, sh.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Orbit blades.
  const orbit = s.weapons.orbit;
  if (orbit.level > 0) {
    const stats = { radius: 95 + (orbit.level - 1) * 12 };
    for (let i = 0; i < 1 + orbit.level; i += 1) {
      const a = orbit.angle + (i * Math.PI * 2) / (1 + orbit.level);
      const bx = s.player.x + Math.cos(a) * stats.radius;
      const by = s.player.y + Math.sin(a) * stats.radius;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(a + Math.PI / 2);
      ctx.shadowColor = '#ffd166';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(7, 8);
      ctx.lineTo(0, 4);
      ctx.lineTo(-7, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  // Enemies.
  for (const e of s.enemies) if (e.active) drawEnemy(ctx, e, s.time);
  // Pilot, with a blink while invulnerable.
  const p = s.player;
  if (s.phase !== PHASE_TITLE) {
    drawShip(ctx, p.x, p.y, p.angle, p.radius, '#7fe7ff', p.iframes > 0);
  }
  // Particles.
  for (const pt of s.particles) {
    if (!pt.active) continue;
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
  // Floating numbers.
  ctx.textAlign = 'center';
  ctx.font = 'bold 13px sans-serif';
  for (const f of s.floaters) {
    ctx.globalAlpha = Math.min(1, f.life / 0.5);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y - (0.9 - f.life) * 30);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Vignette.
  const vg = ctx.createRadialGradient(FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.45, FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.85);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(2,4,14,0.5)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  if (s.phase === PHASE_TITLE) drawTitle(ctx, ui.best);
  else if (s.phase === PHASE_DRAFT) { drawHud(ctx, world); drawDraft(ctx, world); }
  else if (s.phase === PHASE_WIN) drawEnd(ctx, world, true, ui.best);
  else if (s.phase === PHASE_OVER) drawEnd(ctx, world, false, ui.best);
  else {
    drawHud(ctx, world);
    if (s.phase === PHASE_BREATHER) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#7dffb2';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText(`WAVE ${s.wave} CLEARED — next wave in ${Math.ceil(s.breatherTime)}`, FIELD.width / 2, 170);
    }
    if (ui.paused) drawPaused(ctx);
  }
  if (ui.muted) {
    ctx.fillStyle = '#5a6b9a';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('muted [M]', 16, 100);
  }
}
