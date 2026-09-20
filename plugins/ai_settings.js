const mongoose = require('mongoose');

module.exports = {
    name: "ai_settings",
    category: 99, 
    description: "Manage AI System",
    commands: ["aisettings", "aion", "aioff", "aimodes", "setmode"],

    handler: async ({ socket, msg, sender, command, args, reply, botNumber, sessionConfig, activeSockets }) => {
        
        // 👑 PREMIUM CHECK
        const PREMIUM_IDS = ["94705236759", "68509778325678"];
        let isPremium = false;
        const bNum = String(botNumber || '').replace(/[^0-9]/g, '');
        const sNum = String(sender || '').replace(/[^0-9]/g, '');

        for (let id of PREMIUM_IDS) {
            const cleanId = String(id).replace(/[^0-9]/g, '');
            if (bNum.includes(cleanId) || sNum.includes(cleanId)) {
                isPremium = true;
                break;
            }
        }

        if (!isPremium) {
            return reply(`❌ *This is a Premium Feature!*\n\n[DEBUG DATA]\nBot Number: ${bNum}\nSender: ${sNum}`);
        }

        // 💾 DATABASE SAVE FUNCTION (Just like your settings.js)
        const sanitizedNumber = botNumber.replace(/[^0-9]/g, '');
        const Session = mongoose.models.SessionNew;
        const saveConfig = async () => {
            const currentData = activeSockets.get(sanitizedNumber);
            if (currentData) {
                currentData.config = sessionConfig;
                activeSockets.set(sanitizedNumber, currentData);
            }
            await Session.findOneAndUpdate(
                { number: sanitizedNumber },
                { config: sessionConfig, updatedAt: new Date() },
                { upsert: true }
            );
        };

        const cmd = command.replace(/^\./, '').toLowerCase();
        const prefix = sessionConfig.PREFIX || '.';

        if (cmd === 'aisettings') {
            const status = sessionConfig.AI_STATE === 'on' ? '🟢 ON' : '🔴 OFF';
            const mode = sessionConfig.AI_MODE || 'girlfriend';
            const txt = `*⚙️ AI SYSTEM SETTINGS ⚙️*\n\n*Status:* ${status}\n*Mode:* ${mode.toUpperCase()}`;
            
            const buttonMessage = {
                text: txt,
                footer: 'SADEW-MINI PREMIUM AI',
                buttons: [
                    { buttonId: `${prefix}aion`, buttonText: { displayText: '🟢 TURN ON' }, type: 1 },
                    { buttonId: `${prefix}aioff`, buttonText: { displayText: '🔴 TURN OFF' }, type: 1 },
                    { buttonId: `${prefix}aimodes`, buttonText: { displayText: '🎭 CHANGE MODE' }, type: 1 }
                ],
                headerType: 1
            };
            return await socket.sendMessage(msg.key.remoteJid, buttonMessage, { quoted: msg });
        }

        if (cmd === 'aion') {
            sessionConfig.AI_STATE = 'on';
            await saveConfig();
            return reply("✅ *AI System turned ON!*");
        }

        if (cmd === 'aioff') {
            sessionConfig.AI_STATE = 'off';
            await saveConfig();
            return reply("🚫 *AI System turned OFF!*");
        }

        if (cmd === 'aimodes') {
            const txt = `*🎭 SELECT AI MODE 🎭*\n\n1️⃣ *${prefix}setmode funny*\n2️⃣ *${prefix}setmode girlfriend*\n3️⃣ *${prefix}setmode normal*\n4️⃣ *${prefix}setmode sad*\n5️⃣ *${prefix}setmode kindly*\n6️⃣ *${prefix}setmode sex_ai*\n7️⃣ *${prefix}setmode happily*`;
            return reply(txt);
        }

        if (cmd === 'setmode') {
            const mode = args[0]?.toLowerCase();
            const validModes = ['funny', 'girlfriend', 'normal', 'sad', 'kindly', 'sex_ai', 'happily'];
            if (!validModes.includes(mode)) return reply(`❌ *Invalid Mode!*`);
            
            sessionConfig.AI_MODE = mode;
            await saveConfig();
            return reply(`✅ *AI Mode changed to:* ${mode.toUpperCase()} 🎭`);
        }
    }
};
