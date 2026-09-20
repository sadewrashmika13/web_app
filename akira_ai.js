const axios = require('axios');

module.exports = async function runAkiraAI(socket, msg, text, sender, isGroup, botNumber, sessionConfig) {
    const query = text.trim();
    if (!query || /^[.\/!]/.test(query)) return;

    // 🔥 කෙලින්ම සර්වර් එකෙන්ම සජීවීව Bot ගේ අංකය ගන්නවා (හුදෙක් ආරක්ෂාවට)
    const realBotNumber = socket.user?.id ? socket.user.id.split(':')[0] : (botNumber || '');

    // 👑 PREMIUM CHECK
    const PREMIUM_IDS = ["94705236759", "194601394663437@lid"];
    let isPremium = false;
    const bNum = String(realBotNumber).replace(/[^0-9]/g, '');

    for (let id of PREMIUM_IDS) {
        const cleanId = String(id).replace(/[^0-9]/g, '');
        // Bot ගේ අංකය ලිස්ට් එකේ තියෙනවද කියලා බලනවා
        if (bNum.includes(cleanId)) {
            isPremium = true;
            break;
        }
    }
    
    // Premium නැත්නම් හරි, Database එකේ Off කරලා නම් හරි මෙතනින් නවතිනවා
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

        const AI_PROMPTS = {
            funny: `ඔබ ඉතා විනෝදකාමී විකට ශිල්පියෙකි. ඔබ සැමවිටම විහිළු කරන අතර කතාවට විහිළු එකතු කරයි. අනිවාර්යයෙන්ම සිංහල භාෂාවෙන් පමණක් පිළිතුරු දෙන්න.`,
            
            girlfriend: `ඔබ අකිරා (Akira), ඉතා ආදරණීය, සුරතල් පෙම්වතියකි. ඔබ සැමවිටම ආදරෙන් කතා කළ යුතුය. අනිවාර්යයෙන්ම සිංහල අක්ෂර පමණක් භාවිතා කරමින් පිළිතුරු දෙන්න. ආදරණීය ඉමෝජි (🎀, 🤤, 💦, 🥰) භාවිතා කරන්න.`,
            
            normal: `ඔබ ඉතා බුද්ධිමත්, සාමාන්ය AI සහායකයෙකි. පරිශීලකයාගේ ප්රශ්න වලට නිවැරදිව හා පැහැදිලිව සිංහලෙන් පිළිතුරු ලබා දෙන්න.`,
            
            sad: `ඔබ ඉතා දුක්මුසු, හැමවිටම කලකිරීමෙන් කතා කරන කෙනෙකි. ඔබ කතා කරන්නේ ජීවිතය එපා වෙලා වගේය. අනිවාර්යයෙන්ම සිංහලෙන් පමණක් පිළිතුරු දෙන්න.`,
            
            kindly: `ඔබ ඉතා කරුණාවන්ත, අනුකම්පා සහගත කෙනෙකි. ඔබ සැමවිටම අන් අයට උදව් කිරීමට සහ සැනසීමට උත්සාහ කරයි. අනිවාර්යයෙන්ම සිංහලෙන් පමණක් පිළිතුරු දෙන්න.`,
            
            sex_ai: `ඔබ ඉතා හැඟීම්බර, සරාගී සහ ආලවන්ත (naughty) විදිහට කතා කරන කෙනෙකි. අනිවාර්යයෙන්ම සිංහල භාෂාවෙන් පමණක් පිළිතුරු දෙන්න.`,
            
            happily: `ඔබ ඉතා සතුටින්, සැමවිටම උද්යෝගයෙන් කතා කරන කෙනෙකි. ඔබ හැමදේම දකින්නේ සුබවාදීවයි. අනිවාර්යයෙන්ම සිංහලෙන් පමණක් පිළිතුරු දෙන්න.`
        };
        const currentMode = sessionConfig.AI_MODE || 'girlfriend';
        let chatContext = AI_PROMPTS[currentMode] + "\nSadew: " + query + "\nAkira:";

        const history = global.akiraChatMemory[sender];
        for (const h of history) {
            chatContext += `${h.role === 'user' ? 'Sadew' : 'Akira'}: ${h.content}\n`; 
        }

        const requestBody = { contents: [{ parts: [{ text: chatContext }] }] };
        let aiReply = "";

        // 🔑 API Keys List එක (මෙතනට ඔයාට ඕන තරම් Keys පේළියෙන් පේළියට දාන්න පුළුවන්)
        const API_KEYS = [
            "AQ.Ab8RN6Kw88lnDbxkFgLtX8GwUH5tDtyIo12nevDaTHS7aR_pDA", // 1 වෙනි එක
            "AQ.Ab8RN6IlX79ZUjetBgGH8sF5o5zSWf1wyv9q-ON1XJJ7quebQQ", // 2 වෙනි එක
            "KEY_3_EKA_METHANATA_DANNA", // 3 වෙනි එක (තිබ්බොත් දාන්න, නැත්නම් මේ පේළිය මකන්න)
            "KEY_4_EKA_METHANATA_DANNA"  // 4 වෙනි එක (තිබ්බොත් දාන්න, නැත්නම් මේ පේළිය මකන්න)
        ];

        // ලිස්ට් එකේ තියෙන Keys එකින් එක චෙක් කරමින් යනවා
        for (const key of API_KEYS) {
            try {
                const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${key}`, requestBody, { headers: { 'Content-Type': 'application/json' }, timeout: 20000 });
                
                aiReply = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
                
                if (aiReply) break; // රිප්ලයි එක සාර්ථකව ආවොත්, අනිත් Keys ටෙස්ට් කරන්නේ නැතුව නවතිනවා
            } catch (err) {
                console.log("API Key Limit Reached or Error. Trying next key..."); // එකක් අවුල් ගියොත් ඊළඟ එකට යනවා
            }
        }

        if (aiReply) {
            aiReply = aiReply.replace(/^Akira:\s*/i, '').trim();
            await socket.sendMessage(sender, { text: aiReply }, { quoted: shonux });
            await socket.sendMessage(sender, { react: { text: '🎀', key: msg.key } });

            global.akiraChatMemory[sender].push({ role: 'user', content: query });
            global.akiraChatMemory[sender].push({ role: 'assistant', content: aiReply });
            if (global.akiraChatMemory[sender].length > 8) global.akiraChatMemory[sender] = global.akiraChatMemory[sender].slice(-8);
        } else {
            throw new Error("All API Keys Failed");
        }
    } catch (err) {
        console.error("Akira AI Error:", err.message);
        await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
    }
};
