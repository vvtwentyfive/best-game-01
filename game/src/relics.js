// Relics: rare drops from elites and bosses. Nine relics, each with a passive,
// plus named synergies when paired relics are held together.
import { shuffleCopy } from './rng.js';

export const RELIC_POOL = [
  { id: 'sunidol', name: 'SUN IDOL', icon: '☀', desc: 'Bolts deal +25% damage. Synergy: with Ember Sigil, hits explode.', apply(p) { p.damage *= 1.25; } },
  { id: 'embersigil', name: 'EMBER SIGIL', icon: '♨', desc: 'Burning foes take +50% damage. Synergy: with Sun Idol, kills explode.', apply(p) { p.burnChance += 0.25; } },
  { id: 'windcharm', name: 'WIND CHARM', icon: '≋', desc: '+20% move speed, dash recharges 40% faster.', apply(p) { p.moveBonus += 52; } },
  { id: 'mirageveil', name: 'MIRAGE VEIL', icon: '◌', desc: 'Gain a shield that blocks one hit every 25s.', apply(p) { p.shieldCharges += 1; } },
  { id: 'glassheart', name: 'GLASS HEART', icon: '♥', desc: '+40 max HP and +1 HP/s regeneration.', apply(p) { p.maxHp += 40; p.hp += 40; p.regen += 1; } },
  { id: 'thorns', name: 'CACTUS CROWN', icon: '✹', desc: 'Attackers take 12 damage when they hit you.', apply(p) { p.thorns += 12; } },
  { id: 'hourglass', name: 'SAND HOURGLASS', icon: '⧗', desc: 'Pickups last twice as long; +1 bomb stored.', apply(p) { p.bombCount += 1; } },
  { id: 'lode', name: 'MOTHER LODE', icon: '◆', desc: 'Sun-shards are worth double XP.', apply(p) { p.shardBonus += 0.5; } },
  { id: 'stormbell', name: 'STORM BELL', icon: '◉', desc: 'Every 8s, lightning strikes the nearest foe.', apply(p) { p.stormBell = true; } },
];

export const RELIC_SYNERGIES = [
  { pair: ['sunidol', 'embersigil'], name: 'SOLAR FLARE', desc: 'Kills explode, burning nearby foes.' },
  { pair: ['windcharm', 'mirageveil'], name: 'DESERT GHOST', desc: 'Dash recharges twice as fast and restores a shield.' },
  { pair: ['glassheart', 'thorns'], name: 'BRAMBLE OASIS', desc: 'Thorns damage doubled; heal 2 HP per thorn kill.' },
  { pair: ['hourglass', 'lode'], name: 'ENDLESS HARVEST', desc: 'Shard drops linger and magnet range doubles.' },
];

export function rollRelicChoices(session, count) {
  const owned = new Set(session.player.relics);
  const available = RELIC_POOL.filter((r) => !owned.has(r.id));
  const shuffled = shuffleCopy(session.rng, available);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function grantRelic(session, relic) {
  relic.apply(session.player);
  session.player.relics.push(relic.id);
  session.stats.relicsTaken += 1;
  session.audio.playRelic();
  checkRelicSynergies(session);
}

export function checkRelicSynergies(session) {
  const owned = new Set(session.player.relics);
  session.activeSynergies = RELIC_SYNERGIES.filter((s) => owned.has(s.pair[0]) && owned.has(s.pair[1]));
  for (const synergy of session.activeSynergies) {
    if (!session.announcedSynergies.includes(synergy.name)) {
      session.announcedSynergies.push(synergy.name);
      session.synergyFlash = synergy.name;
      session.synergyTimer = 2.6;
    }
  }
}

export function hasRelic(player, id) {
  return player.relics.includes(id);
}

export function hasSynergy(session, name) {
  return (session.activeSynergies || []).some((s) => s.name === name);
}

export function relicById(id) {
  return RELIC_POOL.find((r) => r.id === id);
}
