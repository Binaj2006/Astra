module.exports = {
  name: 'botid',
  aliases: [],
  category: 'rpg',
  description: 'Checks if the bot is admin in this group',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    const OWNER = '221951679328499@lid';
    const isBotAdmin = sender === OWNER || (db.botMods && db.botMods.includes(sender));
    if (!isBotAdmin) {
      return sock.sendMessage(chatId, { text: '❌ Only the bot owner or bot admins can use this command.' }, { quoted: msg });
    }

    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: '❌ Use this command in a group.' }, { quoted: msg });
    }

    try {
      const meta = await sock.groupMetadata(chatId);
      const currentSetting = meta.announce ? 'announcement' : 'not_announcement';
      await sock.groupSettingUpdate(chatId, currentSetting);
      return sock.sendMessage(chatId, { text: '✅ Bot is an admin in this group.' }, { quoted: msg });
    } catch (err) {
      return sock.sendMessage(chatId, { text: '❌ Bot is NOT an admin in this group.' }, { quoted: msg });
    }
  }
};
