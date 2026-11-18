// Bosses: the Dune Tyrant (a segmented sandworm that burrows, charges and
// sheds mites) and the Glass Regent (a bullet-pattern sovereign with two
// phases). Both expose health bars, phase changes and telegraphed attacks.
import { BOSS_DEFS, difficultyById } from './config.js';
import { randomRange } from './rng.js';
import { fireEnemyBolt, fireRadialBurst } from './projectiles.js';
import { spawnEnemy } from './enemies.js';
import { spawnExplosionBurst, spawnHitSparks } from './particles.js';

export function spawnSandwormBoss(session) {
  const def = BOSS_DEFS.tyrant;
  const diff = difficultyById(session.difficulty);
  const hp = Math.round(def.hp * diff.enemyHp * (1 + session.endlessLevel * 0.5));
  const segments = [];
  for (let i = 0; i < 9; i += 1) segments.push({ x: 640 - i * 34, y: 200, r: 30 - i * 2 });
  session.boss = {
    kind: 'tyrant', name: def.name, title: def.title,
    x: 640, y: 200, hp, maxHp: hp,
    speed: def.speed, damage: Math.round(def.damage * diff.enemyDamage),
    radius: def.radius, score: def.score, color: def.color,
    phase: 1, t: 0, attackTimer: 2.5, burrowTimer: 0, burrowed: false,
    chargeTimer: 0, charging: false, chargeAngle: 0,
    segments, flash: 0, introTimer: 1.6, spawnTimer: 4, spiralAngle: 0,
  };
  session.audio.playBossRoar();
  session.shake = 14;
  return session.boss;
}

export function spawnGlassRegent(session) {
  const def = BOSS_DEFS.regent;
  const diff = difficultyById(session.difficulty);
  const hp = Math.round(def.hp * diff.enemyHp * (1 + session.endlessLevel * 0.5));
  session.boss = {
    kind: 'regent', name: def.name, title: def.title,
    x: 640, y: 220, hp, maxHp: hp,
    speed: def.speed, damage: Math.round(def.damage * diff.enemyDamage),
    radius: def.radius, score: def.score, color: def.color,
    phase: 1, t: 0, attackTimer: 2.0, patternTimer: 0, pattern: 'radial',
    segments: [], flash: 0, introTimer: 1.6, spawnTimer: 6, spiralAngle: 0,
    hoverPhase: 0, teleportTimer: 5,
  };
  session.audio.playBossRoar();
  session.shake = 14;
  return session.boss;
}

export function updateBoss(session, dt) {
  const boss = session.boss;
  if (!boss) return;
  const p = session.player;
  boss.t += dt;
  boss.flash = Math.max(0, boss.flash - dt * 4);
  if (boss.introTimer > 0) {
    boss.introTimer -= dt;
    return;
  }
  const hpFrac = boss.hp / boss.maxHp;
  if (boss.kind === 'tyrant') updateSandwormBoss(session, boss, dt, p, hpFrac);
  else updateGlassRegent(session, boss, dt, p, hpFrac);
}

function updateSandwormBoss(session, boss, dt, p, hpFrac) {
  if (hpFrac < 0.55 && boss.phase === 1) {
    boss.phase = 2;
    boss.attackTimer = 1;
    spawnExplosionBurst(session, boss.x, boss.y, '#d97706', 30);
    session.audio.playBossRoar();
  }
  boss.burrowTimer -= dt;
  boss.spawnTimer -= dt;
  if (boss.spawnTimer <= 0) {
    spawnEnemy(session, 'sandmite', boss.x + randomRange(session.rng, -60, 60), boss.y + randomRange(session.rng, -40, 40), false);
    spawnEnemy(session, 'sandmite', boss.x + randomRange(session.rng, -60, 60), boss.y + randomRange(session.rng, -40, 40), false);
    boss.spawnTimer = boss.phase === 2 ? 5 : 7;
  }

  if (boss.burrowed) {
    if (boss.burrowTimer <= 0) {
      boss.burrowed = false;
      const angle = session.rng() * Math.PI * 2;
      boss.x = Math.max(80, Math.min(1200, p.x + Math.cos(angle) * 260));
      boss.y = Math.max(120, Math.min(640, p.y + Math.sin(angle) * 220));
      spawnExplosionBurst(session, boss.x, boss.y, '#e0a458', 24);
      session.shake = Math.min(16, session.shake + 8);
      boss.charging = true;
      boss.chargeTimer = 0.8;
      boss.chargeAngle = Math.atan2(p.y - boss.y, p.x - boss.x);
    }
  } else if (boss.charging) {
    boss.chargeTimer -= dt;
    boss.x += Math.cos(boss.chargeAngle) * boss.speed * 3.4 * dt;
    boss.y += Math.sin(boss.chargeAngle) * boss.speed * 3.4 * dt;
    spawnHitSparks(session, boss.x, boss.y, '#e0a458', 1);
    if (boss.chargeTimer <= 0) {
      boss.charging = false;
      boss.burrowed = true;
      boss.burrowTimer = boss.phase === 2 ? 1.1 : 1.7;
      spawnHitSparks(session, boss.x, boss.y, '#c98a4b', 16);
    }
  } else {
    const angle = Math.atan2(p.y - boss.y, p.x - boss.x);
    const speed = boss.speed * (boss.phase === 2 ? 1.35 : 1);
    boss.x += Math.cos(angle) * speed * dt;
    boss.y += Math.sin(angle) * speed * dt;
    boss.attackTimer -= dt;
    if (boss.attackTimer <= 0) {
      boss.charging = true;
      boss.chargeTimer = 0.7;
      boss.chargeAngle = Math.atan2(p.y - boss.y, p.x - boss.x);
      boss.attackTimer = boss.phase === 2 ? 2.6 : 3.4;
    }
  }
  boss.x = Math.max(40, Math.min(1240, boss.x));
  boss.y = Math.max(80, Math.min(680, boss.y));
  // Worm segments trail the head along its path.
  let prevX = boss.x;
  let prevY = boss.y;
  for (const seg of boss.segments) {
    const dx = prevX - seg.x;
    const dy = prevY - seg.y;
    const dist = Math.hypot(dx, dy) || 1;
    const gap = 34;
    if (dist > gap) {
      seg.x = prevX - (dx / dist) * gap;
      seg.y = prevY - (dy / dist) * gap;
    }
    prevX = seg.x;
    prevY = seg.y;
  }
}

function updateGlassRegent(session, boss, dt, p, hpFrac) {
  if (hpFrac < 0.5 && boss.phase === 1) {
    boss.phase = 2;
    boss.pattern = 'spiral';
    spawnExplosionBurst(session, boss.x, boss.y, '#e879f9', 34);
    session.audio.playBossRoar();
  }
  boss.hoverPhase += dt;
  // Drift toward a hovering anchor above the player, never sitting on them.
  const anchorX = 640 + Math.sin(boss.hoverPhase * 0.5) * 320;
  const anchorY = 190 + Math.sin(boss.hoverPhase * 0.9) * 60;
  boss.x += (anchorX - boss.x) * Math.min(1, dt * 0.8);
  boss.y += (anchorY - boss.y) * Math.min(1, dt * 0.8);

  boss.teleportTimer -= dt;
  if (boss.teleportTimer <= 0) {
    spawnHitSparks(session, boss.x, boss.y, '#f0abfc', 20);
    boss.x = randomRange(session.rng, 200, 1080);
    boss.y = randomRange(session.rng, 130, 320);
    spawnHitSparks(session, boss.x, boss.y, '#f0abfc', 20);
    boss.teleportTimer = boss.phase === 2 ? 3.4 : 5;
  }

  boss.spawnTimer -= dt;
  if (boss.spawnTimer <= 0) {
    spawnEnemy(session, 'glasswasp', boss.x + 60, boss.y + 30, false);
    spawnEnemy(session, 'miragewraith', boss.x - 60, boss.y + 30, false);
    boss.spawnTimer = boss.phase === 2 ? 7 : 9;
  }

  boss.attackTimer -= dt;
  if (boss.attackTimer <= 0) {
    if (boss.pattern === 'radial') {
      fireRadialBurst(session, boss.x, boss.y, boss.phase === 2 ? 18 : 12, 170, boss.damage, '#e879f9', boss.spiralAngle);
      boss.spiralAngle += 0.35;
      boss.pattern = 'aimed';
      boss.attackTimer = boss.phase === 2 ? 1.5 : 2.0;
    } else if (boss.pattern === 'aimed') {
      for (let i = -1; i <= 1; i += 1) {
        const angle = Math.atan2(p.y - boss.y, p.x - boss.x) + i * 0.16;
        session.enemyBullets.push({
          x: boss.x, y: boss.y,
          vx: Math.cos(angle) * 300, vy: Math.sin(angle) * 300,
          damage: boss.damage, radius: 7, life: 4, color: '#f0abfc', pulse: 0,
        });
      }
      boss.pattern = boss.phase === 2 ? 'spiral' : 'radial';
      boss.attackTimer = boss.phase === 2 ? 1.2 : 1.8;
    } else {
      boss.patternTimer += 1;
      boss.spiralAngle += 0.55;
      for (let arm = 0; arm < 3; arm += 1) {
        const angle = boss.spiralAngle + (arm * Math.PI * 2) / 3;
        session.enemyBullets.push({
          x: boss.x, y: boss.y,
          vx: Math.cos(angle) * 150, vy: Math.sin(angle) * 150,
          damage: boss.damage, radius: 6, life: 5, color: '#c084fc', pulse: 0,
        });
      }
      boss.attackTimer = 0.22;
      if (boss.patternTimer > 14) {
        boss.patternTimer = 0;
        boss.pattern = 'radial';
        boss.attackTimer = 1.6;
      }
    }
  }
}

export function damageBoss(session, amount, isCrit) {
  const boss = session.boss;
  if (!boss) return;
  boss.hp -= amount;
  boss.flash = 1;
  session.stats.damageDealt += amount;
  if (boss.hp <= 0) defeatBoss(session, boss);
}

export function defeatBoss(session, boss) {
  session.boss = null;
  session.bossDefeated = boss.kind;
  session.score += Math.round(boss.score * difficultyById(session.difficulty).scoreMult);
  session.kills += 1;
  spawnExplosionBurst(session, boss.x, boss.y, boss.color, 46);
  spawnExplosionBurst(session, boss.x, boss.y, '#fff7cc', 26);
  session.shake = 18;
  session.audio.playExplosion();
  session.audio.playWaveClear();
  for (let i = 0; i < 10; i += 1) {
    const angle = session.rng() * Math.PI * 2;
    session.shardDrops.push({
      x: boss.x + Math.cos(angle) * 40, y: boss.y + Math.sin(angle) * 40,
      vx: Math.cos(angle) * 60, vy: Math.sin(angle) * 60,
      value: 6, life: 26, t: session.rng() * Math.PI * 2,
    });
  }
  session.pickups.push({ kind: 'health', x: boss.x - 50, y: boss.y, life: 30, t: 0 });
  session.pickups.push({ kind: 'relic', x: boss.x + 50, y: boss.y, life: 30, t: 0 });
  if (boss.kind === 'regent') {
    session.finalBossDefeated = true;
  }
}
