module.exports = {
  name: 'unmute',
  description: '🔊 Unmute a user so they can use bot commands again',

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

    const mentionedJid =
      msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quotedParticipant =
      msg.message?.extendedTextMessage?.contextInfo?.participant;

    const targetId = mentionedJid || quotedParticipant;

    if (!targetId) {
      return sock.sendMessage(chatId, {
        text: `❌ Tag a user or reply to their message to unmute.

📌 Usage:
/unmute @user`
      }, { quoted: msg });
    }

    if (!db.mutedUsers || !db.mutedUsers[targetId]) {
      return sock.sendMessage(chatId, {
        text: `ℹ️ This user is not muted.`
      }, { quoted: msg });
    }

    delete db.mutedUsers[targetId];
    saveDatabase();

    await sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔊 USER UNMUTED 🔊
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 User: @${targetId.split('@')[0]}
👮 Unmuted by: @${sender.split('@')[0]}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      mentions: [targetId, sender]
    }, { quoted: msg });

    try {
      await sock.sendMessage(targetId, {
        text: '🔊 You have been unmuted. Be grateful u scum.'
      });
    } catch (e) {}
  }
};
