const TaxSystem = require('../../rpg/utils/TaxSystem');
const { updatePlayerGold } = require('../../rpg/utils/GoldManager');
const SEP = '━━━━━━━━━━━━━━━━━━━━━━━━━━━';

module.exports = {
  name: 'convert',
  description: 'Convert between Gold, Crystals, and Upgrade Points',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Not registered!' }, { quoted: msg });

    const action = args[0]?.toLowerCase();
    const amount = parseInt(args[1]);

    if (!action || !['gold','crystal','crystals','g','c','up','fromup'].includes(action)) {
      return sock.sendMessage(chatId, { text:
        SEP + '\n💱 CURRENCY EXCHANGE 💱\n' + SEP + '\n' +
        '💰 Gold: ' + (player.gold||0).toLocaleString() + '\n' +
        '💎 Crystals: ' + (player.manaCrystals||0) + '\n' +
        '⬆️ Upgrade Points: ' + (player.upgradePoints||0) + '\n' +
        SEP + '\n📊 RATES\n' + SEP + '\n' +
        '💎→🪙  1 Crystal = 10 Gold\n' +
        '🪙→💎  100 Gold = 1 Crystal\n' +
        '💎→⬆️  1000 Crystals = 1 UP\n' +
        '⬆️→💎  1 UP = 1000 Crystals\n' +
        SEP + '\n📌 /convert gold [n]    crystals→gold\n' +
        '📌 /convert crystal [n] gold→crystals\n' +
        '📌 /convert up [n]      crystals→UP\n' +
        '📌 /convert fromup [n]  UP→crystals\n' + SEP
      }, { quoted: msg });
    }

    if (action === 'gold' || action === 'g') {
      if (!amount||amount<=0) return sock.sendMessage(chatId,{text:'❌ Specify amount! e.g. /convert gold 100'},{quoted:msg});
      if ((player.manaCrystals||0)<amount) return sock.sendMessage(chatId,{text:'❌ Not enough crystals! Have: '+(player.manaCrystals||0)},{quoted:msg});
      const totalGold = amount*10;
      const taxAmount = TaxSystem.applyTax(db,totalGold,'gold',saveDatabase);
      const goldGained = totalGold-taxAmount;
      player.manaCrystals -= amount;
      updatePlayerGold(player,goldGained,saveDatabase);
      return sock.sendMessage(chatId,{text: SEP+'\n✅ Crystals → Gold\n'+SEP+'\n💎 Spent: '+amount+' Crystals\n🪙 Got: '+goldGained.toLocaleString()+' Gold (after 5% fee)\n💰 Gold: '+(player.gold||0).toLocaleString()+'\n💎 Crystals: '+(player.manaCrystals||0)+'\n'+SEP},{quoted:msg});
    }

    if (action === 'crystal' || action === 'crystals' || action === 'c') {
      if (!amount||amount<=0) return sock.sendMessage(chatId,{text:'❌ Specify amount! e.g. /convert crystal 500'},{quoted:msg});
      if (amount%100!==0) return sock.sendMessage(chatId,{text:'❌ Must be multiples of 100!'},{quoted:msg});
      if ((player.gold||0)<amount) return sock.sendMessage(chatId,{text:'❌ Not enough gold!'},{quoted:msg});
      const crystalsGained = Math.floor(amount/100);
      TaxSystem.applyTax(db,amount,'gold',saveDatabase);
      updatePlayerGold(player,-amount,saveDatabase);
      player.manaCrystals = (player.manaCrystals||0)+crystalsGained;
      saveDatabase();
      return sock.sendMessage(chatId,{text: SEP+'\n✅ Gold → Crystals\n'+SEP+'\n🪙 Spent: '+amount.toLocaleString()+' Gold\n💎 Got: '+crystalsGained+' Crystals\n💰 Gold: '+(player.gold||0).toLocaleString()+'\n💎 Crystals: '+(player.manaCrystals||0)+'\n'+SEP},{quoted:msg});
    }

    if (action === 'up') {
      if (!amount||amount<=0) return sock.sendMessage(chatId,{text:'❌ Specify crystals! e.g. /convert up 1000'},{quoted:msg});
      if (amount%1000!==0) return sock.sendMessage(chatId,{text:'❌ Must be multiples of 1000!'},{quoted:msg});
      if ((player.manaCrystals||0)<amount) return sock.sendMessage(chatId,{text:'❌ Not enough crystals!'},{quoted:msg});
      const upGained = Math.floor(amount/1000);
      player.manaCrystals -= amount;
      player.upgradePoints = (player.upgradePoints||0)+upGained;
      saveDatabase();
      return sock.sendMessage(chatId,{text: SEP+'\n✅ Crystals → UP\n'+SEP+'\n💎 Spent: '+amount+' Crystals\n⬆️ Got: '+upGained+' Upgrade Point'+(upGained>1?'s':'')+'\n💎 Crystals: '+player.manaCrystals+'\n⬆️ UP: '+player.upgradePoints+'\n'+SEP+'\n💡 Use /upgrade to spend UP!'},{quoted:msg});
    }

    if (action === 'fromup') {
      if (!amount||amount<=0) return sock.sendMessage(chatId,{text:'❌ Specify UP amount! e.g. /convert fromup 1'},{quoted:msg});
      if ((player.upgradePoints||0)<amount) return sock.sendMessage(chatId,{text:'❌ Not enough UP! Have: '+(player.upgradePoints||0)},{quoted:msg});
      const crystalsGained = amount*1000;
      player.upgradePoints -= amount;
      player.manaCrystals = (player.manaCrystals||0)+crystalsGained;
      saveDatabase();
      return sock.sendMessage(chatId,{text: SEP+'\n✅ UP → Crystals\n'+SEP+'\n⬆️ Spent: '+amount+' UP\n💎 Got: '+crystalsGained.toLocaleString()+' Crystals\n⬆️ UP: '+player.upgradePoints+'\n💎 Crystals: '+player.manaCrystals+'\n'+SEP},{quoted:msg});
    }

    return sock.sendMessage(chatId,{text:'❌ Invalid option! Use /convert to see menu.'},{quoted:msg});
  }
};
