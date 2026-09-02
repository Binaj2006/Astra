/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║       AniRPG — Daily Quest System (v2)                      ║
 * ║  • 50-quest pool, 4 random per day                          ║
 * ║  • Auto-start every day (first /dungeon, /pvp, etc. triggers ║
 * ║    today's 4 quests — no /quest daily needed)               ║
 * ║  • Streak reset to 0 if you miss a day                      ║
 * ║  • Bonus on completing all 4 (one-time streak milestones)   ║
 * ║  • Auto-claim when quest hits 100%                          ║
 * ║  • WAT timezone (UTC+1) day rollover at midnight            ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Streak milestones (one-time only, never reset, NERFED):
 *   7-day streak   → +200g
 *   14-day streak  → +500g + 5 💎
 *   30-day streak  → +1,500g + 20 💎
 *   60-day streak  → +3,000g + 50 💎
 *   100-day streak → +7,500g + 100 💎
 *
 * The streak is a "nice to have" cosmetic reward now, not a farming
 * mechanic. The real progression comes from quest rewards themselves.
 */

'use strict';

// ── 50-quest pool ─────────────────────────────────────────────────────────────
const DAILY_QUEST_POOL = [
  // ── Combat / Kills (10) ────────────────────────────────────────────────────
  { id: 'dq_kills10',     name: 'Monster Slayer',        desc: 'Defeat 10 monsters',                       type: 'kill',     target: 10,  reward: { gold: 4000,   crystals: 8   } },
  { id: 'dq_kills25',     name: 'Veteran Hunter',        desc: 'Defeat 25 monsters',                       type: 'kill',     target: 25,  reward: { gold: 8000,   crystals: 25  } },
  { id: 'dq_kills50',     name: 'Exterminator',          desc: 'Defeat 50 monsters',                       type: 'kill',     target: 50,  reward: { gold: 18000,  crystals: 60  } },
  { id: 'dq_kills100',    name: 'Mass Extinction',       desc: 'Defeat 100 monsters',                      type: 'kill',     target: 100, reward: { gold: 35000,  crystals: 120 } },
  { id: 'dq_boss1',       name: 'Boss Slayer',           desc: 'Defeat 1 dungeon boss',                    type: 'boss',     target: 1,   reward: { gold: 10000,  crystals: 30  } },
  { id: 'dq_boss3',       name: 'Boss Hunter',           desc: 'Defeat 3 dungeon bosses',                  type: 'boss',     target: 3,   reward: { gold: 25000,  crystals: 80  } },
  { id: 'dq_boss5',       name: 'Warlord',               desc: 'Defeat 5 dungeon bosses',                  type: 'boss',     target: 5,   reward: { gold: 45000,  crystals: 150 } },
  { id: 'dq_attack5',     name: 'Pattern Practitioner',  desc: 'Use attack patterns 5 times',             type: 'pattern',  target: 5,   reward: { gold: 5500,   crystals: 15  } },
  { id: 'dq_attack10',    name: 'Pattern Master',        desc: 'Use attack patterns 10 times',            type: 'pattern',  target: 10,  reward: { gold: 10000,  crystals: 35  } },
  { id: 'dq_attack25',    name: 'Combo King',            desc: 'Use attack patterns 25 times',            type: 'pattern',  target: 25,  reward: { gold: 22000,  crystals: 75  } },

  // ── Dungeons (8) ──────────────────────────────────────────────────────────
  { id: 'dq_dungeons2',   name: 'Dungeon Diver',         desc: 'Clear 2 dungeon floors',                   type: 'dungeon',  target: 2,   reward: { gold: 5000,   crystals: 10  } },
  { id: 'dq_dungeons5',   name: 'Dungeon Veteran',       desc: 'Clear 5 dungeon floors',                   type: 'dungeon',  target: 5,   reward: { gold: 9000,   crystals: 30  } },
  { id: 'dq_dungeons10',  name: 'Dungeon Master',        desc: 'Clear 10 dungeon floors',                  type: 'dungeon',  target: 10,  reward: { gold: 18000,  crystals: 60  } },
  { id: 'dq_floor5',      name: 'Floor Conqueror',       desc: 'Reach floor 5 in a dungeon',               type: 'floor',    target: 5,   reward: { gold: 7000,   crystals: 20  } },
  { id: 'dq_floor10',     name: 'Deep Diver',            desc: 'Reach floor 10 in a dungeon',              type: 'floor',    target: 10,  reward: { gold: 12000,  crystals: 40  } },
  { id: 'dq_floor20',     name: 'Abyss Walker',          desc: 'Reach floor 20 in a dungeon',              type: 'floor',    target: 20,  reward: { gold: 30000,  crystals: 100 } },
  { id: 'dq_fullclear',   name: 'Full Clear',            desc: 'Fully clear a dungeon (all 20 floors)',    type: 'clear',    target: 1,   reward: { gold: 25000,  crystals: 90  } },
  { id: 'dq_fullclear3',  name: 'Completionist',         desc: 'Fully clear 3 dungeons',                   type: 'clear',    target: 3,   reward: { gold: 60000,  crystals: 250 } },

  // ── PvP (5) ──────────────────────────────────────────────────────────────
  { id: 'dq_pvp1',        name: 'Arena Fighter',         desc: 'Win 1 PvP duel',                           type: 'pvp',      target: 1,   reward: { gold: 6000,   crystals: 15  } },
  { id: 'dq_pvp3',        name: 'PvP Warrior',           desc: 'Win 3 PvP duels',                          type: 'pvp',      target: 3,   reward: { gold: 15000,  crystals: 50  } },
  { id: 'dq_pvp5',        name: 'Duelist',               desc: 'Win 5 PvP duels',                          type: 'pvp',      target: 5,   reward: { gold: 25000,  crystals: 85  } },
  { id: 'dq_pvp10',       name: 'Gladiator',             desc: 'Win 10 PvP duels',                         type: 'pvp',      target: 10,  reward: { gold: 50000,  crystals: 175 } },
  { id: 'dq_pvpfloor',    name: 'Floor Fight',           desc: 'Win 1 PvP inside a dungeon',               type: 'pvpFloor', target: 1,   reward: { gold: 12000,  crystals: 40  } },

  // ── Crafting / Economy (8) ───────────────────────────────────────────────
  { id: 'dq_craft1',      name: 'Craftsmaster',          desc: 'Craft 1 item',                             type: 'craft',    target: 1,   reward: { gold: 4500,   crystals: 12  } },
  { id: 'dq_craft3',      name: 'Artisan',               desc: 'Craft 3 items',                            type: 'craft',    target: 3,   reward: { gold: 12000,  crystals: 40  } },
  { id: 'dq_craft5',      name: 'Master Crafter',        desc: 'Craft 5 items',                            type: 'craft',    target: 5,   reward: { gold: 20000,  crystals: 70  } },
  { id: 'dq_shop1',       name: 'Shopper',               desc: 'Make 1 purchase in any shop',              type: 'shop',     target: 1,   reward: { gold: 2000,   crystals: 5   } },
  { id: 'dq_shop3',       name: 'Big Spender',           desc: 'Make 3 purchases in any shop',             type: 'shop',     target: 3,   reward: { gold: 7500,   crystals: 20  } },
  { id: 'dq_sell1',       name: 'Merchant',              desc: 'Sell 1 item to any shop',                  type: 'sell',     target: 1,   reward: { gold: 2500,   crystals: 5   } },
  { id: 'dq_sell5',       name: 'Trader',                desc: 'Sell 5 items to any shop',                 type: 'sell',     target: 5,   reward: { gold: 12000,  crystals: 30  } },
  { id: 'dq_gold5000',    name: 'Gold Rush',             desc: 'Earn 5,000 Nexus (any source)',            type: 'goldEarn', target: 5000, reward: { gold: 1500,   crystals: 5   } },

  // ── Healer / Support (4) ──────────────────────────────────────────────────
  { id: 'dq_heal2',       name: 'Survivalist',           desc: 'Heal 2 times during battle',               type: 'heal',     target: 2,   reward: { gold: 3000,   crystals: 8   } },
  { id: 'dq_heal5',       name: 'Field Medic',           desc: 'Heal 5 times during battle',               type: 'heal',     target: 5,   reward: { gold: 7500,   crystals: 20  } },
  { id: 'dq_buff1',       name: 'Supporter',             desc: 'Apply 1 buff to a teammate',               type: 'buff',     target: 1,   reward: { gold: 3500,   crystals: 10  } },
  { id: 'dq_buff3',       name: 'Battle Cleric',         desc: 'Apply 3 buffs to teammates',               type: 'buff',     target: 3,   reward: { gold: 9500,   crystals: 30  } },

  // ── Pets / Taming (4) ────────────────────────────────────────────────────
  { id: 'dq_pet1',        name: 'Pet Trainer',           desc: 'Train your pet once',                      type: 'pet',      target: 1,   reward: { gold: 3500,   crystals: 10  } },
  { id: 'dq_pet3',        name: 'Pet Whisperer',         desc: 'Train your pet 3 times',                   type: 'pet',      target: 3,   reward: { gold: 9000,   crystals: 25  } },
  { id: 'dq_petfeed1',    name: 'Caretaker',             desc: 'Feed your pet once',                       type: 'feed',     target: 1,   reward: { gold: 1500,   crystals: 3   } },
  { id: 'dq_petfeed5',    name: 'Devoted Owner',         desc: 'Feed your pet 5 times',                    type: 'feed',     target: 5,   reward: { gold: 5000,   crystals: 12  } },

  // ── Summon / Gacha (5) ────────────────────────────────────────────────────
  { id: 'dq_summon1',     name: 'Lucky Pull',            desc: 'Pull 1 summon',                            type: 'summon',   target: 1,   reward: { gold: 3000,   crystals: 5   } },
  { id: 'dq_summon3',     name: 'Gacha Addict',          desc: 'Pull 3 summons',                           type: 'summon',   target: 3,   reward: { gold: 7500,   crystals: 15  } },
  { id: 'dq_summon10',    name: 'Whale',                 desc: 'Pull 10 summons',                          type: 'summon',   target: 10,  reward: { gold: 25000,  crystals: 60  } },
  { id: 'dq_legendary',   name: 'Star-Blessed',          desc: 'Pull 1 legendary+ item',                   type: 'legendary',target: 1,   reward: { gold: 50000,  crystals: 200 } },
  { id: 'dq_daily1',      name: 'Devoted',               desc: 'Claim your /daily reward',                 type: 'daily',    target: 1,   reward: { gold: 5000,   crystals: 10  } },

  // ── Guild (3) ─────────────────────────────────────────────────────────────
  { id: 'dq_guild1',      name: 'Guild Contributor',     desc: 'Donate to guild treasury',                 type: 'donate',   target: 1,   reward: { gold: 3000,   crystals: 5   } },
  { id: 'dq_guild5gp',    name: 'Guild Pillar',          desc: 'Earn 5 Guild Points',                      type: 'gp',       target: 5,   reward: { gold: 8000,   crystals: 25  } },
  { id: 'dq_guildwar1',   name: 'War Veteran',           desc: 'Participate in 1 Guild War',               type: 'gw',       target: 1,   reward: { gold: 15000,  crystals: 50  } },

  // ── Quests (3) ────────────────────────────────────────────────────────────
  { id: 'dq_quest1',      name: 'Adventurer',            desc: 'Complete 1 quest',                         type: 'quest',    target: 1,   reward: { gold: 4000,   crystals: 12  } },
  { id: 'dq_quest3',      name: 'Quester',               desc: 'Complete 3 quests',                        type: 'quest',    target: 3,   reward: { gold: 12000,  crystals: 40  } },
  { id: 'dq_questrep1',   name: 'Faction Friend',        desc: 'Gain faction reputation',                  type: 'rep',      target: 1,   reward: { gold: 5000,   crystals: 15  } },
];

// ── Streak milestones (one-time, never reset, NERFED) ────────────────────────
const STREAK_MILESTONES = {
  7:   { gold: 200,    crystals: 0,   label: '1 week',     bonus: '+200g'              },
  14:  { gold: 500,    crystals: 5,   label: '2 weeks',    bonus: '+500g + 5 💎'        },
  30:  { gold: 1500,   crystals: 20,  label: '1 month',    bonus: '+1,500g + 20 💎'     },
  60:  { gold: 3000,   crystals: 50,  label: '2 months',   bonus: '+3,000g + 50 💎'     },
  100: { gold: 7500,   crystals: 100, label: '100 days',   bonus: '+7,500g + 100 💎'    },
};

// ── WAT day key ──────────────────────────────────────────────────────────────
function getWATDayKey() {
  const d = new Date(Date.now() + 3600000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

function seededPick(arr, seed, count) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const x = Math.abs(Math.sin(seed + i * 997)) * 1000000;
    const j = Math.floor(x % (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

// ── Ensure player has today's daily quests (4 random) ────────────────────────
function ensureDailyQuests(player) {
  const dayKey = getWATDayKey();

  if (!player.dailyQuests) player.dailyQuests = { streak: 0, milestones: [], quests: [] };

  if (player.dailyQuests.dayKey === dayKey) {
    // Auto-claim any completed but unclaimed quests
    autoClaimIfReady(player);
    return false;
  }

  // ── Day rollover: archive streak and pick fresh quests ────────────
  const prevQuests   = player.dailyQuests.quests || [];
  const allCompleted = prevQuests.length > 0 && prevQuests.every(q => q.completed);

  if (allCompleted && player.dailyQuests.dayKey && player.dailyQuests.dayKey !== dayKey) {
    player.dailyQuests.streak = (player.dailyQuests.streak || 0) + 1;
  } else if (player.dailyQuests.dayKey && player.dailyQuests.dayKey !== dayKey) {
    // Missed a day (didn't complete all 4) → reset streak
    player.dailyQuests.streak = 0;
  }

  // Seeded pick of 4 quests for today
  const playerId = player.id || player.name || 'p';
  let seed = 0;
  for (let i = 0; i < dayKey.length; i++) seed += dayKey.charCodeAt(i) * (i + 1) * 13;
  for (let i = 0; i < playerId.length; i++) seed += playerId.charCodeAt(i) * (i + 1) * 7;

  const picked = seededPick(DAILY_QUEST_POOL, seed, 4);

  player.dailyQuests.dayKey = dayKey;
  player.dailyQuests.quests = picked.map(q => ({
    ...q,
    progress:  0,
    completed: false,
    claimed:   false,
  }));

  return true;
}

// ── Auto-claim: when a quest hits 100%, immediately grant its reward ────────
function autoClaimIfReady(player) {
  if (!player.dailyQuests?.quests) return [];
  const justClaimed = [];
  for (const q of player.dailyQuests.quests) {
    if (q.completed && !q.claimed) {
      q.claimed = true;
      player.gold         = (player.gold         || 0) + (q.reward.gold     || 0);
      player.manaCrystals = (player.manaCrystals || 0) + (q.reward.crystals || 0);
      justClaimed.push(q);
    }
  }
  return justClaimed;
}

// ── Update quest progress (called from dungeon/pvp/craft/etc.) ──────────────
// Auto-bootstraps the daily quest list if the player doesn't have one yet —
// so the very first /dungeon attack (or any quest-tracking event) starts the
// day's 4 quests. No /quest daily required.
function trackQuestProgress(player, type, amount = 1) {
  if (!player) return { completed: [], justClaimed: [] };
  // Self-bootstrap: ensure today's quests exist before tracking
  ensureDailyQuests(player);
  if (!player.dailyQuests?.quests) return { completed: [], justClaimed: [] };
  const completed   = [];
  const justClaimed = [];
  for (const q of player.dailyQuests.quests) {
    if (q.completed || q.type !== type) continue;
    q.progress = (q.progress || 0) + amount;
    if (q.progress >= q.target) {
      q.progress  = q.target;
      q.completed = true;
      completed.push(q);
      // Auto-claim (immediate credit)
      q.claimed = true;
      player.gold         = (player.gold         || 0) + (q.reward.gold     || 0);
      player.manaCrystals = (player.manaCrystals || 0) + (q.reward.crystals || 0);
      justClaimed.push(q);
    }
  }
  // If the player just finished the last quest, check for a streak milestone
  let milestone = null;
  if (justClaimed.length && player.dailyQuests.quests.every(q => q.claimed)) {
    milestone = checkStreakMilestone(player);
  }
  return { completed, justClaimed, milestone };
}

// ── Manual claim (legacy /quest claim <id>) ─────────────────────────────────
function claimQuestReward(player, questId) {
  const q = player.dailyQuests?.quests?.find(q => q.id === questId);
  if (!q)             return { success: false, error: 'Quest not found.' };
  if (!q.completed)   return { success: false, error: 'Quest not completed yet.' };
  if (q.claimed)      return { success: false, error: 'Reward already claimed.' };

  q.claimed = true;
  player.gold         = (player.gold         || 0) + (q.reward.gold     || 0);
  player.manaCrystals = (player.manaCrystals || 0) + (q.reward.crystals || 0);
  return { success: true, reward: q.reward, quest: q };
}

// ── Streak milestones (one-time bonuses when streak hits a threshold) ───────
// Now a small cosmetic reward — not a progression shortcut.
function checkStreakMilestone(player) {
  if (!player.dailyQuests) return null;
  const streak = player.dailyQuests.streak || 0;
  const milestone = STREAK_MILESTONES[streak];
  if (!milestone) return null;

  if (!Array.isArray(player.dailyQuests.milestones)) player.dailyQuests.milestones = [];
  if (player.dailyQuests.milestones.includes(streak)) return null;  // already granted

  player.dailyQuests.milestones.push(streak);
  player.gold         = (player.gold         || 0) + (milestone.gold     || 0);
  player.manaCrystals = (player.manaCrystals || 0) + (milestone.crystals || 0);

  return milestone;
}

// ── Build a progress bar ────────────────────────────────────────────────────
function buildProgressBar(current, max, length = 8) {
  const filled = Math.floor((current / max) * length);
  return '[' + '█'.repeat(Math.min(filled, length)) + '░'.repeat(Math.max(0, length - filled)) + ']';
}

// ── Format daily quests display ─────────────────────────────────────────────
function formatDailyQuests(player) {
  ensureDailyQuests(player);
  const quests = player.dailyQuests?.quests || [];
  const streak = player.dailyQuests?.streak || 0;
  const dayKey = player.dailyQuests?.dayKey || '—';
  const milestones = player.dailyQuests?.milestones || [];

  // Look ahead: what milestones remain?
  const allStreaks = Object.keys(STREAK_MILESTONES).map(Number).sort((a,b) => a-b);
  const nextMilestone = allStreaks.find(s => s > streak);

  let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 *DAILY QUESTS* — ${dayKey}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `🔥 Streak: *${streak}* day${streak===1?'':'s'}   `;
  if (nextMilestone) txt += `(next milestone: ${nextMilestone}-day)\n`;
  else txt += `🏆 MAX MILESTONE!\n`;
  txt += `\n`;

  quests.forEach((q, i) => {
    const icon = q.claimed ? '✅' : q.completed ? '🎁' : '⏳';
    const bar  = buildProgressBar(q.progress || 0, q.target);
    txt += `${icon} *${i+1}. ${q.name}*\n`;
    txt += `   ${q.desc}\n`;
    txt += `   ${bar} ${q.progress||0}/${q.target}\n`;
    txt += `   💰 +${q.reward.gold.toLocaleString()} Nexus | 💎 +${q.reward.crystals} Mana Stones\n`;
    if (q.completed && !q.claimed) txt += `   🎁 Auto-claimed!\n`;
    txt += `\n`;
  });

  const allDone = quests.length === 4 && quests.every(q => q.claimed);
  if (allDone) {
    txt += `🎉 *ALL 4 COMPLETE!* +25% bonus gold on next dungeon clear!\n\n`;
  } else {
    const completed = quests.filter(q => q.completed).length;
    txt += `Progress: ${completed}/4 for tomorrow's streak\n\n`;
  }

  // Milestone log
  if (milestones.length) {
    txt += `🏆 *Milestones earned:* ${milestones.join(', ')}-day\n`;
  }

  txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `💡 Quests refresh at midnight (WAT)\n`;
  txt += `💡 Rewards auto-claim when you hit 100%\n`;
  txt += `💡 Complete all 4 every day to grow your streak\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  return txt;
}

// ── Inline progress snippet (for /dungeon, /pvp, etc. output) ───────────────
function getInlineProgress(player, type) {
  if (!player.dailyQuests?.quests) return '';
  const matching = player.dailyQuests.quests.filter(q => q.type === type && !q.claimed);
  if (matching.length === 0) return '';
  return matching.map(q => `\n  📋 [${buildProgressBar(q.progress || 0, q.target)}] ${q.progress||0}/${q.target} ${q.name}`).join('');
}

module.exports = {
  DAILY_QUEST_POOL,
  STREAK_MILESTONES,
  getWATDayKey,
  ensureDailyQuests,
  trackQuestProgress,
  claimQuestReward,
  checkStreakMilestone,
  autoClaimIfReady,
  formatDailyQuests,
  getInlineProgress,
  buildProgressBar,
};
