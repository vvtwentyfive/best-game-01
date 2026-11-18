// Realms: the three legs of the voyage, each with its own palette, hazard,
// enemy mix and boss. Advancing realms re-tunes the wave director.
import { REALM_PALETTES } from './config.js';

export const REALMS = [
  {
    id: 'dunesea', name: 'DUNE SEA', subtitle: 'Rolling sands and buried teeth',
    waves: 5, bossKind: 'tyrant',
    hazard: 'sandstorm', hazardDesc: 'Sandstorm gusts push the skiff sideways.',
    intro: 'Cross the Dune Sea. Survive 5 waves, then face what sleeps below.',
  },
  {
    id: 'glassflats', name: 'GLASS FLATS', subtitle: 'A mirror desert that cuts',
    waves: 5, bossKind: null,
    hazard: 'shardfields', hazardDesc: 'Glass shard fields erupt underfoot — keep moving.',
    intro: 'The Glass Flats glitter. Shard fields erupt where you linger.',
  },
  {
    id: 'sunkencourt', name: 'SUNKEN COURT', subtitle: 'The drowned throne of glass',
    waves: 5, bossKind: 'regent',
    hazard: 'sunbeams', hazardDesc: 'Pillars of light scorch the arena in warning circles.',
    intro: 'The Sunken Court waits. Endure, then dethrone the Glass Regent.',
  },
];

export function realmPalette(realmIndex) {
  return REALM_PALETTES[Math.min(realmIndex, REALM_PALETTES.length - 1)];
}

export function realmDef(realmIndex) {
  return REALMS[Math.min(realmIndex, REALMS.length - 1)];
}

export function advanceRealm(session) {
  session.realmIndex += 1;
  session.wave = 0;
  session.waveTime = 0;
  session.waveActive = false;
  session.surgeStarted = false;
  session.betweenWaves = 2.5;
  session.enemies.length = 0;
  session.enemyBullets.length = 0;
  session.hazards.length = 0;
  session.audio.setRealm(Math.min(session.realmIndex, 2));
  session.realmBanner = realmDef(session.realmIndex).name;
  session.realmBannerTimer = 3;
}

export function updateRealmHazards(session, dt) {
  const realm = realmDef(session.realmIndex);
  const p = session.player;
  session.hazardTimer = (session.hazardTimer || 0) - dt;
  if (realm.hazard === 'sandstorm') {
    if (session.hazardTimer <= 0) {
      session.stormGust = 1.6;
      session.stormDir = session.rng() < 0.5 ? -1 : 1;
      session.hazardTimer = 7 + session.rng() * 5;
    }
    if (session.stormGust > 0) {
      session.stormGust -= dt;
      p.x = Math.max(28, Math.min(1252, p.x + session.stormDir * 70 * dt));
    }
  } else if (realm.hazard === 'shardfields') {
    if (session.hazardTimer <= 0) {
      const count = 3;
      for (let i = 0; i < count; i += 1) {
        session.hazards.push({
          kind: 'shardfield',
          x: 80 + session.rng() * 1120,
          y: 110 + session.rng() * 560,
          radius: 52, warnTimer: 1.1, activeTimer: 0.9, t: 0,
        });
      }
      session.hazardTimer = 5 + session.rng() * 3;
    }
  } else if (realm.hazard === 'sunbeams') {
    if (session.hazardTimer <= 0) {
      for (let i = 0; i < 2; i += 1) {
        session.hazards.push({
          kind: 'sunbeam',
          x: 80 + session.rng() * 1120,
          y: 110 + session.rng() * 560,
          radius: 64, warnTimer: 1.3, activeTimer: 0.8, t: 0,
        });
      }
      session.hazardTimer = 4.5 + session.rng() * 3;
    }
  }
  for (let i = session.hazards.length - 1; i >= 0; i -= 1) {
    const h = session.hazards[i];
    h.t += dt;
    if (h.warnTimer > 0) {
      h.warnTimer -= dt;
    } else {
      h.activeTimer -= dt;
      const dist = Math.hypot(p.x - h.x, p.y - h.y);
      if (dist < h.radius && p.invulnTimer <= 0) {
        session.pendingHazardHit = { damage: 14, x: h.x, y: h.y };
      }
      if (h.activeTimer <= 0) session.hazards.splice(i, 1);
    }
  }
}
