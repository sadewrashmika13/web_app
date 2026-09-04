const axios = require('axios');

// පරණ චැට් මතක තියාගන්න Global Memory Object එක
if (!global.wormGptMemory) global.wormGptMemory = {};

module.exports = {
    name: "worm_gpt",
    category: "ai",
    description: "Fake WormGPT with Memory & Code Extractor",
    commands: ["worm", "darkai", "ai"],
    on: "message",

    handler: async ({ socket, reply, msg, sender, args }) => {
        try {
            const query = args.join(" ").trim();
            
            if (!query) {
                return await reply("👾 *WormGPT Ready.* What do you want?");
            }

            await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

            // යූසර්ට මතකයක් නැත්නම් අලුතින් හදනවා
            if (!global.wormGptMemory[sender]) {
                global.wormGptMemory[sender] = [];
            }

            // මතකය සහ අලුත් ප්‍රශ්නය එකතු කරලා කතාව (Context) හදනවා
            let chatContext = "";
            const history = global.wormGptMemory[sender];
            for (const h of history) {
                chatContext += `${h.role === 'user' ? 'User' : 'WormGPT'}: ${h.content}\n`;
            }
            chatContext += `User: ${query}\nWormGPT:`;

            // API කෝල් එක
            const url = `https://apix.wolvarex.com/api/ai/wormgpt?q=${encodeURIComponent(chatContext)}&key=wxa_f_688f63d082`;
            
            const res = await axios.get(url, { timeout: 30000 });

            let aiReply = res.data?.result;

            if (!aiReply) throw new Error("API Response is empty");

            // "WormGPT: " කියලා මුලට දාලා එව්වොත් ඒක අයින් කරනවා
            aiReply = aiReply.replace(/^WormGPT:\s*/i, '').trim();

            // ==========================================
            // 🛑 Code Block Extractor (Text එකයි Code එකයි වෙන් කිරීම)
            // ==========================================
            const codeBlockRegex = /```[\s\S]*?```/g;
            let codes = [];
            let textOnly = aiReply;
            
            let match;
            while ((match = codeBlockRegex.exec(aiReply)) !== null) {
                codes.push(match[0]); // Code blocks ටික වෙනම Array එකකට ගන්නවා
            }
            
            // ප්‍රධාන මැසේජ් එකෙන් Code blocks ටික අයින් කරනවා
            textOnly = textOnly.replace(codeBlockRegex, '').trim();

            // 1. Text එක විතරක් යවනවා (Text එකක් ඉතුරු වෙලා තියෙනවා නම්)
            if (textOnly) {
                await reply(textOnly);
            }

            // 2. Code blocks ටික වෙනම මැසේජ් විදිහට යවනවා
            if (codes.length > 0) {
                for (const code of codes) {
                    await new Promise(r => setTimeout(r, 1000)); // පිළිවෙලට යන්න තත්පරයක පරතරයක් දෙනවා
                    await socket.sendMessage(sender, { text: code }, { quoted: msg });
                }
            }

            await socket.sendMessage(sender, { react: { text: '👾', key: msg.key } });

            // අලුත් චැට් එක Memory එකට සේව් කරනවා
            global.wormGptMemory[sender].push({ role: 'user', content: query });
            global.wormGptMemory[sender].push({ role: 'assistant', content: aiReply });

            // URL දිග වැඩිවෙලා API එක කඩා වැටෙන එක නවත්තන්න, අන්තිම මැසේජ් 6 (ප්‍රශ්න 3යි උත්තර 3යි) විතරක් තියාගන්නවා
            if (global.wormGptMemory[sender].length > 6) {
                global.wormGptMemory[sender] = global.wormGptMemory[sender].slice(-6);
            }

        } catch (err) {
            console.error("WormGPT Error:", err.message);
            
            // 🛑 414 / 431 එරර් එක ආවොත් (URL දිග වැඩි වුණොත්) ඔටෝම මතකය Reset කරනවා
            if (err.message.includes('431') || err.message.includes('414') || err.message.includes('Request-URI Too Large')) {
                global.wormGptMemory[sender] = []; // මතකය මකලා දානවා
                await socket.sendMessage(sender, { react: { text: '🔄', key: msg.key } });
                await reply("⚠️ *Memory Limit Reached!* චැට් එක දිග වැඩි නිසා පරණ මතකය Reset කරලා අලුතින් පටන් ගත්තා.");
            } else {
                await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
                await reply("❌ *API Error:* සේවාදායකයෙන් දත්ත ලබාගැනීමට නොහැක.");
            }
        }
    }
};