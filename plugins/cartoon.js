const axios = require('axios');
const fs = require('fs');
const path = require('path');

if (!global.slcSession) global.slcSession = {};

// ════════════════════════════════════════════════════════
// CORE NUMBER REPLY HANDLER
// ════════════════════════════════════════════════════════
async function handleNumberReply({ socket, msg, sender, numStr }) {
    const reply = (text) => socket.sendMessage(sender, { text }, { quoted: msg });

    const contextInfo =
        msg.message?.extendedTextMessage?.contextInfo ||
        msg.message?.imageMessage?.contextInfo ||
        msg.message?.videoMessage?.contextInfo ||
        msg.message?.documentMessage?.contextInfo;

    if (!contextInfo?.stanzaId) return false;

    const stanzaId = contextInfo.stanzaId;
    const sessionKey = `${sender}__${stanzaId}`;
    const session = global.slcSession[sessionKey];

    if (!session) return false;

    if (Date.now() > session.expiresAt) {
        delete global.slcSession[sessionKey];
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

            const msgId = sentMsg?.key?.id;
            if (msgId) {
                const epKey = `${sender}__${msgId}`;
                global.slcSession[epKey] = {
                    type: 'episodes',
                    items: epItems,
                    expiresAt: Date.now() + 5 * 60 * 1000
                };
                setTimeout(() => { delete global.slcSession[epKey]; }, 5 * 60 * 1000);
            }

        } catch (e) {
            console.error("[cartoon] Details Error:", e.message);
            await reply(`❌ *Details error: ${e.message}*`);
        }
        return true;
    }

    // ── EPISODE → DOWNLOAD ──
    if (session.type === 'episodes') {
        let tempFilePath = null;
        try {
            await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });
            await reply(`⬇️ *Downloading...*\n🎬 *${selectedItem.title}*\n\n_Server eka download wadinawa..._`);

            const safeTitle = selectedItem.title.replace(/[^a-zA-Z0-9\s]/g, '').trim().substring(0, 40).replace(/\s+/g, '_');
            const finalFileName = `SadewMini_${safeTitle}.mp4`;
            tempFilePath = path.join('/tmp', `cartoon_${Date.now()}.mp4`);

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
            if (tempFilePath) try { fs.unlinkSync(tempFilePath); } catch (_) {}
        }
        return true;
    }

    return false;
}

// ════════════════════════════════════════════════════════
// GLOBAL HANDLER — main file eke call karanava (one line)
// Usage: if (global.cartoonNumHandler) await global.cartoonNumHandler(msg);
// ════════════════════════════════════════════════════════
global.cartoonNumHandler = async (msg, socketRef) => {
    if (!msg?.message) return;

    const socket = socketRef || global._cartoonSocket;
    if (!socket) return;

    const sender = msg.key.remoteJid;

    const rawText = (
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        ''
    ).trim();

    if (!/^\d{1,2}$/.test(rawText)) return;
    const num = parseInt(rawText);
    if (num < 1 || num > 50) return;

    await handleNumberReply({ socket, msg, sender, numStr: rawText });
};

// ════════════════════════════════════════════════════════
// SELF-CONTAINED LISTENER (try karanava — framework support karoth work karanava)
// ════════════════════════════════════════════════════════
function setupCartoonListener(socket) {
    global._cartoonSocket = socket; // global reference save karanava

    if (global._cartoonListenerAdded) return;
    global._cartoonListenerAdded = true;
    console.log("[cartoon] ✅ Listener registered.");

    socket.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            if (!msg.message) continue;
            const sender = msg.key.remoteJid;
            const rawText = (
                msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                ''
            ).trim();

            if (!/^\d{1,2}$/.test(rawText)) continue;
            const num = parseInt(rawText);
            if (num < 1 || num > 50) continue;

            const contextInfo =
                msg.message?.extendedTextMessage?.contextInfo ||
                msg.message?.imageMessage?.contextInfo;
            if (!contextInfo?.stanzaId) continue;

            const sKey = `${sender}__${contextInfo.stanzaId}`;
            if (!global.slcSession[sKey]) continue;

            await handleNumberReply({ socket, msg, sender, numStr: rawText });
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

                const msgId = sentMsg?.key?.id;
                if (msgId) {
                    const sKey = `${sender}__${msgId}`;
                    global.slcSession[sKey] = {
                        type: 'search',
                        items: searchItems,
                        expiresAt: Date.now() + 5 * 60 * 1000
                    };
                    setTimeout(() => { delete global.slcSession[sKey]; }, 5 * 60 * 1000);
                    console.log(`[cartoon] Session saved: key="${sender}__${msgId}"`);
                }

            } catch (e) {
                console.error("[cartoon] Search Error:", e.message);
                reply(`❌ *Search error: ${e.message}*`);
            }
        }
    }
};
