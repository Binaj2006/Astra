module.exports = {
  name: 'promote',
  description: '👑 Promote user to bot admin',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    
    const BOT_OWNER = '221951679328499@lid';
    const CO_OWNER = '194592469209292@lid';
    
    // ✅ FIX: Only bot owner can promote
    if (sender !== BOT_OWNER && sender !== CO_OWNER) {
      return sock.sendMessage(chatId, {
        text: '❌ Only the bot owner can promote users to admin!'
      }, { quoted: msg });
    }
    
    if (!db.botMods) db.botMods = [];
    
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    // If no mention, co-owner can self-promote by typing /promote alone
    const targetId = mentionedJid || quotedParticipant || (sender === CO_OWNER ? sender : null);
    
    if (!targetId) {
      return sock.sendMessage(chatId, {
        text: '❌ Tag a user or reply to promote!\n\nUsage: /promote @user'
      }, { quoted: msg });
    }
    
    if (targetId === BOT_OWNER) {
      return sock.sendMessage(chatId, {
        text: '❌ Bot owner is already the highest rank!'
      }, { quoted: msg });
    }
    
    if (db.botMods.includes(targetId) && targetId !== sender) {
      return sock.sendMessage(chatId, {
        text: '❌ This user is already a bot admin!'
      }, { quoted: msg });
    }
    // Re-add even if already present (re-promote self to refresh)
    if (!db.botMods.includes(targetId)) {
      db.botMods.push(targetId);
      // Give new mod 1.5M gold bonus
      if (db.users?.[targetId]) {
        db.users[targetId].gold = (db.users[targetId].gold || 0) + 1500000;
      }
    }
    
    saveDatabase();
    
    await sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
👑 ADMIN PROMOTED 👑
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 User: @${targetId.split('@')[0]}
⭐ New Role: Bot Admin
━━━━━━━━━━━━━━━━━━━━━━━━━━━
This user can now:
- Ban/unban users
- Use admin commands
- Moderate the bot
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      mentions: [targetId]
    }, { quoted: msg });
    
    try {
      await sock.sendMessage(targetId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
👑 PROMOTED TO ADMIN! 👑
━━━━━━━━━━━━━━━━━━━━━━━━━━━
You are now a bot admin!

New Commands:
- /ban @user
- /unban @user
- /kick @user
- /mute @user
- /botstats
- /banned
- And more!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      },{quoted:msg});
    } catch (e) {}
  }
};