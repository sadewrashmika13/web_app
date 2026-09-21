const axios = require('axios');
const { downloadContentFromMessage } = require('baileys');

module.exports = async function runAkiraAI(socket, msg, text, sender, isGroup, botNumber, sessionConfig) {
    
    // 1. 🔍 මැසේජ් එකේ වර්ගය අඳුරගැනීම (Text, Image, Audio, Document)
    const getMessageDetails = (messageObj) => {
        const m = messageObj.message;
        if (!m) return { type: 'unknown', content: '' };
        
        if (m.conversation || m.extendedTextMessage) {
            return { type: 'text', content: text.trim() }; 
        }
        if (m.imageMessage) {
            // ෆොටෝ එකක් දාලා මුකුත් ටයිප් කරේ නැත්නම් මේක ඔටෝ යනවා
            return { type: 'image', content: m.imageMessage.caption || "මේ ෆොටෝ එක හොඳට බලලා, මේකේ තියෙන දේ පැහැදිලිව විස්තර කරන්න.", msgNode: m.imageMessage, mime: m.imageMessage.mimetype };
        }
        if (m.audioMessage) {
            // කවුරු හරි Voice දැම්මොත්
            return { type: 'audio', content: "මේ voice මැසේජ් එක අහලා තේරුම් අරගෙන, ඒකට ගැලපෙන හොඳ උත්තරයක් දෙන්න.", msgNode: m.audioMessage, mime: m.audioMessage.mimetype };
        }
        if (m.documentMessage) {
            // PDF එකක් දැම්මොත්
            return { type: 'document', content: m.documentMessage.caption || "මේ Document එකේ තියෙන දේවල් කියවලා සාරාංශ කරලා දෙන්න.", msgNode: m.documentMessage, mime: m.documentMessage.mimetype };
        }
        return { type: 'unknown', content: text.trim() };
    };

    const msgDetails = getMessageDetails(msg);
    const query = text.trim() || msgDetails.content; // Caption එකක් නැත්නම් ඔටෝ prompt එක ගන්නවා

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

        const history = global.akiraChatMemory[sender];
        for (const h of history) {
            chatContext += `${h.role === 'user' ? 'User' : 'Alya'}: ${h.content}\n`; 
        }

        chatContext += `User: ${query}\nAlya:`;

        // 📸 Media Download Function
        async function downloadMedia(msgNode, msgType) {
            const stream = await downloadContentFromMessage(msgNode, msgType);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }
            return buffer.toString('base64');
        }

        // 🎯 Payload එක හැදීම
        const parts = [{ text: chatContext }];

        if (msgDetails.type !== 'text' && msgDetails.type !== 'unknown' && msgDetails.msgNode) {
            // PDF වලට පමණක් සීමා කිරීම (අනෙක් Documents යැව්වොත් Error එන නිසා)
            if (msgDetails.type === 'document' && !msgDetails.mime.includes('pdf')) {
                // Not a PDF
            } else {
                try {
                    const base64Data = await downloadMedia(msgDetails.msgNode, msgDetails.type);
                    parts.push({
                        inline_data: {
                            mime_type: msgDetails.mime,
                            data: base64Data
                        }
                    });
                } catch (e) {
                    console.error("Media Download Failed:", e.message);
                }
            }
        }

        const requestBody = { contents: [{ parts: parts }] };
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
            aiReply = aiReply.replace(/^Alya:\s*/i, '').trim(); 
            await socket.sendMessage(sender, { text: aiReply }, { quoted: shonux });
            await socket.sendMessage(sender, { react: { text: '🎀', key: msg.key } });

            global.akiraChatMemory[sender].push({ role: 'user', content: query });
            global.akiraChatMemory[sender].push({ role: 'assistant', content: aiReply });
            if (global.akiraChatMemory[sender].length > 10) global.akiraChatMemory[sender] = global.akiraChatMemory[sender].slice(-10);
        } else {
            throw new Error("All API Keys Failed");
        }
    } catch (err) {
        console.error("Alya AI Error:", err.message);
        await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
    }
};
