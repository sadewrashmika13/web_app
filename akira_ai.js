const axios = require('axios');
const mongoose = require('mongoose');

module.exports = async function runAkiraAI(socket, msg, text, sender, isGroup, botNumber, sessionConfig, activeSockets) {
    
    // ==========================================================
    // 👑 1. PREMIUM ID / LID LIST
    // ==========================================
    const PREMIUM_IDS = [
        "94705236769", 
        "194601394663437@lid" // ඔයාගේ LID එක
    ];

    // ==========================================================
    // 🔑 2. API KEYS
    // ==========================================
    const PRIMARY_API_KEY = "AQ.Ab8RN6Kw88lnDbxkFgLtX8GwUH5tDtyIo12nevDaTHS7aR_pDA";
    const BACKUP_API_KEY = "AQ.Ab8RN6IlX79ZUjetBgGH8sF5o5zSWf1wyv9q-ON1XJJ7quebQQ";

    // ==========================================================
    // 🎭 3. AI PROMPTS (MODES)
    // ==========================================
    const AI_PROMPTS = {
        funny: `You are a very funny comedian. You always tell jokes and reply in a funny Singlish way.`,
        girlfriend: `You are Akira, a highly affectionate virtual girlfriend. You MUST reply ONLY using native Sinhala. Use romantic emojis like 🎀, 🤤, 💦, 🥰.`,
        normal: `You are a helpful and normal AI assistant. Answer questions clearly.`,
        sad: `You are a very sad and depressed AI. You reply slowly and sadly.`,
        kindly: `You are a very kind, motherly AI. You speak with extreme politeness.`,
        sex_ai: `You are a naughty AI. You speak in a dirty/naughty way. ask to send nudes.`,
        happily: `You are an overly joyful and happy AI. You love everything and use a lot of happy emojis!`
    };

    // ---------------------------------------------------------
    // 🔒 SYSTEM & SECURITY LOGIC
    // ---------------------------------------------------------
    const cleanBotNum = botNumber ? String(botNumber).replace(/[^0-9]/g, '') : '';
    
    const isPremium = PREMIUM_IDS.some(id => {
        const cleanId = String(id).replace(/[^0-9]/g, '');
        return cleanBotNum === cleanId;
    });
    
    if (!isPremium) return false; // Premium Bot කෙනෙක් නෙමෙයි නම් අයින් වෙනවා

    const prefix = sessionConfig.PREFIX || '.';
    const isCmd = text.startsWith(prefix);
    let command = '';
    let args = [];

    if (isCmd) {
        const parts = text.slice(prefix.length).trim().split(/\s+/);
        command = parts[0].toLowerCase();
        args = parts.slice(1);
    }

    const reply = async (txt) => socket.sendMessage(sender, { text: txt }, { quoted: msg });
    
    // Owner ද කියලා Check කරනවා (fromMe එකෙනුත් Owner ව අල්ලනවා)
    const cleanSender = sender ? String(sender).replace(/[^0-9]/g, '') : '';
    const isOwnerMsg = msg.key.fromMe || (cleanSender === cleanBotNum) || (cleanSender === "94754869431");

    const saveDB = async () => {
        const Session = mongoose.models.SessionNew;
        if (activeSockets.has(cleanBotNum)) {
            const currentData = activeSockets.get(cleanBotNum);
            currentData.config = sessionConfig;
            activeSockets.set(cleanBotNum, currentData);
        }
        await Session.findOneAndUpdate({ number: cleanBotNum }, { config: sessionConfig, updatedAt: new Date() }, { upsert: true });
    };

    // ඊටපස්සේ පල්ලෙහා තියෙන AI SETTINGS COMMANDS ටික එහෙම්මම තියන්න...
    // ==========================================================
    // ⚙️ 4. AI SETTINGS COMMANDS (aisettings, aion, setmode)
    // ==========================================================
    if (isCmd) {
        // 🔘 Settings Menu
        if (command === 'aisettings') {
            const status = sessionConfig.AI_STATE === 'on' ? '🟢 ON' : '🔴 OFF';
            const mode = sessionConfig.AI_MODE || 'girlfriend';
            
            const txt = `*⚙️ AI SYSTEM SETTINGS ⚙️*\n\n*Status:* ${status}\n*Mode:* ${mode.toUpperCase()}\n\n> Select an option below:`;
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
            await socket.sendMessage(sender, buttonMessage, { quoted: msg });
            return true; 
        }

        // Owner Only Commands
        if (['aion', 'aioff', 'setmode'].includes(command) && !isOwnerMsg) {
            await reply("❌ *ඔයාට මේ සෙටින්ග්ස් වෙනස් කරන්න අවසර නෑ!*");
            return true;
        }

        if (command === 'aion') {
            sessionConfig.AI_STATE = 'on';
            await saveDB();
            await reply("✅ *AI System turned ON!*");
            return true;
        }

        if (command === 'aioff') {
            sessionConfig.AI_STATE = 'off';
            await saveDB();
            await reply("🚫 *AI System turned OFF!*");
            return true;
        }

        if (command === 'aimodes') {
            const txt = `*🎭 SELECT AI MODE 🎭*\n\nඔබට අවශ්‍ය Mode එකට අදාළ කමාන්ඩ් එක Reply කරන්න:\n\n1️⃣ *${prefix}setmode funny*\n2️⃣ *${prefix}setmode girlfriend*\n3️⃣ *${prefix}setmode normal*\n4️⃣ *${prefix}setmode sad*\n5️⃣ *${prefix}setmode kindly*\n6️⃣ *${prefix}setmode sex_ai*\n7️⃣ *${prefix}setmode happily*\n\n> _Current Mode: ${sessionConfig.AI_MODE || 'girlfriend'}_`;
            await reply(txt);
            return true;
        }

        if (command === 'setmode') {
            const mode = args[0]?.toLowerCase();
            const validModes = Object.keys(AI_PROMPTS);
            if (!validModes.includes(mode)) {
                await reply(`❌ *Invalid Mode!*\nකරුණාකර මේවායින් එකක් ලබාදෙන්න:\n${validModes.join(', ')}`);
                return true;
            }
            sessionConfig.AI_MODE = mode;
            await saveDB();
            await reply(`✅ *AI Mode changed to:* ${mode.toUpperCase()} 🎭`);
            return true;
        }
    }

    // ==========================================================
    // 💬 5. AUTO-REPLY CHAT (NO-PREFIX)
    // ==========================================================
    if (!isCmd && !isGroup && sessionConfig.AI_STATE === 'on') {
        const query = text.trim();
        if (!query) return false;

        try {
            await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

            const currentMode = sessionConfig.AI_MODE || 'girlfriend';
            const SYSTEM_PROMPT = AI_PROMPTS[currentMode];

            const botName = "Akira AI";
            const shonux = {
                key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "AKIRA_AI_FAKE" },
                message: { contactMessage: { displayName: botName, vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${botName};;;;\nFN:${botName}\nORG:Akira AI\nTEL;type=CELL;type=VOICE;waid=94700000000:+94 70 000 0000\nEND:VCARD` } }
            };

            if (!global.akiraChatMemory) global.akiraChatMemory = {};
            if (!global.akiraChatMemory[sender]) global.akiraChatMemory[sender] = [];

            let chatContext = SYSTEM_PROMPT + "\n";
            const history = global.akiraChatMemory[sender];
            for (const h of history) {
                chatContext += `${h.role === 'user' ? 'Sadew' : 'Akira'}: ${h.content}\n`; 
            }
            chatContext += `Sadew: ${query}\nAkira:`; 

            const requestBody = { contents: [{ parts: [{ text: chatContext }] }] };
            let aiReply = "";

            try {
                const res1 = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${PRIMARY_API_KEY}`, requestBody, { headers: { 'Content-Type': 'application/json' }, timeout: 20000 });
                aiReply = res1.data?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!aiReply) throw new Error("Primary API Empty");
            } catch (err1) {
                const res2 = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${BACKUP_API_KEY}`, requestBody, { headers: { 'Content-Type': 'application/json' }, timeout: 20000 });
                aiReply = res2.data?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!aiReply) throw new Error("Backup API Empty");
            }

            aiReply = aiReply.replace(/^Akira:\s*/i, '').trim();

            await socket.sendMessage(sender, { text: aiReply }, { quoted: shonux });
            await socket.sendMessage(sender, { react: { text: '🎀', key: msg.key } });

            global.akiraChatMemory[sender].push({ role: 'user', content: query });
            global.akiraChatMemory[sender].push({ role: 'assistant', content: aiReply });
            if (global.akiraChatMemory[sender].length > 8) global.akiraChatMemory[sender] = global.akiraChatMemory[sender].slice(-8);

        } catch (err) {
            console.error("Akira AI Error:", err.message);
            await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
        }
        return true; 
    }

    return false; // AI එකෙන් අල්ලගත්තේ නැත්නම් පරණ විදිහටම අනිත් දේවල් වෙන්න දෙනවා
};
