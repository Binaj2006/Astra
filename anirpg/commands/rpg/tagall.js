module.exports = {
  name: 'tagall',
  description: '📢  Tag all members in group',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    
    const BOT_OWNER = '221951679328499@lid';
    
    if (!db.botMods) db.botMods = [];
    
    const isAdmin = sender === BOT_OWNER || db.botMods.includes(sender);
    
    if (!isAdmin) {
      return sock.sendMessage(chatId, {
        text: '❌ Only bot admins can use this command!'
      }, { quoted: msg });
    }
    
    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, {
        text: '❌ This command only works in groups!'
      }, { quoted: msg });
    }
    
    const message = args.join(' ') || 'Announcement';

    try {
      const groupMetadata = await sock.groupMetadata(chatId);
      const participants = groupMetadata.participants.map(p => p.id);
      
      const text = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
📢 GROUP ANNOUNCEMENT 📢
━━━━━━━━━━━━━━━━━━━━━━━━━━━

${message}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
${BOT_OWNER}-chan
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      
      await sock.sendMessage(chatId, {
        text,
        mentions: participants // ✅ silent ping
      }, { quoted: msg });
      
    } catch (error) {
      await sock.sendMessage(chatId, {
        text: '❌ Failed to send announcement.\nMake sure the bot is an admin.'
      }, { quoted: msg });
    }
  }
};
