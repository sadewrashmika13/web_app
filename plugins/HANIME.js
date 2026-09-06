const axios = require('axios');
const { generateWAMessageFromContent, prepareWAMessageMedia } = require('baileys');

if (!global.hanimeContexts) global.hanimeContexts = {};

// ════════ Helper Function (බාගන්න කෑල්ල) ════════
async function processDownload(socket, replyMsg, sender, animeId, epsToDownload, targetJid, meta) {
    await socket.sendMessage(sender, { react: { text: '📥', key: replyMsg.key } });
    
    // Group එකට (JID) Details Card එක යවනවා
    if (targetJid !== sender) {
        let cardText = `🎬 *${meta.videoname}*\n\n📝 _${meta.desc}_\n\n> 🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮`;
        if (meta.thumbnail) {
            await socket.sendMessage(targetJid, { image: { url: meta.thumbnail }, caption: cardText });
        } else {
            await socket.sendMessage(targetJid, { text: cardText });
        }
        await socket.sendMessage(sender, { text: `✅ *Details Card එක සහ Episodes ${targetJid} ට යවන්න පටන් ගත්තා!*` }, { quoted: replyMsg });
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
            
            await socket.sendMessage(sender, { react: { text: '📤', key: replyMsg.key } });
            
            const streamResponse = await axios({ url: finalDlLink, method: 'GET', responseType: 'stream' });
            
            await socket.sendMessage(targetJid, {
                document: { stream: streamResponse.data },
                mimetype: 'video/mp4',
                fileName: `${meta.videoname} - Ep ${ep.num} [SADEW].mp4`,
                caption: `🎬 *${meta.videoname}* - Episode ${ep.num}\n\n> 🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮`
            }, { quoted: (targetJid === sender ? replyMsg : undefined) }); 
            
            if (epsToDownload.length > 1) {
                await new Promise(r => setTimeout(r, 3000));
            }
        } catch (err) {
            await socket.sendMessage(sender, { text: `❌ *Ep ${ep.num} Error:* ${err.message}` });
        }
    }
    await socket.sendMessage(sender, { react: { text: '✅', key: replyMsg.key } });
}

// ════════ Plugin Body ════════
module.exports = {
    name: "hanime",
    category: "anime",
    description: "Search (Buttons) and Download (Number Reply) Anime",
    commands: ["hanime", "hdown"],
    
    handler: async ({ socket, msg, sender, command, args, reply }) => {
        const input = args.join(" ").trim();

        // ════════════ SEARCH ANIME (10 NORMAL BUTTONS) ════════════
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
                
                let buttons = [];
                let seen = new Set();
                let firstThumb = "";
                
                for (const m of matches) {
                    if (buttons.length >= 10) break; 
                    const animeId = m[1].replace('anime.php?', '');
                    let thumbUrl = m[2];
                    if (thumbUrl && !thumbUrl.startsWith('http')) thumbUrl = 'https://animeheaven.me/' + thumbUrl;
                    const title = m[3].trim();
                    
                    if (buttons.length === 0) firstThumb = thumbUrl;
                    
                    if (!seen.has(animeId)) {
                        seen.add(animeId);
                        let shortTitle = title.length > 25 ? title.substring(0, 25) + '...' : title;
                        
                        buttons.push({
                            name: "quick_reply",
                            buttonParamsJson: JSON.stringify({
                                display_text: shortTitle,
                                id: `.hdown ${animeId}|${targetJid}`
                            })
                        });
                    }
                }
                
                let media = {};
                if (firstThumb) {
                    try {
                        media = await prepareWAMessageMedia({ image: { url: firstThumb } }, { upload: socket.waUploadToServer });
                    } catch (e) {}
                }
                
                const msgContent = {
                    viewOnceMessage: {
                        message: {
                            interactiveMessage: {
                                header: { hasMediaAttachment: !!firstThumb, ...media },
                                body: { text: `🎯 *Search Results for:* _${q}_\n\n👇 පහළ Buttons වලින් Anime එක තෝරන්න.` },
                                footer: { text: "🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮" },
                                nativeFlowMessage: { buttons: buttons }
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

        // ════════════ EPISODE LIST (.hdown) ════════════
        if (command === "hdown") {
            if (!input) return;
            
            const parts = input.split('|');
            const animeId = parts[0].trim();
            
            // JID එක සහ 'all' කමාන්ඩ් එක වෙන් කරගැනීම
            let action = 'list';
            let targetJid = sender;
            if (parts.length === 2) {
                if (parts[1].trim() === 'all') action = 'all';
                else targetJid = parts[1].trim();
            } else if (parts.length === 3) {
                if (parts[1].trim() === 'all') action = 'all';
                targetJid = parts[2].trim();
            }
            
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
                
                if (episodes.length === 0) {
                    let snippet = html.replace(/<[^>]*>?/gm, '').trim().substring(0, 150);
                    return socket.sendMessage(sender, { text: `🚫 *Episodes හොයාගන්න බැරි වුණා!*\n\n🛠 *Debug logs:*\nURL: ${seriesUrl}\nHTML: ${snippet}...` }, { quoted: msg });
                }
                episodes.sort((a, b) => a.num - b.num);
                const meta = { videoname, desc, thumbnail, seriesUrl };
                
                // 1️⃣ 'Download All' බොත්තම එබුවම කෙලින්ම බානවා 
                if (action === 'all') {
                    await processDownload(socket, msg, sender, animeId, episodes, targetJid, meta);
                    return;
                }
                
                // 2️⃣ එහෙම නැත්තම් Episode List එක යවනවා (Download All Button එකත් එක්ක)
                const displayEps = episodes.slice(0, 30); // උපරිම 30ක් පෙන්නනවා
                
                let menuText = `🎬 *${videoname}*\n\n📝 _${desc}_\n\n`;
                menuText += `*Episodes ලැයිස්තුව:*\n\n`;
                
                for (let i = 0; i < displayEps.length; i++) {
                    menuText += `*[ ${i + 1} ]* - Episode ${displayEps[i].num}\n`;
                }
                menuText += `\n> 💡 *ඔයාට ඕනේ Episode එකේ අංකය (උදා: 1) මේ මැසේජ් එකට Reply කරන්න.* (ඔක්කොම බාන්න පහළ බොත්තම ඔබන්න)\n`;
                
                let media = {};
                if (thumbnail) {
                    try { media = await prepareWAMessageMedia({ image: { url: thumbnail } }, { upload: socket.waUploadToServer }); } catch (e) {}
                }
                
                const msgContent = {
                    viewOnceMessage: {
                        message: {
                            interactiveMessage: {
                                header: { hasMediaAttachment: !!thumbnail, ...media },
                                body: { text: menuText },
                                footer: { text: "🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮" },
                                nativeFlowMessage: {
                                    buttons: [{
                                        name: "quick_reply",
                                        buttonParamsJson: JSON.stringify({
                                            display_text: "📥 Download All",
                                            id: `.hdown ${animeId}|all|${targetJid}`
                                        })
                                    }]
                                }
                            }
                        }
                    }
                };
                
                let waMsg;
                try { waMsg = generateWAMessageFromContent(sender, msgContent, { quoted: msg }); } 
                catch (e) { waMsg = generateWAMessageFromContent(msgContent, { userJid: socket.user?.id, quoted: msg }); }
                
                await socket.relayMessage(sender, waMsg.message, { messageId: waMsg.key.id });
                
                // ==========================================
                // 🔥 DYNAMIC EPISODE REPLY LISTENER (දැන් off වෙන්නේ නෑ!)
                // ==========================================
                
                // පරණ Listener එකක් තිබ්බොත් අයින් කරනවා (Memory Leak නොවෙන්න)
                if (global.hanimeContexts[sender] && global.hanimeContexts[sender].listener) {
                    socket.ev.off('messages.upsert', global.hanimeContexts[sender].listener);
                }

                const replyListener = async ({ messages }) => {
                    try {
                        const replyMsg = messages[0];
                        if (!replyMsg.message || replyMsg.key.remoteJid !== sender) return;

                        const getActualMessage = (m) => {
                            if (!m) return null;
                            if (m.ephemeralMessage) return m.ephemeralMessage.message;
                            if (m.viewOnceMessage) return m.viewOnceMessage.message;
                            return m;
                        };

                        const actualMsg = getActualMessage(replyMsg.message);
                        const extMsg = actualMsg?.extendedTextMessage;
                        const ctx = extMsg?.contextInfo;
                        if (!ctx || !ctx.stanzaId) return;

                        const context = global.hanimeContexts[sender];
                        if (!context) return;

                        if (ctx.stanzaId === context.quotedId) {
                            const replyText = (extMsg.text || '').trim().toLowerCase();
                            
                            const num = parseInt(replyText);
                            if (isNaN(num) || num < 1 || num > context.episodes.length) return;
                            const epsToDl = [context.episodes[num - 1]];

                            // 🛑 මෙතනින් Off වෙන කෑල්ල අයින් කරා! එතකොට ආයෙ ආයෙ Reply කරන්න පුළුවන්!
                            await processDownload(socket, replyMsg, sender, context.animeId, epsToDl, context.targetJid, context.meta);
                        }
                    } catch (listenerErr) {
                        console.error("Hanime Listener Error:", listenerErr);
                    }
                };

                // අලුත් Listener එක සේව් කරනවා
                global.hanimeContexts[sender] = {
                    quotedId: waMsg.key.id,
                    episodes: displayEps,
                    animeId: animeId,
                    targetJid: targetJid,
                    meta: meta,
                    listener: replyListener 
                };

                socket.ev.on('messages.upsert', replyListener);
                
                // විනාඩි 3කින් Auto Off වෙනවා
                setTimeout(() => {
                    if (global.hanimeContexts[sender] && global.hanimeContexts[sender].listener === replyListener) {
                        socket.ev.off('messages.upsert', replyListener);
                        delete global.hanimeContexts[sender];
                    }
                }, 3 * 60 * 1000);
                
            } catch (err) {
                reply(`❌ *Error:* ${err.message}`);
            }
        }
    }
};
