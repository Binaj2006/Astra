module.exports = {
  name: 'unban',
  description: '✅ Unban a user',
  
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
    
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const targetId = mentionedJid || quotedParticipant;
    
    if (!targetId) {
      return sock.sendMessage(chatId, {
        text: '❌ Tag a user or reply to unban!\n\nUsage: /unban @user'
      }, { quoted: msg });
    }
    
    if (!db.bannedUsers[targetId]) {
      return sock.sendMessage(chatId, {
        text: '❌ This user is not banned!'
      }, { quoted: msg });
    }
    
    delete db.bannedUsers[targetId];
    saveDatabase();
    
    await sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ USER UNBANNED ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 User: @${targetId.split('@')[0]}
👮 Unbanned by: @${sender.split('@')[0]}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
This user can now use the bot again.
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      mentions: [targetId, sender]
    }, { quoted: msg });
    
    try {
      await sock.sendMessage(targetId, {
        text: `✅ You have been unbanned!\n\nYou can now use bot commands again.`
      },{quoted:msg});
    } catch (e) {}
  }
};