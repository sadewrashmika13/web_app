module.exports = {
    name: "premiumjoin",
    category: "premium", 
    description: "Bot ව Group එකකට ඇතුලත් කිරීම (Premium Users Only)",
    commands: ["join", "joingc"],
    
    handler: async ({ socket, msg, sender, args, reply }) => {
        
        const premiumUsers = [
            "194601394663437@lid", // ඔයාගේ LID එක
            "94769634033"
        ];

        const actualSender = msg.key.participant || msg.key.remoteJid || sender || "";

        let isPremium = false;
        for (let num of premiumUsers) {
            if (actualSender.includes(num)) {
                isPremium = true;
                break;
            }
        }

        if (!isPremium) {
            return reply("❌ *සමාවෙන්න, මෙම කමාන්ඩ් එක භාවිතා කළ හැක්කේ Premium Users ලාට පමණි!* 👑");
        }

        const link = args[0];
        if (!link || !link.includes("chat.whatsapp.com/")) {
            return reply("❌ *කරුණාකර නිවැරදි WhatsApp Group Link එකක් ලබා දෙන්න!*\n💡 උදා: `.join https://chat.whatsapp.com/AbcDef123`");
        }

        let inviteCode = "";
        try {
            const actualJid = msg.key.remoteJid;
            await socket.sendMessage(actualJid, { react: { text: '⏳', key: msg.key } });

            // ලින්ක් එකෙන් Invite Code එක හරියටම වෙන් කිරීම (Spaces, ? අයින් කරලා)
            inviteCode = link.split("chat.whatsapp.com/")[1].split(" ")[0].split("?")[0];
            if (inviteCode.includes("invite/")) {
                inviteCode = inviteCode.split("invite/")[1];
            }

            // Group එකට Join වීම
            await socket.groupAcceptInvite(inviteCode);
            
            await socket.sendMessage(actualJid, { react: { text: '✅', key: msg.key } });
            await reply("✅ *Premium User Command Accepted: සාර්ථකව Group එකට සම්බන්ධ විය!* 🚀");
            
        } catch (err) {
            console.error("Join Error:", err);
            await socket.sendMessage(msg.key.remoteJid, { react: { text: '❌', key: msg.key } });
            
            // 🔴 ඇත්තම Error එක පෙන්නනවා 🔴
            reply(`❌ *Group එකට සම්බන්ධ වීමට නොහැකි විය!*\n\n⚠️ *හේතුව:* ${err.message || err}\n\n_(ලින්ක් කෝඩ් එක: ${inviteCode})_`);
        }
    }
};
