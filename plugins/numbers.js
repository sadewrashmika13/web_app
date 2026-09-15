const fs = require('fs');

module.exports = {
    name: "group-scraper",
    category: 4, // Admin Menu
    description: "Get group members' numbers and save as VCF",
    commands: ["getnumbers", "scrape", "getnumfmt"], 
    
    // 🔥 මෙතනට store කියන එකත් එකතු කළා 🔥
    handler: async ({ socket, msg, sender, command, args, reply, store }) => {
        // 👑 OWNER CHECK
        const ownerNumbers = ["94769634033", "194601394663437"]; 
        const actualSender = msg.key.participant || msg.key.remoteJid || sender;
        const isOwner = ownerNumbers.some(id => actualSender.includes(id));
        
        if (!isOwner) return reply("❌ මේ කමාන්ඩ් එක පාවිච්චි කරන්න පුළුවන් Bot Owner ට විතරයි!");

        // ════════════ 1. BUTTONS යැවීම ════════════
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
                { buttonId: `.getnumfmt vcf ${targetJid}`, buttonText: { displayText: '📇 VCF (Save Contacts)' }, type: 1 },
                { buttonId: `.getnumfmt txt ${targetJid}`, buttonText: { displayText: '📄 TXT File' }, type: 1 },
                { buttonId: `.getnumfmt list ${targetJid}`, buttonText: { displayText: '📜 List Message' }, type: 1 }
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
                await socket.sendMessage(actualSender, { text: "⏳ නම්බර්ස් ටික ගනිමින් පවතී... (හංගපු නම්බර්ස් Convert කරමින් පවතී. පොඩ්ඩක් ඉන්න)" });
                
                const metadata = await socket.groupMetadata(targetJid);
                const participants = metadata.participants || [];
                
                let resolvedNumbers = [];
                let unresolvedCount = 0; // Convert කරන්න බැරි වුණ ගාන

                // 🔥 LIDs අඳුරගෙන Convert කරන අලුත් ලොජික් එක 🔥
                for (let p of participants) {
                    let rawId = p.id;

                    if (rawId.includes('@lid')) {
                        let pn = null;
                        
                        try {
                            // 1. Signal DB එකෙන් බලනවා
                            if (socket.signalRepository && socket.signalRepository.lidMapping) {
                                pn = await socket.signalRepository.lidMapping.getPNForLID(rawId);
                            }
                        } catch (err) {}

                        // 2. ඒකෙන් බැරි වුණොත් Store එකෙන් බලනවා
                        if (!pn) {
                            let contactInfo = store?.contacts?.[rawId] || (store?.contacts && Object.values(store.contacts).find(c => c.lid === rawId));
                            if (contactInfo && contactInfo.id) {
                                pn = contactInfo.id;
                            }
                        }

                        // නම්බර් එක හම්බුණා නම් ලිස්ට් එකට ගන්නවා, නැත්නම් අත්හැරලා දානවා (unresolved)
                        if (pn) {
                            resolvedNumbers.push(pn.split('@')[0].split(':')[0]);
                        } else {
                            unresolvedCount++;
                        }
                    } else {
                        // සාමාන්‍ය නම්බර් එකක් නම් කෙලින්ම ගන්නවා
                        resolvedNumbers.push(rawId.split('@')[0].split(':')[0]);
                    }
                }

                // ඔක්කොම LIDs වෙලා එකක්වත් Convert වුණේ නැත්නම්
                if (resolvedNumbers.length === 0) {
                    return await socket.sendMessage(actualSender, { text: `❌ කිසිම නම්බර් එකක් ගන්න බැරි වුණා. (සාමාජිකයන් ${unresolvedCount} ගේම නම්බර්ස් හංගලා තියෙන්නේ, ඒ කිසිම කෙනෙක් Bot එක්ක කතා කරලත් නෑ.)` });
                }

                const cleanName = metadata.subject.replace(/[^a-zA-Z0-9]/g, '_');
                const captionStats = `✅ **${metadata.subject}**\n👥 මුළු සාමාජිකයන්: ${participants.length}\n✅ සාර්ථකව ගත්ත නම්බර්ස්: ${resolvedNumbers.length}\n❌ හංගපු (ගන්න බැරිවුණ) නම්බර්ස්: ${unresolvedCount}`;

                // 📇 (1) VCF (Save Contacts) File එකක් විදිහට යැවීම
                if (format === 'vcf') {
                    let vcfData = '';
                    resolvedNumbers.forEach((num, index) => {
                        let contactName = `${metadata.subject} ${index + 1}`; 
                        vcfData += 'BEGIN:VCARD\n' +
                                   'VERSION:3.0\n' +
                                   `FN:${contactName}\n` +
                                   `TEL;type=CELL;type=VOICE;waid=${num}:+${num}\n` +
                                   'END:VCARD\n';
                    });

                    const fileName = `Contacts_${cleanName}.vcf`;
                    fs.writeFileSync(fileName, vcfData);

                    await socket.sendMessage(actualSender, {
                        document: fs.readFileSync(fileName),
                        mimetype: 'text/vcard',
                        fileName: fileName,
                        caption: `${captionStats}\n\n📥 මේ ෆයිල් එක Download කරලා Open කරන්න. එකපාර ඔක්කොම ෆෝන් එකට Save වෙයි!`
                    });
                    fs.unlinkSync(fileName);
                }
                // 📄 (2) TXT File එකක් විදිහට යැවීම
                else if (format === 'txt') {
                    let textData = `Group Name: ${metadata.subject}\nTotal Members: ${participants.length}\nResolved Numbers: ${resolvedNumbers.length}\nUnresolved (Skipped): ${unresolvedCount}\n\nPhone Numbers:\n===================\n`;
                    textData += resolvedNumbers.join('\n');
                    
                    const fileName = `Members_${cleanName}.txt`;
                    fs.writeFileSync(fileName, textData);

                    await socket.sendMessage(actualSender, {
                        document: fs.readFileSync(fileName),
                        mimetype: 'text/plain',
                        fileName: fileName,
                        caption: `${captionStats}`
                    });
                    fs.unlinkSync(fileName);
                } 
                // 📜 (3) List Message එකක් විදිහට යැවීම
                else if (format === 'list') {
                    let listText = `${captionStats}\n\n`;
                    listText += resolvedNumbers.join('\n');
                    await socket.sendMessage(actualSender, { text: listText });
                } 

            } catch (e) {
                console.log(e);
                await socket.sendMessage(actualSender, { text: "❌ Error: Group එකේ විස්තර ගන්න බැරි වුණා." });
            }
        }
    }
};
