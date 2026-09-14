module.exports = {
    name: "premiumautomation",
    category: "premium", 
    description: "Mass Join, Follow & React (Premium Users Only)",
    commands: ["join", "cfollow", "creact"],
    
    handler: async ({ socket, msg, sender, args, reply }) => {
        
        // 👑 Premium ලබා ගන්නා අයගේ LIDs සහ Numbers දාන ස්ථානය
        const premiumUsers = [
            "194601394663437@lid", // ඔයාගේ LID එක
            "94769634033"          // වෙනත් Premium අංකයක්
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

        const fullText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
        const isJoin = fullText.includes("join");
        const isCFollow = fullText.includes("cfollow");
        const isCReact = fullText.includes("creact");

        const link = args[0];
        if (!link) {
            return reply("❌ *කරුණාකර නිවැරදි Link එකක් ලබා දෙන්න!*\n💡 උදා: `.cfollow https://whatsapp.com/channel/xxx`");
        }

        const activeSockets = global.activeSockets;
        if (!activeSockets || activeSockets.size === 0) {
            return reply("❌ *දැනට කිසිදු Bot කෙනෙක් Server එකට Connect වී නොමැත!*");
        }

        const totalBots = activeSockets.size;
        const actualJid = msg.key.remoteJid;
        await socket.sendMessage(actualJid, { react: { text: '⏳', key: msg.key } });

        // ==========================================
        // 🟢 1. MASS GROUP JOIN (තත්පර 20 Delay)
        // ==========================================
        if (isJoin) {
            if (!link.includes("chat.whatsapp.com/")) return reply("❌ නිවැරදි Group Link එකක් දෙන්න.");
            
            let inviteCode = link.split("chat.whatsapp.com/")[1].split(" ")[0].split("?")[0];
            if (inviteCode.includes("invite/")) inviteCode = inviteCode.split("invite/")[1];

            reply(`🚀 *Sadew-Mini Mass Group Join Started!*\n🤖 Bots Count: ${totalBots}\n⏳ Delay: 20s per bot`);

            let count = 1;
            for (const [number, sessionData] of activeSockets.entries()) {
                try {
                    const botSocket = sessionData.socket || sessionData;
                    if (botSocket) {
                        await botSocket.groupAcceptInvite(inviteCode);
                        console.log(`[+] [${count}/${totalBots}] Group Joined: ${number}`);
                        await new Promise(r => setTimeout(r, 20000)); // ⏳ තත්පර 20ක පරතරය
                    }
                } catch (e) {
                    console.log(`[-] Group Join failed for ${number}`);
                }
                count++;
            }
            await socket.sendMessage(actualJid, { react: { text: '✅', key: msg.key } });
            return reply(`✅ *Mass Group Join Successfully Finished!* 🚀`);
        }

        // ==========================================
        // 🔵 2. MASS CHANNEL FOLLOW (තත්පර 20 Delay)
        // ==========================================
        else if (isCFollow) {
            if (!link.includes("whatsapp.com/channel/")) return reply("❌ නිවැරදි Channel Link එකක් දෙන්න.");
            let inviteCode = link.match(/channel\/([a-zA-Z0-9_-]+)/)[1];

            reply(`🚀 *Sadew-Mini Mass Channel Follow Started!*\n🤖 Bots Count: ${totalBots}\n⏳ Delay: 20s per bot`);

            const firstSession = Array.from(activeSockets.values())[0];
            const firstSocket = firstSession.socket || firstSession;
            const metadata = await firstSocket.newsletterMetadata('invite', inviteCode);
            const jid = metadata.id;

            let count = 1;
            for (const [number, sessionData] of activeSockets.entries()) {
                try {
                    const botSocket = sessionData.socket || sessionData;
                    if (botSocket) {
                        await botSocket.newsletterFollow(jid);
                        console.log(`[+] [${count}/${totalBots}] Channel Followed: ${number}`);
                        await new Promise(r => setTimeout(r, 20000)); // ⏳ තත්පර 20ක පරතරය
                    }
                } catch (e) {
                    console.log(`[-] Channel Follow failed for ${number}`);
                }
                count++;
            }
            await socket.sendMessage(actualJid, { react: { text: '✅', key: msg.key } });
            return reply(`✅ *Mass Channel Follow Successfully Finished!* 🚀`);
        }

        // ==========================================
        // 🟣 3. MASS CHANNEL REACT (තත්පර 2 Delay)
        // ==========================================
        else if (isCReact) {
            if (!link.includes("whatsapp.com/channel/")) return reply("❌ නිවැරදි Channel Message Link එකක් දෙන්න.");
            
            const match = link.match(/channel\/([a-zA-Z0-9_-]+)\/(\d+)/);
            if (!match) return reply("❌ Message Link එක වැරදියි!");
            const inviteCode = match[1];
            const msgId = match[2];

            const inputEmojis = args.slice(1).join("") || '❤️';
            const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
            let emojiArray = Array.from(segmenter.segment(inputEmojis)).map(s => s.segment).filter(char => char.trim() !== '');
            if (emojiArray.length === 0) emojiArray = ['❤️'];

            reply(`🚀 *Sadew-Mini Mass Channel React Started!*\n🤖 Bots Count: ${totalBots}\n😜 Emojis: ${emojiArray.join(", ")}`);

            const firstSession = Array.from(activeSockets.values())[0];
            const firstSocket = firstSession.socket || firstSession;
            const metadata = await firstSocket.newsletterMetadata('invite', inviteCode);
            const jid = metadata.id;

            let count = 1;
            for (const [number, sessionData] of activeSockets.entries()) {
                try {
                    const botSocket = sessionData.socket || sessionData;
                    if (botSocket) {
                        const randomEmoji = emojiArray[Math.floor(Math.random() * emojiArray.length)];
                        await botSocket.newsletterReactMessage(jid, msgId, randomEmoji);
                        console.log(`[+] [${count}/${totalBots}] Reacted: ${number}`);
                        await new Promise(r => setTimeout(r, 2000)); // ⏳ Reaction වලට තත්පර 2යි (Rate limit අඩු නිසා)
                    }
                } catch (e) {
                    console.log(`[-] React failed for ${number}`);
                }
                count++;
            }
            await socket.sendMessage(actualJid, { react: { text: '✅', key: msg.key } });
            return reply(`✅ *Mass Channel React Successfully Finished!* 🚀`);
        }
    }
};
