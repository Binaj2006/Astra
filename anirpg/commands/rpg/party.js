const monsterTemplates = require('../../rpg/monsters/MonsterTemplates');
const LevelUpManager = require('../../rpg/utils/LevelUpManager');
const ImprovedCombat = require('../../rpg/utils/ImprovedCombat');

module.exports = {
  name: 'party',
  description: '🎉 Pokemon-style party dungeons',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, { text: '❌ You are not registered!' });
    }

    if (!db.partyDungeons) db.partyDungeons = {};

    const action = args[0]?.toLowerCase();

    // ═══════════════════════════════════════════════════════════════
    // PARTY MENU
    // ═══════════════════════════════════════════════════════════════
    if (!action) {
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 PARTY DUNGEON SYSTEM 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Clear dungeons with friends!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
/party create - Create party (2-4 players)
/party join - Join active party
/party start - Start dungeon run
/party attack - Basic attack
/party skills - View your skills
/party use [#] - Use skill by number
/party items - View items
/party item [#] - Use item
/party leave - Leave party
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 Complete floors for rewards!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // CREATE PARTY
    // ═══════════════════════════════════════════════════════════════
    if (action === 'create') {
      if (db.partyDungeons[chatId]) {
        return sock.sendMessage(chatId, {
          text: '❌ A party already exists in this chat!'
        });
      }

      db.partyDungeons[chatId] = {
        leader: sender,
        members: {
          [sender]: {
            name: player.name,
            level: player.level,
            hp: player.stats.maxHp,
            energy: player.stats.maxEnergy
          }
        },
        status: 'recruiting', // recruiting, active
        floor: 0,
        createdAt: Date.now()
      };

      saveDatabase();

      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 PARTY CREATED! 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👑 Leader: ${player.name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 MEMBERS (1/4)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
1️⃣ ${player.name} (Lv.${player.level})
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚔️ Join with /party join
🚀 Start with /party start (2+ players)
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // JOIN PARTY
    // ═══════════════════════════════════════════════════════════════
    if (action === 'join') {
      const party = db.partyDungeons[chatId];

      if (!party) {
        return sock.sendMessage(chatId, {
          text: '❌ No party in this chat!\n\nUse /party create to start one.'
        });
      }

      if (party.status !== 'recruiting') {
        return sock.sendMessage(chatId, {
          text: '❌ Party is already in dungeon!'
        });
      }

      if (party.members[sender]) {
        return sock.sendMessage(chatId, {
          text: '❌ You already joined this party!'
        });
      }

      if (Object.keys(party.members).length >= 4) {
        return sock.sendMessage(chatId, {
          text: '❌ Party is full! (Max 4 players)'
        });
      }

      party.members[sender] = {
        name: player.name,
        level: player.level,
        hp: player.stats.maxHp,
        energy: player.stats.maxEnergy
      };

      saveDatabase();

      const memberList = Object.entries(party.members)
        .map(([id, m], i) => `${i + 1}️⃣ ${m.name} (Lv.${m.level})`)
        .join('\n');

      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ ${player.name} JOINED THE PARTY!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 MEMBERS (${Object.keys(party.members).length}/4)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${memberList}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${Object.keys(party.members).length >= 2 ? '🚀 Ready! Leader can /party start' : '⏰ Need 2+ players to start'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      });
    }

    // Get party
    const party = db.partyDungeons[chatId];

    if (!party) {
      return sock.sendMessage(chatId, {
        text: '❌ No party!\n\nUse /party create or /party join'
      });
    }

    if (!party.members[sender]) {
      return sock.sendMessage(chatId, {
        text: '❌ You are not in this party!\n\nUse /party join to participate.'
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // START DUNGEON
    // ═══════════════════════════════════════════════════════════════
    if (action === 'start') {
      if (party.leader !== sender) {
        return sock.sendMessage(chatId, {
          text: '❌ Only the party leader can start!'
        });
      }

      if (Object.keys(party.members).length < 2) {
        return sock.sendMessage(chatId, {
          text: '❌ Need at least 2 players to start!'
        });
      }

      if (party.status === 'active') {
        return sock.sendMessage(chatId, {
          text: '❌ Party is already in a dungeon!'
        });
      }

      // Generate first floor monster
      const avgLevel = Math.floor(
        Object.values(party.members).reduce((sum, m) => sum + m.level, 0) / Object.keys(party.members).length
      );

      const monster = monsterTemplates.generateMonster(avgLevel + 2);

      party.status = 'active';
      party.floor = 1;
      party.currentMonster = monster;
      party.monsterHP = monster.maxHp;

      saveDatabase();

      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏰 DUNGEON STARTED! 🏰
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Floor: ${party.floor}
👹 ${monster.name} (Lv.${monster.level})
❤️ HP: ${party.monsterHP}/${monster.maxHp}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚔️ Everyone can attack now!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      });
    }

    if (party.status !== 'active') {
      return sock.sendMessage(chatId, {
        text: '❌ Dungeon not started!\n\nLeader must use /party start'
      });
    }

    const memberData = party.members[sender];
    const monster = party.currentMonster;

    // ═══════════════════════════════════════════════════════════════
    // PARTY ATTACK
    // ═══════════════════════════════════════════════════════════════
    if (action === 'attack') {
      if (memberData.hp <= 0) {
        return sock.sendMessage(chatId, {
          text: '❌ You are defeated! Wait for floor to clear.'
        });
      }

      const weaponBonus = player.weapon?.bonus || 0;
      let damage = Math.max(1, (player.stats.atk + weaponBonus) - Math.floor(monster.def / 2));

      const isCrit = Math.random() < 0.1;
      if (isCrit) damage = Math.floor(damage * 2);

      party.monsterHP -= damage;

      let narrative = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      narrative += `⚔️ ${player.name} attacked!\n`;
      if (isCrit) narrative += `💥 CRITICAL HIT!\n`;
      narrative += `💥 Dealt ${damage} damage to ${monster.name}!\n`;
      narrative += `👹 ${monster.name}: ❤️ ${Math.max(0, party.monsterHP)}/${monster.maxHp}\n`;
      narrative += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

      // Check if monster defeated
      if (party.monsterHP <= 0) {
        party.floor += 1;

        // Restore some HP/Energy
        for (const [id, m] of Object.entries(party.members)) {
          const p = db.users[id];
          if (p && m.hp > 0) {
            m.hp = Math.min(m.hp + Math.floor(p.stats.maxHp * 0.3), p.stats.maxHp);
            m.energy = Math.min(m.energy + Math.floor(p.stats.maxEnergy * 0.3), p.stats.maxEnergy);
          }
        }

        narrative += `\n✅ FLOOR ${party.floor - 1} CLEARED!\n\n`;
        narrative += `💚 All members restored 30% HP & Energy!\n`;

        // Check if reached floor 10 (dungeon complete)
        if (party.floor > 10) {
          narrative += `\n🎉 DUNGEON COMPLETE! 🎉\n\n`;
          narrative += `🎁 REWARDS FOR ALL:\n`;
          narrative += `✨ XP: +1000\n`;
          narrative += `💎 Crystals: +100\n`;
          narrative += `🪙 Gold: +500\n`;

          for (const memberId of Object.keys(party.members)) {
            const p = db.users[memberId];
            if (p) {
              p.xp += 1000;
              p.manaCrystals += 100;
              p.gold = (p.gold || 0) + 500;
              LevelUpManager.checkAndApplyLevelUps(p, saveDatabase, sock, chatId);
            }
          }

          delete db.partyDungeons[chatId];
          saveDatabase();

          return sock.sendMessage(chatId, { text: narrative });
        }

        // Generate next monster
        const avgLevel = Math.floor(
          Object.values(party.members).reduce((sum, m) => sum + m.level, 0) / Object.keys(party.members).length
        );

        const nextMonster = monsterTemplates.generateMonster(avgLevel + party.floor);
        party.currentMonster = nextMonster;
        party.monsterHP = nextMonster.maxHp;

        narrative += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        narrative += `📍 FLOOR ${party.floor}\n`;
        narrative += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        narrative += `👹 ${nextMonster.name} (Lv.${nextMonster.level})\n`;
        narrative += `❤️ HP: ${party.monsterHP}/${nextMonster.maxHp}\n`;
        narrative += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

        saveDatabase();
        return sock.sendMessage(chatId, { text: narrative });
      }

      // Monster counter-attack (random member)
      const aliveMembers = Object.entries(party.members).filter(([id, m]) => m.hp > 0);
      
      if (aliveMembers.length === 0) {
        narrative += `\n💀 ALL MEMBERS DEFEATED!\n\n`;
        narrative += `❌ Party wiped on Floor ${party.floor}`;

        delete db.partyDungeons[chatId];
        saveDatabase();

        return sock.sendMessage(chatId, { text: narrative });
      }

      const [targetId, targetMember] = aliveMembers[Math.floor(Math.random() * aliveMembers.length)];
      const targetPlayer = db.users[targetId];

      let monsterDamage = Math.max(1, monster.atk - Math.floor(targetPlayer.stats.def / 2));

      const monsterCrit = Math.random() < 0.1;
      if (monsterCrit) {
        monsterDamage = Math.floor(monsterDamage * 2);
        narrative += `\n💥 ${monster.name} CRITICAL HIT!\n`;
      } else {
        narrative += `\n👹 ${monster.name} attacked!\n`;
      }

      targetMember.hp -= monsterDamage;
      narrative += `💥 ${targetMember.name} took ${monsterDamage} damage!\n`;
      narrative += `👤 ${targetMember.name}: ❤️ ${Math.max(0, targetMember.hp)}/${targetPlayer.stats.maxHp}\n`;

      if (targetMember.hp <= 0) {
        narrative += `💀 ${targetMember.name} was defeated!\n`;
      }

      saveDatabase();
      return sock.sendMessage(chatId, { text: narrative });
    }

    // ═══════════════════════════════════════════════════════════════
    // PARTY SKILLS MENU
    // ═══════════════════════════════════════════════════════════════
    if (action === 'skills') {
      const menu = ImprovedCombat.getSkillsMenu(player);
      return sock.sendMessage(chatId, { text: menu });
    }

    // ═══════════════════════════════════════════════════════════════
    // PARTY USE SKILL
    // ═══════════════════════════════════════════════════════════════
    if (action === 'use') {
      if (memberData.hp <= 0) {
        return sock.sendMessage(chatId, {
          text: '❌ You are defeated! Wait for floor to clear.'
        });
      }

      const skillNum = parseInt(args[1]);

      if (!skillNum || skillNum < 1 || !player.skills?.active) {
        return sock.sendMessage(chatId, {
          text: '❌ Invalid skill number!\n\nUse /party skills to see your skills.'
        });
      }

      const skill = player.skills.active[skillNum - 1];

      if (!skill) {
        return sock.sendMessage(chatId, {
          text: `❌ Skill ${skillNum} not found!`
        });
      }

      // Check cooldown
      const cooldownCheck = ImprovedCombat.checkCooldown(player, skill.name);
      if (!cooldownCheck.ready) {
        return sock.sendMessage(chatId, { text: cooldownCheck.message });
      }

      // Check energy
      if (memberData.energy < skill.energyCost) {
        return sock.sendMessage(chatId, {
          text: `❌ Not enough ${player.energyType}!\nNeed: ${skill.energyCost}\nHave: ${memberData.energy}`
        });
      }

      // Use skill
      memberData.energy -= skill.energyCost;
      player.lastSkillUse[skill.name] = Date.now();

      const weaponBonus = player.weapon?.bonus || 0;
      let damage = Math.max(1, (skill.damage + weaponBonus) - Math.floor(monster.def / 2));

      const isCrit = Math.random() < 0.15;
      if (isCrit) damage = Math.floor(damage * 2);

      party.monsterHP -= damage;

      let narrative = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      narrative += `✨ ${player.name} used ${skill.name}!\n`;
      if (isCrit) narrative += `💥 CRITICAL HIT!\n`;
      narrative += `💥 Dealt ${damage} damage to ${monster.name}!\n`;
      narrative += `💙 ${player.energyType}: ${memberData.energy}/${player.stats.maxEnergy}\n`;
      narrative += `👹 ${monster.name}: ❤️ ${Math.max(0, party.monsterHP)}/${monster.maxHp}\n`;
      narrative += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

      // Check if monster defeated
      if (party.monsterHP <= 0) {
        party.floor += 1;

        for (const [id, m] of Object.entries(party.members)) {
          const p = db.users[id];
          if (p && m.hp > 0) {
            m.hp = Math.min(m.hp + Math.floor(p.stats.maxHp * 0.3), p.stats.maxHp);
            m.energy = Math.min(m.energy + Math.floor(p.stats.maxEnergy * 0.3), p.stats.maxEnergy);
          }
        }

        narrative += `\n✅ FLOOR ${party.floor - 1} CLEARED!\n\n`;
        narrative += `💚 All members restored 30% HP & Energy!\n`;

        if (party.floor > 10) {
          narrative += `\n🎉 DUNGEON COMPLETE! 🎉\n\n`;
          narrative += `🎁 REWARDS FOR ALL:\n`;
          narrative += `✨ XP: +1000\n`;
          narrative += `💎 Crystals: +100\n`;
          narrative += `🪙 Gold: +500\n`;

          for (const memberId of Object.keys(party.members)) {
            const p = db.users[memberId];
            if (p) {
              p.xp += 1000;
              p.manaCrystals += 100;
              p.gold = (p.gold || 0) + 500;
              LevelUpManager.checkAndApplyLevelUps(p, saveDatabase, sock, chatId);
            }
          }

          delete db.partyDungeons[chatId];
          saveDatabase();

          return sock.sendMessage(chatId, { text: narrative });
        }

        const avgLevel = Math.floor(
          Object.values(party.members).reduce((sum, m) => sum + m.level, 0) / Object.keys(party.members).length
        );

        const nextMonster = monsterTemplates.generateMonster(avgLevel + party.floor);
        party.currentMonster = nextMonster;
        party.monsterHP = nextMonster.maxHp;

        narrative += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        narrative += `📍 FLOOR ${party.floor}\n`;
        narrative += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        narrative += `👹 ${nextMonster.name} (Lv.${nextMonster.level})\n`;
        narrative += `❤️ HP: ${party.monsterHP}/${nextMonster.maxHp}\n`;
        narrative += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

        saveDatabase();
        return sock.sendMessage(chatId, { text: narrative });
      }

      saveDatabase();
      return sock.sendMessage(chatId, { text: narrative });
    }

    // ═══════════════════════════════════════════════════════════════
    // PARTY LEAVE
    // ═══════════════════════════════════════════════════════════════
    if (action === 'leave') {
      delete party.members[sender];

      if (Object.keys(party.members).length === 0) {
        delete db.partyDungeons[chatId];
        saveDatabase();
        return sock.sendMessage(chatId, {
          text: '❌ Party disbanded! (No members remaining)'
        });
      }

      // If leader left, assign new leader
      if (party.leader === sender) {
        party.leader = Object.keys(party.members)[0];
        const newLeader = db.users[party.leader];
        
        saveDatabase();
        return sock.sendMessage(chatId, {
          text: `✅ ${player.name} left!\n\n👑 ${newLeader.name} is the new leader!`
        });
      }

      saveDatabase();
      return sock.sendMessage(chatId, {
        text: `✅ ${player.name} left the party!\n\n${Object.keys(party.members).length} members remaining.`
      });
    }

    return sock.sendMessage(chatId, {
      text: '❌ Invalid command!\n\nUse /party for options.'
    });
  }
};