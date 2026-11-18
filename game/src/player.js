// The sand-skiff: movement, dash, firing cadence, levelling and damage taken.
// All upgrades and relics mutate these fields through one place.
import { ARENA_HEIGHT, ARENA_WIDTH, DASH_COOLDOWN, DASH_SPEED, DASH_TIME, difficultyById, xpNeededForLevel } from './config.js';
import { fireSunlance } from './projectiles.js';
import { spawnDamageNumber, spawnHitSparks } from './particles.js';

export function createPlayer(difficultyId) {
  const diff = difficultyById(difficultyId);
  return {
    x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2,
    vx: 0, vy: 0,
    hp: diff.playerHp, maxHp: diff.playerHp,
    speed: 265, radius: 17,
    level: 1, xp: 0, xpNext: xpNeededForLevel(1),
    damage: 13, fireRate: 3.4, fireTimer: 0,
    multishot: 1, pierce: 0, critChance: 0.08, critMult: 2.0,
    magnetRadius: 90, armor: 0, regen: 0, lifesteal: 0,
    burnChance: 0, shardBonus: 0, moveBonus: 0,
    aimX: ARENA_WIDTH / 2, aimY: 200, aimAngle: -Math.PI / 2,
    invulnTimer: 0, dashTimer: 0, dashCooldown: 0, dashDx: 1, dashDy: 0,
    sailPhase: 0, hurtFlash: 0, upgradesTaken: [], relics: [],
    shieldCharges: 0, thorns: 0, bombCount: 0,
  };
}

export function updatePlayer(session, dt, move, aim, firing, wantsDash) {
  const p = session.player;
  p.aimX = aim.x;
  p.aimY = aim.y;
  p.aimAngle = Math.atan2(aim.y - p.y, aim.x - p.x);
  p.sailPhase += dt * (2 + Math.hypot(move.x, move.y) * 3);
  p.invulnTimer = Math.max(0, p.invulnTimer - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt * 3);
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  if (p.regen > 0) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);

  if (wantsDash && p.dashCooldown <= 0 && p.dashTimer <= 0 && (move.x !== 0 || move.y !== 0)) {
    p.dashTimer = DASH_TIME;
    const ghostSynergy = (session.activeSynergies || []).some((s) => s.name === 'DESERT GHOST');
    p.dashCooldown = ghostSynergy ? DASH_COOLDOWN / 2 : DASH_COOLDOWN;
    if (ghostSynergy && p.shieldCharges < 2) p.shieldCharges += 1;
    p.dashDx = move.x;
    p.dashDy = move.y;
    p.invulnTimer = Math.max(p.invulnTimer, DASH_TIME + 0.05);
    session.audio.playDash();
    spawnHitSparks(session, p.x, p.y, '#fde68a', 8);
  }

  if (p.dashTimer > 0) {
    p.dashTimer -= dt;
    p.vx = p.dashDx * DASH_SPEED;
    p.vy = p.dashDy * DASH_SPEED;
  } else {
    const speed = p.speed + p.moveBonus;
    const targetVx = move.x * speed;
    const targetVy = move.y * speed;
    p.vx += (targetVx - p.vx) * Math.min(1, dt * 14);
    p.vy += (targetVy - p.vy) * Math.min(1, dt * 14);
  }
  p.x = Math.max(28, Math.min(ARENA_WIDTH - 28, p.x + p.vx * dt));
  p.y = Math.max(64, Math.min(ARENA_HEIGHT - 28, p.y + p.vy * dt));

  p.fireTimer -= dt;
  if (firing && p.fireTimer <= 0) {
    fireSunlance(session);
    p.fireTimer = 1 / p.fireRate;
    session.audio.playShoot();
  }
}

export function damagePlayer(session, amount, fromX, fromY) {
  const p = session.player;
  if (p.invulnTimer > 0 || session.screen !== 'playing') return false;
  if (p.shieldCharges > 0) {
    p.shieldCharges -= 1;
    p.invulnTimer = 0.6;
    spawnDamageNumber(session, p.x, p.y - 20, 0, 'heal');
    spawnHitSparks(session, p.x, p.y, '#67e8f9', 14);
    session.audio.playHit();
    return false;
  }
  const reduced = Math.max(1, Math.round(amount * (1 - Math.min(0.6, p.armor))));
  p.hp -= reduced;
  p.invulnTimer = 0.55;
  p.hurtFlash = 1;
  session.shake = Math.min(16, session.shake + 6);
  session.combo = 0;
  spawnDamageNumber(session, p.x, p.y - 22, reduced, 'hurt');
  spawnHitSparks(session, p.x, p.y, '#f87171', 10);
  session.audio.playHurt();
  if (fromX !== undefined) {
    const angle = Math.atan2(p.y - fromY, p.x - fromX);
    p.vx += Math.cos(angle) * 160;
    p.vy += Math.sin(angle) * 160;
  }
  if (p.hp <= 0) {
    p.hp = 0;
    session.screen = 'gameover';
    session.audio.playDefeat();
    session.audio.stopMusic();
  }
  return true;
}

export function healPlayer(session, amount) {
  const p = session.player;
  const healed = Math.min(p.maxHp - p.hp, amount);
  p.hp += healed;
  if (healed > 0) spawnDamageNumber(session, p.x, p.y - 24, `+${Math.round(healed)}`, 'heal');
  return healed;
}

export function addExperience(session, amount) {
  const p = session.player;
  p.xp += amount;
  while (p.xp >= p.xpNext && session.screen === 'playing') {
    p.xp -= p.xpNext;
    p.level += 1;
    p.xpNext = xpNeededForLevel(p.level);
    session.pendingLevels += 1;
  }
}

export function gainShards(session, amount) {
  const p = session.player;
  const total = Math.round(amount * (1 + p.shardBonus));
  session.shards += total;
  return total;
}
