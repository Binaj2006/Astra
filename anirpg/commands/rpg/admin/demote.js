module.exports = {
  name: 'demote',
  description: '📉 Remove admin status',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    
    const BOT_OWNER = '221951679328499@lid';
    
    if (sender !== BOT_OWNER) {
      return sock.sendMessage(chatId, {
        text: '❌ Only the bot owner can demote admins!'
      });
    }
    
    if (!db.botMods) db.botMods = [BOT_OWNER];
    
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const targetId = mentionedJid || quotedParticipant;
    
    if (!targetId) {
      return sock.sendMessage(chatId, {
        text: '❌ Tag a user or reply to demote!\n\nUsage: /demote @user'
      });
    }
    
    if (targetId === BOT_OWNER) {
      return sock.sendMessage(chatId, {
        text: '❌ Cannot demote the bot owner!'
      });
    }
    
    if (!db.botMods.includes(targetId)) {
      return sock.sendMessage(chatId, {
        text: '❌ This user is not a bot admin!'
      });
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
    });
    
    try {
      await sock.sendMessage(targetId, {
        text: '📉 You have been demoted from bot admin.\n\nYou no longer have admin privileges.'
      });
    } catch (e) {}
  }
};