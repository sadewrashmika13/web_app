module.exports = {
    name: "premiumjoin",
    category: "premium", 
    description: "Bot ව Group එකකට ඇතුලත් කිරීම (Premium Users Only)",
    commands: ["join", "joingc"],
    
    handler: async ({ socket, msg, sender, args, reply }) => {
        
        const premiumUsers = [
            "94769634033" // ඔයාගේ අංකය
        ];

        // 1. බොට් ඔයාව දකින විදිහ ඔක්කොම එකට එකතු කරනවා (Debug සඳහා)
        const debugText = JSON.stringify({
            senderArg: sender || "none",
            remoteJid: msg?.key?.remoteJid || "none",
            participant: msg?.key?.participant || "none"
        });

        // 2. ඒ ඩේටා එක ඇතුලේ කොහේ හරි ඔයාගේ අංකය තියෙනවද බලනවා
        let isPremium = false;
        for (let num of premiumUsers) {
            if (debugText.includes(num)) {
                isPremium = true;
                break;
            }
        }

        if (!isPremium) {
            // 🔴 මෙතනින් ඔයාට එන මැසේජ් එක යටින් Debug ඩේටා එකත් පෙන්නනවා 🔴
            return reply(`❌ *සමාවෙන්න, මෙම කමාන්ඩ් එක භාවිතා කළ හැක්කේ Premium Users ලාට පමණි!* 👑\n\n🛠️ *DEBUG DATA (මෙය කොපි කර එවන්න):*\n${debugText}`);
        }

        const link = args[0];
        if (!link || !link.includes("chat.whatsapp.com/")) {
            return reply("❌ *කරුණාකර නිවැරදි WhatsApp Group Link එකක් ලබා දෙන්න!*\n💡 උදා: `.join https://chat.whatsapp.com/AbcDef123`");
        }

        try {
            const actualJid = msg.key.remoteJid;
            await socket.sendMessage(actualJid, { react: { text: '⏳', key: msg.key } });

            // ලින්ක් එකෙන් Invite Code එක අරන් බොට්ව Group එකට ජොයින් කරනවා
            const inviteCode = link.split("chat.whatsapp.com/")[1].split(" ")[0];
            await socket.groupAcceptInvite(inviteCode);
            
            await socket.sendMessage(actualJid, { react: { text: '✅', key: msg.key } });
            await reply("✅ *Premium User Command Accepted: සාර්ථකව Group එකට සම්බන්ධ විය!* 🚀");
            
        } catch (err) {
            console.error("Join Error:", err);
            reply("❌ *Group එකට සම්බන්ධ වීමට නොහැකි විය. ලින්ක් එක Expire වී හෝ Bot ව එම Group එකෙන් Ban කර තිබිය හැක.*");
        }
    }
};
