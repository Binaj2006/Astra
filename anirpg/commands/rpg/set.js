// ═══════════════════════════════════════════════════════════════
// /set — Bot configuration flags
//
//   /set --mod @user --true     — promote user to mod
//   /set --mod @user --false    — demote mod
//   /set --maintenance --true   — toggle maintenance mode
//   /set --title @user <id>     — grant any title (owner-only)
//
// Owners are HARDCODED (Senku + Naruto) and CANNOT be modified.
// Only owners can /set --mod and /set --title. Mods can use other /set flags.
// ═══════════════════════════════════════════════════════════════

const Perms = require('../../utils/permissions');
const { stripDevice } = require('../../utils/constants');

module.exports = {
  name: 'set',
  aliases: ['config', 'toggle'],
  description: '⚙️ Set bot flags (mod/maintenance/title)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    // Must be at least a mod to use /set
    if (!Perms.isBotMod(db, sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ Only bot mods/owners can use /set.'
      }, { quoted: msg });
    }

    // Parse flags: --flag <value> [--flag <value>]
    const flags = {};
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (!a.startsWith('--')) continue;
      const key = a.slice(2).toLowerCase();
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = 'true'; // bare --flag means toggle to true
      }
    }

    const requestedFlag = Object.keys(flags)[0];
    if (!requestedFlag) {
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚙️ *SET COMMANDS*
━━━━━━━━━━━━━━━━━━━━━━━━━━━

⭐ *MOD MANAGEMENT* (owner-only)
\`/set --mod @user --true\`    promote
\`/set --mod @user --false\`   demote

👑 *OWNER MANAGEMENT*
_Owners (Senku + Naruto) are permanent and cannot be modified._

🎖️ *TITLE GRANT* (owner-only)
\`/set --title @user <titleId>\`  grant any title (incl. mythic)

🔧 *BOT FLAGS* (mod+)
\`/set --maintenance --true\`  ignore non-mod commands
\`/set --maintenance --false\` resume normal

━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // ── /set --mod @user --true/false ────────────────────────────
    if (requestedFlag === 'mod') {
      if (!Perms.isBotOwner(db, sender)) {
        return sock.sendMessage(chatId, {
          text: '❌ Only bot owners can add/remove mods.'
        }, { quoted: msg });
      }
      return await handleModFlag(sock, msg, db, saveDatabase, sender, flags.mod);
    }

    // ── /set --maintenance --true/false ─────────────────────────
    if (requestedFlag === 'maintenance') {
      if (!Array.isArray(db.botMods))   db.botMods   = [];
      if (!db.maintenance)              db.maintenance = false;
      const want = parseBool(flags.maintenance);
      if (want === null) {
        return sock.sendMessage(chatId, {
          text: '❌ Usage: `/set --maintenance --true` or `--false`'
        }, { quoted: msg });
      }
      db.maintenance = want;
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔧 *MAINTENANCE MODE: ${want ? 'ON' : 'OFF'}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${want
  ? '🚧 Non-mod commands will be silently ignored.\nMods/owners can still use all commands.'
  : '✅ Bot is back to normal. Everyone can use commands.'}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // ── /set --title <@user> <titleId> (owner-only) ───────────
    if (requestedFlag === 'title') {
      if (!Perms.isBotOwner(db, sender)) {
        return sock.sendMessage(chatId, {
          text: '❌ Only bot owners can grant titles.'
        }, { quoted: msg });
      }
      return await handleTitleGrant(sock, msg, db, saveDatabase, sender, args.slice(1));
    }

    return sock.sendMessage(chatId, {
      text: `❌ Unknown flag: \`--${requestedFlag}\`\n\nRun \`/set\` to see available flags.`
    }, { quoted: msg });
  }
};

// ── Handlers ────────────────────────────────────────────────

async function handleModFlag(sock, msg, db, saveDatabase, sender, rawValue) {
  const chatId = msg.key.remoteJid;
  const value  = parseBool(rawValue);
  if (value === null) {
    return sock.sendMessage(chatId, {
      text: '❌ Usage: `/set --mod @user --true` or `--false`'
    }, { quoted: msg });
  }

  const target = extractTarget(msg);
  if (!target) {
    return sock.sendMessage(chatId, {
      text: '❌ Tag a user or reply to their message:\n`/set --mod @user --true`'
    }, { quoted: msg });
  }

  const cleanTarget = stripDevice(target);
  const { OWNER_JID, COOWNER_JID } = require('../../utils/constants');
  if (cleanTarget === OWNER_JID || cleanTarget === COOWNER_JID) {
    return sock.sendMessage(chatId, {
      text: '❌ Owner and Co-Owner cannot be (de)modded — they are above mods.'
    }, { quoted: msg });
  }

  if (!Array.isArray(db.botMods)) db.botMods = [];
  if (value) {
    if (db.botMods.includes(cleanTarget)) {
      return sock.sendMessage(chatId, { text: '⚠️ That user is already a mod.' }, { quoted: msg });
    }
    db.botMods.push(cleanTarget);
    saveDatabase();
    return sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⭐ *MOD PROMOTED*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n👤 @${cleanTarget.split('@')[0]} is now a mod.\n\nThey can now use: /ban, /mute, /kick, /tagall, /set, /mods\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      mentions: [cleanTarget, sender]
    }, { quoted: msg });
  } else {
    if (!db.botMods.includes(cleanTarget)) {
      return sock.sendMessage(chatId, { text: '⚠️ That user is not a mod.' }, { quoted: msg });
    }
    db.botMods = db.botMods.filter(j => j !== cleanTarget);
    saveDatabase();
    return sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n❌ *MOD DEMOTED*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n👤 @${cleanTarget.split('@')[0]} is no longer a mod.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      mentions: [cleanTarget, sender]
    }, { quoted: msg });
  }
}

// ── helpers ─────────────────────────────────────────────────

function parseBool(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).toLowerCase();
  if (['true', '1', 'yes', 'on', 'enable'].includes(s))  return true;
  if (['false', '0', 'no', 'off', 'disable'].includes(s)) return false;
  return null;
}

function extractTarget(msg) {
  return msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
      || msg.message?.extendedTextMessage?.contextInfo?.participant
      || null;
}

// ── Title grant handler (owner-only) ────────────────────────
async function handleTitleGrant(sock, msg, db, saveDatabase, sender, args) {
  const chatId = msg.key.remoteJid;
  const { TITLES, RARITIES } = require('../../rpg/utils/TitleSystem');

  const userToken = args.find(a => a.startsWith('@') || a.includes('@s.whatsapp.net') || a.includes('@lid'));
  const titleId   = args.find(a => !a.startsWith('@') && !a.includes('@'));

  if (!userToken || !titleId) {
    return sock.sendMessage(chatId, {
      text: `❌ Usage: \`/set --title @user <titleId>\`\n\nExample: \`/set --title @user World Savior\`\n\nRun \`/title all\` to see all title IDs.`
    }, { quoted: msg });
  }

  let targetId = null;
  if (userToken.startsWith('@')) {
    targetId = extractTarget(msg);
  } else {
    targetId = userToken;
  }
  if (!targetId) {
    return sock.sendMessage(chatId, {
      text: '❌ Could not resolve user. Tag them or reply to their message.'
    }, { quoted: msg });
  }
  const targetPlayer = db.users[targetId];
  if (!targetPlayer) {
    return sock.sendMessage(chatId, {
      text: '❌ That user is not registered in the bot.'
    }, { quoted: msg });
  }
  const match = Object.keys(TITLES).find(id =>
    id.toLowerCase() === titleId.toLowerCase() ||
    TITLES[id].display.toLowerCase().includes(titleId.toLowerCase())
  );
  if (!match) {
    return sock.sendMessage(chatId, {
      text: `❌ Title \`${titleId}\` not found.\nUse \`/title all\` to see all titles.`
    }, { quoted: msg });
  }
  if (!Array.isArray(targetPlayer.titles)) targetPlayer.titles = [];
  if (targetPlayer.titles.includes(match)) {
    return sock.sendMessage(chatId, {
      text: `⚠️ @${targetId.split('@')[0]} already has *${TITLES[match].display}*.`,
      mentions: [targetId]
    }, { quoted: msg });
  }
  targetPlayer.titles.push(match);
  saveDatabase();
  const def = TITLES[match];
  const rarity = RARITIES[def.rarity] || RARITIES.common;
  return sock.sendMessage(chatId, {
    text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👑 *TITLE GRANTED*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${rarity.code} *${def.display}*\n\n👤 Granted to: @${targetId.split('@')[0]}\n⚡ Stat Boost: ${def.boostDesc}\n\nUse \`/title equip ${match}\` to equip it.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    mentions: [targetId, sender]
  }, { quoted: msg });
}
