require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const Admin = require('./models/Admin'); 

const app = express();
const __path = process.cwd();
const PORT = process.env.PORT || 8000;
let code = require('./pair'); 

require('events').EventEmitter.defaultMaxListeners = 500;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🔥 MongoDB Connection
const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://sadewrashmika577_db_user:bKyIDz8UNMtkRRic@cluster0.sxlaxuj.mongodb.net/?appName=Cluster0';
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB (Server.js)'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ════════════ 📊 SERVER LIVE STATS API (MAIN) ════════════
app.get('/livestats', (req, res) => {
    try {
        const uptime = process.uptime();
        
        // 🎯 REAL RAM FIX: process.memoryUsage().rss (Resident Set Size)
        const ramUsed = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
        
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
        const inputEmojis = req.query.emoji || '❤️';

        if (!link) {
            return res.json({ fail: "Enter your channel post link", example: "/react?link=https://whatsapp.com/channel/xxx/123&emoji=😂👍🔥" });
        }

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

        // 🔥 ඉමෝජි ටික හරියටම වෙන් කිරීම
        const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
        let emojiArray = Array.from(segmenter.segment(inputEmojis))
            .map(s => s.segment)
            .filter(char => char.trim() !== '');

        if (emojiArray.length === 0) {
            emojiArray = ['❤️']; 
        }

        // 🟢 බ්‍රවුසර් එකට දෙන JSON එක
        res.json({
            success: true,
            status: "Background Mass Reaction Started",
            bots_count: activeSockets.size,
            channel_invite: inviteCode,
            message_id: msgId,
            emojis_detected: emojiArray
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
                            // 🎲 හැම බොට් කෙනෙක්ටම වෙනස් ඉමෝජි එකක් Random තෝරනවා
                            const randomEmoji = emojiArray[Math.floor(Math.random() * emojiArray.length)];
                            
                            await botSocket.newsletterReactMessage(jid, msgId, randomEmoji);
                            await new Promise(r => setTimeout(r, 300)); 
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

// Follow කෑල්ලේ Backup එකක් විදිහට තියෙන එක
app.get('/follow', async (req, res) => { res.json({ success: true }); });

// ════════════ LOGIN API ROUTE ════════════
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        if (username === 'sadew' && password === 'sadew123') {
            return res.json({ success: true, redirect: '/central_panel.html' });
        }
        if (username && username.startsWith('admin_')) {
            const user = await Admin.findOne({ username: username, password: password });
            if (user) {
                return res.json({ success: true, redirect: '/sub_admin.html?admin=' + user.username });
            }
        }
        return res.json({ success: false, message: 'Invalid Username or Password!' });
    } catch (error) {
        console.error('Login API Error:', error);
        return res.json({ success: false, message: 'Server error during login!' });
    }
});
// ════════════ SAVE ADMIN SETTINGS API ════════════
app.post('/api/admin/save', async (req, res) => {
    const { admin_id, bot_number, group_jid, footer_text } = req.body;

    try {
        // Admin ID එක අනිවාර්යයි
        if (!admin_id) {
            return res.json({ success: false, message: 'Admin ID is required!' });
        }

        // Database එකේ අදාළ Admin ව හොයලා අලුත් ඩේටා ටික Update කරනවා
        const updatedAdmin = await Admin.findOneAndUpdate(
            { username: admin_id }, // හොයන්නේ මේ නමෙන් (උදා: admin_01)
            { 
                $set: { 
                    bot_number: bot_number, 
                    group_jid: group_jid, 
                    footer_text: footer_text 
                } 
            },
            { new: true } // Update කරපු අලුත් ඩේටා එකම රිටර්න් කරන්න
        );

        if (updatedAdmin) {
            return res.json({ success: true, message: '✅ Settings saved successfully!' });
        } else {
            return res.json({ success: false, message: '❌ Admin account not found!' });
        }

    } catch (error) {
        console.error('Save Settings Error:', error);
        return res.json({ success: false, message: '⚠️ Server error while saving settings!' });
    }
});
// 🔥 IMPORT AND USE MOVIE ROUTES 🔥
const movieRoutes = require('./routes/movieRoutes');
app.use('/', movieRoutes);

// ════════════ FRONTEND ROUTES ════════════

// 1. Pairing Site (Base URL & /pair)
app.use('/code', code);
app.use('/pair', async (req, res, next) => { res.sendFile(__path + '/pair.html'); });
app.use('/', async (req, res, next) => { 
    // මෙතන '/' (Base URL) ආවම, අර පරණ 'main.html' වෙනුවට 'pair.html' එකම ලෝඩ් කරනවා.
    res.sendFile(__path + '/pair.html'); 
});

// 2. Movie Search Sites (ඔයාගේ සහ කස්ටමර්ලගේ)
app.use('/movie', async (req, res, next) => { res.sendFile(__path + '/movie.html'); }); // ඔයාගේ සයිට් එක
app.use('/kamal', async (req, res, next) => { res.sendFile(__path + '/kamal.html'); }); // කමල්ගේ සයිට් එක
app.use('/nimal', async (req, res, next) => { res.sendFile(__path + '/nimal.html'); }); // නිමල්ගේ සයිට් එක (ඕනේ නම්)

// 3. Web Panels (Admin & SaaS Controls)
// ලොග් වෙන තැනට වෙනම ලින්ක් එකක් දෙනවා (උදා: /portal)
app.use('/portal', async (req, res, next) => { res.sendFile(__path + '/main.html'); }); // මේක තමයි Login Page එක

// කස්ටමර්ගේ Settings Panel එක (Sub Admin)
app.use('/sub_admin.html', async (req, res, next) => { res.sendFile(__path + '/sub_admin.html'); }); 

// ඔයාගේ ප්‍රධාන පැනල් එක
app.use('/central_panel.html', async (req, res, next) => { res.sendFile(__path + '/central_panel.html'); });
app.listen(PORT, '0.0.0.0', () => { console.log(`Akira Bot — ONLINE  Port: ${PORT}`); });
module.exports = app;
