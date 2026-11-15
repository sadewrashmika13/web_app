const axios = require('axios');
const crypto = require('crypto');
const cheerio = require('cheerio');
const qs = require('qs');
const https = require('https');

// SSL Bypass Agent
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// ════════════════════════════════════════════════════════
// GLOBAL STORE — Short ID System to prevent long button IDs
// ════════════════════════════════════════════════════════
if (!global.kdStore) global.kdStore = {};

function genId() { 
    return crypto.randomBytes(4).toString('hex'); 
}

function storeData(data, ttlMs = 60 * 60 * 1000) { 
    const id = genId();
    global.kdStore[id] = data;
    setTimeout(() => { delete global.kdStore[id]; }, ttlMs);
    return id;
}

// Flexible Target JID parser (supports comma or space delimited phone / JID)
function parseTarget(fullText) {
    if (!fullText) return { query: "", targetJid: null };
    let raw = fullText.trim();
    let targetJid = null;
    let query = raw;

    const endMatch = raw.match(/(?:,|\s)+([0-9]{9,15}@s\.whatsapp\.net|[0-9]{15,30}@g\.us|\+?94[0-9]{9}|0[0-9]{9})$/i);
    if (endMatch) {
        let extracted = endMatch[1];
        let matchStr = endMatch[0];
        let matchIndex = raw.lastIndexOf(matchStr);
        if (matchIndex !== -1) query = raw.substring(0, matchIndex).replace(/,$/, '').trim();
        
        if (extracted.includes('@g.us') || extracted.includes('@s.whatsapp.net')) {
            targetJid = extracted;
        } else {
            let num = extracted.replace(/[^0-9]/g, '');
            if (num.startsWith('0') && num.length === 10) num = '94' + num.slice(1);
            if (num.length >= 10) targetJid = num + '@s.whatsapp.net';
        }
    } else if (raw.includes(',')) {
        let parts = raw.split(',');
        let lastPart = parts.pop().trim();
        let num = lastPart.replace(/[^0-9]/g, '');
        if (num.length >= 10 && num.length <= 15) {
            targetJid = num + '@s.whatsapp.net';
            query = parts.join(',').trim();
        } else if (num.length > 15) {
            targetJid = num + '@g.us';
            query = parts.join(',').trim();
        }
    }
    return { query, targetJid };
}

// Helper to resolve direct video link (MKV/MP4 or DownloadWella bypass)
async function getDirectLink(dlLink, browserUa) {
    if (!dlLink) return null;
    if (dlLink.endsWith('.mkv') || dlLink.endsWith('.mp4')) return dlLink;

    if (dlLink.includes('downloadwella.com')) {
        try {
            const page1 = await axios.get(dlLink, {
                headers: { 'User-Agent': browserUa },
                httpsAgent,
                timeout: 20000
            });
            const $1 = cheerio.load(page1.data);

            const formData = {};
            $1('form').first().find('input[type="hidden"]').each((i, el) => {
                formData[$1(el).attr('name')] = $1(el).attr('value');
            });
            $1('form').first().find('input[type="submit"], button[type="submit"]').each((i, el) => {
                const n = $1(el).attr('name');
                const v = $1(el).attr('value');
                if (n) formData[n] = v;
            });

            const page2 = await axios.post(dlLink, qs.stringify(formData), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': dlLink,
                    'User-Agent': browserUa
                },
                httpsAgent,
                timeout: 20000
            });
            const $2 = cheerio.load(page2.data);

            let direct = $2('a').filter((i, el) => $2(el).text().trim() === 'Start download').attr('href');
            if (!direct) {
                direct = $2('.btn-success').attr('href') || $2('a[href*=".mkv"]').attr('href') || $2('a[href*=".mp4"]').attr('href');
            }
            return direct || null;
        } catch (e) {
            console.error("[KDrama Scraper] Bypass error:", e.message);
            return null;
        }
    }
    return null;
}

module.exports = {
    name: "kdrama-downloader",
    category: 1,
    description: "Search and download Korean & Chinese Dramas from Thenkiri",
    commands: ["kdrama", "cdrama", "thenkiri", "kd_sel", "kd_ep", "kd_all"],

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        const botName = "👑 SADEW-MINI 👑";
        const BASE_URL = "https://thenkiri.com";
        const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
        
        const metaQuote = {
            key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_KD" },
            message: { contactMessage: { displayName: botName, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${botName}\nORG:Sadew Dramas\nTEL;waid=94700000000:+94 70 000 0000\nEND:VCARD` } }
        };

        // ════════════════════════════════════════════════════════
        // 1. SEARCH (.kdrama / .cdrama / .thenkiri)
        // ════════════════════════════════════════════════════════
        if (command === "kdrama" || command === "cdrama" || command === "thenkiri") {
            const rawText = args.join(" ").trim();
            if (!rawText) {
                return reply("🎬 *කරුණාකර Drama එකේ නම ලබා දෙන්න!*\n_උදා: .kdrama Vincenzo_\n_උදා: .cdrama Falling Into Your Smile_\n_උදා: .thenkiri Doctor Slump 0771234567_");
            }

            const { query, targetJid } = parseTarget(rawText);
            if (!query) return reply("🎬 *කරුණාකර Drama එකේ නම ලබා දෙන්න!*");

            try {
                await socket.sendMessage(sender, { react: { text: "🔍", key: msg.key } });

                const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
                const res = await axios.get(searchUrl, {
                    headers: { 'User-Agent': BROWSER_UA },
                    timeout: 20000,
                    httpsAgent
                });

                const $ = cheerio.load(res.data);
                const searchResults = [];

                $('article, .entry, .post').each((i, el) => {
                    const titleEl = $(el).find('.entry-title a, h2 a, h3 a, .post-title a').first();
                    let title = titleEl.text().replace(/^DOWNLOAD\s+/i, '').trim();
                    let link = titleEl.attr('href');
                    let img = $(el).find('img').first().attr('src') || $(el).find('img').first().attr('data-src');

                    if (!title) {
                        const a = $(el).find('a').first();
                        title = a.text().replace(/^DOWNLOAD\s+/i, '').trim();
                        link = a.attr('href');
                    }

                    if (title && link && link.includes('thenkiri.com') && !searchResults.some(r => r.link === link)) {
                        if (!link.includes('/category/') && !link.includes('/tag/') && !link.includes('/author/')) {
                            searchResults.push({ title, link, img });
                        }
                    }
                });

                if (searchResults.length === 0) {
                    await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                    return reply(`❌ *සමාවෙන්න, "${query}" නමින් Dramas කිසිවක් හමුවූයේ නැත.*\n_කරුණාකර නම නිවැරදිව පරීක්ෂා කර නැවත උත්සාහ කරන්න._`);
                }

                // Output up to 20 results directly as requested!
                const topResults = searchResults.slice(0, 20);
                let listText = `*↳ ❝ [🎬 𝗦𝗮𝗱𝗲𝘄 𝗗𝗿𝗮𝗺𝗮 𝗦𝗲𝗮𝗿𝗰𝗵 🎬] ¡! ❞*\n\n`;
                listText += `🔍 *සෙව්වේ:* ${query}\n📊 *Results:* ${topResults.length}\n`;
                if (targetJid) listText += `🎯 *Send To:* \`${targetJid}\`\n\n`; else listText += `\n`;

                const buttons = [];
                topResults.forEach((dr, i) => {
                    listText += `*${i + 1}.* ${dr.title}\n\n`;
                    const id = storeData({
                        url: dr.link,
                        title: dr.title,
                        img: dr.img,
                        targetJid: targetJid
                    });

                    let btnLabel = dr.title.replace(/\|.*$/i, '').replace(/S0\d+.*$/i, '').replace(/\(Complete\)/i, '').trim();
                    if (btnLabel.length > 20) btnLabel = btnLabel.slice(0, 18) + '..';

                    buttons.push({
                        buttonId: `.kd_sel ${id}`,
                        buttonText: { displayText: `🎬 ${i + 1}. ${btnLabel}` },
                        type: 1
                    });
                });

                listText += `> *📩 ඔබට අවශ්‍ය Drama එක පහලින් තෝරන්න*\n> *👑 𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

                // Set 1st result's thumbnail as requested!
                const firstThumb = topResults.find(r => r.img)?.img || null;

                if (firstThumb) {
                    await socket.sendMessage(sender, {
                        image: { url: firstThumb },
                        caption: listText,
                        footer: botName,
                        buttons: buttons,
                        headerType: 4
                    }, { quoted: metaQuote });
                } else {
                    await socket.sendMessage(sender, {
                        text: listText,
                        footer: botName,
                        buttons: buttons,
                        headerType: 1
                    }, { quoted: metaQuote });
                }

                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

            } catch (e) {
                console.error("[KDrama] Search Error:", e.message);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                reply("❌ *Drama සෙවීමේදී දෝෂයක් ඇතිවිය. කරුණාකර සුළු මොහොතකින් නැවත උත්සාහ කරන්න.*");
            }
        }

        // ════════════════════════════════════════════════════════
        // 2. SELECT DRAMA & LIST ALL EPISODE BUTTONS (.kd_sel <id>)
        // ════════════════════════════════════════════════════════
        else if (command === "kd_sel") {
            const id = args[0];
            const drama = global.kdStore[id];
            if (!drama) return reply("❌ *Link expired. කරුණාකර නැවත search කරන්න.*");

            try {
                await socket.sendMessage(sender, { react: { text: "⏳", key: msg.key } });

                if (!drama.episodes || drama.episodes.length === 0) {
                    await reply(`📥 *${drama.title}* හි Episodes පරීක්ෂා කරමින්...`);

                    const res = await axios.get(drama.url, {
                        headers: { 'User-Agent': BROWSER_UA },
                        timeout: 25000,
                        httpsAgent
                    });

                    const $ = cheerio.load(res.data);

                    let title = $('h1.entry-title, .entry-header h1, h1').first().text().replace(/^DOWNLOAD\s+/i, '').trim();
                    if (!title) title = drama.title;

                    let img = $('meta[property="og:image"]').attr('content') || drama.img || '';

                    let synopsis = '';
                    $('.entry-content p').each((i, el) => {
                        const t = $(el).text().trim();
                        if (t.length > 40 && !t.includes('Download') && !t.includes('Episode') && !synopsis) {
                            synopsis = t;
                        }
                    });

                    const episodeList = [];
                    const seenLinks = new Set();

                    $('a').each((i, el) => {
                        const href = $(el).attr('href') || '';
                        const linkText = $(el).text().trim();

                        const isWella = href.includes('downloadwella.com');
                        const isDirectMkv = (href.includes('.mkv') || href.includes('.mp4')) && (href.startsWith('http://') || href.startsWith('https://'));

                        if ((isWella || isDirectMkv) && !seenLinks.has(href)) {
                            seenLinks.add(href);

                            let epName = '';
                            if (linkText && !linkText.toLowerCase().includes('download episode') && !linkText.toLowerCase().includes('how to')) {
                                epName = linkText;
                            }

                            if (!epName) {
                                const parentText = $(el).parent().text().trim();
                                const epMatch = parentText.match(/(?:Episode|Ep\.?|EP)\s*([0-9]+(?:\s*(?:&|-)\s*[0-9]+)?)/i);
                                if (epMatch) epName = `Episode ${epMatch[1]}`;
                            }

                            if (!epName) {
                                const fnMatch = href.match(/(?:[^\/]+?)(?:S\d+)?(?:E|Episode|EP)(\d+)/i);
                                if (fnMatch) epName = `Episode ${parseInt(fnMatch[1], 10)}`;
                            }

                            if (!epName) epName = `Episode ${episodeList.length + 1}`;

                            episodeList.push({
                                title: epName,
                                url: href
                            });
                        }
                    });

                    drama.parsedTitle = title;
                    drama.img = img;
                    drama.synopsis = synopsis;
                    drama.episodes = episodeList;
                }

                const episodes = drama.episodes;
                if (!episodes || episodes.length === 0) {
                    await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                    return reply("❌ *මෙම Drama එක සඳහා Episodes හමු නොවිණි.*");
                }

                let capText = `*↳ ❝ [🎬 𝗦𝗮𝗱𝗲𝘄 𝗗𝗿𝗮𝗺𝗮 𝗘𝗽𝗶𝘀𝗼𝗱𝗲𝘀 🎬] ¡! ❞*\n\n`;
                capText += `🎬 *Title:* ${drama.parsedTitle || drama.title}\n`;
                capText += `📊 *Total Episodes:* ${episodes.length}\n`;
                if (drama.targetJid) capText += `🎯 *Send To:* \`${drama.targetJid}\`\n`;
                if (drama.synopsis) capText += `\n📝 *Synopsis:* _${drama.synopsis.slice(0, 180)}..._\n`;
                capText += `\n> *ඔබට අවශ්‍ය Episode එක තෝරන්න (හෝ සියල්ලම Download කරන්න)* ⬇️`;

                const buttons = [];

                // 1. "DOWNLOAD ALL EPISODES" button as requested!
                const allId = storeData({
                    title: drama.parsedTitle || drama.title,
                    episodes: episodes,
                    targetJid: drama.targetJid,
                    img: drama.img,
                    synopsis: drama.synopsis
                }, 90 * 60 * 1000); // 1.5 hour TTL

                buttons.push({
                    buttonId: `.kd_all ${allId}`,
                    buttonText: { displayText: `📥 Download All (${episodes.length} Eps)` },
                    type: 1
                });

                // 2. Put ALL Episode buttons directly without any page limits!
                episodes.forEach((ep) => {
                    const epId = storeData({
                        title: drama.parsedTitle || drama.title,
                        epTitle: ep.title,
                        dlLink: ep.url,
                        targetJid: drama.targetJid,
                        img: drama.img,
                        synopsis: drama.synopsis
                    });

                    let label = ep.title;
                    if (label.length > 20) label = label.slice(0, 18) + '..';

                    buttons.push({
                        buttonId: `.kd_ep ${epId}`,
                        buttonText: { displayText: `🎥 ${label}` },
                        type: 1
                    });
                });

                const msgOpts = {
                    caption: capText,
                    footer: botName,
                    buttons: buttons,
                    headerType: drama.img ? 4 : 1
                };
                if (drama.img) msgOpts.image = { url: drama.img };

                await socket.sendMessage(sender, msgOpts, { quoted: metaQuote });
                await socket.sendMessage(sender, { react: { text: "🎬", key: msg.key } });

            } catch (e) {
                console.error("[KDrama] Episode Fetch Error:", e.message);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                reply("❌ *Episodes ලබාගැනීමේදී දෝෂයක් ඇතිවිය.*");
            }
        }

        // ════════════════════════════════════════════════════════
        // 3. DOWNLOAD ALL EPISODES ONE-BY-ONE (.kd_all <allId>)
        // ════════════════════════════════════════════════════════
        else if (command === "kd_all") {
            const allId = args[0];
            const allData = global.kdStore[allId];
            if (!allData || !allData.episodes?.length) {
                return reply("❌ *Link expired. කරුණාකර නැවත search කරන්න.*");
            }

            const destJid = allData.targetJid || sender;

            try {
                await socket.sendMessage(sender, { react: { text: "🚀", key: msg.key } });
                await reply(`🚀 *${allData.title}* හි Episodes ${allData.episodes.length} ම එකින් එක (One by One) Stream කරමින් යැවීම ආරම්භ වේ...\n_කරුණාකර රැඳී සිටින්න!_`);

                // JID send details card first!
                if (destJid !== sender) {
                    const cardText = `*↳ ❝ [🎬 𝗦𝗮𝗱𝗲𝘄 𝗗𝗿𝗮𝗺𝗮 𝗦𝗲𝗿𝗶𝗲𝘀 🎬] ¡! ❞*\n\n` +
                        `🎬 *Title:* ${allData.title}\n` +
                        `📊 *Total Episodes:* ${allData.episodes.length}\n` +
                        (allData.synopsis ? `\n📝 *Synopsis:* _${allData.synopsis.slice(0, 250)}..._\n` : '') +
                        `\n> 👑 *𝗦𝗔𝗗𝗘𝗪-𝗠𝗜𝗡𝗜 𝗪𝗛𝗔𝗧𝗦𝗔𝗣𝗣 𝗕𝗢𝗧* 👑`;
                    try {
                        if (allData.img) {
                            await socket.sendMessage(destJid, { image: { url: allData.img }, caption: cardText }, { quoted: metaQuote });
                        } else {
                            await socket.sendMessage(destJid, { text: cardText }, { quoted: metaQuote });
                        }
                    } catch (cardErr) {
                        console.error("[KDrama All] Target Card Error:", cardErr.message);
                    }
                }

                // Stream one by one with pure stream pipeline - ZERO RAM usage
                for (let i = 0; i < allData.episodes.length; i++) {
                    const ep = allData.episodes[i];
                    try {
                        console.log(`[KDrama All] (${i + 1}/${allData.episodes.length}) Bypassing: ${ep.title}`);
                        const directLink = await getDirectLink(ep.url, BROWSER_UA);

                        if (!directLink) {
                            console.error(`[KDrama All] Could not bypass: ${ep.title}`);
                            await reply(`⚠️ *${ep.title}* Bypass කර ගැනීමට නොහැකි විය. ඊළඟ Episode එකට මාරු වේ...`);
                            continue;
                        }

                        console.log(`[KDrama All] (${i + 1}/${allData.episodes.length}) Streaming: ${directLink}`);

                        const videoStream = await axios({
                            method: 'GET',
                            url: directLink,
                            responseType: 'stream',
                            httpsAgent,
                            headers: {
                                'User-Agent': BROWSER_UA,
                                'Referer': ep.url || BASE_URL
                            },
                            timeout: 1800000,
                            maxRedirects: 10
                        });

                        const ct = videoStream.headers['content-type'] || '';
                        if (ct.includes('text/html')) {
                            videoStream.data.destroy();
                            console.error(`[KDrama All] HTML received on ${ep.title}`);
                            continue;
                        }

                        const cl = parseInt(videoStream.headers['content-length'] || '0');
                        const size = cl ? (cl / 1024 / 1024).toFixed(1) + ' MB' : 'Unknown';

                        const cleanDramaName = allData.title.replace(/[\\/:*?"<>|]/g, '').trim();
                        const cleanEpName = ep.title.replace(/[\\/:*?"<>|]/g, '').trim();
                        const fileName = `${cleanDramaName} - ${cleanEpName}.mkv`;

                        const caption = `*↳ ❝ [🎬 𝗦𝗮𝗱𝗲𝘄 𝗗𝗿𝗮𝗺𝗮 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱 🎬] ¡! ❞*\n\n` +
                            `🎬 *Title:* ${allData.title}\n` +
                            `🎞️ *Episode:* ${ep.title} (${i + 1}/${allData.episodes.length})\n` +
                            `📦 *Size:* ${size}\n\n` +
                            `> 👑 *𝗦𝗔𝗗𝗘𝗪-𝗠𝗜𝗡𝗜 𝗪𝗛𝗔𝗧𝗦𝗔𝗣𝗣 𝗕𝗢𝗧* 👑`;

                        await socket.sendMessage(destJid, {
                            document: { stream: videoStream.data },
                            mimetype: "video/x-matroska",
                            fileName: fileName,
                            caption: caption
                        }, { quoted: metaQuote });

                        try {
                            if (videoStream.data && typeof videoStream.data.destroy === 'function') {
                                videoStream.data.destroy();
                            }
                        } catch (err) {}

                        // Clean memory after each episode
                        if (global.gc) {
                            try { global.gc(); } catch (e) {}
                        }

                        // Short pause between episodes
                        await new Promise(resolve => setTimeout(resolve, 3000));

                    } catch (epErr) {
                        console.error(`[KDrama All] Error on ${ep.title}:`, epErr.message);
                        await reply(`⚠️ *${ep.title}* යැවීමේදී දෝෂයක් ඇතිවිය: ${epErr.message}`);
                    }
                }

                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });
                await reply(`🎉 *${allData.title}* හි සියලුම Episodes සාර්ථකව යවා අවසන් කරන ලදී!`);
                delete global.kdStore[allId];

            } catch (e) {
                console.error("[KDrama All] Batch error:", e.message);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                reply(`❌ *Batch Download දෝෂයක් ඇතිවිය:* ${e.message}`);
            }
        }

        // ════════════════════════════════════════════════════════
        // 4. DOWNLOAD SINGLE EPISODE (.kd_ep <epId>) - Direct Stream
        // ════════════════════════════════════════════════════════
        else if (command === "kd_ep") {
            const id = args[0];
            const epData = global.kdStore[id];
            if (!epData) return reply("❌ *Link expired. කරුණාකර නැවත search කරන්න.*");

            const destJid = epData.targetJid || sender;

            try {
                await socket.sendMessage(sender, { react: { text: "🔄", key: msg.key } });
                await reply(`🔄 *${epData.title} - ${epData.epTitle}* හි Direct Download Link එක ලබා ගනිමින් පවතී...\n_කරුණාකර මඳක් රැඳී සිටින්න._`);

                const directLink = await getDirectLink(epData.dlLink, BROWSER_UA);

                if (!directLink) {
                    await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                    return reply("❌ *සමාවෙන්න, Direct Link එක Bypass කර ගැනීමට නොහැකි විය.*");
                }

                // If targetJid was provided: First send details card to destJid as requested!
                if (destJid !== sender) {
                    const cardText = `*↳ ❝ [🎬 𝗦𝗮𝗱𝗲𝘄 𝗗𝗿𝗮𝗺𝗮 𝗗𝗲𝘁𝗮𝗶𝗹𝘀 🎬] ¡! ❞*\n\n` +
                        `🎬 *Title:* ${epData.title}\n` +
                        `🎞️ *Episode:* ${epData.epTitle}\n` +
                        (epData.synopsis ? `\n📝 *Synopsis:* _${epData.synopsis.slice(0, 250)}..._\n` : '') +
                        `\n> 👑 *𝗦𝗔𝗗𝗘𝗪-𝗠𝗜𝗡𝗜 𝗪𝗛𝗔𝗧𝗦𝗔𝗣𝗣 𝗕𝗢𝗧* 👑`;
                    try {
                        if (epData.img) {
                            await socket.sendMessage(destJid, { image: { url: epData.img }, caption: cardText }, { quoted: metaQuote });
                        } else {
                            await socket.sendMessage(destJid, { text: cardText }, { quoted: metaQuote });
                        }
                    } catch (cardErr) {
                        console.error("[KDrama] Target Card Error:", cardErr.message);
                    }
                }

                console.log("[KDrama] Found Direct Link:", directLink);
                await socket.sendMessage(sender, { react: { text: "📥", key: msg.key } });
                await reply(`📥 *Download ආරම්භ වේ...*\n🎬 *${epData.title}*\n🎞️ *${epData.epTitle}*\n\n_File ප්‍රමාණය අනුව යැවීමට මිනිත්තු කිහිපයක් ගතවිය හැක._`);

                // Pure Axios stream pipeline - No RAM exhaustion
                const videoStream = await axios({
                    method: 'GET',
                    url: directLink,
                    responseType: 'stream',
                    httpsAgent,
                    headers: {
                        'User-Agent': BROWSER_UA,
                        'Referer': epData.dlLink || BASE_URL
                    },
                    timeout: 1800000,
                    maxRedirects: 10
                });

                const ct = videoStream.headers['content-type'] || '';
                if (ct.includes('text/html')) {
                    videoStream.data.destroy();
                    throw new Error("HTML response received instead of video stream");
                }

                const cl = parseInt(videoStream.headers['content-length'] || '0');
                const size = cl ? (cl / 1024 / 1024).toFixed(1) + ' MB' : 'Unknown';

                const cleanDramaName = epData.title.replace(/[\\/:*?"<>|]/g, '').trim();
                const cleanEpName = epData.epTitle.replace(/[\\/:*?"<>|]/g, '').trim();
                const fileName = `${cleanDramaName} - ${cleanEpName}.mkv`;

                const caption = `*↳ ❝ [🎬 𝗦𝗮𝗱𝗲𝘄 𝗗𝗿𝗮𝗺𝗮 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱 🎬] ¡! ❞*\n\n` +
                    `🎬 *Title:* ${epData.title}\n` +
                    `🎞️ *Episode:* ${epData.epTitle}\n` +
                    `📦 *Size:* ${size}\n\n` +
                    `> 👑 *𝗦𝗔𝗗𝗘𝗪-𝗠𝗜𝗡𝗜 𝗪𝗛𝗔𝗧𝗦𝗔𝗣𝗣 𝗕𝗢𝗧* 👑`;

                await socket.sendMessage(destJid, {
                    document: { stream: videoStream.data },
                    mimetype: "video/x-matroska",
                    fileName: fileName,
                    caption: caption
                }, { quoted: metaQuote });

                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

                try {
                    if (videoStream.data && typeof videoStream.data.destroy === 'function') {
                        videoStream.data.destroy();
                    }
                } catch (err) {}

                setTimeout(() => {
                    try { if (global.gc) global.gc(); } catch (e) {}
                }, 5000);

                delete global.kdStore[id];

            } catch (e) {
                console.error("[KDrama] Download Error:", e.message);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                reply(`❌ *Episode එක යැවීමේදී දෝෂයක් ඇතිවිය!* (${e.message})`);
            }
        }
    }
};
