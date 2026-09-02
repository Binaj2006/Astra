module.exports = {
  name: 'mute',
  description: '🔇 Mute user from using bot commands',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    
    const BOT_OWNER = '221951679328499@lid';
    
    if (!db.botMods) db.botMods = [];
    
    // ✅ FIX: Check if sender is admin
    const isAdmin = sender === BOT_OWNER || db.botMods.includes(sender);
    
    if (!isAdmin) {
      return sock.sendMessage(chatId, {
        text: '❌ Only bot admins can use this command!'
      }, { quoted: msg });
    }
    
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const targetId = mentionedJid || quotedParticipant;
    
    if (!targetId) {
      return sock.sendMessage(chatId, {
        text: `❌ Tag a user or reply to mute!

📌 Usage:
/mute @user [minutes]

Example:
/mute @user 60 (mute for 60 minutes)
/mute @user (mute indefinitely)`
      }, { quoted: msg });
    }
    
    if (targetId === BOT_OWNER) {
      return sock.sendMessage(chatId, {
        text: '❌ Cannot mute the bot owner!'
      }, { quoted: msg });
    }
    
    if (db.botMods.includes(targetId)) {
      return sock.sendMessage(chatId, {
        text: '❌ Cannot mute another admin!'
      }, { quoted: msg });
    }
    
    const duration = parseInt(args[1]) || 0;
    const durationText = duration > 0 ? `${duration} minutes` : 'until unmuted';
    
    // Store mute info
    if (!db.mutedUsers) db.mutedUsers = {};
    
    db.mutedUsers[targetId] = {
      mutedBy: sender,
      mutedAt: Date.now(),
      duration: duration * 60 * 1000,
      endsAt: duration > 0 ? Date.now() + (duration * 60 * 1000) : null
    };
    
    saveDatabase();
    
    await sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔇 USER MUTED 🔇
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 User: @${targetId.split('@')[0]}
⏰ Duration: ${durationText}
👮 Muted by: @${sender.split('@')[0]}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
This user cannot use bot commands.
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      mentions: [targetId, sender]
    }, { quoted: msg });
    
    try {
      await sock.sendMessage(targetId, {
        text: `🔇 You have been muted from using bot commands.\n\nDuration: ${durationText}`
      });
    } catch (e) {}
  }
};