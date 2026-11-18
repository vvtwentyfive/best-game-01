// HUD and screens: the top bar, boss bar, banners, title, pause, level-up
// cards, relic cards, workshop, victory and game-over screens. Layout rects
// are exported so clicks land exactly on what is drawn.
import { ARENA_HEIGHT, ARENA_WIDTH, DIFFICULTY_ORDER, DIFFICULTIES } from './config.js';
import { realmDef } from './realms.js';
import { drawRelicIcons } from './render.js';

const FONT = 'Verdana, Geneva, sans-serif';
const HEAD_FONT = '"Trebuchet MS", Verdana, sans-serif';

function panel(ctx, x, y, w, h, fill, stroke) {
  ctx.fillStyle = fill || 'rgba(15,8,30,0.82)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = stroke || '#f59e0b';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function bigText(ctx, text, x, y, size, color, align) {
  ctx.font = `bold ${size}px ${HEAD_FONT}`;
  ctx.textAlign = align || 'left';
  ctx.lineWidth = Math.max(3, size / 8);
  ctx.strokeStyle = 'rgba(20,8,0,0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.textAlign = 'left';
}

function bodyText(ctx, text, x, y, size, color, align) {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align || 'left';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.textAlign = 'left';
}

export function drawHUD(ctx, session, muted) {
  const p = session.player;
  const realm = realmDef(session.realmIndex);
  // Top bar.
  ctx.fillStyle = 'rgba(12,6,24,0.78)';
  ctx.fillRect(0, 0, ARENA_WIDTH, 58);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, 58, ARENA_WIDTH, 2);
  // HP bar.
  ctx.fillStyle = '#3f1d1d';
  ctx.beginPath();
  ctx.roundRect(16, 14, 240, 20, 6);
  ctx.fill();
  const hpFrac = Math.max(0, p.hp / p.maxHp);
  ctx.fillStyle = hpFrac > 0.35 ? '#22c55e' : '#ef4444';
  ctx.beginPath();
  ctx.roundRect(16, 14, 240 * hpFrac, 20, 6);
  ctx.fill();
  bodyText(ctx, `HP ${Math.ceil(p.hp)}/${p.maxHp}`, 24, 29, 14, '#ffffff');
  // XP bar + level.
  ctx.fillStyle = '#1e1b4b';
  ctx.beginPath();
  ctx.roundRect(16, 38, 240, 12, 6);
  ctx.fill();
  const xpFrac = Math.max(0, Math.min(1, p.xp / p.xpNext));
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.roundRect(16, 38, 240 * xpFrac, 12, 6);
  ctx.fill();
  bigText(ctx, `LV ${p.level}`, 268, 34, 20, '#7dd3fc');
  // Realm + wave.
  bigText(ctx, realm.name, 400, 26, 19, '#fde68a', 'center');
  bodyText(ctx, session.boss ? 'BOSS FIGHT' : session.endless ? `ENDLESS TIDE ${session.endlessLevel} · WAVE ${session.wave}` : `WAVE ${Math.max(1, session.wave)} / ${realm.waves}`, 400, 46, 14, '#ffffff', 'center');
  // Score, shards, kills.
  bigText(ctx, `SCORE ${session.score.toLocaleString('en-US')}`, 640, 26, 19, '#ffffff', 'center');
  bodyText(ctx, `◆ ${session.shards} shards   ☠ ${session.kills} slain`, 640, 46, 14, '#fde68a', 'center');
  // Combo.
  if (session.combo >= 3) {
    bigText(ctx, `COMBO x${session.combo}`, 880, 30, 20, '#ffd23f', 'center');
    bodyText(ctx, 'keep slaying!', 880, 48, 12, '#ffffff', 'center');
  }
  // Bombs + dash + mute: left block ends well before the right-aligned hints.
  bodyText(ctx, `✹ Bombs: ${p.bombCount} [B]`, 985, 24, 15, '#ffffff');
  const dashReady = p.dashCooldown <= 0;
  bodyText(ctx, dashReady ? 'Dash READY [Shift]' : `Dash ${p.dashCooldown.toFixed(1)}s`, 985, 44, 13, dashReady ? '#4ade80' : '#9ca3af');
  bodyText(ctx, muted ? 'M: SOUND OFF' : 'M: SOUND ON', 1264, 24, 13, '#d1d5db', 'right');
  bodyText(ctx, 'ESC: PAUSE', 1264, 44, 13, '#d1d5db', 'right');
  // Relic icons under the bar.
  if (p.relics.length > 0) {
    bodyText(ctx, 'RELICS', 16, 78, 12, '#fbbf24');
    drawRelicIcons(ctx, session, 66, 76);
  }
  // Boss bar.
  if (session.boss) {
    const boss = session.boss;
    const bw = 620;
    const bx = (ARENA_WIDTH - bw) / 2;
    const by = ARENA_HEIGHT - 46;
    ctx.fillStyle = 'rgba(12,6,24,0.8)';
    ctx.beginPath();
    ctx.roundRect(bx - 12, by - 22, bw + 24, 40, 8);
    ctx.fill();
    bigText(ctx, `${boss.name}  ·  PHASE ${boss.phase}`, 640, by - 6, 15, '#fda4af', 'center');
    ctx.fillStyle = '#3f1d1d';
    ctx.beginPath();
    ctx.roundRect(bx, by + 2, bw, 12, 6);
    ctx.fill();
    ctx.fillStyle = '#e11d48';
    ctx.beginPath();
    ctx.roundRect(bx, by + 2, bw * Math.max(0, boss.hp / boss.maxHp), 12, 6);
    ctx.fill();
  }
  // Banners.
  if (session.realmBannerTimer > 0) {
    const a = Math.min(1, session.realmBannerTimer);
    ctx.globalAlpha = a;
    bigText(ctx, session.realmBanner, 640, 170, 44, '#fff7cc', 'center');
    bodyText(ctx, realmDef(session.realmIndex).subtitle, 640, 200, 17, '#ffffff', 'center');
    ctx.globalAlpha = 1;
  } else if (session.waveBannerTimer > 0) {
    const a = Math.min(1, session.waveBannerTimer);
    ctx.globalAlpha = a;
    bigText(ctx, session.waveBanner, 640, 170, 38, '#ffd23f', 'center');
    ctx.globalAlpha = 1;
  }
  if (session.synergyTimer > 0) {
    ctx.globalAlpha = Math.min(1, session.synergyTimer);
    panel(ctx, 440, 220, 400, 52, 'rgba(124,58,237,0.9)', '#fde68a');
    bigText(ctx, `SYNERGY: ${session.synergyFlash}`, 640, 254, 20, '#fde68a', 'center');
    ctx.globalAlpha = 1;
  }
  if (session.stormGust > 0) {
    bodyText(ctx, '◀ SANDSTORM GUST — HOLD YOUR COURSE ▶', 640, 88, 16, '#fde68a', 'center');
  }
}

// ---- Title screen ----
export function titleLayout() {
  return {
    difficulties: DIFFICULTY_ORDER.map((id, i) => ({ id, x: 340 + i * 200, y: 452, w: 180, h: 64 })),
    sail: { x: 490, y: 540, w: 300, h: 62 },
  };
}

export function drawTitleScreen(ctx, session, selectedDifficulty, best, bestLevel) {
  ctx.fillStyle = 'rgba(10,4,24,0.45)';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  bigText(ctx, 'DUNESAIL', 640, 150, 84, '#ffd23f', 'center');
  bodyText(ctx, 'Arena survival on a living desert — sail the sands, slay the swarm, dethrone the Glass Regent.', 640, 186, 17, '#ffffff', 'center');
  panel(ctx, 290, 210, 700, 118, 'rgba(15,8,30,0.85)');
  bodyText(ctx, 'YOUR QUEST', 320, 240, 16, '#fbbf24');
  bodyText(ctx, 'Survive 3 realms, defeat 2 bosses, and claim the Sunken Court.', 320, 264, 16, '#ffffff');
  bodyText(ctx, 'Slain foes drop sun-shards: level up, choose upgrades, claim relics, spend shards', 320, 288, 15, '#e5e7eb');
  bodyText(ctx, 'in the workshop between realms. Win, then sail on into Endless mode.', 320, 310, 15, '#e5e7eb');
  panel(ctx, 290, 342, 700, 84, 'rgba(15,8,30,0.85)');
  bodyText(ctx, 'CONTROLS', 320, 370, 16, '#fbbf24');
  bodyText(ctx, 'WASD / Arrows — sail    ·    Mouse — aim    ·    Hold Click / Space — fire sunlance', 320, 394, 15, '#ffffff');
  bodyText(ctx, 'Shift / Right-click — dash    ·    B — sun-bomb    ·    Esc — pause    ·    M — mute', 320, 414, 15, '#ffffff');
  const layout = titleLayout();
  bodyText(ctx, 'CHOOSE YOUR VOYAGE', 640, 442, 15, '#fde68a', 'center');
  layout.difficulties.forEach((slot) => {
    const diff = DIFFICULTIES[slot.id];
    const selected = slot.id === selectedDifficulty;
    panel(ctx, slot.x, slot.y, slot.w, slot.h, selected ? 'rgba(245,158,11,0.92)' : 'rgba(15,8,30,0.85)', selected ? '#fff7cc' : '#f59e0b');
    bigText(ctx, diff.label, slot.x + slot.w / 2, slot.y + 30, 19, selected ? '#ffffff' : '#fde68a', 'center');
    bodyText(ctx, selected ? '★ SELECTED ★' : 'click to choose', slot.x + slot.w / 2, slot.y + 52, 12, selected ? '#1f2937' : '#d1d5db', 'center');
  });
  const sail = layout.sail;
  panel(ctx, sail.x, sail.y, sail.w, sail.h, 'rgba(220,38,38,0.95)', '#fff7cc');
  bigText(ctx, '⛵  SET SAIL', sail.x + sail.w / 2, sail.y + 40, 26, '#ffffff', 'center');
  bodyText(ctx, `Best score: ${best.toLocaleString('en-US')}    ·    Best level: ${bestLevel}    ·    Sound on — headphones recommended`, 640, 640, 14, '#fde68a', 'center');
  bodyText(ctx, 'An original game — every sprite, sound and note made in code. No downloads, no network.', 640, 664, 13, '#d1d5db', 'center');
}

export function drawPauseScreen(ctx, session) {
  ctx.fillStyle = 'rgba(8,4,20,0.72)';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  panel(ctx, 440, 220, 400, 260, 'rgba(15,8,30,0.94)');
  bigText(ctx, 'PAUSED', 640, 280, 44, '#ffd23f', 'center');
  bodyText(ctx, `Score ${session.score.toLocaleString('en-US')}  ·  Wave ${session.wave}  ·  Level ${session.player.level}`, 640, 316, 15, '#ffffff', 'center');
  bodyText(ctx, 'Esc / P — resume', 640, 356, 17, '#fde68a', 'center');
  bodyText(ctx, 'M — mute    ·    R — restart run', 640, 384, 17, '#fde68a', 'center');
  bodyText(ctx, 'Click anywhere to resume', 640, 428, 14, '#d1d5db', 'center');
}

// ---- Choice overlays ----
export function choiceCardLayout(count) {
  const w = 280;
  const gap = 24;
  const total = count * w + (count - 1) * gap;
  const startX = (ARENA_WIDTH - total) / 2;
  return Array.from({ length: count }, (_, i) => ({ x: startX + i * (w + gap), y: 250, w, h: 250 }));
}

export function drawLevelUpScreen(ctx, session) {
  ctx.fillStyle = 'rgba(8,4,20,0.66)';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  bigText(ctx, `LEVEL UP!  —  LEVEL ${session.player.level}`, 640, 150, 42, '#ffd23f', 'center');
  bodyText(ctx, 'The desert rewards the bold. Choose one upgrade:', 640, 186, 17, '#ffffff', 'center');
  const rects = choiceCardLayout(session.levelUpChoices.length);
  session.levelUpChoices.forEach((upgrade, i) => {
    const r = rects[i];
    panel(ctx, r.x, r.y, r.w, r.h, 'rgba(30,20,50,0.96)', '#38bdf8');
    bigText(ctx, upgrade.icon, r.x + r.w / 2, r.y + 66, 44, '#7dd3fc', 'center');
    bigText(ctx, upgrade.name, r.x + r.w / 2, r.y + 108, 18, '#ffffff', 'center');
    wrapText(ctx, upgrade.desc, r.x + 20, r.y + 140, r.w - 40, 15, '#e5e7eb');
    panel(ctx, r.x + r.w / 2 - 46, r.y + r.h - 44, 92, 30, 'rgba(56,189,248,0.9)', '#ffffff');
    bodyText(ctx, `PRESS ${i + 1}`, r.x + r.w / 2, r.y + r.h - 23, 13, '#0c4a6e', 'center');
  });
  bodyText(ctx, 'Click a card or press 1 / 2 / 3', 640, 540, 15, '#d1d5db', 'center');
}

export function drawRelicScreen(ctx, session) {
  ctx.fillStyle = 'rgba(8,4,20,0.66)';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  bigText(ctx, 'A RELIC OF THE OLD COURT!', 640, 150, 40, '#f0abfc', 'center');
  bodyText(ctx, 'An elite fell and left treasure behind. Claim one relic — pairs unlock synergies:', 640, 186, 17, '#ffffff', 'center');
  const rects = choiceCardLayout(session.relicChoices.length);
  session.relicChoices.forEach((relic, i) => {
    const r = rects[i];
    panel(ctx, r.x, r.y, r.w, r.h, 'rgba(46,16,60,0.96)', '#e879f9');
    bigText(ctx, relic.icon, r.x + r.w / 2, r.y + 66, 44, '#f0abfc', 'center');
    bigText(ctx, relic.name, r.x + r.w / 2, r.y + 108, 18, '#ffffff', 'center');
    wrapText(ctx, relic.desc, r.x + 20, r.y + 140, r.w - 40, 14, '#e5e7eb');
    panel(ctx, r.x + r.w / 2 - 46, r.y + r.h - 44, 92, 30, 'rgba(232,121,249,0.9)', '#ffffff');
    bodyText(ctx, `PRESS ${i + 1}`, r.x + r.w / 2, r.y + r.h - 23, 13, '#701a75', 'center');
  });
  bodyText(ctx, 'Click a card or press 1 / 2 / 3', 640, 540, 15, '#d1d5db', 'center');
}

function wrapText(ctx, text, x, y, maxWidth, size, color) {
  ctx.font = `${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  const words = text.split(' ');
  let line = '';
  let lineY = y;
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      ctx.fillText(line, x + maxWidth / 2, lineY);
      line = word;
      lineY += size + 6;
    } else {
      line = trial;
    }
  }
  if (line) ctx.fillText(line, x + maxWidth / 2, lineY);
  ctx.textAlign = 'left';
}

// ---- Workshop ----
export function workshopLayout(offers) {
  const rects = offers.map((offer, i) => ({
    id: offer.id,
    x: 240 + (i % 2) * 410,
    y: 190 + Math.floor(i / 2) * 104,
    w: 390, h: 88,
  }));
  return { offers: rects, sail: { x: 490, y: 540, w: 300, h: 60 } };
}

export function drawWorkshopScreen(ctx, session) {
  ctx.fillStyle = 'rgba(8,4,20,0.78)';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  bigText(ctx, '⛺  DESERT WORKSHOP', 640, 110, 42, '#ffd23f', 'center');
  bodyText(ctx, `${realmDef(session.realmIndex).name} cleared! Spend sun-shards before the next realm.`, 640, 142, 17, '#ffffff', 'center');
  bigText(ctx, `◆ ${session.shards} SHARDS`, 640, 172, 22, '#fde68a', 'center');
  const layout = workshopLayout(session.workshopOffers);
  session.workshopOffers.forEach((offer, i) => {
    const r = layout.offers[i];
    const bought = session.workshopBought.includes(offer.id);
    const afford = session.shards >= offer.cost;
    panel(ctx, r.x, r.y, r.w, r.h, bought ? 'rgba(20,60,30,0.9)' : 'rgba(30,20,50,0.94)', bought ? '#4ade80' : '#f59e0b');
    bigText(ctx, offer.icon, r.x + 40, r.y + 52, 30, '#fde68a', 'center');
    bigText(ctx, offer.name, r.x + 70, r.y + 34, 17, '#ffffff');
    bodyText(ctx, offer.desc, r.x + 70, r.y + 58, 14, '#e5e7eb');
    bigText(ctx, bought ? 'OWNED ✓' : `◆ ${offer.cost}`, r.x + r.w - 20, r.y + 52, 17, bought ? '#4ade80' : afford ? '#ffd23f' : '#9ca3af', 'right');
  });
  const sail = layout.sail;
  panel(ctx, sail.x, sail.y, sail.w, sail.h, 'rgba(220,38,38,0.95)', '#fff7cc');
  bigText(ctx, `SAIL TO ${realmDef(session.realmIndex + 1).name} →`, sail.x + sail.w / 2, sail.y + 38, 20, '#ffffff', 'center');
  bodyText(ctx, 'Click an offer to buy · Click SAIL when ready', 640, 632, 14, '#d1d5db', 'center');
}

// ---- End screens ----
export function endScreenLayout(victory) {
  if (victory) {
    return {
      restart: { x: 330, y: 540, w: 280, h: 60 },
      endless: { x: 670, y: 540, w: 280, h: 60 },
    };
  }
  return { restart: { x: 490, y: 540, w: 300, h: 60 } };
}

function drawRunStats(ctx, session, y) {
  const p = session.player;
  const mins = Math.floor(session.runTime / 60);
  const secs = Math.floor(session.runTime % 60);
  const stats = [
    `SCORE ${session.score.toLocaleString('en-US')}`,
    `LEVEL ${p.level}`,
    `SLAIN ${session.kills}`,
    `BEST COMBO x${session.maxCombo}`,
    `RELICS ${p.relics.length}`,
    `TIME ${mins}:${String(secs).padStart(2, '0')}`,
  ];
  stats.forEach((line, i) => {
    bodyText(ctx, line, 340 + (i % 3) * 210, y + Math.floor(i / 3) * 30, 16, '#ffffff');
  });
}

export function drawVictoryScreen(ctx, session) {
  ctx.fillStyle = 'rgba(8,4,20,0.72)';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  bigText(ctx, '👑  THE COURT FALLS  👑', 640, 130, 48, '#ffd23f', 'center');
  bigText(ctx, 'VICTORY!', 640, 190, 56, '#ffffff', 'center');
  bodyText(ctx, 'The Glass Regent shatters. The desert is yours, Captain — the sun rises over a free Dune Sea.', 640, 226, 17, '#fde68a', 'center');
  panel(ctx, 300, 250, 680, 240, 'rgba(15,8,30,0.92)');
  bodyText(ctx, 'VOYAGE RECORD', 330, 284, 16, '#fbbf24');
  drawRunStats(ctx, session, 316);
  if (session.isNewBest) bigText(ctx, '★ NEW BEST SCORE! ★', 640, 430, 22, '#ffd23f', 'center');
  else bodyText(ctx, `Best score: ${session.best.toLocaleString('en-US')}`, 640, 428, 15, '#d1d5db', 'center');
  bodyText(ctx, 'Upgrades taken: ' + Math.max(0, session.stats.upgradesTaken) + '   ·   Damage dealt: ' + Math.round(session.stats.damageDealt).toLocaleString('en-US'), 640, 462, 14, '#e5e7eb', 'center');
  const layout = endScreenLayout(true);
  panel(ctx, layout.restart.x, layout.restart.y, layout.restart.w, layout.restart.h, 'rgba(245,158,11,0.95)', '#fff7cc');
  bigText(ctx, 'NEW VOYAGE', layout.restart.x + layout.restart.w / 2, layout.restart.y + 38, 20, '#ffffff', 'center');
  panel(ctx, layout.endless.x, layout.endless.y, layout.endless.w, layout.endless.h, 'rgba(124,58,237,0.95)', '#fff7cc');
  bigText(ctx, '∞ ENDLESS MODE', layout.endless.x + layout.endless.w / 2, layout.endless.y + 38, 20, '#ffffff', 'center');
  bodyText(ctx, 'Press R to restart · Click ENDLESS for ever-rising tides', 640, 632, 14, '#d1d5db', 'center');
}

export function drawGameOverScreen(ctx, session) {
  ctx.fillStyle = 'rgba(8,4,20,0.74)';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  bigText(ctx, 'THE DESERT CLAIMS ANOTHER SKIFF', 640, 130, 34, '#f87171', 'center');
  bigText(ctx, 'GAME OVER', 640, 192, 60, '#ffffff', 'center');
  bodyText(ctx, `Your voyage ended in the ${realmDef(session.realmIndex).name}, wave ${Math.max(1, session.wave)}. The sands keep your story.`, 640, 228, 17, '#fde68a', 'center');
  panel(ctx, 300, 252, 680, 238, 'rgba(15,8,30,0.92)');
  bodyText(ctx, 'VOYAGE RECORD', 330, 286, 16, '#fbbf24');
  drawRunStats(ctx, session, 318);
  if (session.isNewBest) bigText(ctx, '★ NEW BEST SCORE! ★', 640, 430, 22, '#ffd23f', 'center');
  else bodyText(ctx, `Best score: ${session.best.toLocaleString('en-US')}`, 640, 428, 15, '#d1d5db', 'center');
  bodyText(ctx, 'Tip: elites drop relics, and relic pairs unlock synergies. Dash through danger!', 640, 462, 14, '#e5e7eb', 'center');
  const layout = endScreenLayout(false);
  panel(ctx, layout.restart.x, layout.restart.y, layout.restart.w, layout.restart.h, 'rgba(220,38,38,0.95)', '#fff7cc');
  bigText(ctx, 'SAIL AGAIN', layout.restart.x + layout.restart.w / 2, layout.restart.y + 38, 22, '#ffffff', 'center');
  bodyText(ctx, 'Press R or click SAIL AGAIN to restart', 640, 632, 14, '#d1d5db', 'center');
}
