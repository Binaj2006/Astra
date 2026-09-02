module.exports = {
  name: 'kick',
  description: '👢 Kick user from group',
  
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
    
    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, {
        text: '❌ This command only works in groups!'
      });
    }
    
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const targetId = mentionedJid || quotedParticipant;
    
    if (!targetId) {
      return sock.sendMessage(chatId, {
        text: '❌ Tag a user or reply to kick!\n\nUsage: /kick @user'
      });
    }
    
    if (targetId === BOT_OWNER) {
      return sock.sendMessage(chatId, {
        text: '❌ Cannot kick the bot owner!'
      });
    }
    
    try {
      await sock.groupParticipantsUpdate(chatId, [targetId], 'remove');
      
      await sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
👢 USER KICKED 👢
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 User: @${targetId.split('@')[0]}
👮 Kicked by: @${sender.split('@')[0]}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        mentions: [targetId, sender]
      });
      
    } catch (error) {
      await sock.sendMessage(chatId, {
        text: '❌ Failed to kick user!\n\nMake sure bot is admin in this group.'
      });
    }
  }
};