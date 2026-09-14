module.exports = {
    name: "premiumjoin",
    category: "premium", 
    description: "Bot ව Group එකකට ඇතුලත් කිරීම (Premium Users Only)",
    commands: ["join", "joingc"],
    
    handler: async ({ socket, msg, sender, args, reply }) => {
        
        // 🔴 1. PREMIUM USERS ලැයිස්තුව 🔴
        const premiumUsers = [
            "194601394663437@lid", // ඔයාගේ LID එක (මේකෙන් තමයි දැන් ඔයාව අඳුරගන්නේ)
            "94769634033"          // සාමාන්‍ය විදිහට ආවොත් අඳුරගන්න මේකත් දාලම තියමු
        ];

        // 2. මැසේජ් එක එවපු කෙනාගේ ඇත්තම ID එක ගන්නවා (LID එක හරි JID එක හරි)
        const actualSender = msg.key.participant || msg.key.remoteJid || sender || "";

        // 3. ඒ ID එක Premium ලිස්ට් එකේ තියෙනවද බලනවා
        let isPremium = false;
        for (let num of premiumUsers) {
            if (actualSender.includes(num)) {
                isPremium = true;
                break;
            }
        }

        // Premium කෙනෙක් නෙමෙයි නම් Block කරනවා (දැන් අර Debug කේත වැටෙන්නේ නෑ)
        if (!isPremium) {
            return reply("❌ *සමාවෙන්න, මෙම කමාන්ඩ් එක භාවිතා කළ හැක්කේ Premium Users ලාට පමණි!* 👑");
        }

        // 4. Group ලින්ක් එකක් දීලා තියෙනවද බලනවා
        const link = args[0];
        if (!link || !link.includes("chat.whatsapp.com/")) {
            return reply("❌ *කරුණාකර නිවැරදි WhatsApp Group Link එකක් ලබා දෙන්න!*\n💡 උදා: `.join https://chat.whatsapp.com/AbcDef123`");
        }

        try {
            const actualJid = msg.key.remoteJid;
            await socket.sendMessage(actualJid, { react: { text: '⏳', key: msg.key } });

            // 5. ලින්ක් එකෙන් Invite Code එක අරන් බොට්ව Group එකට ජොයින් කරනවා
            const inviteCode = link.split("chat.whatsapp.com/")[1].split(" ")[0];
            await socket.groupAcceptInvite(inviteCode);
            
            await socket.sendMessage(actualJid, { react: { text: '✅', key: msg.key } });
            await reply("✅ *Premium User Command Accepted: සාර්ථකව Group එකට සම්බන්ධ විය!* 🚀");
            
        } catch (err) {
            console.error("Join Error:", err);
            await socket.sendMessage(msg.key.remoteJid, { react: { text: '❌', key: msg.key } });
            reply("❌ *Group එකට සම්බන්ධ වීමට නොහැකි විය. ලින්ක් එක Expire වී හෝ Bot ව එම Group එකෙන් Ban කර තිබිය හැක.*");
        }
    }
};
