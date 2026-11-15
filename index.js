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

// 🔥 MongoDB Connection (Securely loaded from Environment Variables)
const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
    console.error('❌ MONGODB_URI is not set in environment variables/secrets!');
}
mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('✅ Connected to MongoDB (Server.js)');
        try {
            const vinuAdmin = await Admin.findOne({ username: 'vinu' });
            if (!vinuAdmin) {
                await Admin.create({
                    username: 'vinu',
                    password: 'vinu' + Math.floor(1000 + Math.random() * 9000),
                    bot_number: '94743441803',
                    group_jid: '120363425721300928@g.us',
                    footer_text: '╭━━━〔 🎬 𝗩𝐢𝐧𝐮 𝐱 Ｍ𝐨𝐯𝐢𝐞 ℂ𝐥𝐮𝐛 🍿 〕━━━╮\n✨ 𝐘𝐨𝐮𝐫 𝐌𝐨𝐯𝐢𝐞 𝐖𝐨𝐫𝐥𝐝, 𝐘𝐨𝐮𝐫 𝐕𝐢𝐛𝐞! 💫\n╰━━━━━━━━━━━━━━━━━━╯'
                });
                console.log('✅ Auto-initialized Vinu admin settings in MongoDB');
            }
        } catch(e) {
            console.warn('Vinu admin auto-init check:', e.message);
        }
    })
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

// 3. Login API (Database එකෙන් පාස්වර්ඩ් චෙක් කරනවා)
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        // 1. Master Admin Check (ඔයාට Central Panel එකට යන්න)
        // 'sadew123' වෙනුවට ඔයාට ඕනේ ප්‍රධාන පාස්වර්ඩ් එක මෙතන දෙන්න
        if (username === 'sadew' && password === 'sadew123') { 
            return res.json({ success: true, redirect: '/central_panel.html' });
        }

        // 2. Customer Check (Database එකෙන් බලලා Sub Admin එකට යවන්න)
        const admin = await Admin.findOne({ username: username });
        
        if (!admin) {
            return res.json({ success: false, message: 'Username not found!' });
        }
        if (admin.password !== password) {
            return res.json({ success: false, message: 'Incorrect Password!' });
        }

        // පාස්වර්ඩ් හරි නම් කස්ටමර්ගේ පැනල් එකට යවනවා
        return res.json({ success: true, redirect: `/sub_admin.html?admin=${username}` });

    } catch (error) {
        console.error('Login Error:', error);
        res.json({ success: false, message: 'Server error!' });
    }
});
// ════════════ ADMIN SETTINGS APIS (GET & SAVE) ════════════
app.get('/api/admin/settings/:admin_id?', async (req, res) => {
    const rawId = req.params.admin_id || req.query.admin || req.query.admin_id;
    if (!rawId) {
        return res.status(400).json({ success: false, message: 'Admin ID is required!' });
    }

    try {
        const cleanId = rawId.trim();
        const safeRegex = cleanId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const admin = await Admin.findOne({
            $or: [
                { username: cleanId },
                { username: new RegExp('^' + safeRegex + '$', 'i') }
            ]
        });

        if (admin) {
            return res.json({
                success: true,
                admin_id: admin.username,
                bot_number: admin.bot_number || '',
                group_jid: admin.group_jid || '',
                footer_text: admin.footer_text || ''
            });
        } else {
            return res.json({
                success: true,
                admin_id: cleanId,
                bot_number: '',
                group_jid: '',
                footer_text: ''
            });
        }
    } catch (e) {
        console.error('Fetch Settings Error:', e);
        return res.status(500).json({ success: false, message: 'Server error fetching settings' });
    }
});

app.post('/api/admin/save', async (req, res) => {
    const { admin_id, bot_number, group_jid, footer_text } = req.body;

    try {
        if (!admin_id) {
            return res.json({ success: false, message: 'Admin ID is required!' });
        }

        const cleanId = String(admin_id).trim();
        const safeRegex = cleanId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let admin = await Admin.findOne({
            $or: [
                { username: cleanId },
                { username: new RegExp('^' + safeRegex + '$', 'i') }
            ]
        });

        if (!admin) {
            admin = new Admin({
                username: cleanId,
                password: 'sub_' + Math.random().toString(36).slice(2, 8),
                role: 'sub_admin'
            });
        }

        if (bot_number !== undefined) admin.bot_number = String(bot_number).trim();
        if (group_jid !== undefined) admin.group_jid = String(group_jid).trim();
        if (footer_text !== undefined) admin.footer_text = String(footer_text).trim();

        await admin.save();
        return res.json({ success: true, message: '✅ Settings saved successfully!' });

    } catch (error) {
        console.error('Save Settings Error:', error);
        return res.json({ success: false, message: '⚠️ Server error while saving settings!' });
    }
});

// ════════════ CENTRAL PANEL APIS (AUTO DATABASE) ════════════

// 1. Database එකේ ඉන්න ඔක්කොම ඇඩ්මින්ලාව Panel එකට ගන්න API එක
app.get('/api/admins', async (req, res) => {
    if (req.headers['x-admin-key'] !== 'sadew123') {
        return res.status(403).json({ success: false, message: '🚫 Unauthorized: Admin access required.' });
    }
    try {
        const admins = await Admin.find({});
        res.json({ success: true, admins: admins });
    } catch (error) {
        res.json({ success: false, message: 'Failed to fetch admins' });
    }
});

// 2. Central Panel එකෙන් අලුත් ඇඩ්මින් කෙනෙක් හදන API එක
app.post('/api/admin/create', async (req, res) => {
    if (req.headers['x-admin-key'] !== 'sadew123') {
        return res.status(403).json({ success: false, message: '🚫 Unauthorized: Admin access required.' });
    }
    const { username, password, bot_number, group_jid, footer_text } = req.body;
    try {
        if (!username || !password) {
            return res.json({ success: false, message: 'Username and Password are required!' });
        }

        // ඇඩ්මින් කලින් ඉන්නවද බලනවා (හිටියොත් අප්ඩේට් කරනවා, නැත්තම් අලුතින් හදනවා)
        let existingAdmin = await Admin.findOne({ username: username });
        
        if (existingAdmin) {
            existingAdmin.password = password;
            existingAdmin.bot_number = bot_number || existingAdmin.bot_number;
            existingAdmin.group_jid = group_jid || existingAdmin.group_jid;
            existingAdmin.footer_text = footer_text || existingAdmin.footer_text;
            await existingAdmin.save();
            return res.json({ success: true, message: 'Admin updated successfully!' });
        } else {
            const newAdmin = new Admin({
                username: username,
                password: password,
                bot_number: bot_number || '',
                group_jid: group_jid || '',
                footer_text: footer_text || ''
            });
            await newAdmin.save();
            return res.json({ success: true, message: 'New Admin created successfully!' });
        }
    } catch (error) {
        console.error('Create Admin Error:', error);
        res.json({ success: false, message: 'Server error while creating admin!' });
    }
});
// 🔥 IMPORT AND USE MOVIE ROUTES 🔥
const movieRoutes = require('./routes/movieRoutes');
app.use('/', movieRoutes);

// ════════════ FRONTEND ROUTES ════════════

app.use('/code', code); // Pairing API එක

// 1. Movie Search Page 
app.use('/movie', async (req, res) => { 
    res.sendFile(path.join(__path, 'movie.html')); 
});

// 2. Login Portal 
app.use('/portal', async (req, res) => { 
    res.sendFile(path.join(__path, 'main.html')); 
});

// 3. Sub Admin Panel 
app.use('/sub_admin.html', async (req, res) => { 
    res.sendFile(path.join(__path, 'sub_admin.html')); 
});

// 4. Central Panel 
app.use('/central_panel.html', async (req, res) => { 
    res.sendFile(path.join(__path, 'central_panel.html')); 
});

// 5. Customer Websites
app.use('/deshan', async (req, res) => { 
   res.sendFile(path.join(__path, 'nimal.html')); 
});

// 5.1 Vinu's Web & Admin Settings
app.use('/vinu', async (req, res) => { 
   res.sendFile(path.join(__path, 'vinu.html')); 
});
app.use('/vinu-admin', async (req, res) => {
   res.redirect('/sub_admin.html?admin=vinu');
});

// 6. Pairing Page (Base URL - මේක අනිවාර්යයෙන්ම අන්තිමටම තියෙන්න ඕනේ!)
app.use('/', async (req, res) => { 
    res.sendFile(path.join(__path, 'pair.html')); 
});

// ════════════ START SERVER ════════════
app.listen(PORT, '0.0.0.0', () => { 
    console.log(`Akira Bot — ONLINE  Port: ${PORT}`); 
});
module.exports = app;
