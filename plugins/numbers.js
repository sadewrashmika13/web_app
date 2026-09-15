const fs = require('fs');

module.exports = {
    name: "group-scraper",
    category: 4, // Admin Menu
    description: "Get group members' numbers with format selection",
    commands: ["getnumbers", "scrape", "getnumfmt"], 
    
    handler: async ({ socket, msg, sender, command, args, reply }) => {
        // 👑 OWNER CHECK
        const ownerNumbers = ["94769634033", "194601394663437"]; 
        const actualSender = msg.key.participant || msg.key.remoteJid || sender;
        const isOwner = ownerNumbers.some(id => actualSender.includes(id));
        
        if (!isOwner) return reply("❌ මේ කමාන්ඩ් එක පාවිච්චි කරන්න පුළුවන් Bot Owner ට විතරයි!");

        // ════════════ 1. මුලින්ම කමාන්ඩ් එක ගහද්දි (BUTTONS යැවීම) ════════════
        if (command === "getnumbers" || command === "scrape") {
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

            const capText = `*↳ ❝ [ 👥 𝗚𝗿𝗼𝘂𝗽 𝗦𝗰𝗿𝗮𝗽𝗲𝗿 ] ¡! ❞*\n\n` +
                            `👇 *ඔබට නම්බර්ස් ටික අවශ්‍ය කොයි Format එකටද කියලා තෝරන්න:*`;
            
            const buttons = [
                { buttonId: `.getnumfmt txt ${targetJid}`, buttonText: { displayText: '📄 TXT File' }, type: 1 },
                { buttonId: `.getnumfmt list ${targetJid}`, buttonText: { displayText: '📜 List Message' }, type: 1 },
                { buttonId: `.getnumfmt line ${targetJid}`, buttonText: { displayText: '➖ Line (Comma)' }, type: 1 }
            ];

            await socket.sendMessage(actualSender, { 
                text: capText, 
                footer: '🔮 SADEW-MINI 🔮', 
                buttons: buttons, 
                headerType: 1 
            });

            if (sender !== actualSender) {
                await reply("✅ ඔයාගේ Inbox එකට Format එක තෝරන්න මැසේජ් එකක් එව්වා! Inbox එක චෙක් කරන්න.");
            }
            return;
        }

        // ════════════ 2. BUTTON එක එබුවට පස්සේ වැඩ කරන කොටස ════════════
        if (command === "getnumfmt") {
            const format = args[0];
            const targetJid = args[1];

            if (!format || !targetJid) return reply("❌ Invalid request.");

            try {
                await socket.sendMessage(actualSender, { text: "⏳ නම්බර්ස් ටික ගනිමින් පවතී..." });
                
                const metadata = await socket.groupMetadata(targetJid);
                const participants = metadata.participants || [];
                
                // 🔥 LID ද Normal Number ද කියලා බලලා හරියටම වෙන් කරනවා 🔥
                const numbers = participants.map(p => {
                    if (p.id.includes('@lid')) {
                        // LID එකක් නම් අගට @lid කියලා දාලා එවනවා
                        return p.id.split('@')[0].split(':')[0] + '@lid';
                    } else {
                        // සාමාන්‍ය නම්බර් එකක් නම් පිරිසිදු අංකය විතරක් එවනවා
                        return p.id.split('@')[0].split(':')[0];
                    }
                });

                if (format === 'txt') {
                    let textData = `Group Name: ${metadata.subject}\nTotal Members: ${participants.length}\n\nPhone Numbers:\n===================\n`;
                    textData += numbers.join('\n');
                    
                    const cleanName = metadata.subject.replace(/[^a-zA-Z0-9]/g, '_');
                    const fileName = `Members_${cleanName}.txt`;
                    fs.writeFileSync(fileName, textData);

                    await socket.sendMessage(actualSender, {
                        document: fs.readFileSync(fileName),
                        mimetype: 'text/plain',
                        fileName: fileName,
                        caption: `✅ **${metadata.subject}** Group එකේ නම්බර්ස් ටික.\n👥 සාමාජිකයන්: ${participants.length}`
                    });
                    fs.unlinkSync(fileName);
                } 
                else if (format === 'list') {
                    let listText = `✅ **${metadata.subject}**\n👥 සාමාජිකයන්: ${participants.length}\n\n`;
                    listText += numbers.join('\n');
                    await socket.sendMessage(actualSender, { text: listText });
                } 
                else if (format === 'line') {
                    let lineText = `✅ **${metadata.subject}**\n👥 සාමාජිකයන්: ${participants.length}\n\n`;
                    lineText += numbers.join(',');
                    await socket.sendMessage(actualSender, { text: lineText });
                }

            } catch (e) {
                await socket.sendMessage(actualSender, { text: "❌ Error: Group එකේ විස්තර ගන්න බැරි වුණා." });
            }
        }
    }
};
