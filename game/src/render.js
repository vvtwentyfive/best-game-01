// World rendering: procedural desert art — layered dunes, a low sun, realm
// palettes, the sand-skiff, seven enemy silhouettes, both bosses, hazards,
// pickups and the storm. No images; every shape is drawn from code.
import { ARENA_HEIGHT, ARENA_WIDTH, ENEMY_DEFS } from './config.js';
import { realmPalette, realmDef } from './realms.js';
import { drawParticles, drawDamageNumbers, shakeOffset } from './particles.js';
import { drawProjectiles } from './projectiles.js';
import { relicById } from './relics.js';

function hashNoise(index, salt) {
  let h = (index * 374761393 + salt * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function drawSkyAndDunes(ctx, session, palette) {
  const t = session.time;
  const grad = ctx.createLinearGradient(0, 0, 0, ARENA_HEIGHT);
  grad.addColorStop(0, palette.skyTop);
  grad.addColorStop(0.45, palette.skyMid);
  grad.addColorStop(0.72, palette.skyLow);
  grad.addColorStop(1, palette.sandFar);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  // Low sun with halo.
  const sunX = 1060;
  const sunY = 118;
  ctx.fillStyle = palette.glow;
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 74, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 48, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
  ctx.fill();
  // Three dune ridges, slowly breathing.
  const ridges = [
    { base: 300, amp: 26, color: palette.sandFar, speed: 0.11, phase: 0 },
    { base: 420, amp: 34, color: palette.sandMid, speed: 0.07, phase: 2.1 },
    { base: 560, amp: 30, color: palette.sandNear, speed: 0.05, phase: 4.4 },
  ];
  for (const ridge of ridges) {
    ctx.fillStyle = ridge.color;
    ctx.beginPath();
    ctx.moveTo(0, ARENA_HEIGHT);
    for (let x = 0; x <= ARENA_WIDTH; x += 16) {
      const y = ridge.base
        + Math.sin(x * 0.006 + ridge.phase + t * ridge.speed) * ridge.amp
        + Math.sin(x * 0.017 + ridge.phase * 2 + t * ridge.speed * 1.7) * ridge.amp * 0.4;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(ARENA_WIDTH, ARENA_HEIGHT);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = palette.duneLine;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // Deterministic decor: rocks, bones, glass shards, ruins by realm.
  for (let i = 0; i < 26; i += 1) {
    const x = hashNoise(i, 11) * ARENA_WIDTH;
    const y = 330 + hashNoise(i, 23) * 360;
    const s = 6 + hashNoise(i, 37) * 14;
    const kind = Math.floor(hashNoise(i, 51) * 3);
    ctx.fillStyle = palette.duneLine;
    if (kind === 0) {
      ctx.beginPath();
      ctx.ellipse(x, y, s, s * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(hashNoise(i, 67) * 0.6 - 0.3);
      ctx.fillRect(-s * 0.18, -s * 1.6, s * 0.36, s * 1.6);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + s * 0.5, y - s);
      ctx.lineTo(x + s, y);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.fillStyle = palette.fog;
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
}

function drawHazards(ctx, session, palette) {
  for (const h of session.hazards) {
    const warning = h.warnTimer > 0;
    const pulse = 0.5 + Math.sin(h.t * 10) * 0.3;
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
    if (warning) {
      ctx.fillStyle = `rgba(255,60,60,${0.14 * pulse + 0.08})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(255,80,80,${0.8 * pulse + 0.2})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = h.kind === 'sunbeam' ? 'rgba(255,230,120,0.55)' : 'rgba(125,211,252,0.5)';
      ctx.fill();
      ctx.strokeStyle = palette.hazard;
      ctx.lineWidth = 3;
      ctx.stroke();
      for (let i = 0; i < 8; i += 1) {
        const a = hashNoise(i, 91) * Math.PI * 2;
        const r = hashNoise(i, 97) * h.radius * 0.8;
        ctx.fillStyle = palette.hazard;
        ctx.beginPath();
        ctx.arc(h.x + Math.cos(a) * r, h.y + Math.sin(a) * r, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawShardDrops(ctx, session) {
  for (const s of session.shardDrops) {
    const bob = Math.sin(s.t) * 3;
    const blink = 0.7 + Math.sin(s.t * 2) * 0.3;
    ctx.save();
    ctx.translate(s.x, s.y + bob);
    ctx.rotate(Math.PI / 4);
    ctx.globalAlpha = blink;
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(-6, -6, 12, 12);
    ctx.fillStyle = '#fff7cc';
    ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawPickups(ctx, session) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const pk of session.pickups) {
    const bob = Math.sin(pk.t * 3) * 4;
    const y = pk.y + bob;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(pk.x, pk.y + 14, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(pk.x, y, 17, 0, Math.PI * 2);
    ctx.fillStyle = pk.kind === 'health' ? '#16a34a' : pk.kind === 'magnet' ? '#0284c7' : pk.kind === 'bomb' ? '#b45309' : '#7c3aed';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Verdana, sans-serif';
    const glyph = pk.kind === 'health' ? '+' : pk.kind === 'magnet' ? '◉' : pk.kind === 'bomb' ? '✹' : '◆';
    ctx.fillText(glyph, pk.x, y + 1);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function drawEnemyHealthBar(ctx, e) {
  if (e.hp >= e.maxHp) return;
  const w = e.radius * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 5);
  ctx.fillStyle = e.elite ? '#fbbf24' : '#4ade80';
  ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, (w * Math.max(0, e.hp)) / e.maxHp, 5);
}

function drawEnemyShape(ctx, e, def) {
  const flash = e.flash > 0.4;
  const body = flash ? '#ffffff' : def.color;
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.type === 'sandmite') {
    const wiggle = Math.sin(e.t * 10) * 0.2;
    ctx.rotate(wiggle);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, e.radius, e.radius * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    for (let leg = -1; leg <= 1; leg += 1) {
      ctx.beginPath();
      ctx.moveTo(leg * 6, -4);
      ctx.lineTo(leg * 10, -e.radius - 4);
      ctx.moveTo(leg * 6, 4);
      ctx.lineTo(leg * 10, e.radius + 4);
      ctx.stroke();
    }
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.arc(5, -3, 2.6, 0, Math.PI * 2);
    ctx.arc(5, 3, 2.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.type === 'dunecrawler') {
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + e.t * 0.4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * e.radius * 0.6, Math.sin(a) * e.radius * 0.6);
      ctx.lineTo(Math.cos(a) * e.radius, Math.sin(a) * e.radius);
      ctx.stroke();
    }
  } else if (e.type === 'glasswasp') {
    const flap = Math.sin(e.t * 22) * 0.5;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.save();
    ctx.rotate(flap);
    ctx.beginPath();
    ctx.ellipse(-8, -8, 10, 4, -0.6, 0, Math.PI * 2);
    ctx.ellipse(-8, 8, 10, 4, 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, e.radius * 0.7, e.radius, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0c4a6e';
    ctx.beginPath();
    ctx.arc(0, -e.radius * 0.5, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.type === 'shardspitter') {
    ctx.fillStyle = body;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + e.t * 0.6;
      const r = i % 2 === 0 ? e.radius : e.radius * 0.6;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#14532d';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.type === 'miragewraith') {
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, -e.radius);
    ctx.quadraticCurveTo(e.radius, 0, e.radius * 0.6, e.radius);
    ctx.lineTo(0, e.radius * 0.6);
    ctx.lineTo(-e.radius * 0.6, e.radius);
    ctx.quadraticCurveTo(-e.radius, 0, 0, -e.radius);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-4, -3, 2.5, 0, Math.PI * 2);
    ctx.arc(4, -3, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.type === 'emberscarab') {
    const pulse = e.charging ? 1.25 : 1 + Math.sin(e.t * 6) * 0.08;
    ctx.scale(pulse, pulse);
    ctx.fillStyle = e.charging ? '#fca5a5' : body;
    ctx.beginPath();
    ctx.ellipse(0, 0, e.radius, e.radius * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -e.radius * 0.8);
    ctx.lineTo(0, e.radius * 0.8);
    ctx.stroke();
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.type === 'crystalgolem') {
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, -e.radius);
    ctx.lineTo(e.radius * 0.8, -e.radius * 0.2);
    ctx.lineTo(e.radius * 0.6, e.radius);
    ctx.lineTo(-e.radius * 0.6, e.radius);
    ctx.lineTo(-e.radius * 0.8, -e.radius * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.moveTo(0, -e.radius * 0.7);
    ctx.lineTo(e.radius * 0.35, 0);
    ctx.lineTo(0, e.radius * 0.6);
    ctx.lineTo(-e.radius * 0.35, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1e3a8a';
    ctx.beginPath();
    ctx.arc(-6, -6, 3, 0, Math.PI * 2);
    ctx.arc(6, -6, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (e.elite) {
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 13px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ELITE', e.x, e.y - e.radius - 16);
    ctx.textAlign = 'left';
  }
  drawEnemyHealthBar(ctx, e);
}

function drawSandwormBoss(ctx, boss) {
  if (boss.burrowed) {
    ctx.fillStyle = 'rgba(120,60,20,0.35)';
    ctx.beginPath();
    ctx.ellipse(boss.x, boss.y, 60, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#78350f';
    ctx.font = 'bold 15px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠ BENEATH THE SAND ⚠', Math.max(140, Math.min(1140, boss.x)), boss.y - 26);
    ctx.textAlign = 'left';
    return;
  }
  for (let i = boss.segments.length - 1; i >= 0; i -= 1) {
    const seg = boss.segments[i];
    ctx.fillStyle = i % 2 === 0 ? '#b45309' : '#92400e';
    ctx.beginPath();
    ctx.arc(seg.x, seg.y, seg.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  const flash = boss.flash > 0.4;
  ctx.fillStyle = flash ? '#ffffff' : '#d97706';
  ctx.beginPath();
  ctx.arc(boss.x, boss.y, boss.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#451a03';
  ctx.beginPath();
  ctx.arc(boss.x, boss.y + 6, boss.radius * 0.55, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  for (let i = -2; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.moveTo(boss.x + i * 9 - 4, boss.y + 6);
    ctx.lineTo(boss.x + i * 9 + 4, boss.y + 6);
    ctx.lineTo(boss.x + i * 9, boss.y + 18);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.arc(boss.x - 12, boss.y - 12, 4, 0, Math.PI * 2);
  ctx.arc(boss.x + 12, boss.y - 12, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawGlassRegent(ctx, boss) {
  const flash = boss.flash > 0.4;
  const bob = Math.sin(boss.t * 2) * 6;
  const y = boss.y + bob;
  ctx.save();
  ctx.translate(boss.x, y);
  ctx.rotate(Math.sin(boss.t * 0.8) * 0.08);
  ctx.fillStyle = 'rgba(232,121,249,0.25)';
  ctx.beginPath();
  ctx.arc(0, 0, boss.radius + 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = flash ? '#ffffff' : '#e879f9';
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 + boss.t * 0.3;
    const r = i % 2 === 0 ? boss.radius : boss.radius * 0.62;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fdf4ff';
  ctx.beginPath();
  ctx.arc(0, 0, boss.radius * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#701a75';
  ctx.beginPath();
  ctx.arc(0, 0, boss.radius * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-3, -3, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSkiff(ctx, session) {
  const p = session.player;
  const blink = p.invulnTimer > 0 && Math.floor(session.time * 14) % 2 === 0;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(1.28, 1.28);
  if (blink) ctx.globalAlpha = 0.55;
  // Sail shadow + wake.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(2, 14, 26, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hull: a curved sand-skiff with twin runners.
  ctx.fillStyle = '#7c2d12';
  ctx.beginPath();
  ctx.moveTo(-26, 2);
  ctx.quadraticCurveTo(0, 16, 26, 2);
  ctx.quadraticCurveTo(18, -6, 0, -6);
  ctx.quadraticCurveTo(-18, -6, -26, 2);
  ctx.fill();
  ctx.fillStyle = '#b45309';
  ctx.fillRect(-22, -2, 44, 4);
  ctx.fillStyle = '#451a03';
  ctx.fillRect(-26, 8, 8, 4);
  ctx.fillRect(18, 8, 8, 4);
  // Mast + billowing sail.
  const billow = Math.sin(p.sailPhase) * 4;
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.lineTo(0, -34);
  ctx.stroke();
  ctx.fillStyle = '#fef3c7';
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.quadraticCurveTo(20 + billow, -26, 18 + billow, -8);
  ctx.quadraticCurveTo(8, -14, 0, -8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(9 + billow * 0.5, -21, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Sunlance: aims at the mouse.
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(1.28, 1.28);
  ctx.rotate(p.aimAngle);
  ctx.fillStyle = '#78350f';
  ctx.fillRect(8, -3, 24, 6);
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.moveTo(32, -5);
  ctx.lineTo(44, 0);
  ctx.lineTo(32, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Shield ring.
  if (p.shieldCharges > 0) {
    ctx.strokeStyle = 'rgba(103,232,249,0.8)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, (p.radius + 8 + Math.sin(session.time * 4) * 2) * 1.28, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Hurt vignette flash around the skiff.
  if (p.hurtFlash > 0) {
    ctx.strokeStyle = `rgba(248,113,113,${p.hurtFlash * 0.8})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, (p.radius + 6) * 1.28, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawStormGust(ctx, session) {
  if (session.stormGust <= 0) return;
  ctx.fillStyle = 'rgba(224,164,88,0.16)';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  ctx.strokeStyle = 'rgba(255,220,160,0.5)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i += 1) {
    const y = hashNoise(i, 7) * ARENA_HEIGHT;
    const x = ((session.time * 500 * session.stormDir + hashNoise(i, 13) * ARENA_WIDTH) % ARENA_WIDTH + ARENA_WIDTH) % ARENA_WIDTH;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 70 * session.stormDir, y + 8);
    ctx.stroke();
  }
}

export function drawGameWorld(ctx, session) {
  const palette = realmPalette(session.realmIndex);
  ctx.save();
  const shake = shakeOffset(session);
  ctx.translate(shake.x, shake.y);
  drawSkyAndDunes(ctx, session, palette);
  drawHazards(ctx, session, palette);
  drawShardDrops(ctx, session);
  drawPickups(ctx, session);
  for (const e of session.enemies) drawEnemyShape(ctx, e, ENEMY_DEFS[e.type]);
  if (session.boss) {
    if (session.boss.kind === 'tyrant') drawSandwormBoss(ctx, session.boss);
    else drawGlassRegent(ctx, session.boss);
  }
  drawSkiff(ctx, session);
  drawProjectiles(ctx, session);
  drawParticles(ctx, session);
  drawStormGust(ctx, session);
  drawDamageNumbers(ctx, session);
  ctx.restore();
  // Vignette.
  const vig = ctx.createRadialGradient(640, 360, 320, 640, 360, 720);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
}

export function drawRelicIcons(ctx, session, x, y) {
  const p = session.player;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  p.relics.forEach((id, i) => {
    const relic = relicById(id);
    if (!relic) return;
    const cx = x + i * 34;
    ctx.fillStyle = 'rgba(20,10,40,0.75)';
    ctx.beginPath();
    ctx.arc(cx, y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 15px Verdana, sans-serif';
    ctx.fillText(relic.icon, cx, y + 1);
  });
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

export { realmDef };
