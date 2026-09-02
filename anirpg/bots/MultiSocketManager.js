/**
 * ╔══════════════════════════════════════════════════════╗
 * ║         AniRPG — MultiSocketManager                  ║
 * ║  One Baileys socket per linked bot number.          ║
 * ║  Every bot handles RPG commands AND has a          ║
 * ║  personality. No "primary" or "secondary" — all     ║
 * ║  bots are equal.                                   ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Each bot number:
 *  - Has its own auth folder (auth/hinata/, auth/lunar/, …)
 *  - Runs its own Baileys socket
 *  - Handles RPG commands in groups (like /dungeon, /pvp, /profile)
 *  - Reacts to AI chat in groups when its personality is active
 *  - Can DM players — but DMs are GATED by the serf system.
 *    The ONLY exception is the welcome DM (first-join only).
 *
 * AstraLink pairing codes are issued through whichever bot is
 * currently connected (the API endpoint picks any live socket).
 */

'use strict';

const path = require('path');
const fs   = require('fs');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const pino    = require('pino');

const PersonalityManager = require('./PersonalityManager');
const AIHandler          = require('./AIHandler');
const SerfManager        = require('../rpg/utils/SerfManager');
const Perms              = require('../utils/permissions');

// ── AstraLink endpoint (loopback) for issuing pairing codes ──────────────────
const ASTRALINK_HOST = process.env.ASTRALINK_HOST || '127.0.0.1';
const ASTRALINK_PORT = parseInt(process.env.PORT || '3000', 10);
const httpClient     = require('http');

/**
 * Request a pairing code from any connected bot's AstraLink API (loopback).
 * Returns { success, code } on success or { success: false, error } on failure.
 *
 * Why loopback and not direct sock.requestPairingCode()?
 *   Baileys v7's `requestPairingCode()` must be called on the SOCKET that
 *   will actually emit the creds. Any connected bot works; we just need
 *   the HTTP API in index.js to relay through one of them.
 */
function requestAstraLinkPairingCode(phoneNumber, personalityKey) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ phoneNumber, personality: personalityKey });
    const req = httpClient.request({
      hostname: ASTRALINK_HOST,
      port:     ASTRALINK_PORT,
      path:     '/api/request-pairing-code',
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 15_000,
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve({ success: false, error: 'Invalid AstraLink response' }); }
      });
    });
    req.on('error', (e) => resolve({ success: false, error: e.message }));
    req.on('timeout', () => { req.destroy(new Error('AstraLink timeout')); });
    req.write(body);
    req.end();
  });
}

// ── Connected sockets registry ────────────────────────────────────────────────
// { personalityKey: socket }
const botSockets = {};

// ── Pairing-code de-dup & notice state ───────────────────────────────────────
const _pendingCodeRequested = new Set();
const _noNumberWarned       = new Set();

/**
 * Get the socket for a given personality key.
 * Returns null if not connected.
 */
function getSocket(personalityKey) {
  return botSockets[personalityKey] || null;
}

/**
 * Get all connected sockets keyed by personality.
 */
function getAllSockets() {
  return { ...botSockets };
}

/**
 * Return any one connected socket (for AstraLink pairing code requests).
 */
function getAnySocket() {
  const keys = Object.keys(botSockets);
  if (keys.length === 0) return null;
  return botSockets[keys[0]];
}

/**
 * Connect one bot. Every bot has equal status — all of them handle
 * RPG commands and can host a personality in their active group.
 *
 * @param {string} personalityKey  e.g. 'hinata'
 * @param {string} authDir         base auth directory
 * @param {Function} getDatabase
 * @param {Function} saveDatabase
 * @param {object} options
 *   - personalityKey:  which personality to attach to this socket
 *   - isWelcomeBot:    if true, this bot also sends the welcome DM
 *                      (only one bot should do this; we pick the first
 *                      that connects)
 *   - handlers:        { rpgCommandHandler, onGroupJoin }
 */
async function connectBot(personalityKey, authDir, getDatabase, saveDatabase, options = {}) {
  const botAuthDir = path.join(authDir, personalityKey);
  fs.mkdirSync(botAuthDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(botAuthDir);
  const { version } = await fetchLatestBaileysVersion();

  const displayName = PersonalityManager.getDisplayName(personalityKey);

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    auth: state,
    browser: [`AniRPG-${displayName}`, 'Chrome', '10.0'],
    syncFullHistory: false,
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: false,
    getMessage: async () => ({ conversation: '' }),
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      if (_pendingCodeRequested.has(personalityKey)) return;

      const envPhone = process.env[`BOT_${personalityKey.toUpperCase()}`];
      if (envPhone) {
        _pendingCodeRequested.add(personalityKey);
        const cleanPhone = envPhone.replace(/[^0-9]/g, '');
        console.log(`\n🛰️  [${displayName}] Bot not registered. Requesting pairing code via AstraLink for +${cleanPhone}…`);
        const result = await requestAstraLinkPairingCode(cleanPhone, personalityKey);
        if (result.success && result.code) {
          console.log('━'.repeat(60));
          console.log(`🔗 [${displayName}] ASTRALINK PAIRING CODE:  ${result.code}`);
          console.log(`   Use this code in WhatsApp → Linked Devices → Link with phone number`);
          console.log('━'.repeat(60));
        } else {
          console.error(`❌ [${displayName}] AstraLink pairing code failed: ${result.error || 'unknown'}`);
          console.error('   Open the AstraLink web UI and request a code manually.');
          _pendingCodeRequested.delete(personalityKey);
        }
      } else if (!_noNumberWarned.has(personalityKey)) {
        _noNumberWarned.add(personalityKey);
        console.log(`🛰️  [${displayName}] Bot not registered and no phone number was supplied.`);
        console.log('   Set BOT_' + personalityKey.toUpperCase() + '=<phone-with-country-code> in .env');
        console.log('   Then use the AstraLink web UI to issue a pairing code.');
      }
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      console.log(`❌ [${displayName}] Disconnected (code: ${code}). Reconnect: ${shouldReconnect}`);

      delete botSockets[personalityKey];
      _pendingCodeRequested.delete(personalityKey);

      if (shouldReconnect) {
        const delay = code === 405 ? 30000 : 5000;
        setTimeout(() => connectBot(personalityKey, authDir, getDatabase, saveDatabase, options), delay);
      }
    } else if (connection === 'open') {
      console.log(`✅ [${displayName}] Connected!`);
      botSockets[personalityKey] = sock;
      _pendingCodeRequested.delete(personalityKey);
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // ── Group join/leave announcements ─────────────────────────────────────
  // `onGroupJoin(sock, personalityKey, chatId, participants, action)` is
  // called for every bot in the group. The handler decides whether
  // the bot should respond (based on whether it's the active bot in
  // the group, plus dedupe for the welcome DM).
  sock.ev.on('group-participants.update', async ({ id: chatId, participants, action }) => {
    if (action !== 'add' && action !== 'remove') return;
    if (options.onGroupJoin) {
      try { await options.onGroupJoin(sock, personalityKey, chatId, participants, action); }
      catch (e) { console.error('❌ onGroupJoin error:', e.message); }
    }
  });

  // ── Message handler (RPG commands + AI chat) ─────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const isGroup  = msg.key.remoteJid?.endsWith('@g.us');
    const sender   = isGroup ? msg.key.participant : msg.key.remoteJid;
    const chatId   = msg.key.remoteJid;

    if (!sender?.endsWith('@s.whatsapp.net') && !sender?.endsWith('@lid')) return;

    const messageText =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      msg.message.videoMessage?.caption || '';

    const db = getDatabase();
    if (db.bannedUsers?.[sender] || db.banlist?.[sender]) return;

    const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf-8'));
    const isCommand = messageText.startsWith(config.prefix);

    // ── Active-bot gate ────────────────────────────────────────────────────
    // In any group, only the active bot (set via /start or /switch) is
    // allowed to respond. Every bot in the group receives the same
    // message, so non-active bots must stay silent.
    //
    // For DMs, ANY connected bot can respond (each user DMs a specific
    // bot number, and that bot handles it).
    const activeKey = isGroup ? PersonalityManager.getActiveBot(chatId) : null;
    const isActive = isGroup ? (activeKey === personalityKey) : true;

    // ── RPG command handling ───────────────────────────────────────────────
    // Only the active bot in a group handles commands. In DMs, the
    // receiving bot handles the command (mod-only via the handler's gate).
    if (isCommand && options.rpgCommandHandler) {
      if (isActive && (isGroup || Perms.canAccessDM(db, sender))) {
        try {
          await options.rpgCommandHandler(sock, msg, messageText, config, getDatabase, saveDatabase);
        } catch (e) {
          console.error(`❌ [${displayName}] command handler error:`, e.message);
        }
      }
      return;
    }

    // ── !mp3 reply trigger (works in any chat) ───────────────────────────
    if (messageText.trim().toLowerCase() === '!mp3') {
      // Only the active bot replies (no point sending three identical
      // /mp3 confirmations from every bot in the group)
      if (isActive) {
        try {
          const { handleMp3Reply } = require('../commands/rpg/utility');
          await handleMp3Reply(sock, msg, chatId);
        } catch (e) { console.error('❌ !mp3 handler error:', e.message); }
      }
      return;
    }

    // ── AI personality chat (only when this bot is the active personality) ─
    if (!isGroup || !messageText.trim()) return;
    if (activeKey !== personalityKey) return;

    const botDisplayName = PersonalityManager.getDisplayName(personalityKey);
    const botJid = sock.user?.id;

    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const isMentioned = botJid && mentionedJids.some(j => j.split(':')[0] === botJid.split(':')[0]);
    const isQuoted    = botJid && quotedParticipant?.split(':')[0] === botJid?.split(':')[0];
    const nameInText  = messageText.toLowerCase().includes(botDisplayName.toLowerCase());

    if (!isMentioned && !isQuoted && !nameInText) return;

    try { await sock.sendPresenceUpdate('composing', chatId); } catch(e) {}

    const senderName = msg.pushName || sender.split('@')[0];
    try {
      const { text, attachment } = await AIHandler.generateResponse(
        chatId, personalityKey, messageText, senderName,
        sender, msg, getDatabase, saveDatabase
      );

      if (text) {
        await sock.sendMessage(chatId, {
          text: `*${botDisplayName}:* ${text}`,
        }, { quoted: msg });
      }

      if (attachment) {
        await sendAttachment(sock, chatId, attachment);
      }

    } catch (err) {
      console.error(`❌ [${displayName}] AI error:`, err.message);
    }
    try { await sock.sendPresenceUpdate('paused', chatId); } catch(e) {}
  });

  return sock;
}

/**
 * Send an attachment from AIHandler. Group sends are unfiltered; 1:1 DMs
 * go through the serf gate. The only bypass is the welcome DM (caller
 * passes opts.welcome = true and the welcome-bypass is applied via
 * `safeSendDM` directly).
 */
async function sendAttachment(sock, chatId, attachment, opts = {}) {
  if (!attachment) return;
  const isGroup = chatId?.endsWith?.('@g.us');

  const send = async (content) => {
    if (isGroup) return sock.sendMessage(chatId, content);
    return safeSendDM(sock, chatId, content, opts);
  };

  if (attachment.type === 'image' && attachment.buffer) {
    await send({ image: attachment.buffer, mimetype: 'image/jpeg' });
  } else if (attachment.type === 'audio' && attachment.buffer) {
    await send({
      audio: attachment.buffer,
      mimetype: 'audio/mpeg',
      fileName: attachment.fileName || 'audio.mp3',
      ptt: false,
    });
  } else if (attachment.type === 'lyrics') {
    await send({
      text: [
        `🎵 *${attachment.title}*`,
        attachment.artist ? `🎤 ${attachment.artist}` : null,
        ``,
        `🔗 ${attachment.url}`,
      ].filter(Boolean).join('\n'),
    });
  }
}

/**
 * sendAs — send from a specific personality's socket. 1:1 DMs are
 * gated through the serf system (unless `welcome: true`).
 */
async function sendAs(personalityKey, chatId, content, opts = {}) {
  const sock = botSockets[personalityKey];
  if (!sock) return { dropped: true, reason: 'no-socket' };
  if (!chatId?.endsWith?.('@g.us') && !opts.welcome) {
    return safeSendDM(sock, chatId, content, opts);
  }
  return sock.sendMessage(chatId, content);
}

/**
 * Serf-gate: should this bot be allowed to DM this player?
 *
 * Rules:
 *   - Welcome DMs are always allowed (caller sets opts.welcome = true)
 *   - Otherwise the bot must be the player's approved serf
 *   - Players without an approved serf receive a one-time reminder
 *   - Mods / owners can always be DMed by any bot
 */
function canSendDM(db, playerJid, botJid, botKey) {
  if (!db || !playerJid) return { allowed: true, reason: 'no-db' };

  // Mods / owners are exempt from the serf gate (admin override)
  if (Perms.isBotMod(db, playerJid) || Perms.isBotOwner(db, playerJid)) {
    return { allowed: true, reason: 'privileged' };
  }

  if (botJid && SerfManager.isJidPlayerSerf(db, playerJid, botJid)) {
    return { allowed: true, reason: 'serf-jid' };
  }
  if (botKey && SerfManager.isPlayerSerf(db, playerJid, botKey)) {
    return { allowed: true, reason: 'serf-key' };
  }

  return { allowed: false, reason: 'not-serf' };
}

/**
 * Send a DM from a bot, gated by the serf system.
 * If the player has not set a serf, the DM is dropped and a one-time
 * reminder is sent telling them to /setserf.
 */
const _serfReminderSent = new Set();
async function safeSendDM(sock, playerJid, content, opts = {}) {
  // The "welcome" flag bypasses serf checks — only used for the new-member DM.
  if (opts.welcome) {
    return sock.sendMessage(playerJid, content);
  }
  if (!opts.db) {
    // Without DB we can't gate — fail open and let the caller decide.
    return sock.sendMessage(playerJid, content);
  }
  const botJid = sock.user?.id || null;
  const botKey = opts.botKey || null;
  const verdict = canSendDM(opts.db, playerJid, botJid, botKey);
  if (verdict.allowed) {
    return sock.sendMessage(playerJid, content);
  }
  // Dropped. Queue a one-time reminder.
  if (!_serfReminderSent.has(playerJid)) {
    _serfReminderSent.add(playerJid);
    const reminder =
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '⚓ *DM BLOCKED — PICK YOUR SERF*\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
      'A bot tried to DM you, but you haven\'t set it as your serf.\n\n' +
      'To allow DMs from one personality bot:\n' +
      '1. Go to any group where the bot is active.\n' +
      '2. Run: `/setserf @botname`\n' +
      '3. A mod will confirm in the Mod GC.\n\n' +
      'After that, only your chosen bot can DM you.\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    try {
      await sock.sendMessage(playerJid, { text: reminder });
    } catch (e) { /* best effort */ }
  }
  return { dropped: true, reason: verdict.reason };
}

/**
 * Send /hi chorus — each bot replies from its own number.
 * All sends go to the group chat (not a DM), so no serf gate needed.
 */
async function sendHiChorus(chatId, responses) {
  for (let i = 0; i < responses.length; i++) {
    const { personalityKey, displayName, text, attachment } = responses[i];
    const sock = botSockets[personalityKey];
    if (!sock) continue;

    if (text) {
      await sock.sendMessage(chatId, {
        text: `*${displayName}:* ${text}`,
      });
    }

    if (attachment) {
      await sendAttachment(sock, chatId, attachment);
    }

    if (i < responses.length - 1) {
      await new Promise(r => setTimeout(r, 800));
    }
  }
}

/**
 * Pick a socket for a group chat:
 *   - The active personality in that group, if connected
 *   - Otherwise any connected socket (round-robin is overkill — we just
 *     pick the first one)
 */
function getActiveSocket(chatId) {
  const PersonalityManager = require('./PersonalityManager');
  const activeKey = PersonalityManager.getActiveBot(chatId);
  if (activeKey && botSockets[activeKey]) return botSockets[activeKey];
  return getAnySocket();
}

module.exports = {
  connectBot,
  getSocket,
  getAllSockets,
  getAnySocket,
  sendAs,
  sendHiChorus,
  sendAttachment,
  canSendDM,
  safeSendDM,
  getActiveSocket,
};
