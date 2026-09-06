const axios = require('axios');
const { generateWAMessageFromContent } = require('baileys');

module.exports = {
    name: "hanime",
    category: "anime",
    description: "Search and Download Anime from AnimeHeaven",
    commands: ["hanime", "hdown"],
    
    handler: async ({ socket, msg, sender, command, args, reply }) => {
        const input = (args && args.length > 0) ? args.join(" ").trim() : "";

        // ════════════ SEARCH ANIME (.hanime) ════════════
        if (command === "hanime") {
            if (!input) return reply("❌ *කරුණාකර ඇනිමෙ නමක් දෙන්න!*\n💡 උදා: `.hanime naruto` හෝ `.hanime naruto | JID`");
            
            // JID එකක් දීලා තියෙනවද කියලා බලනවා
            let q = input;
            let targetJid = sender; // මුකුත් දුන්නේ නැත්තම් යවපු කෙනාටම යවනවා
            
            if (input.includes('|')) {
                const parts = input.split('|');
                q = parts[0].trim();
                targetJid = parts[1].trim();
            }
            
            await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } });
            
            try {
                const searchUrl = `https://animeheaven.me/search.php?s=${encodeURIComponent(q)}`;
                const res = await axios.get(searchUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0' }
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
                            id: `.hdown ${animeId}|list|${targetJid}` // 👈 JID එකත් එක්කම Button ID එක හදනවා
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
            if (!input) return;
            
            const parts = input.split('|');
            const animeId = parts[0];
            const targetEp = parts[1] || 'list'; 
            const targetJid = parts[2] || sender; // JID එක අරගන්නවා
            
            await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });
            
            try {
                const seriesUrl = `https://animeheaven.me/anime.php?${animeId}`;
                const res = await axios.get(seriesUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                const html = res.data;
                
                const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
                let videoname = titleMatch ? titleMatch[1].replace('Anime | AnimeHeaven.Me', '').trim() : "Anime";
                
                const epRegex = /onclick=['"]gatea\(['"]([^'"]+)['"]\)['"][^>]*>[\s\S]*?<div class=['"]watch2 bc\s*['"]>(\d+)<\/div>/gi;
                const episodes = [];
                let epMatch;
                while ((epMatch = epRegex.exec(html)) !== null) {
                    episodes.push({ hash: epMatch[1], num: parseInt(epMatch[2]) });
                }
                
                // Fallbacks
                if (episodes.length === 0) {
                    const fallbackEpRegex = /gatea\(['"]([^'"]+)['"]\)[\s\S]*?Episode\s*<\/div><div class=['"]watch2 bc\s*['"]>(\d+)<\/div>/gi;
                    let fMatch;
                    while ((fMatch = fallbackEpRegex.exec(html)) !== null) {
                        episodes.push({ hash: fMatch[1], num: parseInt(fMatch[2]) });
                    }
                }
                if (episodes.length === 0) {
                    const movieRegex = /gatea\(['"]([^'"]+)['"]\)/gi;
                    let mMatch; let count = 1;
                    while ((mMatch = movieRegex.exec(html)) !== null) {
                        if (!episodes.find(e => e.hash === mMatch[1])) {
                            episodes.push({ hash: mMatch[1], num: count });
                            count++;
                        }
                    }
                }
                
                if (episodes.length === 0) return reply("🚫 *Episodes හොයාගන්න බැරි වුණා!*");
                episodes.sort((a, b) => a.num - b.num);
                
                // 1️⃣ Show Episode List (Download All බොත්තමත් එක්ක)
                if (targetEp === 'list' && episodes.length > 1) {
                    let rows = [];
                    
                    // 📥 Download All බොත්තම උඩින්ම දානවා
                    rows.push({
                        header: "",
                        title: "📥 Download All Episodes",
                        description: "හැම Episode එකක්ම එකින් එක Download කරන්න",
                        id: `.hdown ${animeId}|all|${targetJid}`
                    });

                    // උපරිම Episodes 20ක් පෙන්නනවා Button ලිමිට් එක නිසා
                    for (let i = 0; i < Math.min(episodes.length, 20); i++) {
                        const ep = episodes[i];
                        rows.push({
                            header: "",
                            title: `Episode ${ep.num}`,
                            description: `Download ${videoname} - Ep ${ep.num}`,
                            id: `.hdown ${animeId}|${ep.num}|${targetJid}`
                        });
                    }
                    
                    const listMessage = { title: "📺 𝐒𝐞𝐥𝐞𝐜𝐭 𝐄𝐩𝐢𝐬𝐨𝐝𝐞", sections: [{ title: "Available Episodes", rows: rows }] };
                    
                    const msgContent = {
                        viewOnceMessage: {
                            message: {
                                interactiveMessage: {
                                    header: { hasMediaAttachment: false },
                                    body: { text: `🎬 *${videoname}*\n\n👇 Episode එකක් තෝරන්න හරි ඔක්කොම Download All දෙන්න.` },
                                    footer: { text: "🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮" },
                                    nativeFlowMessage: { buttons: [{ name: "single_select", buttonParamsJson: JSON.stringify(listMessage) }] }
                                }
                            }
                        }
                    };
                    
                    let waMsg;
                    try { waMsg = generateWAMessageFromContent(sender, msgContent, { quoted: msg }); } 
                    catch (e) { waMsg = generateWAMessageFromContent(msgContent, { userJid: socket.user?.id, quoted: msg }); }
                    return await socket.relayMessage(sender, waMsg.message, { messageId: waMsg.key.id });
                }
                
                // 2️⃣ Download logic (Single or All)
                let epsToDownload = [];
                if (targetEp === 'all') {
                    epsToDownload = episodes;
                    reply(`📥 *Download All Started!* (${episodes.length} Episodes)\nකරුණාකර රැඳී සිටින්න...`);
                } else {
                    const selectedEp = episodes.find(e => e.num === parseInt(targetEp)) || episodes[0];
                    if (!selectedEp) return reply("🚫 Episode not found!");
                    epsToDownload = [selectedEp];
                }
                
                // ලූප් කරලා යවනවා (Streaming විදිහටම)
                for (const ep of epsToDownload) {
                    const hash = ep.hash;
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
                    
                    if (!finalDlLink) {
                        await socket.sendMessage(sender, { text: `🚫 *Ep ${ep.num} හොයාගන්න බැරි වුණා!*` });
                        continue;
                    }
                    
                    await socket.sendMessage(sender, { react: { text: '📤', key: msg.key } });
                    
                    // 100% RAM Friendly Streaming අලුත්ම විදිහ
                    const streamResponse = await axios({
                        url: finalDlLink,
                        method: 'GET',
                        responseType: 'stream'
                    });
                    
                    await socket.sendMessage(targetJid, {
                        document: { stream: streamResponse.data }, // 👈 කෙලින්ම Stream වෙනවා 
                        mimetype: 'video/mp4',
                        fileName: `${videoname} - Ep ${ep.num} [SADEW].mp4`,
                        caption: `🎬 *${videoname}* - Episode ${ep.num}\n\n> 🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮`
                    }, { quoted: (targetJid === sender ? msg : undefined) }); 
                    
                    // Download All දීලා නම් එකක් යවලා තත්පර 3ක් ඉන්නවා සර්වර් බ්ලොක් නොවෙන්න
                    if (targetEp === 'all') {
                        await new Promise(r => setTimeout(r, 3000));
                    }
                }
                
                await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
                
            } catch (err) {
                reply(`❌ *Error:* ${err.message}`);
            }
        }
    }
};
