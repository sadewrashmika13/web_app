const express = require('express');
const axios = require('axios');
const app = express();
const __path = process.cwd();
const PORT = process.env.PORT || 8000;
let code = require('./pair'); 

require('events').EventEmitter.defaultMaxListeners = 500;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ════════════ 📊 SERVER LIVE STATS API (MAIN) ════════════
app.get('/livestats', (req, res) => {
    try {
        const uptime = process.uptime();
        const ramUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const sessionsCount = (global.activeSockets && global.activeSockets.size) 
                              ? global.activeSockets.size 
                              : 0;
        res.json({ uptime: uptime, ramUsed: ramUsed, sessionsCount: sessionsCount });
    } catch (error) {
        console.error("Stats API Error:", error);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

// ════════════ 📢 MASS CHANNEL REACTION API ════════════
app.get('/react', async (req, res) => {
    try {
        const link = req.query.link;
        const inputEmojis = req.query.emoji || '❤️';

        if (!link) {
            return res.json({ fail: "Enter your channel post link", example: "/react?link=https://whatsapp.com/channel/xxx/123&emoji=😂👍🔥" });
        }
        const activeSockets = global.activeSockets;
        if (!activeSockets || activeSockets.size === 0) {
            return res.json({ fail: "No active bots connected!" });
        }

        const match = link.match(/channel\/([a-zA-Z0-9_-]+)\/(\d+)/);
        if (!match) return res.json({ fail: "Invalid channel link format!" });

        const inviteCode = match[1];
        const msgId = match[2];

        const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
        let emojiArray = Array.from(segmenter.segment(inputEmojis)).map(s => s.segment).filter(char => char.trim() !== '');
        if (emojiArray.length === 0) emojiArray = ['❤️']; 

        res.json({
            success: true, status: "Background Mass Reaction Started",
            bots_count: activeSockets.size, channel_invite: inviteCode,
            message_id: msgId, emojis_detected: emojiArray
        });

        (async () => {
            try {
                const firstSession = Array.from(activeSockets.values())[0];
                const firstSocket = firstSession.socket || firstSession;
                const metadata = await firstSocket.newsletterMetadata('invite', inviteCode);
                const jid = metadata.id;

                for (const [number, sessionData] of activeSockets.entries()) {
                    try {
                        const botSocket = sessionData.socket || sessionData;
                        if (botSocket) {
                            const randomEmoji = emojiArray[Math.floor(Math.random() * emojiArray.length)];
                            await botSocket.newsletterReactMessage(jid, msgId, randomEmoji);
                            await new Promise(r => setTimeout(r, 300)); 
                        }
                    } catch (e) {
                        console.log(`React failed for ${number}`);
                    }
                }
            } catch (err) { console.error('Mass React Error:', err.message); }
        })();
    } catch (error) {
        if (!res.headersSent) res.json({ fail: "System error occurred", error: error.message });
    }
});

// ════════════ 📢 MASS CHANNEL FOLLOW API ════════════
app.get('/follow', async (req, res) => {
    try {
        const link = req.query.link;
        if (!link) return res.json({ fail: "Enter your channel link" });

        const activeSockets = global.activeSockets;
        if (!activeSockets || activeSockets.size === 0) return res.json({ fail: "No active bots connected!" });

        const match = link.match(/channel\/([a-zA-Z0-9_-]+)/);
        if (!match) return res.json({ fail: "Invalid channel link format!" });

        const inviteCode = match[1];

        res.json({
            success: true, status: "Background Mass Follow Started",
            bots_count: activeSockets.size, channel_invite: inviteCode,
            anti_spam_delay: "15 Seconds per user"
        });

        (async () => {
            try {
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
                            console.log(`[+] [${count}/${activeSockets.size}] Followed successfully: ${number}`);
                            await new Promise(r => setTimeout(r, 15000));
                        }
                    } catch (e) { console.log(`[-] Follow failed for ${number}:`, e.message); }
                    count++;
                }
                console.log(`✅ Mass follow completely finished for ${inviteCode}`);
            } catch (err) { console.error('Mass Follow Error:', err.message); }
        })();
    } catch (error) {
        if (!res.headersSent) res.json({ fail: "System error occurred", error: error.message });
    }
});

// ════════════ 🎬 CINESUBZ MOVIE SENDER API ════════════
const CZ_API = "https://cz-dnuz.vercel.app";
const GROUP_JID = '120363425721300928@g.us'; // 🔴 Movie Group JID
const BOT_NUMBER = '94705236759'; // 🔴 Correct Bot Number

app.post('/api/search', async (req, res) => {
    const { query } = req.body;
    try {
        const searchRes = await axios.get(`${CZ_API}/search?q=${encodeURIComponent(query)}`);
        if (searchRes.data.success && searchRes.data.result?.length > 0) {
            res.json({ success: true, results: searchRes.data.result.slice(0, 6) });
        } else {
            res.json({ success: false });
        }
    } catch (error) {
        res.json({ success: false });
    }
});

app.post('/api/links', async (req, res) => {
    const { url } = req.body;
    try {
        const dlRes = await axios.get(`${CZ_API}/movidl?url=${encodeURIComponent(url)}`);
        res.json({ success: true, downloads: dlRes.data.result?.downloads || [] });
    } catch (error) {
        res.json({ success: false });
    }
});

app.post('/api/send-movie', async (req, res) => {
    const { title, url, quality, reqName, reqNum } = req.body;
    const activeSockets = global.activeSockets;
    
    if (!activeSockets || !activeSockets.has(BOT_NUMBER)) {
        return res.status(500).json({ error: 'Bot is not connected!' });
    }
    const sock = activeSockets.get(BOT_NUMBER).socket || activeSockets.get(BOT_NUMBER);

    try {
        res.json({ success: true, message: 'Upload started' });

        // 1. Inbox එකට මැසේජ් එක යැවීම
        const ownerMessage = `📌 *New Movie Requested!*\n\n🎬 *Movie:* ${title}\n📽 *Quality:* ${quality}\n👤 *Requested By:* ${reqName}\n📞 *Number:* ${reqNum}\n\n_මෙම චිත්‍රපටය (Document එකක් ලෙස) Group එකට Upload වෙමින් පවතී..._`;
        await sock.sendMessage(BOT_NUMBER + '@s.whatsapp.net', { text: ownerMessage });

        // 2. Group එකට දැන්වීම
        await sock.sendMessage(GROUP_JID, { 
            text: `⏳ *${title}* (${quality})\n_චිත්‍රපටය ඩවුන්ලෝඩ් කර Document එකක් ලෙස අප්ලෝඩ් වෙමින් පවතී. කරුණාකර රැඳී සිටින්න..._\n\n👤 *Requested By:* ${reqName}`
        });

        let resolvedUrl = url.replace(/\/(server\d+)\/\d+:\//g, '/$1/');
        if (resolvedUrl.endsWith('.mp4') && !resolvedUrl.includes('?ext=')) {
            resolvedUrl = resolvedUrl.replace(/\.mp4$/, '?ext=mp4');
        }

        const dlApiUrl = `${CZ_API}/download?url=${resolvedUrl}`;
        const dlRes = await axios.get(dlApiUrl);
        const httpUrl = dlRes.data.result?.downloadUrls?.find(u => u.url?.startsWith('http') && !u.url.includes('t.me'));
        
        if (!httpUrl?.url) throw new Error("Direct download link not found!");

        // 3. Axios Stream මඟින් ඩවුන්ලෝඩ් කර Document ලෙස ගෲප් එකට යැවීම
        const streamRes = await axios({
            method: 'GET', url: httpUrl.url, responseType: 'stream', timeout: 600000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
            maxRedirects: 10
        });

        const fileName = `${title.substring(0, 30).replace(/[^a-zA-Z0-9 ]/g, '').trim()} - ${quality}.mp4`;
        const groupCaption = `🎬 *${title}*\n✨ *Quality:* ${quality}\n\n👤 *Movie Requested By:* ${reqName}\n\n> 👑 *SADEW-MINI WEB SENDER* 👑`;

        await sock.sendMessage(GROUP_JID, {
            document: { stream: streamRes.data },
            mimetype: "video/mp4",
            fileName: fileName,
            caption: groupCaption
        });

        console.log(`✅ Movie successfully sent to Group as Document Stream!`);
        setTimeout(() => { try { if (global.gc) global.gc(); } catch (e) {} }, 5000);

    } catch (error) {
        console.error('❌ Web Upload Error:', error.message);
        try {
            await sock.sendMessage(BOT_NUMBER + '@s.whatsapp.net', { 
                text: `❌ *Upload Failed!*\n\n🎬 *Movie:* ${title}\n⚠️ *Error:* ${error.message}` 
            });
            await sock.sendMessage(GROUP_JID, { 
                text: `❌ *Upload Failed!*\n🎬 *Movie:* ${title}\n_සර්වර් දෝෂයක් නිසා චිත්‍රපටය යැවීම අසාර්ථක විය._` 
            });
        } catch (e) {}
    }
});

// ════════════ 🌐 WEB PAGE ROUTES ════════════
app.use('/code', code);
app.use('/pair', async (req, res, next) => { res.sendFile(__path + '/pair.html'); });
app.use('/settings', async (req, res, next) => { res.sendFile(__path + '/settings.html'); });
app.use('/movie', async (req, res, next) => { res.sendFile(__path + '/movie.html'); });
app.use('/', async (req, res, next) => { res.sendFile(__path + '/main.html'); });

app.listen(PORT, () => {
  console.log(`╔═══════════════════════════╗`);
  console.log(`║  Akira Bot — ONLINE  Port: ${PORT}   ║`);
  console.log(`╚═══════════════════════════╝`);
});

module.exports = app;
