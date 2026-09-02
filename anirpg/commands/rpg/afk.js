module.exports = {
  name: 'afk',
  description: '💤 Set AFK status',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!db.afkUsers) db.afkUsers = {};

    const reason = args.join(' ') || 'AFK';

    db.afkUsers[sender] = {
      reason,
      since: Date.now()
    };

    saveDatabase();

    return sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━
💤 YOU ARE NOW AFK HUNTER
━━━━━━━━━━━━━━━━━━━━━━
👤 @${sender.split('@')[0]}
📝 Reason: ${reason}
━━━━━━━━━━━━━━━━━━━━━━`,
      mentions: [sender]
    }, { quoted: msg });
  }
};
