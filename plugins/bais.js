const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');

// ════════════════════════════════════════════════════════
// GLOBAL STORE (RAM Clear වීම සඳහා TTL යොදා ඇත)
// ════════════════════════════════════════════════════════
if (!global.bsStore) global.bsStore = {};

function genId() { return crypto.randomBytes(4).toString('hex'); }
function storeData(data, ttlMs = 15 * 60 * 1000) { 
    const id = genId(); 
    global.bsStore[id] = data; 
    setTimeout(() => { delete global.bsStore[id]; }, ttlMs);
    return id; 
}

// 🎯 ULTRA SMART PARSER (Target JID සඳහා)
function parseBaiscopeSend(fullText) {
    if (!fullText) return { query: "", targetJid: null };
    let raw = fullText.trim();
    let targetJid = null;
    let query = raw;

    const endMatch = raw.match(/(?:,|\s)*([0-9]+@g\.us|[0-9]+@s\.whatsapp\.net|\+?94[0-9]{9}|0[0-9]{9})$/i);
    if (endMatch) {
        let extracted = endMatch[1];
        let matchStr = endMatch[0];
        let matchIndex = raw.lastIndexOf(matchStr);
        if (matchIndex !== -1) query = raw.substring(0, matchIndex).replace(/,$/, '').trim();

        if (extracted.includes('@g.us') || extracted.includes('@s.whatsapp.net')) targetJid = extracted;
        else {
            let num = extracted.replace(/[^0-9]/g, '');
            if (num.startsWith('0') && num.length === 10) num = '94' + num.slice(1);
            if (num.length >= 10) targetJid = num + '@s.whatsapp.net';
        }
    }
    return { query, targetJid };
}

// 🌐 DIRECT LINK BYPASSER (Basic Failback Logic)
async function extractDirectLink(url) {
    try {
        // මෙතනට Usersdrive, Send.now වගේ සයිට් වල Bypass එක ලියන්න පුළුවන්.
        // දැනට කෙලින්ම MP4 එකක් තිබ්බොත් ඒක ගන්නවා.
        if (url.includes('.mp4')) return url;

        // Usersdrive Basic Bypass Try
        if (url.includes('usersdrive.com')) {
            const html = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const $ = cheerio.load(html.data);
            // Form එකක් Submit කරන්න ඕනෙනම් ඒක මෙතනින් හැසිරවිය හැක.
            // (Usersdrive Captcha නැති වෙලාවට වැඩ කිරීමට)
        }

        // Bypasser එක සාර්ථක නැත්නම් මුල් ලින්ක් එකම දෙනවා.
        return url;
    } catch (e) {
        return null;
    }
}

module.exports = {
    name: "baiscope-downloader",
    category: 10,
    description: "Search and download movies from BaiscopeDownloads (Failback Supported)",
    
    // මෙනු එකේ පේන්නේ bs විතරයි
    commands: ["bs"], 

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        const botName = "👑 SADEW-MINI 👑";
        const metaQuote = {
            key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_BS" },
            message: { contactMessage: { displayName: botName, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${botName}\nORG:Sadew Baiscope\nTEL;waid=94700000000:+94 70 000 0000\nEND:VCARD` } }
        };

        const subCmd = args[0];
        const subId = args[1];

        // ════════════════════════════════════════════════════════
        // 1. SELECT MOVIE (--sel) [Hidden]
        // ════════════════════════════════════════════════════════
        if (subCmd === "--sel") {
            const movie = global.bsStore[subId];
            if (!movie) return reply("❌ *Link expired. නැවත search කරන්න.*");

            await socket.sendMessage(sender, { react: { text: "⏳", key: msg.key } });
            await reply(`📥 *${movie.title}* හි Links ලබා ගනිමින්...`);

            try {
                // සයිට් එකෙන් ලින්ක් Scrape කිරීම
                const res = await axios.get(movie.url, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0' } });
                const $ = cheerio.load(res.data);
                
                let qualities = { "1080p": [], "720p": [], "480p": [] };

                // "a" ටැග් ඔක්කොම අරන් ඩවුන්ලෝඩ් ලින්ක්ස් වෙන් කිරීම
                $('a').each((i, el) => {
                    const href = $(el).attr('href');
                    if (href && (href.includes('usersdrive') || href.includes('send.now') || href.includes('bysezoxexe') || href.includes('ouo.io'))) {
                        let textContext = $(el).parent().text().toLowerCase() + " " + $(el).text().toLowerCase();
                        if (textContext.includes('1080p') || textContext.includes('1080')) qualities["1080p"].push(href);
                        else if (textContext.includes('480p') || textContext.includes('480')) qualities["480p"].push(href);
                        else qualities["720p"].push(href); // Default to 720p
                    }
                });

                const buttons = [];
                let capText = `*↳ ❝ [🎬 𝗕𝗮𝗶𝘀𝗰𝗼𝗽𝗲 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝘀] ¡! ❞*\n\n🎬 *Title:* ${movie.title}\n`;
                if (movie.targetJid) capText += `🎯 *Send Target:* \`${movie.targetJid}\`\n`;
                capText += `\n> *අවශ්‍ය Quality එක තෝරන්න* ⬇️`;

                // තියෙන Qualities වලට විතරක් Button සෑදීම
                for (const [q, links] of Object.entries(qualities)) {
                    if (links.length > 0) {
                        const qId = storeData({ title: movie.title, quality: q, links: links, targetJid: movie.targetJid, img: movie.img });
                        buttons.push({ buttonId: `.bs --dl ${qId}`, buttonText: { displayText: `🎥 Download ${q}` }, type: 1 });
                    }
                }

                if (buttons.length === 0) return reply("❌ *මෙම චිත්‍රපටය සඳහා Download Links හමු නොවිණි.*");

                const msgOpts = { caption: capText, footer: botName, buttons: buttons, headerType: movie.img ? 4 : 1 };
                if (movie.img) msgOpts.image = { url: movie.img };

                await socket.sendMessage(sender, msgOpts, { quoted: msg });
                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

            } catch (e) {
                reply("❌ Error parsing movie page: " + e.message);
            }
        }

        // ════════════════════════════════════════════════════════
        // 2. DOWNLOAD & FAILBACK SYSTEM (--dl) [Hidden]
        // ════════════════════════════════════════════════════════
        else if (subCmd === "--dl") {
            const dlData = global.bsStore[subId];
            if (!dlData) return reply("❌ *Link expired. නැවත search කරන්න.*");
            const destJid = dlData.targetJid || sender;

            await socket.sendMessage(sender, { react: { text: "⬇️", key: msg.key } });
            await reply(`🚀 *Failback System Active*\n\`${dlData.title} (${dlData.quality})\` සඳහා සර්වර් පරීක්ෂා කරමින් පවතී...`);

            let streamSuccess = false;

            // සර්වර් ඔක්කොම එකින් එක පරීක්ෂා කිරීම (FAILBACK)
            for (let i = 0; i < dlData.links.length; i++) {
                const link = dlData.links[i];
                try {
                    // Bypass Logic හරහා Direct Link එක ගැනීම
                    let directUrl = await extractDirectLink(link);
                    if (!directUrl || !directUrl.includes('http')) continue;

                    await socket.sendMessage(sender, { text: `🔄 *Server ${i + 1} සම්බන්ධ වෙමින් පවතී...*` });

                    const streamRes = await axios({
                        method: 'GET', url: directUrl, responseType: 'stream', timeout: 0, 
                        headers: { 'User-Agent': 'Mozilla/5.0' }, maxRedirects: 10
                    });

                    const fileName = `${(dlData.title || 'Movie').substring(0, 30).replace(/[^a-zA-Z0-9 .\-]/g, '').trim()} - ${dlData.quality}.mp4`;
                    const cap = `🎬 *Name:* ${dlData.title}\n📽 *Quality:* ${dlData.quality}\n\n> 👑 *SADEW-MINI* 👑`;

                    await socket.sendMessage(destJid, {
                        document: { stream: streamRes.data },
                        mimetype: "video/mp4", fileName: fileName, caption: cap
                    }, { quoted: metaQuote });

                    // ඩවුන්ලෝඩ් එක සාර්ථකයි නම් ලූප් එක නවත්වනවා
                    streamSuccess = true;
                    try { if (streamRes.data && typeof streamRes.data.destroy === 'function') streamRes.data.destroy(); } catch(e){}
                    break;

                } catch (err) {
                    console.log(`[Failback] Server ${i + 1} Failed: ${err.message}`);
                    // මේ සර්වර් එක වැඩ නැත්නම් ඊළඟ එකට (continue) යනවා
                }
            }

            if (streamSuccess) {
                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });
            } else {
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                await reply("❌ *Download Failed!* සර්වර් සියල්ලම පරීක්ෂා කළ නමුත් කිසිඳු සර්වර් එකකින් වීඩියෝව ලබාගත නොහැකි විය. (Filehost Captcha/Errors)");
            }

            // 🧹 MEMORY CLEAR PROCESS (අනිවාර්යයෙන්ම RAM එක සුද්ද කිරීම)
            delete global.bsStore[subId];
            try { 
                if (global.gc) {
                    global.gc();
                    console.log("[RAM] Garbage Collection Executed after DL.");
                }
            } catch (e) {}
        }

        // ════════════════════════════════════════════════════════
        // 3. SEARCH BAISCOPE (Main Command)
        // ════════════════════════════════════════════════════════
        else {
            const fullText = args.join(" ").trim();
            if (!fullText) return reply("🎬 *කරුණාකර නම ලබා දෙන්න!*\n_උදා: .bs leo_");

            const { query, targetJid } = parseBaiscopeSend(fullText);
            await socket.sendMessage(sender, { react: { text: "🔍", key: msg.key } });

            try {
                // BaiscopeDownloads Search URL
                const searchUrl = `https://baiscopedownloads.link/?s=${encodeURIComponent(query)}`;
                const res = await axios.get(searchUrl, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0' } });
                const $ = cheerio.load(res.data);

                const movies = [];
                // සර්ච් රිසල්ට් වලින් මුල් 10 ගන්නවා
                $('.post-content').each((i, el) => {
                    if (i >= 10) return;
                    const titleEl = $(el).find('h2.entry-title a');
                    const title = titleEl.text().trim();
                    const url = titleEl.attr('href');
                    const img = $(el).find('img').attr('src');

                    if (title && url) {
                        movies.push({ title, url, img });
                    }
                });

                if (movies.length === 0) return reply("❌ *කිසිවක් හමුවූයේ නැත.*");

                let listText = `*↳ ❝ [🎬 𝗕𝗮𝗶𝘀𝗰𝗼𝗽𝗲 𝗦𝗲𝗮𝗿𝗰𝗵] ¡! ❞*\n\n🔍 *සෙව්වේ:* ${query}\n`;
                if (targetJid) listText += `🎯 *Target Send To:* \`${targetJid}\`\n\n`;
                else listText += `\n`;

                const buttons = [];
                movies.forEach((mv, i) => {
                    listText += `*${i + 1}.* 🎬 ${mv.title}\n\n`;
                    const id = storeData({ url: mv.url, title: mv.title, img: mv.img, targetJid: targetJid });
                    
                    // Hidden subcommand 
                    buttons.push({ buttonId: `.bs --sel ${id}`, buttonText: { displayText: `🎬 ${(mv.title).slice(0, 20)}` }, type: 1 });
                });

                listText += `> *📩 පහලින් චිත්‍රපටය තෝරන්න*`;
                await socket.sendMessage(sender, { text: listText, footer: botName, buttons: buttons, headerType: 1 }, { quoted: msg });
                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

            } catch (e) {
                console.error(e);
                reply("❌ *සෙවීමේදී දෝෂයක් ඇතිවිය.*");
            }
        }
    }
};
