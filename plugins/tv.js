const axios = require('axios');
const crypto = require('crypto');

// ════════════════════════════════════════════════════════
// GLOBAL STORE FOR TV (පරණ API එකට වෙනම Store එකක්)
// ════════════════════════════════════════════════════════
if (!global.tvOldStore) global.tvOldStore = {};

function genId() { return crypto.randomBytes(4).toString('hex'); }
function storeData(data) { 
    const id = genId(); 
    global.tvOldStore[id] = data; 
    setTimeout(() => { delete global.tvOldStore[id]; }, 20 * 60 * 1000);
    return id; 
}

module.exports = {
    name: "cinesubz-tv-old",
    category: 10,
    description: "Search and download TV Series using Old API",
    commands: ["tv", "tv_sel", "tv_dl"],

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        const botName = "👑 SADEW-MINI 👑";
        const OLD_API = "https://cinesubz-api-cnw.vercel.app/api";

        // ════════════════════════════════════════════════════════
        // 1. SEARCH TV SERIES (.tv)
        // ════════════════════════════════════════════════════════
        if (command === "tv") {
            const query = args.join(" ").trim();
            if (!query) return reply("🎬 *කරුණාකර TV Series එකේ නම ලබා දෙන්න!*\n_උදා: .tv arrow_");

            await socket.sendMessage(sender, { react: { text: "🔍", key: msg.key } });
            try {
                const searchRes = await axios.get(`${OLD_API}/search?q=${encodeURIComponent(query)}`, { timeout: 15000 });
                if (!searchRes.data.status || !searchRes.data.data.length) return reply("❌ *කිසිවක් හමුවූයේ නැත.*");

                // Filter only TV Shows (isTV === true)
                const tvShows = searchRes.data.data.filter(x => x.isTV).slice(0, 10);
                if (!tvShows.length) return reply("❌ *TV Series කිසිවක් හමුවූයේ නැත.*");

                let listText = `*↳ ❝ [📺 𝗦𝗮𝗱𝗲𝘄 𝗧𝗩 𝗦𝗲𝗿𝗶𝗲𝘀 📺] ¡! ❞*\n\n🔍 *සෙව්වේ:* ${query}\n\n`;
                const buttons = [];
                
                tvShows.forEach((tv, i) => {
                    listText += `*${i + 1}.* 📺 ${tv.title}\n   📅 Year: ${tv.year} | ⭐ IMDb: ${tv.imdb}\n\n`;
                    const id = storeData(tv);
                    buttons.push({ buttonId: `.tv_sel ${id}`, buttonText: { displayText: `📺 ${(tv.title).slice(0, 20)}` }, type: 1 });
                });

                listText += `> *📩 පහලින් TV Series එක තෝරන්න*`;
                await socket.sendMessage(sender, { text: listText, footer: botName, buttons: buttons, headerType: 1 }, { quoted: msg });
                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });
            } catch (e) {
                reply("❌ Error: " + e.message);
            }
        }

        // ════════════════════════════════════════════════════════
        // 2. EXTRACT EPISODES / QUALITY (.tv_sel)
        // ════════════════════════════════════════════════════════
        else if (command === "tv_sel") {
            const tv = global.tvOldStore[args[0]];
            if (!tv) return reply("❌ *Link expired. නැවත search කරන්න.*");

            await socket.sendMessage(sender, { react: { text: "⏳", key: msg.key } });
            await reply(`📥 *${tv.title}* හි විස්තර සකසමින්...`);

            try {
                // Fetch using type=tv
                const extractRes = await axios.get(`${OLD_API}/extract?id=${tv.id}&type=tv`, { timeout: 20000 });
                
                if (!extractRes.data.status) {
                    return reply(`❌ *Error:* ${extractRes.data.message}`);
                }

                const data = extractRes.data.data;
                const buttons = [];
                let capText = `📺 *${tv.title}*\n\n> *ඔබට අවශ්‍ය Episode/Quality එක තෝරන්න* ⬇️`;

                if (Array.isArray(data)) {
                    data.forEach(dl => {
                        let btnLabel = dl.episode ? `${dl.episode} - ${dl.quality || dl.size}` : `🎥 ${dl.quality || dl.size || 'Download'}`;
                        const dlId = storeData({ title: tv.title, url: dl.link, img: tv.img, label: btnLabel });
                        buttons.push({ buttonId: `.tv_dl ${dlId}`, buttonText: { displayText: btnLabel.slice(0, 20) }, type: 1 });
                    });

                    const msgOpts = { caption: capText, footer: botName, buttons: buttons, headerType: tv.img ? 4 : 1 };
                    if (tv.img) msgOpts.image = { url: tv.img };
                    await socket.sendMessage(sender, msgOpts, { quoted: msg });
                } 
                else {
                    // API එකෙන් එන Format එක වෙනස් නම් මොකද වෙන්නේ කියලා බලාගන්න මේක දැම්මා
                    await reply(`⚠️ *Format එක අලුත්.* කරුණාකර මේක එවන්න:\n\n${JSON.stringify(data).slice(0, 1000)}`);
                }
            } catch (e) {
                reply("❌ Extract Error: " + e.message);
            }
        }

        // ════════════════════════════════════════════════════════
        // 3. DOWNLOAD (.tv_dl)
        // ════════════════════════════════════════════════════════
        else if (command === "tv_dl") {
            const dl = global.tvOldStore[args[0]];
            if (!dl) return reply("❌ *Link expired.*");

            await socket.sendMessage(sender, { react: { text: "⬇️", key: msg.key } });
            await reply(`📥 *Downloading...*\n${dl.title} | ${dl.label}`);

            try {
                // Direct stream from the Old API link
                const streamRes = await axios({ method: 'GET', url: dl.url, responseType: 'stream', timeout: 300000 });
                const fileName = `${dl.title.substring(0, 30)} - ${dl.label}.mp4`.replace(/[^a-zA-Z0-9.\- ]/g, '');
                
                await socket.sendMessage(sender, { 
                    document: { stream: streamRes.data }, 
                    mimetype: "video/mp4", 
                    fileName: fileName, 
                    caption: `🎬 *${dl.title}*\n> 👑 *SADEW-MINI*` 
                }, { quoted: msg });
                
                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });
            } catch (e) {
                reply("❌ *Download Failed!* සර්වර් එකේ ලින්ක් එක වැඩ කරන්නේ නැත.");
            }
        }
    }
};
