module.exports = {
    name: "text-art",
    category: 5, // Tools & Edits Category
    description: "Text එක ASCII art style එකට convert කරන්න (Local Built-in Version)",
    commands: ["art", "ascii", "textart"],

    handler: async ({ socket, msg, sender, args, reply }) => {
        try {
            let textInput = args.join(" ").trim().toUpperCase();
            
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!textInput && quoted) {
                textInput = (quoted.conversation || quoted.extendedTextMessage?.text || "").trim().toUpperCase();
            }

            if (!textInput) {
                return await reply("🎨 *Art කරන්න text එකක් දෙන්න මචං.*\n\n💡 _උදා: .art SADEW_");
            }

            if (textInput.length > 10) {
                return await reply("❌ *Text එක දිග වැඩියි මචං. අකුරු 10 ට අඩුවෙන් දෙන්න.*");
            }

            await socket.sendMessage(sender, { react: { text: "🎨", key: msg.key } });

            // Simple & Clean Block Font Dictionary (A-Z, 0-9, Space)
            const asciiFont = {
                'A': [" █████ ", "██   ██", "███████", "██   ██", "██   ██"],
                'B': ["██████ ", "██   ██", "██████ ", "██   ██", "██████ "],
                'C': [" ██████", "██     ", "██     ", "██     ", " ██████"],
                'D': ["██████ ", "██   ██", "██   ██", "██   ██", "██████ "],
                'E': ["███████", "██     ", "█████  ", "██     ", "███████"],
                'F': ["███████", "██     ", "█████  ", "██     ", "██     "],
                'G': [" ██████", "██     ", "██  ███", "██   ██", " ██████"],
                'H': ["██   ██", "██   ██", "███████", "██   ██", "██   ██"],
                'I': ["███", " ██ ", " ██ ", " ██ ", "███"],
                'J': ["    ██", "    ██", "    ██", "██  ██", " ████ "],
                'K': ["██  ██", "██ █  ", "████  ", "██ █  ", "██  ██"],
                'L': ["██     ", "██     ", "██     ", "██     ", "███████"],
                'M': ["██   ██", "███ ███", "██ █ ██", "██   ██", "██   ██"],
                'N': ["██   ██", "███  ██", "██ ██ ██", "██  ███", "██   ██"],
                'O': [" █████ ", "██   ██", "██   ██", "██   ██", " █████ "],
                'P': ["██████ ", "██   ██", "██████ ", "██     ", "██     "],
                'Q': [" █████ ", "██   ██", "██   ██", "██  ███", " ████ █"],
                'R': ["██████ ", "██   ██", "██████ ", "██   ██", "██   ██"],
                'S': [" ██████", "██     ", " █████ ", "     ██", "██████ "],
                'T': ["███████", "   ██  ", "   ██  ", "   ██  ", "   ██  "],
                'U': ["██   ██", "██   ██", "██   ██", "██   ██", " █████ "],
                'V': ["██   ██", "██   ██", "██   ██", " ██ ██ ", "  ███  "],
                'W': ["██   ██", "██   ██", "██ █ ██", "███████", "██   ██"],
                'X': ["██   ██", " ██ ██ ", "  ███  ", " ██ ██ ", "██   ██"],
                'Y': ["██   ██", " ██ ██ ", "  ███  ", "  ██   ", "  ██   "],
                'Z': ["███████", "    ██ ", "   ██  ", "  ██   ", "███████"],
                '0': [" █████ ", "██   ██", "██   ██", "██   ██", " █████ "],
                '1': ["  ██ ", " ███ ", "  ██ ", "  ██ ", "█████"],
                '2': [" █████ ", "    ██ ", " █████ ", "██     ", "███████"],
                '3': ["██████ ", "     ██", " █████ ", "     ██", "██████ "],
                '4': ["██   ██", "██   ██", "███████", "     ██", "     ██"],
                '5': ["███████", "██     ", "██████ ", "     ██", "██████ "],
                '6': [" ██████", "██     ", "██████ ", "██   ██", " ██████"],
                '7': ["███████", "     ██", "    ██ ", "   ██  ", "  ██   "],
                '8': [" █████ ", "██   ██", " █████ ", "██   ██", " █████ "],
                '9': [" █████ ", "██   ██", " ██████", "     ██", " █████ "],
                ' ': ["     ", "     ", "     ", "     ", "     "]
            };

            // Render rows (5 lines high)
            let lines = ["", "", "", "", ""];
            for (let char of textInput) {
                let glyph = asciiFont[char] || [" ███ ", "█   █", "█   █", "█   █", " ███ "]; // Default fallback for symbols
                for (let i = 0; i < 5; i++) {
                    lines[i] += (glyph[i] || "     ") + "  ";
                }
            }

            const finalArt = lines.join("\n");
            const finalMessage = "```\n" + finalArt + "\n```\n\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*";

            await reply(finalMessage);
            await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

        } catch (err) {
            console.error("Art command error:", err.message);
            await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
            await reply("❌ *Art එක හදන්න බැරි වුණා.*\n\nහේතුව: " + err.message);
        }
    }
};