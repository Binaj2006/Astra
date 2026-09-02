const BOT_OWNER_ID = '221951679328499@lid'; // ✅ YOUR ID HERE!

class TaxSystem {
  static TAX_RATE = 0.05; // 5% tax on gold purchases

  static applyTax(db, cost, currency, saveDatabase) {
    if (currency !== 'gold') return 0; // Only tax gold
    
    const taxAmount = Math.floor(cost * this.TAX_RATE);
    
    // Initialize bot owner
    if (!db.users[BOT_OWNER_ID]) {
      console.log('✅ [TAX] Bot owner account created:', BOT_OWNER_ID);
      db.users[BOT_OWNER_ID] = {
        userId: BOT_OWNER_ID,
        name: 'System Owner',
        gold: 0,
        manaCrystals: 0,
        inventory: {
          healthPotions: 0,
          energyPotions: 0,
          manaPotions: 0,
          reviveTokens: 0
        },
        systemAccount: true
      };
    }
    
    // Add tax to bot owner
    const oldGold = db.users[BOT_OWNER_ID].gold || 0;
    db.users[BOT_OWNER_ID].gold = oldGold + taxAmount;
    
    // Save if function provided
    if (saveDatabase) {
      saveDatabase();
    }
    
    console.log(`💰 [TAX] Collected ${taxAmount}g tax (5% of ${cost}g)`);
    console.log(`💰 [TAX] Owner balance: ${oldGold}g → ${db.users[BOT_OWNER_ID].gold}g`);
    
    return taxAmount;
  }

  static getTaxAmount(cost) {
    return Math.floor(cost * this.TAX_RATE);
  }

  static initialize(db, saveDatabase) {
    if (!db.users[BOT_OWNER_ID]) {
      console.log('🔧 [TAX] Initializing bot owner account...');
      db.users[BOT_OWNER_ID] = {
        userId: BOT_OWNER_ID,
        name: 'System Owner',
        gold: 0,
        manaCrystals: 0,
        inventory: {
          healthPotions: 0,
          energyPotions: 0,
          manaPotions: 0,
          reviveTokens: 0
        },
        systemAccount: true
      };
      saveDatabase();
      console.log('✅ [TAX] Bot owner account created');
    } else {
      console.log(`✅ [TAX] Bot owner balance: ${db.users[BOT_OWNER_ID].gold || 0}g`);
    }
  }

  static getBotOwnerBalance(db) {
    return db.users[BOT_OWNER_ID]?.gold || 0;
  }
}

module.exports = TaxSystem;
