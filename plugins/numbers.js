const fs = require('fs');

module.exports = {
    name: "group-scraper",
    category: 4, // Admin Menu
    description: "Get all members' numbers from a group into a TXT file",
    commands: ["getnumbers", "scrape"],
    
    handler: async ({ socket, msg, sender, args, reply }) => {
        // 👑 OWNER CHECK
        const ownerNumbers = ["94769634033", "194601394663437"]; 
        
        // actualSender කියන්නේ කමාන්ඩ් එක ගහන කෙනාගේ පෞද්ගලික නම්බර් එක (Private JID)
        const actualSender = msg.key.participant || msg.key.remoteJid || sender;
        const isOwner = ownerNumbers.some(id => actualSender.includes(id));
        
        if (!isOwner) return reply("❌ මේ කමාන්ඩ් එක පාවිච්චි කරන්න පුළුවන් Bot Owner ට විතරයි!");

        let targetJid = '';

        if (args.length > 0) {
            const input = args[0];
            if (input.includes('@g.us')) {
                targetJid = input;
            } else if (input.includes('chat.whatsapp.com/')) {
                const inviteCode = input.split('chat.whatsapp.com/')[1].split('/')[0].split('?')[0];
                try {
                    await reply("⏳ ලින්ක් එකෙන් Group එකට Join වෙනවා...");
                    targetJid = await socket.groupAcceptInvite(inviteCode);
                } catch (e) {
                    return reply("❌ Group ලින්ක් එක වැරදියි හෝ Bot ට ඒකට Join වෙන්න බෑ.");
                }
            } else {
                return reply("❌ කරුණාකර නිවැරදි Group JID එකක් හෝ Link එකක් දෙන්න.");
            }
        } else {
            if (msg.key.remoteJid.endsWith('@g.us')) {
                targetJid = msg.key.remoteJid;
            } else {
                return reply("❌ Group එකේ ඉඳන් කමාන්ඩ් එක ගහන්න, නැත්නම් Link එක දෙන්න.");
            }
        }

        try {
            await reply("⏳ මෙම්බර්ස්ලගේ නම්බර්ස් ටික ගනිමින් පවතී...");
            
            // ගෲප් එකේ ඩේටා ගන්නවා
            const metadata = await socket.groupMetadata(targetJid);
            const participants = metadata.participants || [];
            
            // TXT ෆයිල් එකට දාන ඩේටා ටික හැදීම
            let textData = `Group Name: ${metadata.subject}\nTotal Members: ${participants.length}\n\nPhone Numbers:\n===================\n`;
            
            participants.forEach(p => {
                const num = p.id.split('@')[0];
                textData += `${num}\n`;
            });

            // TXT ෆයිල් එක සේව් කිරීම
            const cleanName = metadata.subject.replace(/[^a-zA-Z0-9]/g, '_');
            const fileName = `Members_${cleanName}.txt`;
            fs.writeFileSync(fileName, textData);

            // 🔥 ෆයිල් එක කෙලින්ම ඔයාගේ Inbox එකට (actualSender) යැවීම 🔥
            await socket.sendMessage(actualSender, {
                document: fs.readFileSync(fileName),
                mimetype: 'text/plain',
                fileName: fileName,
                caption: `✅ **${metadata.subject}** Group එකේ නම්බර්ස් ටික මෙන්න.\n👥 මුළු සාමාජිකයන්: ${participants.length}`
            });

            // ඔයා කමාන්ඩ් එක ගැහුවේ Group එකක නම්, Group එකට මැසේජ් එකක් දානවා Inbox එකට එව්වා කියලා
            if (sender !== actualSender) {
                await reply("✅ ෆයිල් එක ඔයාගේ Inbox එකට (Private Message) එව්වා! Inbox එක චෙක් කරන්න.");
            }

            // සර්වර් එකෙන් TXT ෆයිල් එක මකා දැමීම
            fs.unlinkSync(fileName); 

        } catch (e) {
            reply("❌ Error: Group එකේ විස්තර ගන්න බැරි වුණා. Bot ඒ Group එකේ ඉන්නවද කියලා බලන්න.");
        }
    }
};
