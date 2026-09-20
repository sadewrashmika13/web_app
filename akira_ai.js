const axios = require('axios');

module.exports = async function runAkiraAI(socket, msg, text, sender, isGroup, botNumber, sessionConfig) {
    const query = text.trim();
    if (!query || /^[.\/!]/.test(query)) return;

    // 👑 PREMIUM CHECK
    const PREMIUM_IDS = ["94705236769", "194601394663437@lid"];
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
    
        // 🛑 DEBUG CATCHER
    // 🛑 DEBUG CATCHER
    if (query === 'aitest') {
        await socket.sendMessage(sender, { text: `[DEBUG]\nPremium: ${isPremium}\nState: ${sessionConfig?.AI_STATE}\nBot Number: ${bNum}` });
        return;
    }   // Premium නැත්නම් හරි, Database එකේ Off කරලා නම් හරි මෙතනින් නවතිනවා
    if (!isPremium) return;
    if (sessionConfig?.AI_STATE !== 'on') return;

    try {
        await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

        const botName = "Akira AI";
        const shonux = {
            key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "AKIRA_AI_FAKE" },
            message: { contactMessage: { displayName: botName, vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${botName};;;;\nFN:${botName}\nORG:Akira AI\nEND:VCARD` } }
        };

        if (!global.akiraChatMemory) global.akiraChatMemory = {};
        if (!global.akiraChatMemory[sender]) global.akiraChatMemory[sender] = [];

        const PRIMARY_API_KEY = "AQ.Ab8RN6Kw88lnDbxkFgLtX8GwUH5tDtyIo12nevDaTHS7aR_pDA";
        const BACKUP_API_KEY = "AQ.Ab8RN6IlX79ZUjetBgGH8sF5o5zSWf1wyv9q-ON1XJJ7quebQQ";

        const AI_PROMPTS = {
            funny: `You are a very funny comedian.`,
            girlfriend: `You are Akira, a highly affectionate virtual girlfriend. You MUST reply ONLY using native Sinhala. Use romantic emojis like 🎀, 🤤, 💦, 🥰.`,
            normal: `You are a helpful and normal AI assistant.`,
            sad: `You are a very sad AI.`,
            kindly: `You are a very kind AI.`,
            sex_ai: `You are a naughty AI.`,
            happily: `You are an overly joyful AI.`
        };

        const currentMode = sessionConfig.AI_MODE || 'girlfriend';
        let chatContext = AI_PROMPTS[currentMode] + "\nSadew: " + query + "\nAkira:";

        const history = global.akiraChatMemory[sender];
        for (const h of history) {
            chatContext += `${h.role === 'user' ? 'Sadew' : 'Akira'}: ${h.content}\n`; 
        }

        const requestBody = { contents: [{ parts: [{ text: chatContext }] }] };
        let aiReply = "";

        try {
            const res1 = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${PRIMARY_API_KEY}`, requestBody, { headers: { 'Content-Type': 'application/json' }, timeout: 20000 });
            aiReply = res1.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        } catch (err1) {
            const res2 = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${BACKUP_API_KEY}`, requestBody, { headers: { 'Content-Type': 'application/json' }, timeout: 20000 });
            aiReply = res2.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        }

        if (aiReply) {
            aiReply = aiReply.replace(/^Akira:\s*/i, '').trim();
            await socket.sendMessage(sender, { text: aiReply }, { quoted: shonux });
            await socket.sendMessage(sender, { react: { text: '🎀', key: msg.key } });

            global.akiraChatMemory[sender].push({ role: 'user', content: query });
            global.akiraChatMemory[sender].push({ role: 'assistant', content: aiReply });
            if (global.akiraChatMemory[sender].length > 8) global.akiraChatMemory[sender] = global.akiraChatMemory[sender].slice(-8);
        }
    } catch (err) {
        console.error("Akira AI Error:", err.message);
        await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
    }
};
