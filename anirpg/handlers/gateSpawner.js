const GateManager = require('../rpg/dungeons/GateManager');

class GateSpawner {
  static activeTimers = {};
  
  // Initialize gate spawning for a chat
  static initialize(sock, chatId, getDatabase) {
    // Don't spawn if already spawning
    if (this.activeTimers[chatId]) return;
    
    // Schedule first gate
    this.scheduleNextGate(sock, chatId, getDatabase);
  }
  
  // Schedule next gate spawn
  static scheduleNextGate(sock, chatId, getDatabase) {
    const minInterval = GateManager.SPAWN_MIN_INTERVAL * 60 * 1000; // Convert to ms
    const maxInterval = GateManager.SPAWN_MAX_INTERVAL * 60 * 1000;
    
    const randomInterval = Math.floor(Math.random() * (maxInterval - minInterval) + minInterval);
    
    console.log(`[GATE] Next gate in ${Math.floor(randomInterval / 1000 / 60)} minutes for ${chatId}`);
    
    this.activeTimers[chatId] = setTimeout(() => {
      this.spawnGate(sock, chatId, getDatabase);
    }, randomInterval);
  }
  
  // Spawn a gate
  static async spawnGate(sock, chatId, getDatabase) {
    const db = getDatabase();
    
    // Calculate average level of active players in this chat
    const players = Object.values(db.users).filter(p => p.lastActive && Date.now() - p.lastActive < 86400000); // Active in last 24h
    const avgLevel = players.length > 0 ? Math.floor(players.reduce((sum, p) => sum + p.level, 0) / players.length) : 1;
    
    // Spawn gate
    const gate = GateManager.spawnGate(chatId, avgLevel);
    
    // Announce gate
    const announcement = GateManager.formatGateInfo(gate);
    
    try {
      await sock.sendMessage(chatId, { text: announcement });
      console.log(`[GATE] Spawned ${gate.rank}-rank gate ${gate.id} in ${chatId}`);
    } catch (error) {
      console.error('[GATE] Failed to announce gate:', error);
    }
    
    // Schedule next gate
    this.scheduleNextGate(sock, chatId, getDatabase);
  }
  
  // Stop spawning gates for a chat
  static stop(chatId) {
    if (this.activeTimers[chatId]) {
      clearTimeout(this.activeTimers[chatId]);
      delete this.activeTimers[chatId];
    }
  }
}

module.exports = GateSpawner;