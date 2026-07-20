const axios = require('axios');
const fs = require('fs');
const path = require('path');

if (!global.slcSession) global.slcSession = {};
// Listener add karala thiyenavada kiyala track karanava (duplocate avoid)
if (!global._cartoonListenerAdded) global._cartoonListenerAdded = false;

// ════════════════════════════════════════════════════════
// CORE NUMBER REPLY HANDLER
// ════════════════════════════════════════════════════════
async function handleNumberReply({ socket, msg, sender, numStr }) {
    const reply = (text) => socket.sendMessage(sender, { text }, { quoted: msg });

    // Reply ekak da?
    const contextInfo =
        msg.message?.extendedTextMessage?.contextInfo ||
        msg.message?.imageMessage?.contextInfo ||
        msg.message?.videoMessage?.contextInfo;

    if (!contextInfo?.stanzaId) return false;

    const repliedMsgId = contextInfo.stanzaId;
    const session = global.slcSession[repliedMsgId];
    if (!session) return false; // apege bot eke msg ekak neme

    if (Date.now() > session.expiresAt) {
        delete global.slcSession[repliedMsgId];
        await reply("❌ *මෙම පණිවිඩයේ කාලය (විනාඩි 5) අවසන් වී ඇත. නැවත .cartoon search කරන්න.*");
        return true;
    }

    const index = parseInt(numStr) - 1;
    if (isNaN(index) || index < 0 || index >= session.items.length) {
        await reply(`❌ *1 ඉඳන් ${session.items.length} දක්වා අංකයක් දෙන්න.*`);
        return true;
    }

    const selectedItem = session.items[index];

    // ── SEARCH → EPISODE LIST ──
    if (session.type === 'search') {
        try {
            const API_KEY = "zan_FIAO7Ayh_eo1vllkep6";
            const BASE_API = "https://api.zanta-mini.store/api/slcartoons";

            await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

            const dlRes = await axios.get(`${BASE_API}/dl?apiKey=${API_KEY}&text=${encodeURIComponent(selectedItem.url)}`);
            if (!dlRes.data.results) throw new Error("Details naha");

            const details = dlRes.data.results;

            let capText = `*🎬 SADEW-MINI CARTOON DETAILS*\n\n`;
            capText += `📌 *Title:* ${selectedItem.title}\n`;
            capText += `🏷️ *Type:* ${details.type || 'N/A'}\n`;
            if (details.total_episodes) capText += `📺 *Total Episodes:* ${details.total_episodes}\n`;
            capText += `\n*📥 DOWNLOAD LINKS:*\n\n`;

            const epItems = [];
            let n = 1;

            if (details.episodes?.length > 0) {
                details.episodes.forEach((ep) => {
                    if (ep.stream_url) {
                        capText += `*${n}.* ${ep.title}\n`;
                        epItems.push({ url: ep.stream_url, title: `${selectedItem.title} - ${ep.title}` });
                        n++;
                    }
                });
            } else if (details.download_links?.length > 0) {
                details.download_links.forEach((dl) => {
                    if (dl.final_link && !dl.final_link.includes('t.me')) {
                        capText += `*${n}.* ${dl.info || 'Direct'}\n`;
                        epItems.push({ url: dl.final_link, title: selectedItem.title });
                        n++;
                    }
                });
            }

            if (epItems.length === 0) {
                await reply("❌ *Download links නැහැ.*");
                return true;
            }

            capText += `\n> *Episode අංකය prefix නැතිව Reply කරන්න* 🔢\n> ⏳ _(විනාඩි 5)_`;

            const msgOpts = { caption: capText, footer: "👑 SADEW-MINI 👑" };
            if (selectedItem.image) msgOpts.image = { url: selectedItem.image };

            const sentMsg = await socket.sendMessage(sender, msgOpts, { quoted: msg });
            await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

            // Session save — sentMsg eke ID ekath, possible alternative IDs ekath
            const msgId = sentMsg?.key?.id;
            if (msgId) {
                global.slcSession[msgId] = {
                    type: 'episodes',
                    items: epItems,
                    expiresAt: Date.now() + 5 * 60 * 1000
                };
                setTimeout(() => { delete global.slcSession[msgId]; }, 5 * 60 * 1000);
            }

        } catch (e) {
            console.error("[cartoon] Details Error:", e.message);
            await reply(`❌ *Details load error: ${e.message}*`);
        }
        return true;
    }

    // ── EPISODE → DOWNLOAD ──
    if (session.type === 'episodes') {
        try {
            await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });
            await reply(`⬇️ *Downloading...*\n🎬 *${selectedItem.title}*\n\n_Server eke download wadinawa..._`);

            const safeTitle = selectedItem.title.replace(/[^a-zA-Z0-9\s]/g, '').trim().substring(0, 40).replace(/\s+/g, '_');
            const finalFileName = `SadewMini_${safeTitle}.mp4`;
            const tempFilePath = path.join('/tmp', `cartoon_${Date.now()}_${finalFileName}`);

            const writer = fs.createWriteStream(tempFilePath);
            const fileRes = await axios({
                method: 'GET',
                url: selectedItem.url,
                responseType: 'stream',
                timeout: 0,
                headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0' },
                maxRedirects: 10
            });

            fileRes.data.pipe(writer);
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            const stats = fs.statSync(tempFilePath);
            const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

            if (stats.size > 2000 * 1024 * 1024) {
                fs.unlinkSync(tempFilePath);
                return await reply(`❌ *File too large!* (${sizeMB} MB)`);
            }

            await socket.sendMessage(sender, { react: { text: '⬆️', key: msg.key } });

            await socket.sendMessage(sender, {
                document: fs.readFileSync(tempFilePath),
                mimetype: 'video/mp4',
                fileName: finalFileName,
                caption: `*🎬 Title:* ${selectedItem.title}\n📦 *Size:* ${sizeMB} MB\n\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`
            }, { quoted: msg });

            await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

        } catch (e) {
            console.error("[cartoon] Download Error:", e.message);
            await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
            await reply(`❌ *Download error: ${e.message}*`);
        } finally {
            try { fs.unlinkSync(tempFilePath); } catch (_) {}
        }
        return true;
    }

    return false;
}

// ════════════════════════════════════════════════════════
// SOCKET LISTENER SETUP — module eke eken call karanava
// Prefix-less number replies handle karanava
// ════════════════════════════════════════════════════════
function setupCartoonListener(socket) {
    if (global._cartoonListenerAdded) return;
    global._cartoonListenerAdded = true;

    console.log("[cartoon] ✅ Prefix-less number reply listener active.");

    socket.ev.on('messages.upsert', async ({ messages, type }) => {
        // DEBUG: type eka check karanava
        // if (type !== 'notify') return; // <-- temporarily remove this filter

        for (const msg of messages) {
            if (!msg.message) continue;
            if (msg.key.fromMe) continue;

            const sender = msg.key.remoteJid;

            // ALL possible places where text can be
            const rawText = (
                msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                msg.message?.imageMessage?.caption ||
                msg.message?.buttonsResponseMessage?.selectedDisplayText ||
                msg.message?.listResponseMessage?.title ||
                ''
            ).trim();

            // DEBUG: every incoming message log karanava
            console.log(`[cartoon-debug] MSG type="${type}" from="${sender}" text="${rawText}"`);

            // Pure number ekak da (1-50)?
            if (!/^\d{1,2}$/.test(rawText)) continue;
            const num = parseInt(rawText);
            if (num < 1 || num > 50) continue;

            console.log(`[cartoon-debug] ✅ Number detected: ${rawText}`);

            // Reply contextInfo check — ALL possible message types
            const contextInfo =
                msg.message?.extendedTextMessage?.contextInfo ||
                msg.message?.imageMessage?.contextInfo ||
                msg.message?.videoMessage?.contextInfo ||
                msg.message?.documentMessage?.contextInfo ||
                msg.message?.stickerMessage?.contextInfo;

            if (!contextInfo?.stanzaId) {
                console.log(`[cartoon-debug] ❌ No contextInfo/stanzaId — user did not reply to a message`);
                continue;
            }

            const stanzaId = contextInfo.stanzaId;
            console.log(`[cartoon-debug] 🔍 stanzaId="${stanzaId}"`);
            console.log(`[cartoon-debug] 📦 Sessions in memory: ${JSON.stringify(Object.keys(global.slcSession))}`);

            // Session thiyanavada?
            if (!global.slcSession[stanzaId]) {
                console.log(`[cartoon-debug] ❌ No session found for stanzaId="${stanzaId}"`);
                continue;
            }

            console.log(`[cartoon-debug] ✅ Session found! type="${global.slcSession[stanzaId].type}" items=${global.slcSession[stanzaId].items.length}`);

            // Handle karanava!
            try {
                await handleNumberReply({ socket, msg, sender, numStr: rawText });
            } catch (e) {
                console.error("[cartoon] listener error:", e.message);
            }
        }
    });
}

// ════════════════════════════════════════════════════════
// MODULE EXPORT
// ════════════════════════════════════════════════════════
module.exports = {
    name: "cartoon",
    category: 1,
    description: "Search and download Sinhala cartoons",
    commands: ["cartoon"],

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        const API_KEY = "zan_FIAO7Ayh_eo1vllkep6";
        const BASE_API = "https://api.zanta-mini.store/api/slcartoons";

        // First time handler call eke listener setup karanava
        setupCartoonListener(socket);

        if (command === "cartoon") {
            const query = args.join(' ').trim();
            if (!query) return reply("🎥 *කරුණාකර කාටූන් නමක් ලබා දෙන්න!*\n💡 `.cartoon ben 10`");

            try {
                await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } });

                const { data } = await axios.get(
                    `${BASE_API}/search?apiKey=${API_KEY}&text=${encodeURIComponent(query)}`
                );

                if (!data.success || !data.results?.length) {
                    await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
                    return reply("❌ *සෙවූ කාටූනය හමු වුනේ නැහැ.*");
                }

                const results = data.results.slice(0, 15);
                let listText = `*🔍 SADEW-MINI CARTOON SEARCH*\n\n`;
                const searchItems = [];

                results.forEach((m, i) => {
                    listText += `*${i + 1}.* ${m.title}\n`;
                    listText += `🌟 *Rating:* ${m.rating || 'N/A'} | 🎬 *Quality:* ${m.quality || 'N/A'}\n\n`;
                    searchItems.push({ url: m.url, title: m.title, image: m.thumbnail });
                });

                listText += `> *අංකය prefix නැතිව Reply කරන්න* (1, 2, 3...) 🔢\n> ⏳ _(විනාඩි 5)_`;

                const msgOpts = { caption: listText, footer: "👑 SADEW-MINI 👑" };
                if (results[0]?.thumbnail) msgOpts.image = { url: results[0].thumbnail };

                const sentMsg = await socket.sendMessage(sender, msgOpts, { quoted: msg });
                await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

                // Session save
                const msgId = sentMsg?.key?.id;
                if (msgId) {
                    global.slcSession[msgId] = {
                        type: 'search',
                        items: searchItems,
                        expiresAt: Date.now() + 5 * 60 * 1000
                    };
                    setTimeout(() => { delete global.slcSession[msgId]; }, 5 * 60 * 1000);
                }

            } catch (e) {
                console.error("[cartoon] Search Error:", e.message);
                reply(`❌ *Search error: ${e.message}*`);
            }
        }
    }
};
