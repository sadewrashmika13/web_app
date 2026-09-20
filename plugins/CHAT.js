const axios = require('axios');

module.exports = {
    name: "ai-girlfriend",
    category: "ai",
    description: "No prefix AI Girlfriend using Gemini 3.1 Flash (No Extra Packages)",
    on: "text", // Prefix එකක් නැතුව නිකම්ම වැඩ කරන්න
    
    handler: async ({ socket, msg, sender, body, isCmd, reply }) => {
        try {
            // කමාන්ඩ් එකක් නම් (.menu වගේ) රිප්ලයි කරන්නේ නෑ
            if (isCmd) return;

            const text = body || msg.message?.conversation || msg.message?.extendedTextMessage?.text;
            if (!text) return;

            // ගෲප් වල පිස්සු නටන එක නවත්තන්න, Inbox වලට විතරක් සීමා කළා
            const isGroup = msg.key.remoteJid.endsWith('@g.us');
            if (isGroup) return;

            // ඔයාගේ API Key එක සහ Model එක
            const apiKey = "AQ.Ab8RN6Kw88lnDbxkFgLtX8GwUH5tDtyIo12nevDaTHS7aR_pDA";
            const model = "gemini-3.1-flash"; 

            // 💖 AI Girlfriend ට දෙන Custom Prompt එක 💖
            const prompt = `System: You are a very sweet, caring, and loving virtual girlfriend. 
Your name is 'Akira'. You are chatting with your loving boyfriend on WhatsApp.
You speak Singlish (Sinhala mixed with English).
Keep your messages short, cute, and conversational. Always use romantic emojis like ❤️, 🥰, ✨.
Never ever mention that you are an AI or an assistant. Act exactly like a real, loyal, loving human girlfriend.

Boyfriend says: "${text}"

Akira (You):`;

            // ටයිප් කරනවා වගේ පේන්න
            await socket.sendPresenceUpdate('composing', msg.key.remoteJid);

            // 🔥 අලුත් පැකේජ් නැතුව Axios වලින්ම කෙලින්ම Request එක යැවීම 🔥
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            
            const payload = {
                contents: [{
                    parts: [{ text: prompt }]
                }]
            };

            const response = await axios.post(url, payload, {
                headers: { "Content-Type": "application/json" }
            });

            // රිප්ලයි එක යැවීම
            if (response.data && response.data.candidates) {
                const replyText = response.data.candidates[0].content.parts[0].text;
                await reply(replyText.trim());
            }

        } catch (error) {
            // API Key එකේ හරි Model එකේ හරි අවුලක් තිබ්බොත් Terminal එකෙන් ලේසියෙන්ම බලාගන්න පුළුවන්
            console.log("AI Girlfriend Error:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        }
    }
};
