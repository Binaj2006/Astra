module.exports = {
  name: 'banned',
  description: '🚫 List all banned users',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    
    const BOT_OWNER = '221951679328499@lid';
    
    if (!db.botMods) db.botMods = [BOT_OWNER];
    if (!db.bannedUsers) db.bannedUsers = {};
    
    if (sender !== BOT_OWNER && !db.botMods.includes(sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ Only bot admins can view banned users!'
      });
    }
    
    const bannedList = Object.keys(db.bannedUsers);
    
    if (bannedList.length === 0) {
      return sock.sendMessage(chatId, {
        text: '✅ No banned users!'
      });
    }
    
    let text = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 BANNED USERS 🚫
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Banned: ${bannedList.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    bannedList.forEach((userId, i) => {
      const banInfo = db.bannedUsers[userId];
      const userName = db.users[userId]?.name || userId.split('@')[0];
      const reason = banInfo.reason || 'No reason';
      const date = new Date(banInfo.bannedAt).toLocaleDateString();
      
      text += `${i + 1}. ${userName}\n`;
      text += `   @${userId.split('@')[0]}\n`;
      text += `   📝 Reason: ${reason}\n`;
      text += `   📅 Date: ${date}\n\n`;
    });
    
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\nUse /unban @user to unban`;
    
    await sock.sendMessage(chatId, {
      text: text,
      mentions: bannedList
    });
  }
};