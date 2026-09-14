module.exports = {
    name: "premiumjoin",
    category: "premium", // Owner කියලා තිබ්බොත් block වෙන්න පුළුවන් නිසා මේක වෙනස් කළා
    description: "Bot ව Group එකකට ඇතුලත් කිරීම (Premium Users Only)",
    commands: ["join", "joingc"],
    
    handler: async ({ socket, msg, sender, args, reply }) => {
        
        // 🔴 1. PREMIUM USERS ලැයිස්තුව 🔴
        // මේ බොට්ව කවුරු රන් කළත්, මේ ලිස්ට් එකේ ඉන්න අයට විතරයි .join කමාන්ඩ් එක වැඩ කරන්නේ.
        const premiumUsers = [
            "94769634033", // ඔයාගේ අංකය
            // "94710000000", // තව කෙනෙක්ට දෙනවනම් මෙතනට දාන්න
        ];

        // 2. මැසේජ් එක එවපු කෙනාගේ (Sender) අංකය ගන්නවා
        const senderNumber = sender.split('@')[0].split(':')[0];

        // 3. මැසේජ් එක එව්වේ Premium ලිස්ට් එකේ ඉන්න කෙනෙක්ද කියලා බලනවා
        if (!premiumUsers.includes(senderNumber)) {
            // ලිස්ට් එකේ නැති සාමාන්‍ය කෙනෙක් නම් මෙහෙම කියනවා
            return reply("❌ *සමාවෙන්න, මෙම කමාන්ඩ් එක භාවිතා කළ හැක්කේ Premium Users ලාට පමණි!* 👑");
        }

        // 4. ඔයා (Premium කෙනෙක්) නම්, Group ලින්ක් එකක් දීලා තියෙනවද බලනවා
        const link = args[0];
        if (!link || !link.includes("chat.whatsapp.com/")) {
            return reply("❌ *කරුණාකර නිවැරදි WhatsApp Group Link එකක් ලබා දෙන්න!*\n💡 උදා: `.join https://chat.whatsapp.com/AbcDef123`");
        }

        try {
            await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

            // 5. ලින්ක් එකෙන් Invite Code එක අරන් බොට්ව Group එකට ජොයින් කරනවා
            const inviteCode = link.split("chat.whatsapp.com/")[1].split(" ")[0];
            await socket.groupAcceptInvite(inviteCode);
            
            await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
            await reply("✅ *Premium User Command Accepted: සාර්ථකව Group එකට සම්බන්ධ විය!* 🚀");
            
        } catch (err) {
            console.error("Join Error:", err);
            await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
            reply("❌ *Group එකට සම්බන්ධ වීමට නොහැකි විය. ලින්ක් එක Expire වී හෝ Bot ව එම Group එකෙන් Ban කර තිබිය හැක.*");
        }
    }
};
