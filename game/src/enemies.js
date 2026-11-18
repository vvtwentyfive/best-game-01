// Enemy roster: seven behaviours — chasers, a tank, a weaver, a ranged
// keeper, a blinker, a suicide charger and a splitter. Elites are bigger,
// tougher and drop relics.
import { ENEMY_DEFS, difficultyById } from './config.js';
import { randomRange, pickRandom } from './rng.js';
import { fireEnemyBolt } from './projectiles.js';
import { damagePlayer } from './player.js';
import { spawnExplosionBurst, spawnHitSparks } from './particles.js';

let enemyIdCounter = 1;

export const ENEMY_TYPES_BY_REALM = [
  ['sandmite', 'sandmite', 'dunecrawler', 'glasswasp', 'emberscarab'],
  ['glasswasp', 'shardspitter', 'sandmite', 'dunecrawler', 'crystalgolem'],
  ['miragewraith', 'shardspitter', 'glasswasp', 'crystalgolem', 'emberscarab', 'dunecrawler'],
];

export function spawnEnemy(session, type, x, y, elite) {
  const def = ENEMY_DEFS[type];
  const diff = difficultyById(session.difficulty);
  const realmScale = 1 + session.realmIndex * 0.35 + session.wave * 0.06 + (session.endlessLevel * 0.25);
  const hp = Math.round(def.hp * diff.enemyHp * realmScale * (elite ? 3.2 : 1));
  const enemy = {
    id: enemyIdCounter,
    type,
    x, y,
    hp, maxHp: hp,
    speed: def.speed * diff.enemySpeed * (elite ? 0.9 : 1) * randomRange(session.rng, 0.9, 1.1),
    damage: Math.round(def.damage * diff.enemyDamage * (elite ? 1.5 : 1)),
    radius: def.radius * (elite ? 1.45 : 1),
    xp: def.xp * (elite ? 4 : 1),
    score: def.score * (elite ? 4 : 1),
    elite: !!elite,
    t: randomRange(session.rng, 0, Math.PI * 2),
    flash: 0,
    shootTimer: randomRange(session.rng, 0.8, 2.2),
    blinkTimer: randomRange(session.rng, 1.4, 2.6),
    chargeTimer: 0,
    charging: false,
    knockX: 0, knockY: 0,
    burnTimer: 0, burnDps: 0,
    weavePhase: session.rng() * Math.PI * 2,
  };
  enemyIdCounter += 1;
  session.enemies.push(enemy);
  return enemy;
}

export function spawnEnemyAtEdge(session, type, elite) {
  const side = Math.floor(session.rng() * 4);
  const m = 30;
  let x = m;
  let y = m;
  if (side === 0) { x = randomRange(session.rng, m, 1250); y = 70; }
  if (side === 1) { x = randomRange(session.rng, m, 1250); y = 690; }
  if (side === 2) { x = m; y = randomRange(session.rng, 90, 690); }
  if (side === 3) { x = 1250; y = randomRange(session.rng, 90, 690); }
  return spawnEnemy(session, type, x, y, elite);
}

export function spawnRandomEnemy(session, elite) {
  const roster = ENEMY_TYPES_BY_REALM[session.realmIndex] || ENEMY_TYPES_BY_REALM[0];
  return spawnEnemyAtEdge(session, pickRandom(session.rng, roster), elite);
}

function steerToward(enemy, targetX, targetY, dt, speedMult) {
  const angle = Math.atan2(targetY - enemy.y, targetX - enemy.x);
  enemy.x += Math.cos(angle) * enemy.speed * (speedMult || 1) * dt;
  enemy.y += Math.sin(angle) * enemy.speed * (speedMult || 1) * dt;
  return angle;
}

export function updateEnemies(session, dt) {
  const p = session.player;
  for (const e of session.enemies) {
    e.t += dt;
    e.flash = Math.max(0, e.flash - dt * 4);
    if (e.burnTimer > 0) {
      e.burnTimer -= dt;
      e.hp -= e.burnDps * dt;
      if (session.rng() < dt * 8) spawnHitSparks(session, e.x, e.y, '#fb923c', 1);
    }
    e.x += e.knockX * dt;
    e.y += e.knockY * dt;
    e.knockX *= Math.pow(0.001, dt);
    e.knockY *= Math.pow(0.001, dt);

    if (e.type === 'sandmite' || e.type === 'dunecrawler') {
      steerToward(e, p.x, p.y, dt, 1);
    } else if (e.type === 'glasswasp') {
      e.weavePhase += dt * 4;
      const angle = Math.atan2(p.y - e.y, p.x - e.x) + Math.sin(e.weavePhase) * 0.7;
      e.x += Math.cos(angle) * e.speed * dt;
      e.y += Math.sin(angle) * e.speed * dt;
    } else if (e.type === 'shardspitter') {
      const dist = Math.hypot(p.x - e.x, p.y - e.y);
      if (dist > 340) steerToward(e, p.x, p.y, dt, 1);
      else if (dist < 220) steerToward(e, 2 * e.x - p.x, 2 * e.y - p.y, dt, 0.8);
      else {
        const angle = Math.atan2(p.y - e.y, p.x - e.x) + Math.PI / 2;
        e.x += Math.cos(angle) * e.speed * 0.5 * dt;
        e.y += Math.sin(angle) * e.speed * 0.5 * dt;
      }
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && dist < 520) {
        fireEnemyBolt(session, e.x, e.y, p.x, p.y, 240, e.damage, '#4ade80');
        e.shootTimer = randomRange(session.rng, 1.6, 2.4);
      }
    } else if (e.type === 'miragewraith') {
      e.blinkTimer -= dt;
      if (e.blinkTimer <= 0) {
        spawnHitSparks(session, e.x, e.y, '#c084fc', 8);
        const angle = session.rng() * Math.PI * 2;
        const dist = randomRange(session.rng, 90, 190);
        e.x = Math.max(30, Math.min(1250, p.x + Math.cos(angle) * dist));
        e.y = Math.max(70, Math.min(690, p.y + Math.sin(angle) * dist));
        spawnHitSparks(session, e.x, e.y, '#c084fc', 8);
        e.blinkTimer = randomRange(session.rng, 1.6, 2.8);
      } else {
        steerToward(e, p.x, p.y, dt, 0.7);
      }
    } else if (e.type === 'emberscarab') {
      e.chargeTimer -= dt;
      if (!e.charging && e.chargeTimer <= 0 && Math.hypot(p.x - e.x, p.y - e.y) < 300) {
        e.charging = true;
        e.chargeTimer = 0.55;
      }
      if (e.charging) {
        steerToward(e, p.x, p.y, dt, 2.3);
        if (e.chargeTimer <= 0) {
          e.charging = false;
          e.chargeTimer = randomRange(session.rng, 1.2, 2.0);
        }
      } else {
        steerToward(e, p.x, p.y, dt, 0.6);
      }
    } else if (e.type === 'crystalgolem') {
      steerToward(e, p.x, p.y, dt, 1);
    }
    e.x = Math.max(16, Math.min(1264, e.x));
    e.y = Math.max(56, Math.min(704, e.y));
  }
}

export function damageEnemy(session, enemy, amount, isCrit, knockAngle) {
  enemy.hp -= amount;
  enemy.flash = 1;
  if (knockAngle !== undefined) {
    const force = enemy.type === 'crystalgolem' || enemy.type === 'dunecrawler' ? 60 : 170;
    enemy.knockX += Math.cos(knockAngle) * force;
    enemy.knockY += Math.sin(knockAngle) * force;
  }
  if (session.player.burnChance > 0 && session.rng() < session.player.burnChance) {
    enemy.burnTimer = 2;
    enemy.burnDps = session.player.damage * 0.5;
  }
  session.stats.damageDealt += amount;
  if (enemy.hp <= 0) killEnemy(session, enemy, true);
}

export function killEnemy(session, enemy, byPlayer) {
  const index = session.enemies.indexOf(enemy);
  if (index === -1) return;
  session.enemies.splice(index, 1);
  if (enemy.type === 'emberscarab') {
    spawnExplosionBurst(session, enemy.x, enemy.y, '#f43f5e', 22);
    session.audio.playExplosion();
    const p = session.player;
    if (Math.hypot(p.x - enemy.x, p.y - enemy.y) < 110) {
      damagePlayer(session, 14, enemy.x, enemy.y);
    }
  } else if (enemy.type === 'crystalgolem') {
    spawnExplosionBurst(session, enemy.x, enemy.y, '#93c5fd', 18);
    for (let i = 0; i < 3; i += 1) {
      spawnEnemy(session, 'sandmite', enemy.x + randomRange(session.rng, -24, 24), enemy.y + randomRange(session.rng, -24, 24), false);
    }
  } else {
    spawnHitSparks(session, enemy.x, enemy.y, ENEMY_DEFS[enemy.type].color, enemy.elite ? 26 : 12);
  }
  if (byPlayer) {
    session.kills += 1;
    session.combo += 1;
    session.comboTimer = 2.4;
    session.maxCombo = Math.max(session.maxCombo, session.combo);
    // SOLAR FLARE synergy: kills explode, scorching nearby foes.
    const flare = (session.activeSynergies || []).some((s) => s.name === 'SOLAR FLARE');
    if (flare && !session.flareBursting) {
      session.flareBursting = true;
      spawnExplosionBurst(session, enemy.x, enemy.y, '#fb923c', 12);
      for (const other of session.enemies.slice()) {
        if (Math.hypot(other.x - enemy.x, other.y - enemy.y) < 110) {
          other.burnTimer = 2;
          other.burnDps = 12;
          damageEnemy(session, other, 22, false, undefined);
        }
      }
      session.flareBursting = false;
    }
    const mult = 1 + Math.min(2, session.combo * 0.05);
    session.score += Math.round(enemy.score * mult * difficultyById(session.difficulty).scoreMult);
    dropSunShards(session, enemy);
    if (enemy.elite) {
      session.pendingRelic = true;
      spawnRelicDrop(session, enemy.x, enemy.y);
    } else if (session.rng() < 0.045) {
      dropRandomPickup(session, enemy.x, enemy.y);
    }
    session.audio.playEnemyDie();
  }
}

export function dropSunShards(session, enemy) {
  const count = enemy.elite ? 6 : enemy.xp >= 8 ? 3 : enemy.xp >= 5 ? 2 : 1;
  for (let i = 0; i < count; i += 1) {
    const angle = session.rng() * Math.PI * 2;
    const dist = 8 + session.rng() * 26;
    session.shardDrops.push({
      x: enemy.x + Math.cos(angle) * dist,
      y: enemy.y + Math.sin(angle) * dist,
      vx: Math.cos(angle) * 40, vy: Math.sin(angle) * 40,
      value: Math.max(1, Math.round(enemy.xp / count)),
      life: 22, t: session.rng() * Math.PI * 2,
    });
  }
}

export function spawnRelicDrop(session, x, y) {
  session.pickups.push({ kind: 'relic', x, y, life: 30, t: 0 });
}

export function dropRandomPickup(session, x, y) {
  const roll = session.rng();
  const kind = roll < 0.45 ? 'health' : roll < 0.75 ? 'magnet' : 'bomb';
  session.pickups.push({ kind, x, y, life: 14, t: 0 });
}
