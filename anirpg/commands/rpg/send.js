const { updatePlayerGold } = require('../../rpg/utils/GoldManager');
const { logTransaction } = require('../../rpg/utils/TransactionLog');
const DC = require('../../rpg/utils/DailyChallenges');
const { COOWNER_JID } = require('../../utils/constants');

module.exports = {
  name: 'send',
  description: 'Send gold or crystals to another hunter',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      await sock.sendMessage(chatId, { 
        text: '❌ You are not registered!' 
      });
      return;
    }

    const action = args[0]?.toLowerCase();

    if (!action) {
      const menu = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💸 SEND SYSTEM 💸
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Send resources to other hunters!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Your Gold: ${player.gold || 0}
💎 Your Crystals: ${player.manaCrystals}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 USAGE
/send gold @user [amount]
/send crystals @user [amount]

Example:
Reply to someone's message and type:
/send gold 1000

Or mention them:
/send gold @user 1000
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📜 RULES
- Min amount: 1000
- Max amount: 5,000000 per send
- 5% transaction fee
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      await sock.sendMessage(chatId, { text: menu });
      return;
    }

    if (action === 'gold' || action === 'crystals') {
      let recipientId = null;
      
      const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
      
      recipientId = mentionedJid || quotedParticipant;
      
      if (!recipientId) {
        await sock.sendMessage(chatId, {
          text: `❌ Please tag a user or reply to their message!

💡 Methods:
1. Reply to their message then type /send ${action} [amount]
2. Type: /send ${action} @username [amount]`
        });
        return;
      }

      const recipient = db.users[recipientId];

      if (!recipient) {
        await sock.sendMessage(chatId, { 
          text: '❌ That hunter is not registered!' 
        });
        return;
      }

      if (recipientId === sender) {
        await sock.sendMessage(chatId, { 
          text: '❌ You cannot send to yourself!' 
        });
        return;
      }

      let amount = parseInt(args[1]);
      if (isNaN(amount) || !amount) {
        amount = parseInt(args[2]);
      }

      if (isNaN(amount) || amount < 1000) {
        await sock.sendMessage(chatId, {
          text: '❌ Invalid amount!\n\nMinimum: 1000\nExample: /send gold @user 1000'
        });
        return;
      }

      if (amount > 5000000) {
        await sock.sendMessage(chatId, {
          text: '❌ Maximum 5000000 per send!'
        });
        return;
      }

      // ✅ NEW: 5% Transaction Fee
      const fee = Math.floor(amount * 0.05);
      const amountAfterFee = amount - fee;
      const BOT_OWNER_ID = COOWNER_JID;

      if (action === 'gold') {
        const senderGold = player.gold || 0;
        
        if (senderGold < amount) {
          await sock.sendMessage(chatId, {
            text: `❌ Not enough gold!\n\nNeed: ${amount} 🪙 (+ ${fee} fee)\nHave: ${senderGold} 🪙`
          });
          return;
        }

        // Transfer gold
        player.gold = senderGold - amount;
        recipient.gold = (recipient.gold || 0) + amountAfterFee;
        
        // Sync inventory
        if (player.inventory) player.inventory.gold = player.gold;
        if (recipient.inventory) recipient.inventory.gold = recipient.gold;

        // Log transaction for both parties
        logTransaction(player, { type:'send', amount, currency:'🪙', note:`→ ${recipient.name}` });
        DC.trackProgress(player, 'send_gold', 1);
        try{require('./weekly').trackWeeklyProgress(player,'earn_gold',amount);}catch(e){}
        logTransaction(recipient, { type:'receive', amount:amountAfterFee, currency:'🪙', note:`← ${player.name}` });

        // ✅ FEE GOES TO YOU!
        if (!db.users[BOT_OWNER_ID]) {
          db.users[BOT_OWNER_ID] = {
            id: BOT_OWNER_ID,
            name: 'System',
            gold: fee,
            manaCrystals: 0,
            inventory: { gold: fee }
          };
        } else {
          db.users[BOT_OWNER_ID].gold = (db.users[BOT_OWNER_ID].gold || 0) + fee;
          if (db.users[BOT_OWNER_ID].inventory) {
            db.users[BOT_OWNER_ID].inventory.gold = db.users[BOT_OWNER_ID].gold;
          }
        }

        saveDatabase();

        await sock.sendMessage(chatId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ GOLD SENT! ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Amount: ${amount} 🪙
💸 Transaction Fee: ${fee} 🪙 (5%)
💰 Recipient Gets: ${amountAfterFee} 🪙
👤 To: @${recipientId.split('@')[0]}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Your Gold Left: ${player.gold}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          mentions: [recipientId]
        });

        await sock.sendMessage(recipientId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 GOLD RECEIVED! 💰
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Received: ${amountAfterFee} 🪙
💸 (${amount} - ${fee} fee)
👤 From: @${sender.split('@')[0]}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Your Gold Now: ${recipient.gold}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          mentions: [sender]
        });
      } 
      else if (action === 'crystals') {
        if (player.manaCrystals < amount) {
          await sock.sendMessage(chatId, {
            text: `❌ Not enough crystals!\n\nNeed: ${amount} 💎 (+ ${fee} fee)\nHave: ${player.manaCrystals} 💎`
          });
          return;
        }

        // Transfer crystals
        player.manaCrystals -= amount;
        recipient.manaCrystals += amountAfterFee;

        // ✅ FEE GOES TO YOU (converted to gold)!
        const goldFee = fee * 2; // 1 crystal = 2 gold
        
        if (!db.users[BOT_OWNER_ID]) {
          db.users[BOT_OWNER_ID] = {
            id: BOT_OWNER_ID,
            name: 'System',
            gold: goldFee,
            manaCrystals: 0,
            inventory: { gold: goldFee }
          };
        } else {
          db.users[BOT_OWNER_ID].gold = (db.users[BOT_OWNER_ID].gold || 0) + goldFee;
          if (db.users[BOT_OWNER_ID].inventory) {
            db.users[BOT_OWNER_ID].inventory.gold = db.users[BOT_OWNER_ID].gold;
          }
        }

        saveDatabase();

        await sock.sendMessage(chatId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ CRYSTALS SENT! ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 Amount: ${amount} 💎
💸 Transaction Fee: ${fee} 💎 (5%)
💎 Recipient Gets: ${amountAfterFee} 💎
👤 To: @${recipientId.split('@')[0]}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 Your Crystals Left: ${player.manaCrystals}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          mentions: [recipientId]
        });

        await sock.sendMessage(recipientId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 CRYSTALS RECEIVED! 💎
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 Received: ${amountAfterFee} 💎
💸 (${amount} - ${fee} fee)
👤 From: @${sender.split('@')[0]}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 Your Crystals Now: ${recipient.manaCrystals}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          mentions: [sender]
        });
      }
      return;
    }

    await sock.sendMessage(chatId, {
      text: '❌ Invalid!\n\nUse: /send gold or /send crystals'
    });
  }
};