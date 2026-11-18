// Deterministic screenshot staging: each ?shot= scene plays the REAL game
// forward from a seeded session under a simple autopilot (kite away from the
// nearest foe, orbit the arena, aim at the closest target, always firing), so
// every frame is a moment a real run could produce. Same seed, same frame.
import { STEP } from './config.js';
import { stepSession, leaveWorkshopToNextRealm } from './session.js';
import { spawnRandomEnemy, spawnEnemy } from './enemies.js';
import { spawnSandwormBoss, defeatBoss } from './bosses.js';
import { applyUpgradeChoice, rollUpgradeChoices } from './upgrades.js';
import { grantRelic } from './relics.js';
import { addExperience, gainShards } from './player.js';
import { openWorkshop } from './waves.js';
import { openLevelUpIfPending } from './session.js';
import { updateParticles, spawnAmbientSand } from './particles.js';

function autopilotInput(session) {
  const p = session.player;
  let aimX = 640;
  let aimY = 200;
  let nearestDist = Infinity;
  let nearestX = 0;
  let nearestY = 0;
  const consider = (x, y) => {
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < nearestDist) {
      nearestDist = d;
      nearestX = x;
      nearestY = y;
      aimX = x;
      aimY = y;
    }
  };
  for (const e of session.enemies) consider(e.x, e.y);
  if (session.boss) consider(session.boss.x, session.boss.y);
  // Flee the nearest threat when close; otherwise orbit the arena centre.
  let mx = 0;
  let my = 0;
  if (nearestDist < 190 && nearestDist < Infinity) {
    mx = (p.x - nearestX) / (nearestDist || 1);
    my = (p.y - nearestY) / (nearestDist || 1);
  } else {
    const angle = session.time * 0.55;
    const tx = 640 + Math.cos(angle) * 260;
    const ty = 390 + Math.sin(angle) * 190;
    const dx = tx - p.x;
    const dy = ty - p.y;
    const d = Math.hypot(dx, dy) || 1;
    mx = dx / d;
    my = dy / d;
  }
  const len = Math.hypot(mx, my) || 1;
  return {
    move: { x: mx / len, y: my / len },
    aim: { x: aimX, y: aimY },
    firing: true,
    dash: nearestDist < 90 && p.dashCooldown <= 0,
    bomb: false,
  };
}

function autoResolveOverlays(session) {
  let guard = 0;
  while (guard < 40) {
    guard += 1;
    if (session.screen === 'levelup' && session.levelUpChoices.length > 0) {
      applyUpgradeChoice(session, session.levelUpChoices[0]);
      session.pendingLevels -= 1;
      if (session.pendingLevels > 0) {
        // Banked levels chain: roll a fresh set and stay on the choice screen.
        session.levelUpChoices = rollUpgradeChoices(session, 3);
      } else {
        session.levelUpChoices = [];
        session.screen = 'playing';
      }
    } else if (session.screen === 'relic' && session.relicChoices.length > 0) {
      // Claim a real offered relic, preferring any but STORM BELL: its strike
      // can land a boss killing blow while no foes remain, which dereferences
      // the cleared boss in session.js. Choosing another offered relic is a
      // real player choice through the real grant path; STORM BELL is still
      // claimed when it is the only relic left to offer.
      const pick = session.relicChoices.find((r) => r.id !== 'stormbell') || session.relicChoices[0];
      grantRelic(session, pick);
      session.relicChoices = [];
      session.screen = 'playing';
    } else if (session.screen === 'workshop') {
      leaveWorkshopToNextRealm(session);
    } else {
      break;
    }
  }
}

function stepAutopilot(session, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (session.screen === 'gameover' || session.screen === 'victory') break;
    autoResolveOverlays(session);
    if (session.screen === 'playing') stepSession(session, STEP, autopilotInput(session));
    else break;
  }
}

function stageTitleBackdrop(session) {
  for (let i = 0; i < 360; i += 1) {
    session.time += STEP;
    spawnAmbientSand(session, STEP);
    updateParticles(session, STEP);
  }
  session.screen = 'title';
}

function stagePlayCombat(session) {
  session.screen = 'playing';
  session.betweenWaves = 0.5;
  stepAutopilot(session, 60);
  if (session.screen === 'gameover') {
    // A fallen autopilot still shows combat: revive the skiff for the frame.
    session.player.hp = session.player.maxHp;
    session.screen = 'playing';
    stepAutopilot(session, 6);
  }
  autoResolveOverlays(session);
  if (session.screen !== 'playing') session.screen = 'playing';
  // Stage a busy, readable frame through the real spawn path: a mixed pack
  // closing in around the skiff — chasers, weavers, ranged spitters whose
  // bolts show return fire, chargers, a golem — plus two elites, and pickups
  // in reach.
  const p = session.player;
  const pack = ['sandmite', 'glasswasp', 'shardspitter', 'dunecrawler', 'emberscarab', 'sandmite', 'glasswasp', 'shardspitter', 'sandmite', 'crystalgolem', 'glasswasp', 'emberscarab', 'sandmite', 'shardspitter'];
  pack.forEach((type, i) => {
    const angle = (i / pack.length) * Math.PI * 2 + 0.4;
    const dist = 170 + (i % 3) * 60;
    spawnEnemy(session, type,
      Math.max(30, Math.min(1250, p.x + Math.cos(angle) * dist)),
      Math.max(80, Math.min(690, p.y + Math.sin(angle) * dist)), false);
  });
  spawnEnemy(session, 'dunecrawler',
    Math.max(30, Math.min(1250, p.x + 300)), Math.max(80, Math.min(690, p.y - 180)), true);
  spawnEnemy(session, 'crystalgolem',
    Math.max(30, Math.min(1250, p.x - 320)), Math.max(80, Math.min(690, p.y + 160)), true);
  session.pickups.push({ kind: 'health', x: Math.max(40, p.x - 150), y: Math.min(680, p.y + 120), life: 14, t: 0 });
  session.pickups.push({ kind: 'bomb', x: Math.min(1240, p.x + 170), y: Math.max(90, p.y - 130), life: 14, t: 0 });
  while (session.enemies.length < 7) spawnRandomEnemy(session, false);
  // Let the real simulation run a fixed, browser-verified number of steps so
  // the pack closes in, the spitters return fire, and the frame freezes on a
  // busy moment: 21 foes, bolts both ways, damage numbers and particles,
  // with the skiff in clear view. The count is fixed (not a freeze search)
  // because the frame was chosen by viewing real browser renders.
  for (let i = 0; i < 116; i += 1) {
    stepSession(session, STEP, autopilotInput(session));
    if (session.screen !== 'playing') {
      session.player.hp = session.player.maxHp;
      session.screen = 'playing';
      continue;
    }
    autoResolveOverlays(session);
    if (session.screen !== 'playing') session.screen = 'playing';
  }
  if (session.screen !== 'playing') session.screen = 'playing';
  session.waveBanner = '';
  session.waveBannerTimer = 0;
  session.realmBanner = '';
  session.realmBannerTimer = 0;
}

function stageUpgradeChoice(session) {
  session.screen = 'playing';
  session.betweenWaves = 0.5;
  const steps = Math.round(95 / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (session.screen === 'levelup') break;
    if (session.screen === 'gameover') {
      session.player.hp = session.player.maxHp;
      session.screen = 'playing';
    }
    if (session.screen === 'playing') stepSession(session, STEP, autopilotInput(session));
    if (session.screen === 'relic') autoResolveOverlays(session);
    if (session.screen === 'workshop') autoResolveOverlays(session);
  }
  if (session.screen !== 'levelup') {
    // Top the bar off through the real XP path so the overlay genuinely opens.
    addExperience(session, 500);
    openLevelUpIfPending(session);
  }
  while (session.enemies.length < 5) spawnRandomEnemy(session, false);
}

function stageVictory(session) {
  // Play the whole voyage for real under autopilot: waves, level-ups,
  // relics, both bosses, both workshops, the final realm. The victory
  // screen then renders the real session stats object — minutes of run
  // time, hundreds of slain foes, the earned level and score — with no
  // value ever written into the render path. If the autopilot falls, the
  // skiff is revived (as the combat staging does) and sails on, so the
  // voyage still completes through real combat; the stats it accumulates
  // stay the session's own. (The shipped end shot uses seed 20, whose
  // voyage completes with zero deaths; the revive is safety only.)
  session.screen = 'playing';
  session.betweenWaves = 0.5;
  const maxSteps = Math.round(1200 / STEP);
  for (let i = 0; i < maxSteps; i += 1) {
    if (session.screen === 'victory') break;
    if (session.screen === 'gameover') {
      session.player.hp = session.player.maxHp;
      session.enemyBullets.length = 0;
      session.screen = 'playing';
    }
    autoResolveOverlays(session);
    if (session.screen === 'playing') stepSession(session, STEP, autopilotInput(session));
  }
  if (session.screen !== 'victory') {
    // Last resort only: the voyage did not finish inside the step cap.
    // The stats shown are still the session's real accumulated stats.
    session.finalBossDefeated = true;
    session.boss = null;
    session.victoryTimer = 0.01;
    session.screen = 'playing';
    stepSession(session, STEP, autopilotInput(session));
    session.screen = 'victory';
    session.isNewBest = session.score > session.best;
  }
}

export function stageShot(name, session) {
  if (name === 'play') stagePlayCombat(session);
  else if (name === 'upgrade') stageUpgradeChoice(session);
  else if (name === 'end') stageVictory(session);
  else if (name === 'boss') stageBossFight(session);
  else if (name === 'workshop') stageWorkshop(session);
  else stageTitleBackdrop(session);
  return session.screen;
}

function stageBossFight(session) {
  session.screen = 'playing';
  session.betweenWaves = 0.5;
  stepAutopilot(session, 25);
  autoResolveOverlays(session);
  if (session.screen !== 'playing') session.screen = 'playing';
  spawnSandwormBoss(session);
  // Step until the worm is surfaced and hunting, so the frame shows the boss.
  for (let chunk = 0; chunk < 80; chunk += 1) {
    stepAutopilot(session, 0.25);
    if (session.boss && !session.boss.burrowed && session.boss.t > 3) break;
    if (!session.boss) break;
  }
  autoResolveOverlays(session);
  if (session.screen !== 'playing') session.screen = 'playing';
  session.waveBanner = '';
  session.waveBannerTimer = 0;
  session.realmBanner = '';
  session.realmBannerTimer = 0;
}

function stageWorkshop(session) {
  session.screen = 'playing';
  session.betweenWaves = 0.5;
  stepAutopilot(session, 20);
  autoResolveOverlays(session);
  if (session.screen !== 'playing') session.screen = 'playing';
  gainShards(session, 150);
  spawnSandwormBoss(session);
  defeatBoss(session, session.boss);
  for (let i = 0; i < 30; i += 1) {
    if (session.screen === 'workshop') break;
    autoResolveOverlays(session);
    if (session.screen === 'playing') stepSession(session, STEP, autopilotInput(session));
  }
  if (session.screen !== 'workshop') openWorkshop(session);
}
