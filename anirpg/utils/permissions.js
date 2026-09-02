// ═══════════════════════════════════════════════════════════════
// AniRPG — Permission Tiers
// Single source of truth for "is this JID allowed to do X?"
//
// Hierarchy:
//   botOwners    (top tier — Senku + Naruto are always in here)
//   botMods      (mid tier — operator-managed)
//   registered   (regular player, can do most things)
//   guest        (anyone not registered)
//
// db shape:
//   db.botOwners = [jid, jid, ...]      // super-tier (rare, sensitive commands)
//   db.botMods   = [jid, jid, ...]      // standard admin (most /admin/* commands)
// ═══════════════════════════════════════════════════════════════

'use strict';

const { OWNER_JID, COOWNER_JID, isPrivileged, stripDevice } = require('./constants');

/**
 * The two top-tier JIDs are always botOwners, regardless of what's in the DB.
 * This is enforced at every check, so a DB tampering can't demote them.
 */
function getBotOwners(db) {
  if (!db) db = {};
  if (!Array.isArray(db.botOwners)) db.botOwners = [];
  const builtIn = [OWNER_JID, COOWNER_JID].filter(Boolean);
  // Merge, dedupe, ensure built-in are always present
  const set = new Set(builtIn);
  for (const j of db.botOwners) set.add(stripDevice(j));
  return [...set];
}

function getBotMods(db) {
  if (!db) db = {};
  if (!Array.isArray(db.botMods)) db.botMods = [];
  const owners = new Set(getBotOwners(db));
  // Mods are botMods, minus anyone who's already an owner
  return db.botMods.map(stripDevice).filter(j => !owners.has(j));
}

/**
 * Tier check — returns one of: 'owner' | 'mod' | 'player' | 'guest'
 */
function getTier(db, jid) {
  if (!jid) return 'guest';
  const clean = stripDevice(jid);
  if (getBotOwners(db).includes(clean))  return 'owner';
  if (getBotMods(db).includes(clean))    return 'mod';
  // Registered player
  if (db?.users?.[clean])                return 'player';
  return 'guest';
}

function isBotOwner(db, jid) {
  return getTier(db, jid) === 'owner';
}
function isBotMod(db, jid) {
  const t = getTier(db, jid);
  return t === 'owner' || t === 'mod';   // owners are implicitly mods
}
function isRegistered(db, jid) {
  return !!db?.users?.[stripDevice(jid)];
}

/**
 * Higher-level helpers
 */
function canManageMods(db, jid)    { return isBotOwner(db, jid); }            // only owners can /set --mod
function canBan(db, jid)           { return isBotMod(db, jid); }              // any mod can /ban
function canMute(db, jid)          { return isBotMod(db, jid); }              // any mod can /mute
function canAccessDM(db, jid)      { return isBotMod(db, jid); }              // DM commands are mod-only
function canUseAdminCommand(db, jid) { return isBotMod(db, jid); }

module.exports = {
  getBotOwners,
  getBotMods,
  getTier,
  isBotOwner,
  isBotMod,
  isRegistered,
  canManageMods,
  canBan,
  canMute,
  canAccessDM,
  canUseAdminCommand,
};
