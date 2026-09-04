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
        
        // 🎯 REAL RAM FIX: process.memoryUsage().rss (Resident Set Size)
        // Heroku සර්වර් එකෙන් ඇත්තටම මනින සම්පූර්ණ Physical RAM Usage එක මෙතැනින් මැනිය හැක.
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