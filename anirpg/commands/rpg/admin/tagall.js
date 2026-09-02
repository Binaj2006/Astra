module.exports = {
  name: 'tagall',
  description: '📢 Tag all members in group',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    
    const BOT_OWNER = '221951679328499@lid';
    
    if (!db.botMods) db.botMods = [BOT_OWNER];
    
    if (sender !== BOT_OWNER && !db.botMods.includes(sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ Only bot admins can use this command!'
      });
    }
    
    // Check if in group
    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, {
        text: '❌ This command only works in groups!'
      });
    }
    
    const message = args.join(' ') || 'Announcement';
    
    try {
      // Get group metadata
      const groupMetadata = await sock.groupMetadata(chatId);
      const participants = groupMetadata.participants.map(p => p.id);
      
      let text = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
📢 GROUP ANNOUNCEMENT 📢
━━━━━━━━━━━━━━━━━━━━━━━━━━━

${message}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 Tagging ${participants.length} members:
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      
      // Add mentions
      participants.forEach((id, i) => {
        text += `${i + 1}. @${id.split('@')[0]} `;
        if ((i + 1) % 5 === 0) text += '\n';
      });
      
      text += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━';
      
      await sock.sendMessage(chatId, {
        text: text,
        mentions: participants
      });
      
    } catch (error) {
      await sock.sendMessage(chatId, {
        text: '❌ Failed to tag members!\n\nMake sure bot has proper group permissions.'
      });
    }
  }
};