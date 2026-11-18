// Level-up upgrades: 14 choices across damage, firepower, survival and
// utility. Rolling offers 3 distinct cards; applying one mutates the player.
import { shuffleCopy } from './rng.js';

export const UPGRADE_POOL = [
  { id: 'sunlance', name: 'SUNLANCE FOCUS', icon: '☀', desc: '+30% lance damage', max: 5, apply(p) { p.damage *= 1.3; } },
  { id: 'rapid', name: 'SWIFT REPEATER', icon: '≫', desc: '+22% fire rate', max: 5, apply(p) { p.fireRate *= 1.22; } },
  { id: 'split', name: 'TWIN SUNS', icon: '✦', desc: '+1 bolt per volley', max: 3, apply(p) { p.multishot += 1; } },
  { id: 'pierce', name: 'GLASS PIERCER', icon: '➶', desc: 'Bolts pierce +1 foe', max: 3, apply(p) { p.pierce += 1; } },
  { id: 'crit', name: 'DEADEYE SIGHT', icon: '◎', desc: '+12% crit chance', max: 4, apply(p) { p.critChance += 0.12; } },
  { id: 'critdmg', name: 'BURNING EDGE', icon: '♦', desc: '+60% crit damage', max: 3, apply(p) { p.critMult += 0.6; } },
  { id: 'hull', name: 'REINFORCED HULL', icon: '⬢', desc: '+25 max HP, heal 25', max: 5, apply(p) { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); } },
  { id: 'sails', name: 'STORM SAILS', icon: '≋', desc: '+14% move speed', max: 4, apply(p) { p.moveBonus += 36; } },
  { id: 'magnet', name: 'SHARD LODESTONE', icon: '◉', desc: '+55% shard pull range', max: 3, apply(p) { p.magnetRadius *= 1.55; } },
  { id: 'armor', name: 'DUNE PLATING', icon: '▣', desc: 'Take 12% less damage', max: 4, apply(p) { p.armor += 0.12; } },
  { id: 'regen', name: 'OASIS HEART', icon: '♥', desc: 'Regenerate 1.2 HP/s', max: 3, apply(p) { p.regen += 1.2; } },
  { id: 'ember', name: 'EMBER ROUNDS', icon: '♨', desc: 'Hits ignite: 20% burn chance', max: 3, apply(p) { p.burnChance += 0.2; } },
  { id: 'vampire', name: 'SUN SIPHON', icon: '◈', desc: 'Heal 3 HP on every 12th kill', max: 2, apply(p) { p.lifesteal += 1; } },
  { id: 'greed', name: 'GILDED WAKE', icon: '✧', desc: '+35% shards from all sources', max: 3, apply(p) { p.shardBonus += 0.35; } },
];

export function countUpgradeTaken(player, id) {
  return player.upgradesTaken.filter((taken) => taken === id).length;
}

export function rollUpgradeChoices(session, count) {
  const available = UPGRADE_POOL.filter((u) => countUpgradeTaken(session.player, u.id) < u.max);
  const shuffled = shuffleCopy(session.rng, available);
  const picks = shuffled.slice(0, Math.min(count, shuffled.length));
  while (picks.length < count) {
    picks.push({ id: 'heal', name: 'FIELD REPAIRS', icon: '+', desc: 'Restore 40 HP now', max: 99, apply(p) { p.hp = Math.min(p.maxHp, p.hp + 40); } });
  }
  return picks;
}

export function applyUpgradeChoice(session, upgrade) {
  upgrade.apply(session.player);
  session.player.upgradesTaken.push(upgrade.id);
  session.stats.upgradesTaken += 1;
  if (upgrade.id === 'heal') {
    // Field repairs is a fallback, not a build choice: do not count it twice.
  }
}
