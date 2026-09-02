module.exports = {
  name: 'broadcast',
  description: '📣 Send message to all bot users',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    
    // ✅ Allowed broadcasters
    const ALLOWED_USERS = [
      '221951679328499@lid',      // Bot Owner
      '194592469209292@lid'       // Second allowed user
    ];
    
    // ✅ Only allowed users can broadcast
    if (!ALLOWED_USERS.includes(sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ Only the bot owner can broadcast messages!'
      }, { quoted: msg });
    }
    
    const message = args.join(' ');
    
    if (!message) {
      return sock.sendMessage(chatId, {
        text: `❌ Please provide a message!

📌 Usage:
/broadcast [message]

Example:
/broadcast New features added! Check /help`
      }, { quoted: msg });
    }
    
    if (!Array.isArray(db.subscribers)) db.subscribers = Object.values(db.subscribers || {}).filter(v => typeof v === 'string');
    const allUsers = db.subscribers || [];
    
    if (allUsers.length === 0) {
      return sock.sendMessage(chatId, {
        text: '❌ No registered users to broadcast to!'
      }, { quoted: msg });
    }
    
    await sock.sendMessage(chatId, {
      text: `📣 Broadcasting to ${allUsers.length} users...\n\nThis may take a moment.`
    }, { quoted: msg });
    
    let successCount = 0;
    let failCount = 0;
    
    const broadcastMessage = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
📣 BOT ANNOUNCEMENT 📣
━━━━━━━━━━━━━━━━━━━━━━━━━━━

${message}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is an official broadcast from Ani R.P.G.
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    
    for (const userId of allUsers) {
      try {
        await sock.sendMessage(userId, {
          text: broadcastMessage
        });
        successCount++;
        
        // Small delay to avoid spam
        await new Promise(resolve => setTimeout(resolve, 2500));
        
      } catch (error) {
        failCount++;
      }
    }
    
    await sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ BROADCAST COMPLETE ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Sent: ${successCount}
❌ Failed: ${failCount}
📊 Total: ${allUsers.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    }, { quoted: msg });
  }
};