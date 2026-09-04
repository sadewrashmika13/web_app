const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// ═══════ API CONFIG & SHORT STORE ═══════
const API_BASE = "https://api.zanta-mini.store/api/hentai";
const API_KEY = "zan_FIAO7Ayh_eo1vllkep6";
const botName = "👑 SADEW-MINI 👑";

if (!global.animeStore) global.animeStore = {};

const metaQuote = {
    key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_ANI" },
    message: { contactMessage: { displayName: botName, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${botName}\nORG:Sadew Anime\nTEL;waid=94700000000:+94 70 000 0000\nEND:VCARD` } }
};

module.exports = {
    name: "anime-downloader",
    category: 10, // 👈 Category 10 (TV Series & Movies)
    description: "Search and download anime episodes with quality selection",
    commands: ["anime", "anime_dl"],

    handler: async ({ socket, msg, sender, command, args, sessionConfig }) => {
        const prefix = sessionConfig?.PREFIX || '.';

        // ==========================================
        // 1. ANIME SEARCH (.anime <query>)
        // ==========================================
        if (command === "anime") {
            const query = args.join(" ").trim();

            if (!query) {
                return await socket.sendMessage(sender, {
                    text: `*↳ ❝ [🎌 𝗔𝗻𝗶𝗺𝗲 𝗦𝗲𝗮𝗿𝗰𝗵 🎌] ¡! ❞*\n\n` +
                          `❌ *කරුණාකර Anime නම ලබා දෙන්න!*\n` +
                          `_උදා: ${prefix}anime naruto_\n\n` +
                          `> *𝗦𝗮𝗱𝗲 w-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲 w 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`
                }, { quoted: metaQuote });
            }

            try {
                await socket.sendMessage(sender, { react: { text: "🔍", key: msg.key } });

                const searchUrl = `${API_BASE}/search?apiKey=${API_KEY}&url=${encodeURIComponent(query)}`;
                const res = await axios.get(searchUrl, { timeout: 15000 });
                const data = res.data;

                if (!data.success || !data.results || data.results.length === 0) {
                    await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                    return await socket.sendMessage(sender, {
                        text: `❌ *"${query}" සඳහා Results හමුවූයේ නැත.*`
                    }, { quoted: msg });
                }

                const topResults = data.results.slice(0, 10);

                let listText = `*↳ ❝ [🎌 𝗔𝗻𝗶𝗺𝗲 𝗦𝗲𝗮𝗿𝗰𝗵 🎌] ¡! ❞*\n\n`;
                listText += `🔍 *සෙව්වේ:* ${query}\n`;
                listText += `📊 *Results:* ${topResults.length}\n\n`;

                topResults.forEach((item, i) => {
                    listText += `*${i + 1}.* ${item.title}\n`;
                    listText += `   👁️ ${item.views || 'N/A'} | ⏱ ${item.duration || 'N/A'}\n\n`;
                });

                listText += `> *📩 ඔබට අවශ්‍ය Anime එකේ අංකය Reply කරන්න (1-${topResults.length})*\n`;
                listText += `> *𝗦𝗮𝗱𝗲 w-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲 w 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

                const firstThumb = topResults[0]?.thumbnail;
                let listMsg;

                if (firstThumb) {
                    listMsg = await socket.sendMessage(sender, {
                        image: { url: firstThumb },
                        caption: listText
                    }, { quoted: metaQuote });
                } else {
                    listMsg = await socket.sendMessage(sender, { text: listText }, { quoted: metaQuote });
                }

                // Save search context
                global.animeStore[sender] = {
                    stage: 'search',
                    results: topResults,
                    msgId: listMsg.key.id
                };

                // ═══ SINGLE CLEAN REPLY LISTENER ═══
                const listener = async ({ messages }) => {
                    try {
                        const replyMsg = messages[0];
                        if (!replyMsg.message || replyMsg.key.remoteJid !== sender) return;

                        const ctx = replyMsg.message.extendedTextMessage?.contextInfo;
                        const context = global.animeStore[sender];
                        if (!ctx || !context) return;

                        const replyText = (replyMsg.message.extendedTextMessage?.text || '').trim();
                        if (!/^\d+$/.test(replyText)) return;
                        const num = parseInt(replyText);

                        // STAGE 1: SEARCH SELECTION
                        if (context.stage === 'search' && ctx.stanzaId === context.msgId) {
                            if (num < 1 || num > context.results.length) {
                                return await socket.sendMessage(sender, { text: "❌ *වැරදි අංකයක්!*" }, { quoted: replyMsg });
                            }

                            const selected = context.results[num - 1];
                            const selectedThumb = selected.thumbnail || '';
                            await socket.sendMessage(sender, { react: { text: "⏳", key: replyMsg.key } });

                            try {
                                const epUrl = `${API_BASE}/ep?apiKey=${API_KEY}&url=${encodeURIComponent(selected.url)}`;
                                const epRes = await axios.get(epUrl, { timeout: 15000 });
                                const epData = epRes.data;

                                if (epData.success && epData.result && epData.result.is_series && epData.result.episode_list && epData.result.episode_list.length > 1) {
                                    const episodes = epData.result.episode_list;

                                    let epText = `*↳ ❝ [🎌 ${selected.title} 🎌] ¡! ❞*\n\n`;
                                    epText += `📺 *Series — Episodes: ${episodes.length}*\n\n`;

                                    episodes.forEach((ep, i) => {
                                        epText += `*${ep.episode_number || (i + 1)}.* ${ep.episode_title}\n`;
                                    });

                                    epText += `\n> *📩 ඔබට අවශ්‍ය Episode අංකය Reply කරන්න*\n`;
                                    epText += `> *𝗦𝗮𝗱𝗲 w-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲 w 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

                                    let epMsg;
                                    if (selectedThumb) {
                                        epMsg = await socket.sendMessage(sender, {
                                            image: { url: selectedThumb },
                                            caption: epText
                                        }, { quoted: replyMsg });
                                    } else {
                                        epMsg = await socket.sendMessage(sender, { text: epText }, { quoted: replyMsg });
                                    }

                                    // Update context for episodes stage
                                    global.animeStore[sender] = {
                                        stage: 'episodes',
                                        episodes: episodes,
                                        title: selected.title,
                                        thumbnail: selectedThumb,
                                        msgId: epMsg.key.id
                                    };

                                } else {
                                    // Single Episode
                                    socket.ev.off('messages.upsert', listener);
                                    delete global.animeStore[sender];
                                    await showQualityButtons(socket, sender, replyMsg, selected.url, selected.title, selectedThumb, prefix);
                                }
                            } catch (epErr) {
                                socket.ev.off('messages.upsert', listener);
                                delete global.animeStore[sender];
                                await showQualityButtons(socket, sender, replyMsg, selected.url, selected.title, selectedThumb, prefix);
                            }

                            await socket.sendMessage(sender, { react: { text: "🎌", key: replyMsg.key } });
                        }

                        // STAGE 2: EPISODE SELECTION
                        else if (context.stage === 'episodes' && ctx.stanzaId === context.msgId) {
                            const matchedEp = context.episodes.find(e => parseInt(e.episode_number) === num) || context.episodes[num - 1];
                            if (!matchedEp) {
                                return await socket.sendMessage(sender, { text: "❌ *වැරදි Episode අංකයක්!*" }, { quoted: replyMsg });
                            }

                            socket.ev.off('messages.upsert', listener);
                            const fullTitle = `${context.title} - Ep ${matchedEp.episode_number}`;
                            const thumb = context.thumbnail;
                            delete global.animeStore[sender];

                            await showQualityButtons(socket, sender, replyMsg, matchedEp.episode_url, fullTitle, thumb, prefix);
                        }

                    } catch (listenerErr) {
                        console.log("Anime listener error:", listenerErr.message);
                    }
                };

                socket.ev.on('messages.upsert', listener);
                setTimeout(() => {
                    socket.ev.off('messages.upsert', listener);
                    if (global.animeStore[sender]) delete global.animeStore[sender];
                }, 120000);

                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

            } catch (e) {
                console.error("Anime Search Error:", e.message);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                await socket.sendMessage(sender, { text: `❌ *Search Error!*\n_${e.message}_` }, { quoted: msg });
            }
        }

        // ==========================================
        // 2. ANIME DOWNLOAD (.anime_dl shortId)
        // ==========================================
        else if (command === "anime_dl") {
            const shortId = args[0]?.trim();
            const storedData = global.animeStore[shortId];

            if (!storedData || !storedData.url) {
                return await socket.sendMessage(sender, { 
                    text: "❌ *ලින්ක් එක කල් ඉකුත් වී ඇත. නැවත .anime search කරන්න.*" 
                }, { quoted: msg });
            }

            const videoUrl = storedData.url;
            const quality = storedData.quality;
            const title = storedData.title;

            const tmpId = crypto.randomBytes(6).toString('hex');
            const tmpPath = path.join(os.tmpdir(), `sadew_anime_${tmpId}.mp4`);

            try {
                await socket.sendMessage(sender, { react: { text: "⬇️", key: msg.key } });
                await socket.sendMessage(sender, {
                    text: `📥 *Downloading ${title} [${quality}]...*\n_Server එකෙන් Download කරමින්, රැඳී සිටින්න..._`
                }, { quoted: msg });

                const response = await axios({
                    method: 'GET',
                    url: videoUrl,
                    responseType: 'stream',
                    timeout: 180000,
                    maxRedirects: 5,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Referer': 'https://xanimeporn.com/'
                    }
                });

                const writer = fs.createWriteStream(tmpPath);
                response.data.pipe(writer);

                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });

                const stats = fs.statSync(tmpPath);
                if (stats.size < 1000) throw new Error("Downloaded file is too small/empty");

                const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(1);
                const caption = `*↳ ❝ [🎌 𝗔𝗻𝗶𝗺𝗲 𝗗𝗟 🎌] ¡! ❞*\n\n` +
                                `🎬 *${title}*\n` +
                                `📺 *Quality:* ${quality}\n` +
                                `📦 *Size:* ${fileSizeMB}MB\n\n` +
                                `> *𝗦𝗮𝗱𝗲 w-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲 w 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

                // 🚀 Memory Leak Fix: Send via File ReadStream (0% RAM Buffer)
                const safeTitle = title.replace(/[^a-zA-Z0-9._-]/g, '_');
                await socket.sendMessage(sender, {
                    document: { stream: fs.createReadStream(tmpPath) },
                    mimetype: 'video/mp4',
                    fileName: `${safeTitle}_[${quality}].mp4`,
                    caption: caption
                }, { quoted: metaQuote });

                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

            } catch (e) {
                console.error("Anime DL Error:", e.message);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                await socket.sendMessage(sender, { text: `❌ *Download Failed!*\n_${e.message}_` }, { quoted: msg });
            } finally {
                try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (_) {}
            }
        }
    }
};

// ══════════════════════════════════════════
// HELPER: Quality buttons with Short ID
// ══════════════════════════════════════════
async function showQualityButtons(sock, chatJid, quotedMsg, episodeUrl, title, thumbnail, prefix) {
    try {
        const dlUrl = `${API_BASE}/dl?apiKey=${API_KEY}&url=${encodeURIComponent(episodeUrl)}`;
        const dlRes = await axios.get(dlUrl, { timeout: 20000 });
        const dlData = dlRes.data;

        if (!dlData.success || !dlData.result || !dlData.result.download_links || dlData.result.download_links.length === 0) {
            return await sock.sendMessage(chatJid, { text: `❌ *Download Links හමුවූයේ නැත!*` }, { quoted: quotedMsg });
        }

        const links = dlData.result.download_links;
        const qualityOrder = ['480p', '720p', '1080p', '240p'];
        const sortedLinks = [...links].sort((a, b) => {
            const aIdx = qualityOrder.indexOf(a.quality);
            const bIdx = qualityOrder.indexOf(b.quality);
            return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
        });

        const buttons = sortedLinks.map((link, idx) => {
            const label = idx === 0 ? `⚡ ${link.quality} (Recommended)` : `🎥 ${link.quality}`;
            
            // 🛡️ Short ID generator (Prevents WhatsApp Button Payload Overflow)
            const shortId = crypto.randomBytes(4).toString('hex');
            global.animeStore[shortId] = {
                url: link.direct_link,
                quality: link.quality,
                title: title
            };

            setTimeout(() => {
                if (global.animeStore[shortId]) delete global.animeStore[shortId];
            }, 15 * 60 * 1000);

            return {
                buttonId: `${prefix}anime_dl ${shortId}`,
                buttonText: { displayText: label },
                type: 1
            };
        });

        const captionText = `*↳ ❝ [🎌 𝗔𝗻𝗶𝗺𝗲 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱 🎌] ¡! ❞*\n\n` +
                            `🎬 *${title}*\n\n` +
                            `📺 *Available Qualities:*\n` +
                            sortedLinks.map((l, i) => `┊ ${i === 0 ? '⚡' : '🎥'} ${l.quality}${i === 0 ? ' ← වේගවත්ම' : ''}`).join('\n') + `\n\n` +
                            `> *ඔබට අවශ්‍ය Quality එක පහලින් තෝරන්න* ⬇️\n` +
                            `> *𝗦𝗮𝗱𝗲 w-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲 w 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

        if (thumbnail) {
            await sock.sendMessage(chatJid, {
                image: { url: thumbnail },
                caption: captionText,
                footer: botName,
                buttons: buttons,
                headerType: 4
            }, { quoted: quotedMsg });
        } else {
            await sock.sendMessage(chatJid, {
                text: captionText,
                footer: botName,
                buttons: buttons,
                headerType: 1
            }, { quoted: quotedMsg });
        }

    } catch (e) {
        console.log("Anime quality buttons error:", e.message);
        await sock.sendMessage(chatJid, { text: `❌ *Quality Links ලබාගැනීමේ Error!*\n_${e.message}_` }, { quoted: quotedMsg });
    }
}