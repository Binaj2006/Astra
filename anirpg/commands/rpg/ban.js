module.exports = {
  name: 'ban',
  description: '🚫 Ban a user from using the bot',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    
    const BOT_OWNER = '221951679328499@lid';
    
    if (!db.botMods) db.botMods = [];
    if (!db.bannedUsers) db.bannedUsers = {};
    
    // ✅ FIX: Check if sender is admin
    const isAdmin = sender === BOT_OWNER || db.botMods.includes(sender);
    
    if (!isAdmin) {
      return sock.sendMessage(chatId, {
        text: '❌ Only bot admins can use this command!'
      }, { quoted: msg });
    }
    
    // Get user to ban
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const targetId = mentionedJid || quotedParticipant;
    
    if (!targetId) {
      return sock.sendMessage(chatId, {
        text: `❌ Tag a user or reply to ban!

📌 Usage:
/ban @user [reason]
/ban @user spamming

Reply to their message:
/ban [reason]`
      }, { quoted: msg });
    }
    
    // Can't ban owner
    if (targetId === BOT_OWNER) {
      return sock.sendMessage(chatId, {
        text: '❌ Cannot ban the bot owner!'
      }, { quoted: msg });
    }
    
    // Can't ban admins
    if (db.botMods.includes(targetId)) {
      return sock.sendMessage(chatId, {
        text: '❌ Cannot ban another admin!'
      }, { quoted: msg });
    }
    
    // Can't ban yourself
    if (targetId === sender) {
      return sock.sendMessage(chatId, {
        text: '❌ You cannot ban yourself!'
      }, { quoted: msg });
    }
    
    const reason = args.slice(1).join(' ') || 'No reason provided';
    const targetUser = db.users[targetId];
    const targetName = targetUser?.name || targetId.split('@')[0];
    
    // Ban user
    db.bannedUsers[targetId] = {
      bannedBy: sender,
      bannedAt: Date.now(),
      reason: reason
    };
    
    saveDatabase();
    
    await sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 USER BANNED 🚫
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 User: @${targetId.split('@')[0]}
📝 Reason: ${reason}
👮 Banned by: @${sender.split('@')[0]}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
This user can no longer use the bot.
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      mentions: [targetId, sender]
    }, { quoted: msg });
    
    // Notify banned user
    try {
      await sock.sendMessage(targetId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 YOU HAVE BEEN BANNED 🚫
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 Reason: ${reason}
👮 Banned by: Admin
━━━━━━━━━━━━━━━━━━━━━━━━━━━
You can no longer use bot commands.
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      });
    } catch (e) {
      console.log('Could not notify banned user');
    }
  }
};