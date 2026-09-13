const express = require('express');
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
        
        // global.activeSockets හරහා sessions ගාණ ගන්නවා
        const sessionsCount = (global.activeSockets && global.activeSockets.size) 
                              ? global.activeSockets.size 
                              : 0;

        res.json({
            uptime: uptime,
            ramUsed: ramUsed,
            sessionsCount: sessionsCount
        });
    } catch (error) {
        console.error("Stats API Error:", error);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

// ════════════ 📢 MASS CHANNEL REACTION API ════════════
app.get('/react', async (req, res) => {
    try {
        const link = req.query.link;
        const emoji = req.query.emoji || '❤️';

        if (!link) {
            return res.json({ fail: "Enter your channel post link", example: "/react?link=https://whatsapp.com/channel/xxx/123&emoji=❤️" });
        }

        // index.js එකේදී global.activeSockets හරහා bots ලව ගන්නවා
        const activeSockets = global.activeSockets;

        if (!activeSockets || activeSockets.size === 0) {
            return res.json({ fail: "No active bots connected!" });
        }

        const match = link.match(/channel\/([a-zA-Z0-9_-]+)\/(\d+)/);
        if (!match) {
            return res.json({ fail: "Invalid channel link format!" });
        }

        const inviteCode = match[1];
        const msgId = match[2];

        // 🟢 බ්‍රවුසර් එක හිරවෙන්නේ නැති වෙන්න කෙලින්ම JSON එක මෙතනින් දෙනවා
        res.json({
            success: true,
            status: "Background Mass Reaction Started",
            bots_count: activeSockets.size,
            channel_invite: inviteCode,
            message_id: msgId,
            emoji: emoji
        });

        // 🟡 Background එකේ ඉතුරු වැඩේ වෙනවා
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
                            await botSocket.newsletterReactMessage(jid, msgId, emoji);
                            await new Promise(r => setTimeout(r, 300)); // Spam නොවෙන්න
                        }
                    } catch (e) {
                        console.log(`React failed for ${number}`);
                    }
                }
            } catch (err) {
                console.error('Mass React Error:', err.message);
            }
        })();

    } catch (error) {
        if (!res.headersSent) {
            res.json({ fail: "System error occurred", error: error.message });
        }
    }
});
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════

app.use('/code', code);

app.use('/pair', async (req, res, next) => {
    res.sendFile(__path + '/pair.html')
});

app.use('/settings', async (req, res, next) => {
    res.sendFile(__path + '/settings.html')
});

// මේක හැමදේටම පස්සේ යටින්ම තියෙන්න ඕනේ (Catch-all)
app.use('/', async (req, res, next) => {
    res.sendFile(__path + '/main.html')
});

app.listen(PORT, () => {
  console.log(`╔═══════════════════════════╗`);
  console.log(`║  Akira Bot — ONLINE  Port: ${PORT}   ║`);
  console.log(`╚═══════════════════════════╝`);
});

module.exports = app;
