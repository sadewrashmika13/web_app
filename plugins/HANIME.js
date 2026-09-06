const axios = require('axios');
const { generateWAMessageFromContent } = require('baileys');

module.exports = {
    name: "hanime",
    category: "anime",
    description: "Search and Download Anime from AnimeHeaven",
    commands: ["hanime", "hdown"],
    
    handler: async ({ socket, msg, sender, command, args, reply }) => {
        // 🛑 Error එන්නේ නැති වෙන්න ආරක්ෂිතව args ගන්නවා
        const q = (args && args.length > 0) ? args.join(" ").trim() : "";

        // ════════════ SEARCH ANIME (.hanime) ════════════
        if (command === "hanime") {
            if (!q) return reply("❌ *කරුණාකර ඇනිමෙ නමක් දෙන්න!*\n💡 උදා: `.hanime naruto`");
            
            await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } });
            
            try {
                const searchUrl = `https://animeheaven.me/search.php?s=${encodeURIComponent(q)}`;
                const res = await axios.get(searchUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' }
                });
                
                const html = res.data;
                const matches = [...html.matchAll(/<a href=['"](anime\.php\?[^'"]+)['"]>.*?<img class=['"]coverimg['"] src=['"]([^'"]*)['"] alt=['"]([^'"]*)['"]/gi)];
                
                if (matches.length === 0) return reply("🚫 *සමාවෙන්න, ප්‍රතිඵල කිසිවක් හමුවුණේ නෑ!*");
                
                let rows = [];
                let seen = new Set();
                
                for (const m of matches) {
                    if (rows.length >= 10) break; 
                    const animeId = m[1].replace('anime.php?', '');
                    const title = m[3].trim();
                    
                    if (!seen.has(animeId)) {
                        seen.add(animeId);
                        rows.push({
                            header: "",
                            title: title,
                            description: "Tap to view episodes",
                            id: `.hdown ${animeId}`
                        });
                    }
                }
                
                const listMessage = {
                    title: "🎬 𝐒𝐞𝐥𝐞𝐜𝐭 𝐀𝐧𝐢𝐦𝐞",
                    sections: [{ title: "Search Results (Top 10)", rows: rows }]
                };
                
                const msgContent = {
                    viewOnceMessage: {
                        message: {
                            interactiveMessage: {
                                header: { hasMediaAttachment: false },
                                body: { text: `🎯 *AnimeHeaven Search Results for :* _${q}_\n\n👇 පහළ තියෙන Button එක ඔබලා Anime එක තෝරන්න.` },
                                footer: { text: "🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮" },
                                nativeFlowMessage: {
                                    buttons: [{
                                        name: "single_select",
                                        buttonParamsJson: JSON.stringify(listMessage)
                                    }]
                                }
                            }
                        }
                    }
                };
                
                // 🛑 මෙතනයි Error එක හැදුවේ (Safe message generation)
                let waMsg;
                try {
                    waMsg = generateWAMessageFromContent(sender, msgContent, { quoted: msg });
                } catch (e) {
                    waMsg = generateWAMessageFromContent(msgContent, { userJid: socket.user?.id, quoted: msg });
                }
                
                await socket.relayMessage(sender, waMsg.message, { messageId: waMsg.key.id });
                
            } catch (err) {
                reply(`❌ *Search Error:* ${err.message}`);
            }
        }

        // ════════════ DOWNLOAD ANIME (.hdown) ════════════
        if (command === "hdown") {
            if (!q) return;
            
            let animeId = q;
            let targetEp = null;
            
            if (q.includes('|')) {
                const parts = q.split('|');
                animeId = parts[0];
                targetEp = parseInt(parts[1]);
            }
            
            await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });
            
            try {
                const seriesUrl = `https://animeheaven.me/anime.php?${animeId}`;
                const res = await axios.get(seriesUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                
                const html = res.data;
                const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
                let videoname = titleMatch ? titleMatch[1].replace('Anime | AnimeHeaven.Me', '').trim() : "Anime";
                
                const epRegex = /onclick=['"]gatea\(['"]([^'"]+)['"]\)['"][^>]*>[\s\S]*?<div class=['"]watch2 bc\s*['"]>(\d+)<\/div>/gi;
                const episodes = [];
                let epMatch;
                
                while ((epMatch = epRegex.exec(html)) !== null) {
                    episodes.push({ hash: epMatch[1], num: parseInt(epMatch[2]) });
                }
                
                if (episodes.length === 0) return reply("🚫 *Episodes හොයාගන්න බැරි වුණා!*");
                episodes.sort((a, b) => a.num - b.num);
                
                // 1️⃣ Multiple episodes - Show List
                if (!targetEp && episodes.length > 1) {
                    let rows = [];
                    for (let i = 0; i < Math.min(episodes.length, 10); i++) {
                        const ep = episodes[i];
                        rows.push({
                            header: "",
                            title: `Episode ${ep.num}`,
                            description: `Download ${videoname} - Ep ${ep.num}`,
                            id: `.hdown ${animeId}|${ep.num}`
                        });
                    }
                    
                    const listMessage = {
                        title: "📺 𝐒𝐞𝐥𝐞𝐜𝐭 𝐄𝐩𝐢𝐬𝐨𝐝𝐞",
                        sections: [{ title: "Available Episodes (Max 10)", rows: rows }]
                    };
                    
                    const msgContent = {
                        viewOnceMessage: {
                            message: {
                                interactiveMessage: {
                                    header: { hasMediaAttachment: false },
                                    body: { text: `🎬 *${videoname}*\n\n👇 කරුණාකර ඔයාට ඕනේ Episode එක තෝරන්න.` },
                                    footer: { text: "🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮" },
                                    nativeFlowMessage: { buttons: [{ name: "single_select", buttonParamsJson: JSON.stringify(listMessage) }] }
                                }
                            }
                        }
                    };
                    
                    // 🛑 මෙතනත් Safe generation දැම්මා
                    let waMsg;
                    try {
                        waMsg = generateWAMessageFromContent(sender, msgContent, { quoted: msg });
                    } catch (e) {
                        waMsg = generateWAMessageFromContent(msgContent, { userJid: socket.user?.id, quoted: msg });
                    }
                    
                    return await socket.relayMessage(sender, waMsg.message, { messageId: waMsg.key.id });
                }
                
                // 2️⃣ Download specific episode
                let selectedEp = targetEp ? episodes.find(e => e.num === targetEp) : episodes[0];
                if (!selectedEp) return reply("🚫 Episode not found!");
                
                const hash = selectedEp.hash;
                const gateRes = await axios.get('https://animeheaven.me/gate.php', {
                    headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': seriesUrl, 'Cookie': `key=${hash}` }
                });
                
                const gateHtml = gateRes.data;
                const downloadRegex = /<a\s+href=['"](https?:\/\/[a-z0-9]+\.animeheaven\.me\/video\.mp4\?[^'"]+)['"]/gi;
                let dlMatch = downloadRegex.exec(gateHtml);
                
                let finalDlLink = '';
                if (dlMatch) {
                    finalDlLink = dlMatch[1];
                } else {
                    const sourceRegex = /<source\s+src=['"]([^'"]+)['"]/gi;
                    let srcMatch;
                    while ((srcMatch = sourceRegex.exec(gateHtml)) !== null) {
                        let src = srcMatch[1];
                        if (src && !src.includes('&error')) {
                            if (src.startsWith('//')) src = 'https:' + src;
                            if (src.includes('.animeheaven.me')) {
                                finalDlLink = src.replace(/&[a-z0-9]+$/, '&d');
                                break;
                            }
                        }
                    }
                }
                
                if (!finalDlLink) return reply("🚫 *සමාවෙන්න, Video Link එක හොයාගන්න බැරි වුණා!*");
                
                await socket.sendMessage(sender, { react: { text: '📤', key: msg.key } });
                
                await socket.sendMessage(sender, {
                    document: { url: finalDlLink },
                    mimetype: 'video/mp4',
                    fileName: `${videoname} - Ep ${selectedEp.num} [SADEW].mp4`,
                    caption: `🎬 *${videoname}* - Episode ${selectedEp.num}\n\n> 🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮`
                }, { quoted: msg });
                
                await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
                
            } catch (err) {
                reply(`❌ *Download Error:* ${err.message}`);
            }
        }
    }
};
