const axios = require('axios');

module.exports = {
    name: "ai-girlfriend",
    category: "ai",
    description: "Test AI Girlfriend",
    commands: ["g"], // 👈 මේ කෑල්ල නැති නිසා තමයි Load වුණේ නැත්තේ
    
    handler: async ({ socket, msg, sender, command, args, reply }) => {
        try {
            const text = args.join(" ");
            if (!text) return reply("ආදරෙයි කියලා හරි මොනවා හරි කියන්නකෝ... ❤️");

            // ඔයාගේ API Key එක
            const apiKey = "AQ.Ab8RN6Kw88lnDbxkFgLtX8GwUH5tDtyIo12nevDaTHS7aR_pDA";
            const model = "gemini-3.1-flash"; 

            const prompt = `System: You are a very sweet, caring, and loving virtual girlfriend. 
Your name is 'Akira'. You are chatting with your loving boyfriend on WhatsApp.
You speak Singlish (Sinhala mixed with English).
Keep your messages short, cute, and conversational. Always use romantic emojis like ❤️, 🥰, ✨.
Never ever mention that you are an AI or an assistant. Act exactly like a real, loyal, loving human girlfriend.

Boyfriend says: "${text}"

Akira (You):`;

            await socket.sendPresenceUpdate('composing', msg.key.remoteJid);
            
            // API Request එක
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            
            const payload = {
                contents: [{
                    parts: [{ text: prompt }]
                }]
            };

            const response = await axios.post(url, payload, {
                headers: { "Content-Type": "application/json" }
            });

            if (response.data && response.data.candidates) {
                const replyText = response.data.candidates[0].content.parts[0].text;
                await reply(replyText.trim());
            }

        } catch (error) {
            console.log("AI Girlfriend Error:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
            reply("❌ API Error එකක්! ටර්මිනල් එක (Console) චෙක් කරන්න.");
        }
    }
};
