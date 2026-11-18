// Session: one voyage. Holds all mutable state and advances the simulation
// one fixed step: player, enemies, bosses, projectiles, hazards, waves,
// collisions, pickups, combos, level-ups, relic offers and realm transitions.
import { STEP, difficultyById } from './config.js';
import { createSeededRng } from './rng.js';
import { createPlayer, updatePlayer, damagePlayer, healPlayer, addExperience, gainShards } from './player.js';
import { updateEnemies, damageEnemy, killEnemy } from './enemies.js';
import { updateBoss, damageBoss } from './bosses.js';
import { updateProjectiles } from './projectiles.js';
import { updateParticles, spawnAmbientSand, spawnDamageNumber, spawnExplosionBurst, spawnHitSparks, spawnPickupText } from './particles.js';
import { rollUpgradeChoices } from './upgrades.js';
import { rollRelicChoices, hasRelic } from './relics.js';
import { updateRealmHazards, advanceRealm } from './realms.js';
import { updateWaveDirector, checkRealmCleared, openWorkshop } from './waves.js';

export function createSession(seed, difficultyId, audio, best) {
  return {
    rng: createSeededRng(seed),
    seed,
    difficulty: difficultyId,
    audio,
    screen: 'title',
    time: 0,
    player: createPlayer(difficultyId),
    enemies: [],
    bullets: [],
    enemyBullets: [],
    shardDrops: [],
    pickups: [],
    particles: [],
    floaters: [],
    hazards: [],
    boss: null,
    realmIndex: 0,
    wave: 0,
    waveTime: 0,
    waveActive: false,
    betweenWaves: 3.0,
    spawnTimer: 0,
    spawnBudget: 0,
    surgeStarted: false,
    shards: 0,
    score: 0,
    kills: 0,
    combo: 0,
    comboTimer: 0,
    maxCombo: 0,
    pendingLevels: 0,
    levelUpChoices: [],
    pendingRelic: false,
    relicChoices: [],
    shake: 0,
    sandTimer: 0,
    hazardTimer: 5,
    stormGust: 0,
    stormDir: 1,
    pendingHazardHit: null,
    bossDefeated: null,
    finalBossDefeated: false,
    victoryTimer: -1,
    endless: false,
    endlessLevel: 0,
    stats: { shotsFired: 0, damageDealt: 0, upgradesTaken: 0, relicsTaken: 0, bombsUsed: 0, dashesUsed: 0 },
    workshopOffers: [],
    workshopBought: [],
    realmBanner: 'DUNE SEA',
    realmBannerTimer: 3,
    waveBanner: '',
    waveBannerTimer: 0,
    synergyFlash: '',
    synergyTimer: 0,
    activeSynergies: [],
    announcedSynergies: [],
    stormBellTimer: 8,
    shieldTimer: 25,
    flareBursting: false,
    best: best || 0,
    isNewBest: false,
    runTime: 0,
  };
}

export function resetSessionForRun(session, difficultyId) {
  const fresh = createSession(session.seed, difficultyId, session.audio, session.best);
  fresh.screen = 'playing';
  return fresh;
}

export function detonateSunBomb(session) {
  const p = session.player;
  if (p.bombCount <= 0) return false;
  p.bombCount -= 1;
  session.stats.bombsUsed += 1;
  session.enemyBullets.length = 0;
  spawnExplosionBurst(session, p.x, p.y, '#ffd23f', 40);
  session.shake = 18;
  session.audio.playBomb();
  const victims = session.enemies.slice();
  for (const e of victims) damageEnemy(session, e, 400, false, undefined);
  if (session.boss) damageBoss(session, 260, false);
  return true;
}

function collectShardDrops(session, dt) {
  const p = session.player;
  const magnet = p.magnetRadius * (session.activeSynergies.some((s) => s.name === 'ENDLESS HARVEST') ? 2 : 1);
  for (let i = session.shardDrops.length - 1; i >= 0; i -= 1) {
    const s = session.shardDrops[i];
    s.life -= dt;
    s.t += dt * 4;
    if (s.life <= 0) {
      session.shardDrops.splice(i, 1);
      continue;
    }
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    const dist = Math.hypot(dx, dy);
    if (dist < magnet) {
      const pull = 520 * (1 - dist / (magnet + 1)) + 180;
      s.x += (dx / (dist || 1)) * pull * dt;
      s.y += (dy / (dist || 1)) * pull * dt;
    } else {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 0.9;
      s.vy *= 0.9;
    }
    if (dist < p.radius + 10) {
      session.shardDrops.splice(i, 1);
      const xpValue = hasRelic(p, 'lode') ? s.value * 2 : s.value;
      addExperience(session, xpValue);
      gainShards(session, 1);
      session.audio.playShard();
    }
  }
}

function collectPickups(session) {
  const p = session.player;
  for (let i = session.pickups.length - 1; i >= 0; i -= 1) {
    const pk = session.pickups[i];
    pk.t += 1 / 60;
    pk.life -= 1 / 60;
    if (pk.life <= 0) {
      session.pickups.splice(i, 1);
      continue;
    }
    if (Math.hypot(p.x - pk.x, p.y - pk.y) < p.radius + 18) {
      session.pickups.splice(i, 1);
      if (pk.kind === 'health') {
        healPlayer(session, 32);
        spawnPickupText(session, p.x, p.y, '+32 HP', '#4ade80');
        session.audio.playPickup();
      } else if (pk.kind === 'magnet') {
        for (const s of session.shardDrops) {
          s.x = p.x;
          s.y = p.y;
        }
        spawnPickupText(session, p.x, p.y, 'SHARD MAGNET!', '#67e8f9');
        session.audio.playPickup();
      } else if (pk.kind === 'bomb') {
        p.bombCount += 1;
        spawnPickupText(session, p.x, p.y, '+1 SUN-BOMB (B)', '#ffd23f');
        session.audio.playPickup();
      } else if (pk.kind === 'relic') {
        session.relicChoices = rollRelicChoices(session, 3);
        if (session.relicChoices.length > 0) {
          session.screen = 'relic';
          session.pendingRelic = false;
        } else {
          gainShards(session, 40);
          spawnPickupText(session, p.x, p.y, '+40 SHARDS', '#ffd23f');
        }
      }
    }
  }
}

function collideBullets(session) {
  const p = session.player;
  for (let bi = session.bullets.length - 1; bi >= 0; bi -= 1) {
    const b = session.bullets[bi];
    let consumed = false;
    for (const e of session.enemies.slice()) {
      if (b.hitIds.includes(e.id)) continue;
      if (Math.hypot(b.x - e.x, b.y - e.y) < b.radius + e.radius) {
        b.hitIds.push(e.id);
        const crit = b.crit;
        const amount = Math.round(b.damage * (crit ? p.critMult : 1));
        spawnDamageNumber(session, e.x, e.y - e.radius, amount, crit ? 'crit' : 'hit');
        spawnHitSparks(session, b.x, b.y, '#ffd23f', crit ? 8 : 4);
        session.audio.playHit();
        damageEnemy(session, e, amount, crit, Math.atan2(b.vy, b.vx));
        if (p.lifesteal > 0 && session.kills % 12 === 0) healPlayer(session, 3 * p.lifesteal);
        if (b.pierce > 0) {
          b.pierce -= 1;
        } else {
          consumed = true;
          break;
        }
      }
    }
    if (!consumed && session.boss && !session.boss.burrowed) {
      const boss = session.boss;
      let hitBoss = Math.hypot(b.x - boss.x, b.y - boss.y) < b.radius + boss.radius;
      if (!hitBoss && boss.segments) {
        for (const seg of boss.segments) {
          if (Math.hypot(b.x - seg.x, b.y - seg.y) < b.radius + seg.r) {
            hitBoss = true;
            break;
          }
        }
      }
      if (hitBoss && !b.hitIds.includes(-1)) {
        b.hitIds.push(-1);
        const crit = b.crit;
        const amount = Math.round(b.damage * (crit ? p.critMult : 1));
        spawnDamageNumber(session, boss.x, boss.y - boss.radius, amount, crit ? 'crit' : 'hit');
        spawnHitSparks(session, b.x, b.y, '#ffd23f', crit ? 8 : 4);
        session.audio.playHit();
        damageBoss(session, amount, crit);
        consumed = true;
      }
    }
    if (consumed) session.bullets.splice(bi, 1);
  }
}

function collidePlayer(session) {
  const p = session.player;
  for (const e of session.enemies.slice()) {
    if (Math.hypot(p.x - e.x, p.y - e.y) < p.radius + e.radius - 4) {
      const took = damagePlayer(session, e.damage, e.x, e.y);
      if (took && p.thorns > 0) {
        const bramble = session.activeSynergies.some((s) => s.name === 'BRAMBLE OASIS');
        damageEnemy(session, e, p.thorns * (bramble ? 2 : 1), false, Math.atan2(e.y - p.y, e.x - p.x));
        if (bramble) healPlayer(session, 2);
      }
      if (e.type === 'emberscarab' && took) killEnemy(session, e, false);
      if (session.screen !== 'playing') return;
    }
  }
  if (session.boss && !session.boss.burrowed && session.boss.introTimer <= 0) {
    const boss = session.boss;
    if (Math.hypot(p.x - boss.x, p.y - boss.y) < p.radius + boss.radius - 6) {
      damagePlayer(session, boss.damage, boss.x, boss.y);
      if (session.screen !== 'playing') return;
    }
  }
  for (let i = session.enemyBullets.length - 1; i >= 0; i -= 1) {
    const b = session.enemyBullets[i];
    if (Math.hypot(p.x - b.x, p.y - b.y) < p.radius + b.radius - 3) {
      session.enemyBullets.splice(i, 1);
      damagePlayer(session, b.damage, b.x - b.vx, b.y - b.vy);
      if (session.screen !== 'playing') return;
    }
  }
  if (session.pendingHazardHit) {
    const hit = session.pendingHazardHit;
    session.pendingHazardHit = null;
    damagePlayer(session, hit.damage, hit.x, hit.y);
  }
}

function updateRelicPassives(session, dt) {
  const p = session.player;
  if (p.stormBell) {
    session.stormBellTimer -= dt;
    if (session.stormBellTimer <= 0) {
      session.stormBellTimer = 8;
      let nearest = null;
      let nearestDist = Infinity;
      for (const e of session.enemies) {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = e;
        }
      }
      if (nearest) {
        spawnHitSparks(session, nearest.x, nearest.y, '#fde047', 14);
        spawnDamageNumber(session, nearest.x, nearest.y - 16, 45, 'hit');
        damageEnemy(session, nearest, 45, false, undefined);
        session.audio.playHit();
      } else if (session.boss) {
        const boss = session.boss;
        damageBoss(session, 45, false);
        spawnHitSparks(session, boss.x, boss.y, '#fde047', 14);
      }
    }
  }
  if (hasRelic(p, 'mirageveil') && p.shieldCharges < 2) {
    session.shieldTimer -= dt;
    if (session.shieldTimer <= 0) {
      session.shieldTimer = 25;
      p.shieldCharges += 1;
      spawnPickupText(session, p.x, p.y, 'SHIELD RESTORED', '#67e8f9');
    }
  }
}

export function openLevelUpIfPending(session) {
  if (session.pendingLevels > 0 && session.screen === 'playing') {
    session.levelUpChoices = rollUpgradeChoices(session, 3);
    session.screen = 'levelup';
    session.audio.playLevelUp();
    return true;
  }
  return false;
}

export function stepSession(session, dt, inputState) {
  session.time += dt;
  session.runTime += dt;
  spawnAmbientSand(session, dt);
  session.comboTimer -= dt;
  if (session.comboTimer <= 0) session.combo = 0;
  session.realmBannerTimer = Math.max(0, session.realmBannerTimer - dt);
  session.waveBannerTimer = Math.max(0, session.waveBannerTimer - dt);
  session.synergyTimer = Math.max(0, session.synergyTimer - dt);

  updatePlayer(session, dt, inputState.move, inputState.aim, inputState.firing, inputState.dash);
  if (inputState.bomb) detonateSunBomb(session);
  updateEnemies(session, dt);
  updateBoss(session, dt);
  updateProjectiles(session, dt);
  updateRealmHazards(session, dt);
  updateRelicPassives(session, dt);
  collideBullets(session);
  if (session.screen !== 'playing') {
    updateParticles(session, dt);
    return;
  }
  collidePlayer(session);
  if (session.screen !== 'playing') {
    updateParticles(session, dt);
    return;
  }
  collectShardDrops(session, dt);
  collectPickups(session);
  updateParticles(session, dt);

  if (session.finalBossDefeated && session.victoryTimer < 0) {
    session.victoryTimer = 1.4;
  }
  if (session.victoryTimer > 0) {
    session.victoryTimer -= dt;
    if (session.victoryTimer <= 0) {
      session.screen = 'victory';
      session.isNewBest = session.score > session.best;
      session.audio.playVictory();
      session.audio.stopMusic();
    }
    return;
  }
  if (openLevelUpIfPending(session)) return;
  if (session.screen === 'relic') return;
  if (checkRealmCleared(session)) {
    openWorkshop(session);
    return;
  }
  updateWaveDirector(session, dt);
}

export function leaveWorkshopToNextRealm(session) {
  session.workshopBought = [];
  session.workshopOffers = [];
  advanceRealm(session);
  session.screen = 'playing';
  session.audio.startMusic(Math.min(session.realmIndex, 2));
}

export function startEndlessVoyage(session) {
  session.endless = true;
  session.endlessLevel += 1;
  session.finalBossDefeated = false;
  session.bossDefeated = null;
  session.victoryTimer = -1;
  session.realmIndex = 0;
  session.wave = 0;
  session.waveTime = 0;
  session.waveActive = false;
  session.betweenWaves = 2.5;
  session.enemies.length = 0;
  session.enemyBullets.length = 0;
  session.player.hp = session.player.maxHp;
  session.realmBanner = `ENDLESS — TIDE ${session.endlessLevel}`;
  session.realmBannerTimer = 3;
  session.screen = 'playing';
  session.audio.startMusic(0);
}

export { STEP };
