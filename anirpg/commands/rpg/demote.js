module.exports = {
  name: 'demote',
  description: '📉 Remove admin status',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    
    const BOT_OWNER = '221951679328499@lid';
    const CO_OWNER = '194592469209292@lid';
    
    // ✅ FIX: Only owner can demote
    if (sender !== BOT_OWNER && sender !== CO_OWNER) {
      return sock.sendMessage(chatId, {
        text: '❌ Only the bot owner can demote admins!'
      }, { quoted: msg });
    }
    
    if (!db.botMods) db.botMods = [];
    
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const targetId = mentionedJid || quotedParticipant || (sender === CO_OWNER ? sender : null);
    
    if (!targetId) {
      return sock.sendMessage(chatId, {
        text: '❌ Tag a user or reply to demote!\n\nUsage: /demote @user'
      }, { quoted: msg });
    }
    
    if (targetId === BOT_OWNER) {
      return sock.sendMessage(chatId, {
        text: '❌ Cannot demote the bot owner!'
      }, { quoted: msg });
    }
    
    if (!db.botMods.includes(targetId)) {
      return sock.sendMessage(chatId, {
        text: '❌ This user is not a bot admin!'
      }, { quoted: msg });
    }
    
    db.botMods = db.botMods.filter(id => id !== targetId);
    saveDatabase();
    
    await sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
📉 ADMIN DEMOTED 📉
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 User: @${targetId.split('@')[0]}
⭐ New Role: Regular User
━━━━━━━━━━━━━━━━━━━━━━━━━━━
This user no longer has admin privileges.
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      mentions: [targetId]
    }, { quoted: msg });
    
    try {
      await sock.sendMessage(targetId, {
        text: '📉 You have been demoted from bot admin.\n\nYou no longer have admin privileges.'
      });
    } catch (e) {}
  }
};