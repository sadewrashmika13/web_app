module.exports = {
    name: "boom",
    category: "fun",
    description: "Message Repeater (Spam Tool)",
    commands: ["boom"],
    on: "message",

    handler: async ({ socket, reply, msg, sender, args }) => {
        try {
            const input = args.join(" ");
            
            // 🛑 ෆෝමැට් එක වැරදියි නම් හෝ කොමාවක් නැත්නම්
            if (!input || !input.includes(",")) {
                return await reply("⚠️ නිවැරදිව ටයිප් කරන්න!\n*උදාහරණ:* .boom Hi මචං, 10");
            }

            // 🛑 අන්තිම කොමාවෙන් වෙන් කරලා මැසේජ් එකයි, යවන්න ඕනේ ගාණයි හොයාගන්නවා
            const lastComma = input.lastIndexOf(",");
            const text = input.substring(0, lastComma).trim();
            const count = parseInt(input.substring(lastComma + 1).trim());

            if (!text) {
                return await reply("⚠️ යවන්න ඕනේ මැසේජ් එක මොකක්ද කියලා ටයිප් කරන්න!");
            }

            if (isNaN(count) || count <= 0) {
                return await reply("⚠️ මැසේජ් එක යවන්න ඕනේ කී පාරද කියලා හරියටම අංකයකින් දෙන්න!\n*උදාහරණ:* .boom Hi, 10");
            }

            // 🛑 බොට් නම්බර් එක Ban වෙන එක නවත්තන්න උපරිම ලිමිට් එකක් දානවා
            if (count > 100000) {
                return await reply("❌ එකපාර ගොඩක් යවන්න බෑ! WhatsApp එකෙන් බොට්ව බෑන් කරයි. උපරිම 50 වතාවක් විතරක් දෙන්න.");
            }

            // වැඩේ පටන් ගන්නවා කියලා පෙන්නන්න ගින්දර ඉමෝජියක් දානවා
            await socket.sendMessage(sender, { react: { text: '🔥', key: msg.key } });

            // 🚀 ලූප් එකක් දාලා මැසේජ් ටික යවනවා
            for (let i = 0; i < count; i++) {
                // මැසේජ් එක යවනවා (Reply විදිහට නෙමෙයි, නෝමල් මැසේජ් එකක් විදිහට)
                await socket.sendMessage(sender, { text: text });
                
                // 🛑 බොට්ව Ban වෙන එකෙන් බේරගන්න මැසේජ් 2ක් අතර මිලි තත්පර 500ක (තත්පර බාගෙක) පොඩි පරතරයක් (Delay) තියනවා
              //await new Promise(resolve => setTimeout(resolve, 0)); 
            }

            // වැඩේ ඉවර වුණාම කියනවා
            await reply(`✅ "${text}" මැසේජ් එක ${count} වතාවක් යවලා ඉවරයි!`);

        } catch (err) {
            console.error("Boom Command Error:", err.message);
            await reply("❌ අවුලක් ගියා මචං! කමාන්ඩ් එක හරියට ගැහුවද බලන්න.");
        }
    }
};