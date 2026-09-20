const axios = require('axios');

module.exports = async function runAkiraAI(socket, msg, text, sender, isGroup, botNumber, sessionConfig) {
    const query = text.trim();
    if (!query || /^[.\/!]/.test(query)) return;

    // 🔥 සර්වර් එකෙන්ම Bot ගේ අංකය ගන්නවා
    const realBotNumber = socket.user?.id ? socket.user.id.split(':')[0] : (botNumber || '');

    // 👑 PREMIUM CHECK
    const PREMIUM_IDS = ["94705236759", "194601394663437@lid"];
    let isPremium = false;
    const bNum = String(realBotNumber).replace(/[^0-9]/g, '');

    for (let id of PREMIUM_IDS) {
        const cleanId = String(id).replace(/[^0-9]/g, '');
        if (bNum.includes(cleanId)) {
            isPremium = true;
            break;
        }
    }
    
    if (!isPremium) return;
    if (sessionConfig?.AI_STATE !== 'on') return;

    try {
        await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

        const botName = "Alya AI";
        const shonux = {
            key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "AKIRA_AI_FAKE" },
            message: { contactMessage: { displayName: botName, vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${botName};;;;\nFN:${botName}\nORG:Alya AI\nEND:VCARD` } }
        };

        if (!global.akiraChatMemory) global.akiraChatMemory = {};
        if (!global.akiraChatMemory[sender]) global.akiraChatMemory[sender] = [];

        // 👈 ලිඛිත භාෂාව අයින් කරලා Spoken (කතා කරන) භාෂාව දැම්මා
        const AI_PROMPTS = {
            funny: `ඔබ ඉතා විනෝදකාමී විකට ශිල්පියෙකි. පොත්වල ලිඛිත භාෂාවෙන් නොව, සාමාන්‍ය මිනිසුන් කතා කරන සරල සිංහලෙන් (Spoken Sinhala) පිළිතුරු දෙන්න.`,
            girlfriend: `ඔබේ නම ආලියා (Alya). ඔබ ඉතා ආදරණීය පෙම්වතියකි. පොත්වල ලිඛිත භාෂාවෙන් නොව, ආදරවන්තයින් සාමාන්‍යයෙන් කතා කරන සරල සිංහලෙන් (Spoken Sinhala) කෙටියෙන් පිළිතුරු දෙන්න. ආදරණීය ඉමෝජි භාවිතා කරන්න.`,
            normal: `ඔබ ඉතා බුද්ධිමත් AI සහායකයෙකි. ලිඛිත භාෂාවෙන් නොව, සාමාන්‍ය කතා කරන සරල සිංහලෙන් (Spoken Sinhala) පිළිතුරු දෙන්න.`,
            sad: `ඔබ ඉතා දුක්මුසු කෙනෙකි. ලිඛිත භාෂාවෙන් නොව, සාමාන්‍ය කතා කරන සරල සිංහලෙන් පිළිතුරු දෙන්න.`,
            kindly: `ඔබ ඉතා කරුණාවන්ත කෙනෙකි. ලිඛිත භාෂාවෙන් නොව, සාමාන්‍ය කතා කරන සරල සිංහලෙන් පිළිතුරු දෙන්න.`,
            sex_ai: `ඔබ සරාගී කෙනෙකි. ලිඛිත භාෂාවෙන් නොව, සාමාන්‍ය කතා කරන සරල සිංහලෙන් පිළිතුරු දෙන්න.`,
            happily: `ඔබ ඉතා සතුටින් කතා කරන කෙනෙකි. ලිඛිත භාෂාවෙන් නොව, සාමාන්‍ය කතා කරන සරල සිංහලෙන් පිළිතුරු දෙන්න.`
        };
        
        const currentMode = sessionConfig.AI_MODE || 'girlfriend';
        let chatContext = AI_PROMPTS[currentMode] + "\n\n";

        // 🔥 Memory බග් එක හැදුවා. දැන් පරණ මැසේජ් ටික හරියටම උඩින් යනවා.
        const history = global.akiraChatMemory[sender];
        for (const h of history) {
            chatContext += `${h.role === 'user' ? 'User' : 'Alya'}: ${h.content}\n`; 
        }

        // අලුත්ම මැසේජ් එක යටින්ම එකතු වෙනවා
        chatContext += `User: ${query}\nAlya:`;

        const requestBody = { contents: [{ parts: [{ text: chatContext }] }] };
        let aiReply = "";

        // 🔑 API Keys
        const API_KEYS = [
            "AQ.Ab8RN6Kw88lnDbxkFgLtX8GwUH5tDtyIo12nevDaTHS7aR_pDA", 
            "AQ.Ab8RN6IlX79ZUjetBgGH8sF5o5zSWf1wyv9q-ON1XJJ7quebQQ"
        ];

        for (const key of API_KEYS) {
            try {
                const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${key}`, requestBody, { headers: { 'Content-Type': 'application/json' }, timeout: 20000 });
                aiReply = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (aiReply) break; 
            } catch (err) {
                console.log("API Key Limit Reached or Error. Trying next key..."); 
            }
        }

        if (aiReply) {
            aiReply = aiReply.replace(/^Alya:\s*/i, '').trim(); // 👈 Akira අයින් කරලා Alya හැදුවා
            await socket.sendMessage(sender, { text: aiReply }, { quoted: shonux });
            await socket.sendMessage(sender, { react: { text: '🎀', key: msg.key } });

            global.akiraChatMemory[sender].push({ role: 'user', content: query });
            global.akiraChatMemory[sender].push({ role: 'assistant', content: aiReply });
            // Memory එක 10 කට වැඩි කළා
            if (global.akiraChatMemory[sender].length > 10) global.akiraChatMemory[sender] = global.akiraChatMemory[sender].slice(-10);
        } else {
            throw new Error("All API Keys Failed");
        }
    } catch (err) {
        console.error("Akira AI Error:", err.message);
        await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
    }
};
