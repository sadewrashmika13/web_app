// 🛡️ Timeout Guard
const withTimeout = (promise, ms = 4000) => {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
    ]);
};

module.exports = {
    name: "getdp",
    category: 5, // Tools & Edits
    description: "📸 Get WhatsApp profile picture and about",
    commands: ["getdp", "dp", "getprofile"],

    handler: async ({ socket, msg, sender, args, reply }) => {
        try {
            let targetJid = null;
            const qCtx = msg.message?.extendedTextMessage?.contextInfo;

            // 1. Target JID හඳුනාගැනීම (Mentions / Reply / Number / Self)
            if (qCtx?.mentionedJid?.length > 0) {
                targetJid = qCtx.mentionedJid[0];
            } else if (qCtx?.participant) {
                targetJid = qCtx.participant;
            } else if (args && args.length > 0) {
                let rawNum = args.join('').replace(/[^0-9]/g, '');
                if (rawNum.startsWith('0') && rawNum.length === 10) {
                    rawNum = '94' + rawNum.slice(1);
                }
                if (rawNum.length >= 8) {
                    targetJid = rawNum + '@s.whatsapp.net';
                }
            } else {
                targetJid = sender;
            }

            if (!targetJid) {
                return reply("❌ *කරුණාකර අංකයක්, Tag එකක් හෝ Message එකකට Reply එකක් ලබා දෙන්න.*");
            }

            try { await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } }); } catch (_) {}

            // 2. Multi-Device JID Normalization (Device Node Clean කිරීම)
            const cleanNumber = targetJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
            const cleanJid = `${cleanNumber}@s.whatsapp.net`;

            // 3. Status (Bio) ලබාගැනීම
            let about = 'Not available (Privacy / Restricted)';
            try {
                const statusRes = await withTimeout(socket.fetchStatus(cleanJid), 3500);
                if (statusRes?.status) about = statusRes.status;
            } catch (_) {}

            // 4. Triple Fallback Profile Picture Fetching
            let ppUrl = null;
            try {
                // Try HD Image
                ppUrl = await withTimeout(socket.profilePictureUrl(cleanJid, 'image'), 4000);
            } catch (_) {
                try {
                    // Try SD Preview
                    ppUrl = await withTimeout(socket.profilePictureUrl(cleanJid, 'preview'), 3500);
                } catch (_) {
                    try {
                        // Try Default Method
                        ppUrl = await withTimeout(socket.profilePictureUrl(cleanJid), 3000);
                    } catch (_) {
                        ppUrl = null;
                    }
                }
            }

            const caption = `*↳ ❝ [📸 𝗦𝗮𝗱𝗲 w-𝗠𝗶𝗻𝗶 𝗣𝗿𝗼𝗳𝗶𝗹𝗲 📸] ¡! ❞*\n\n` +
                            `📞 *Number:* +${cleanNumber}\n` +
                            `📝 *About:* ${about}\n\n` +
                            `> *𝗦𝗮𝗱𝗲 w-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲 w 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

            // 5. Message Send කිරීම
            if (ppUrl) {
                try {
                    await socket.sendMessage(sender, { 
                        image: { url: ppUrl }, 
                        caption: caption,
                        mentions: [cleanJid]
                    }, { quoted: msg });
                } catch (imgErr) {
                    await socket.sendMessage(sender, { 
                        text: `🖼️ *DP Link හමුවූ නමුත් Image එක Load කිරීම අසාර්ථක විය.*\n\n${caption}`,
                        mentions: [cleanJid]
                    }, { quoted: msg });
                }
            } else {
                await socket.sendMessage(sender, { 
                    text: `🖼️ *Profile Picture එක ලබාගත නොහැකි විය.*\n_(මෙම අංකය සමඟ බොට්ගේ Chat History එකක් නැති නිසා WhatsApp Server එකෙන් Query එක Block කර ඇත.)_\n\n${caption}`,
                    mentions: [cleanJid]
                }, { quoted: msg });
            }

            try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        } catch (error) {
            console.error("[GetDP Error]:", error.message);
            try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            await reply(`❌ *Failed:* ${error.message}`);
        }
    }
};