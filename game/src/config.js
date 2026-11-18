// DUNESAIL — tuning, palettes and difficulty tables. Every number that shapes
// how the game feels lives here so balance passes touch one file.
export const ARENA_WIDTH = 1280;
export const ARENA_HEIGHT = 720;
export const STEP = 1 / 60;
export const XP_BASE = 14;
export const XP_GROWTH = 1.32;
export const COMBO_WINDOW = 2.4;
export const PICKUP_LIFETIME = 14;
export const SHARD_LIFETIME = 22;
export const DASH_COOLDOWN = 2.6;
export const DASH_TIME = 0.16;
export const DASH_SPEED = 900;

export const DIFFICULTIES = {
  drifter: {
    id: 'drifter', label: 'DRIFTER', blurb: 'A gentle crossing. Foes are frail and slow.',
    enemyHp: 0.7, enemyDamage: 0.7, enemySpeed: 0.9, spawnRate: 0.8, playerHp: 130, scoreMult: 1,
  },
  sailor: {
    id: 'sailor', label: 'SAILOR', blurb: 'The intended voyage. Fair winds, sharp teeth.',
    enemyHp: 1.0, enemyDamage: 1.0, enemySpeed: 1.0, spawnRate: 1.0, playerHp: 100, scoreMult: 1.5,
  },
  sunscorched: {
    id: 'sunscorched', label: 'SUNSCORCHED', blurb: 'The desert shows no mercy. For proven captains.',
    enemyHp: 1.45, enemyDamage: 1.4, enemySpeed: 1.12, spawnRate: 1.3, playerHp: 85, scoreMult: 2.5,
  },
};

export const DIFFICULTY_ORDER = ['drifter', 'sailor', 'sunscorched'];

// One palette per realm: sky, sand, dune lines, glow and hazard colours.
export const REALM_PALETTES = [
  {
    skyTop: '#1d2b53', skyMid: '#7e2553', skyLow: '#ff9a5a',
    sandFar: '#c98a4b', sandMid: '#e0a458', sandNear: '#f2c078',
    duneLine: 'rgba(120,60,20,0.35)', glow: '#ffd23f', hazard: '#ff6b35',
    fog: 'rgba(255,154,90,0.10)', name: 'DUNE SEA',
  },
  {
    skyTop: '#0b1e3a', skyMid: '#155e75', skyLow: '#7dd3fc',
    sandFar: '#7fa8a0', sandMid: '#a8c8bd', sandNear: '#d9ece4',
    duneLine: 'rgba(20,80,90,0.35)', glow: '#67e8f9', hazard: '#22d3ee',
    fog: 'rgba(125,211,252,0.10)', name: 'GLASS FLATS',
  },
  {
    skyTop: '#160b2e', skyMid: '#4c1d95', skyLow: '#c084fc',
    sandFar: '#5b4a7a', sandMid: '#7a639e', sandNear: '#a78bc9',
    duneLine: 'rgba(40,20,70,0.4)', glow: '#f0abfc', hazard: '#e879f9',
    fog: 'rgba(192,132,252,0.12)', name: 'SUNKEN COURT',
  },
];

export const ENEMY_DEFS = {
  sandmite: { hp: 22, speed: 118, damage: 8, radius: 13, xp: 3, score: 10, color: '#e07840', name: 'Sandmite' },
  dunecrawler: { hp: 85, speed: 52, damage: 16, radius: 22, xp: 8, score: 25, color: '#8a5a2b', name: 'Dune Crawler' },
  glasswasp: { hp: 16, speed: 168, damage: 7, radius: 11, xp: 4, score: 15, color: '#7dd3fc', name: 'Glass Wasp' },
  shardspitter: { hp: 34, speed: 74, damage: 10, radius: 15, xp: 6, score: 20, color: '#4ade80', name: 'Shard Spitter' },
  miragewraith: { hp: 30, speed: 96, damage: 12, radius: 14, xp: 7, score: 30, color: '#c084fc', name: 'Mirage Wraith' },
  emberscarab: { hp: 40, speed: 88, damage: 20, radius: 15, xp: 6, score: 25, color: '#f43f5e', name: 'Ember Scarab' },
  crystalgolem: { hp: 150, speed: 42, damage: 18, radius: 26, xp: 14, score: 50, color: '#93c5fd', name: 'Crystal Golem' },
};

export const BOSS_DEFS = {
  tyrant: { name: 'THE DUNE TYRANT', title: 'Sandworm of the Dune Sea', hp: 2600, speed: 105, damage: 22, radius: 34, score: 1500, color: '#d97706' },
  regent: { name: 'THE GLASS REGENT', title: 'Sovereign of the Sunken Court', hp: 4200, speed: 62, damage: 20, radius: 38, score: 3000, color: '#e879f9' },
};

export function xpNeededForLevel(level) {
  return Math.round(XP_BASE * Math.pow(XP_GROWTH, level - 1));
}

export function difficultyById(id) {
  return DIFFICULTIES[id] ?? DIFFICULTIES.sailor;
}
