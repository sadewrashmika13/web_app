module.exports = {
    name: "premiumjoin",
    category: "owner",
    description: "Bot ව Group එකකට ඇතුලත් කිරීම (Premium Users Only)",
    commands: ["join", "joingc"],
    
    handler: async ({ socket, msg, sender, args, reply }) => {
        
        // 🔴 1. PREMIUM USERS ලැයිස්තුව 🔴
        // ඔයාගේ අංකය සහ තව Premium දෙන්න ඕනේ අයගේ අංක මෙතනට දාන්න.
        // අලුත් කෙනෙක්ව Add කරන්න ඕනේ නම් කමා (,) එකක් දාලා යටින් අංකය දාන්න.
        const premiumUsers = [
            "94769634033", // ඔයාගේ අංකය (ප්‍රධාන Admin)
            // "94710000000", // තව කෙනෙක්ට දෙනවනම් මෙහෙම දාන්න
            // "94770000000"
        ];

        // 2. මැසේජ් එක එවපු කෙනාගේ අංකය වෙන් කරගැනීම
        const senderNumber = sender.split('@')[0].split(':')[0];

        // 3. මැසේජ් එක එවපු කෙනා Premium ලිස්ට් එකේ ඉන්නවද කියලා බැලීම
        if (!premiumUsers.includes(senderNumber)) {
            return reply("❌ *සමාවෙන්න, මෙම කමාන්ඩ් එක භාවිතා කළ හැක්කේ Premium Users ලාට පමණි!* 👑");
        }

        // 4. Group ලින්ක් එකක් දීලා තියෙනවද කියලා බැලීම
        const link = args[0];
        if (!link || !link.includes("chat.whatsapp.com/")) {
            return reply("❌ *කරුණාකර නිවැරදි WhatsApp Group Link එකක් ලබා දෙන්න!*\n💡 උදා: `.join https://chat.whatsapp.com/AbcDef123`");
        }

        try {
            await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

            // 5. ලින්ක් එකෙන් Invite Code එක වෙන් කරගෙන Group එකට Join වීම
            const inviteCode = link.split("chat.whatsapp.com/")[1].split(" ")[0];
            await socket.groupAcceptInvite(inviteCode);
            
            await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
            await reply("✅ *සාර්ථකව Group එකට සම්බන්ධ විය!* 🚀");
            
        } catch (err) {
            console.error("Join Error:", err);
            await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
            reply("❌ *Group එකට සම්බන්ධ වීමට නොහැකි විය. ලින්ක් එක Expire වී හෝ Bot ව එම Group එකෙන් Ban කර තිබිය හැක.*");
        }
    }
};
