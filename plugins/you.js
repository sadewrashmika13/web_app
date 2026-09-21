// 📦 Package එක නැත්නම් කෝඩ් එකෙන්ම Auto Install කරගන්නවා
try {
    require.resolve('@heyputer/puter.js');
} catch (e) {
    console.log("Installing Puter.js package automatically... Please wait.");
    const { execSync } = require('child_process');
    execSync('npm install @heyputer/puter.js', { stdio: 'inherit' });
    console.log("Puter.js installed successfully!");
}

const { puter } = require('@heyputer/puter.js');

module.exports = {
    name: "gemini_free",
    category: 1, 
    description: "Unlimited Free Gemini 3.8 AI via Puter",
    commands: ["you"],

    handler: async ({ socket, msg, sender, args, reply }) => {
        const query = args.join(" ");

        if (!query) {
            return reply("ඔයාට මගෙන් මොනවද දැනගන්න ඕනේ? ප්‍රශ්නයක් අහන්න... \nඋදාහරණ: *.you ලංකාවේ ඉතිහාසය ගැන කියන්න*");
        }

        try {
            await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

            // Puter.js එක හරහා කෙලින්ම Gemini 3.8 Flash ට කනෙක්ට් වෙනවා (API Key ඕනේ නෑ)
            const response = await puter.ai.chat(query, {
                model: 'gemini-3.8-flash'
            });

            // උත්තරය වෙන් කරගන්නවා
            const finalReply = typeof response === 'string' ? response : response.text || response.message;

            await reply(finalReply);
            await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

        } catch (error) {
            console.error("Puter AI Error:", error);
            await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
            reply("සමාවෙන්න, AI එකට කනෙක්ට් වෙන්න බැරි වුණා. ටිකකින් ආයේ ට්‍රයි කරන්න.");
        }
    }
};
