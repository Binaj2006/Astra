module.exports = {
  name: 'bug',
  description: '🐞 Report a bug',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const config = require('../../config.json');
    const ownerId = config.ownerNumber;

    if (!args.length) {
      await sock.sendMessage(chatId, {
        text: '❌ Please describe the bug.\nExample:\n/bug Dungeon crashes on skill use'
      });
      return;
    }

    const report = args.join(' ');

    await sock.sendMessage(chatId, {
      text: '✅ Bug report sent to the developer. Thank you!'
    });

    await sock.sendMessage(ownerId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━
🐞 BUG REPORT
━━━━━━━━━━━━━━━━━━━━━━━
👤 User: @${sender.split('@')[0]}
📍 Group: ${chatId}
📝 Bug:
${report}
━━━━━━━━━━━━━━━━━━━━━━━`,
      mentions: [sender]
    });

    console.log(`[BUG] Report from ${sender}: ${report}`);
  }
};
