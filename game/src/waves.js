// Wave director: timed waves with escalating spawn budgets, elite waves,
// boss gates at the end of realms 1 and 3, and the workshop between realms.
import { difficultyById } from './config.js';
import { realmDef } from './realms.js';
import { spawnRandomEnemy } from './enemies.js';
import { spawnGlassRegent, spawnSandwormBoss } from './bosses.js';

export const WAVE_DURATION = 26;

export function startNextWave(session) {
  session.wave += 1;
  session.waveTime = 0;
  session.waveActive = true;
  session.spawnTimer = 0.5;
  session.spawnBudget = waveSpawnBudget(session);
  session.waveBanner = `WAVE ${session.wave}`;
  session.waveBannerTimer = 2.2;
  session.audio.playWaveClear();
}

export function waveSpawnBudget(session) {
  const base = 6 + session.wave * 3 + session.realmIndex * 5 + session.endlessLevel * 4;
  return Math.round(base * difficultyById(session.difficulty).spawnRate);
}

export function updateWaveDirector(session, dt) {
  if (session.boss) return;
  if (session.bossDefeated === 'tyrant' && session.realmIndex === 0) return;
  if (session.bossDefeated === 'regent') return;
  if (!session.waveActive) {
    session.betweenWaves -= dt;
    if (session.betweenWaves <= 0) {
      const realm = realmDef(session.realmIndex);
      if (session.endless) {
        startNextWave(session);
      } else if (session.wave >= realm.waves) {
        if (realm.bossKind) {
          startRealmBoss(session);
        } else if (!session.surgeStarted) {
          startRealmBoss(session);
        } else {
          // Elite surge done: wait for the mop-up, the realm check opens the workshop.
          session.betweenWaves = 1;
        }
      } else {
        startNextWave(session);
      }
    }
    return;
  }
  session.waveTime += dt;
  session.spawnTimer -= dt;
  const cap = 10 + session.wave + session.realmIndex * 3;
  if (session.spawnTimer <= 0 && session.spawnBudget > 0 && session.enemies.length < cap) {
    const batch = Math.min(session.spawnBudget, 1 + Math.floor(session.wave / 2));
    for (let i = 0; i < batch; i += 1) {
      const elite = session.wave % 3 === 0 && i === 0 && session.rng() < 0.7;
      spawnRandomEnemy(session, elite);
    }
    session.spawnBudget -= batch;
    session.spawnTimer = Math.max(0.35, 1.4 - session.wave * 0.08 - session.realmIndex * 0.15);
  }
  if (session.waveTime >= WAVE_DURATION && session.spawnBudget <= 0) {
    session.waveActive = false;
    session.betweenWaves = 2.2;
    session.score += 50 * session.wave;
    if (session.enemies.length === 0) {
      // Clean clear bonus.
      session.score += 100;
    }
  }
}

export function startRealmBoss(session) {
  const realm = realmDef(session.realmIndex);
  session.waveActive = false;
  session.waveBanner = realm.bossKind === 'tyrant' ? 'THE DUNE TYRANT AWAKENS' : 'THE GLASS REGENT AWAKENS';
  session.waveBannerTimer = 3;
  if (realm.bossKind === 'tyrant') spawnSandwormBoss(session);
  else if (realm.bossKind === 'regent') spawnGlassRegent(session);
  else {
    // Realm 2 ends in an elite surge instead of a boss.
    session.surgeStarted = true;
    for (let i = 0; i < 3; i += 1) spawnRandomEnemy(session, true);
    session.waveActive = true;
    session.waveTime = WAVE_DURATION - 12;
    session.spawnBudget = 6;
  }
}

export function checkRealmCleared(session) {
  if (session.boss) return false;
  if (session.realmIndex === 0 && session.bossDefeated === 'tyrant') return true;
  if (session.realmIndex === 1 && session.surgeStarted && !session.waveActive && session.wave >= realmDef(1).waves && session.enemies.length === 0) return true;
  return false;
}

export function openWorkshop(session) {
  session.screen = 'workshop';
  session.workshopOffers = rollWorkshopOffers(session);
  session.bossDefeated = null;
  session.audio.playWaveClear();
}

export function rollWorkshopOffers(session) {
  const offers = [
    { id: 'repair', name: 'FULL REPAIRS', icon: '+', desc: 'Restore all HP', cost: 30, apply(s) { s.player.hp = s.player.maxHp; } },
    { id: 'whetstone', name: 'SUN WHETSTONE', icon: '☀', desc: '+20% lance damage', cost: 60, apply(s) { s.player.damage *= 1.2; } },
    { id: 'hullplate', name: 'HULL PLATING', icon: '⬢', desc: '+30 max HP', cost: 50, apply(s) { s.player.maxHp += 30; s.player.hp += 30; } },
    { id: 'swift', name: 'TAILWIND RIG', icon: '≋', desc: '+12% fire rate', cost: 55, apply(s) { s.player.fireRate *= 1.12; } },
    { id: 'magnetcoil', name: 'MAGNET COIL', icon: '◉', desc: '+40% shard pull range', cost: 40, apply(s) { s.player.magnetRadius *= 1.4; } },
    { id: 'bombkit', name: 'BOMB KIT', icon: '✹', desc: 'Carry +1 sun-bomb (press B)', cost: 45, apply(s) { s.player.bombCount += 1; } },
  ];
  return offers;
}

export function buyWorkshopOffer(session, offer) {
  if (session.shards < offer.cost || session.workshopBought.includes(offer.id)) return false;
  session.shards -= offer.cost;
  session.workshopBought.push(offer.id);
  offer.apply(session);
  session.audio.playPickup();
  return true;
}
