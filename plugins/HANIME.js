const axios = require('axios');
const { generateWAMessageFromContent } = require('baileys');

// ════════ Helper Function (බාගන්න කෑල්ල) ════════
async function processDownload(socket, msg, sender, animeId, epsToDownload, targetJid, meta) {
    await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } });
    
    // Group එකට (JID) Details Card එක යවනවා
    if (targetJid !== sender) {
        let cardText = `🎬 *${meta.videoname}*\n\n📝 _${meta.desc}_\n\n> 🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮`;
        if (meta.thumbnail) {
            await socket.sendMessage(targetJid, { image: { url: meta.thumbnail }, caption: cardText });
        } else {
            await socket.sendMessage(targetJid, { text: cardText });
        }
        await socket.sendMessage(sender, { text: `✅ *Details Card එක සහ Episodes ${targetJid} ට යවන්න පටන් ගත්තා!*` }, { quoted: msg });
    }
    
    // Episodes බානවා
    for (const ep of epsToDownload) {
        try {
            const hash = ep.hash;
            const gateRes = await axios.get('https://animeheaven.me/gate.php', {
                headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': meta.seriesUrl, 'Cookie': `key=${hash}` }
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
                        if (src.includes('.animeheaven.me')) { finalDlLink = src.replace(/&[a-z0-9]+$/, '&d'); break; }
                    }
                }
            }
            
            if (!finalDlLink) {
                await socket.sendMessage(sender, { text: `🚫 *Ep ${ep.num} හොයාගන්න බැරි වුණා!*` });
                continue;
            }
            
            await socket.sendMessage(sender, { react: { text: '📤', key: msg.key } });
            
            const streamResponse = await axios({ url: finalDlLink, method: 'GET', responseType: 'stream' });
            
            await socket.sendMessage(targetJid, {
                document: { stream: streamResponse.data },
                mimetype: 'video/mp4',
                fileName: `${meta.videoname} - Ep ${ep.num} [SADEW].mp4`,
                caption: `🎬 *${meta.videoname}* - Episode ${ep.num}\n\n> 🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮`
            }, { quoted: (targetJid === sender ? msg : undefined) }); 
            
            if (epsToDownload.length > 1) {
                await new Promise(r => setTimeout(r, 3000));
            }
        } catch (err) {
            await socket.sendMessage(sender, { text: `❌ *Ep ${ep.num} Error:* ${err.message}` });
        }
    }
    await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
}

// ════════ Plugin Body ════════
module.exports = {
    name: "hanime",
    category: "anime",
    description: "Search (Buttons) and Download (Number Reply) Anime",
    commands: ["hanime", "hdown"],
    
    handler: async ({ socket, msg, sender, command, args, reply }) => {
        
        // 🛑 EPISODE REPLY CATCHER
        if (!global.hanimeListenerAttached) {
            global.hanimeCache = {};
            
            const getActualMessage = (m) => {
                if (!m) return null;
                if (m.ephemeralMessage) return m.ephemeralMessage.message;
                if (m.viewOnceMessage) return m.viewOnceMessage.message;
                return m;
            };

            socket.ev.on('messages.upsert', async (m) => {
                try {
                    const replyMsg = m.messages[0];
                    if (!replyMsg.message || replyMsg.key.fromMe) return;

                    const actualMsg = getActualMessage(replyMsg.message);
                    const extMsg = actualMsg?.extendedTextMessage;
                    const context = extMsg?.contextInfo;
                    if (!context || !context.stanzaId) return;

                    const cache = global.hanimeCache[context.stanzaId];
                    if (!cache || cache.type !== 'episodes') return;

                    let replyText = (extMsg.text || "").trim().toLowerCase();
                    const replySender = replyMsg.key.remoteJid;

                    let epsToDl = [];
                    if (replyText === 'all') {
                        epsToDl = cache.episodes;
                    } else {
                        // 1, 2, 3 වගේ ඉලක්කම් කෙලින්ම ගන්නවා
                        const num = parseInt(replyText);
                        if (isNaN(num) || num < 1 || num > cache.episodes.length) return;
                        epsToDl = [cache.episodes[num - 1]];
                    }
                    
                    await processDownload(socket, replyMsg, replySender, cache.animeId, epsToDl, cache.targetJid, cache.meta);
                    
                } catch (e) {
                    console.error("Hanime Catcher Error:", e);
                }
            });
            
            global.hanimeListenerAttached = true;
        }

        const input = (args && args.length > 0) ? args.join(" ").trim() : "";

        // ════════════ SEARCH ANIME (BUTTONS) ════════════
        if (command === "hanime") {
            if (!input) return reply("❌ *කරුණාකර ඇනිමෙ නමක් දෙන්න!*\n💡 උදා: `.hanime naruto` හෝ `.hanime naruto 12036...`");
            
            let q = input;
            let targetJid = sender;
            
            const jidMatch = input.match(/(\d+@[a-z.A-Z]+)/);
            if (jidMatch) {
                targetJid = jidMatch[1];
                q = input.replace(targetJid, '').trim(); 
            }
            
            if (!q) return reply("❌ *Anime නමක් හොයාගන්න බැරි වුණා!*");

            await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } });
            
            try {
                const searchUrl = `https://animeheaven.me/search.php?s=${encodeURIComponent(q)}`;
                const res = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
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
                            id: `.hdown ${animeId}|${targetJid}`
                        });
                    }
                }
                
                const listMessage = {
                    title: "🎬 𝐒𝐞𝐥𝐞𝐜𝐭 𝐀𝐧𝐢𝐦𝐞",
                    sections: [{ title: "Search Results", rows: rows }]
                };
                
                const msgContent = {
                    viewOnceMessage: {
                        message: {
                            interactiveMessage: {
                                header: { hasMediaAttachment: false },
                                body: { text: `🎯 *Search Results for :* _${q}_\n\n👇 පහළ Button එකෙන් Anime එක තෝරන්න.` },
                                footer: { text: "🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮" },
                                nativeFlowMessage: {
                                    buttons: [{ name: "single_select", buttonParamsJson: JSON.stringify(listMessage) }]
                                }
                            }
                        }
                    }
                };
                
                let waMsg;
                try { waMsg = generateWAMessageFromContent(sender, msgContent, { quoted: msg }); } 
                catch (e) { waMsg = generateWAMessageFromContent(msgContent, { userJid: socket.user?.id, quoted: msg }); }
                
                await socket.relayMessage(sender, waMsg.message, { messageId: waMsg.key.id });
                
            } catch (err) {
                reply(`❌ *Search Error:* ${err.message}`);
            }
        }

        // ════════════ EPISODE LIST (TEXT MENU) ════════════
        if (command === "hdown") {
            if (!input) return;
            
            const parts = input.split('|');
            const animeId = parts[0];
            const targetJid = parts[1] || sender;
            
            await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });
            
            try {
                const seriesUrl = `https://animeheaven.me/anime.php?${animeId}`;
                const res = await axios.get(seriesUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                const html = res.data;
                
                const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
                let videoname = titleMatch ? titleMatch[1].replace('Anime | AnimeHeaven.Me', '').trim() : "Anime";
                
                const descMatch = html.match(/<div class=['"]infodes c['"]>([\s\S]*?)<\/div>/i);
                let desc = descMatch ? descMatch[1].trim().replace(/<[^>]+>/g, '') : videoname;
                if (desc.length > 300) desc = desc.substring(0, 300) + '...';
                
                const thumbMatch = html.match(/<div class=['"]infoimg['"]><img[^>]+src=['"]([^'"]+)['"]/i) || html.match(/<meta property=['"]og:image['"] content=['"]([^'"]+)['"]/i);
                let thumbnail = thumbMatch ? thumbMatch[1] : "";
                if (thumbnail && !thumbnail.startsWith('http')) thumbnail = 'https://animeheaven.me/' + thumbnail;
                
                const epRegex = /onclick=['"]gatea\(['"]([^'"]+)['"]\)['"][^>]*>[\s\S]*?<div class=['"]watch2 bc\s*['"]>(\d+)<\/div>/gi;
                const episodes = [];
                let epMatch;
                while ((epMatch = epRegex.exec(html)) !== null) episodes.push({ hash: epMatch[1], num: parseInt(epMatch[2]) });
                
                if (episodes.length === 0) {
                    const fallbackEpRegex = /gatea\(['"]([^'"]+)['"]\)[\s\S]*?Episode\s*<\/div><div class=['"]watch2 bc\s*['"]>(\d+)<\/div>/gi;
                    let fMatch; while ((fMatch = fallbackEpRegex.exec(html)) !== null) episodes.push({ hash: fMatch[1], num: parseInt(fMatch[2]) });
                }
                if (episodes.length === 0) {
                    const movieRegex = /gatea\(['"]([^'"]+)['"]\)/gi;
                    let mMatch; let count = 1;
                    while ((mMatch = movieRegex.exec(html)) !== null) {
                        if (!episodes.find(e => e.hash === mMatch[1])) { episodes.push({ hash: mMatch[1], num: count }); count++; }
                    }
                }
                
                if (episodes.length === 0) return reply("🚫 *Episodes හොයාගන්න බැරි වුණා!*");
                episodes.sort((a, b) => a.num - b.num);
                
                const displayEps = episodes.slice(0, 30);
                
                let menuText = `🎬 *${videoname}*\n\n📝 _${desc}_\n\n`;
                menuText += `*Episodes ලැයිස්තුව:*\n\n`;
                
                for (let i = 0; i < displayEps.length; i++) {
                    menuText += `*[ ${i + 1} ]* - Episode ${displayEps[i].num}\n`;
                }
                menuText += `\n*[ all ]* - ඔක්කොම Download කරන්න\n\n`;
                menuText += `> 💡 *ඔයාට ඕනේ Episode එකේ අංකය (උදා: 1) මේ මැසේජ් එකට Reply කරන්න.* (ඔක්කොම ඕනේ නම් 'all' දෙන්න)`;
                
                const meta = { videoname, desc, thumbnail, seriesUrl };
                
                let sentMsg;
                if (thumbnail) {
                    sentMsg = await socket.sendMessage(sender, { image: { url: thumbnail }, caption: menuText }, { quoted: msg });
                } else {
                    sentMsg = await socket.sendMessage(sender, { text: menuText }, { quoted: msg });
                }
                
                // Catcher එකට දත්ත සේව් කරනවා
                global.hanimeCache[sentMsg.key.id] = { type: 'episodes', episodes: displayEps, animeId, targetJid, meta };
                
            } catch (err) {
                reply(`❌ *Error:* ${err.message}`);
            }
        }
    }
};
