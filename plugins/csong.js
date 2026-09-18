// ════════════ WHATSAPP CHANNEL SONG UPLOAD (VOICE NOTE) ════════════

case 'channelsong':
case 'csong': {
    try {
        // 🔥 ඔයාගේ WhatsApp Channel එකේ JID එක මෙතනට දාන්න (අගට @newsletter තියෙන්න ඕනේ) 🔥
        const channelJID = "120363XXXXXXXXX@newsletter"; 
        
        const query = args.join(' ');
        if (!query) return reply("🎵 *කරුණාකර සින්දුවක නමක් හෝ YouTube ලින්ක් එකක් ලබා දෙන්න!*\n💡 උදා: `.channelsong master sir`");

        reply(`⏳ _Searching and downloading for Channel Upload..._`);

        // ==========================================
        // 1. YouTube Search
        // ==========================================
        let youtubeUrl = null;
        let songTitle = "Sadew-MD Audio";

        const isLink = /(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)[^\s?#]+)/i.test(query);

        if (isLink) {
            youtubeUrl = query.match(/(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)[^\s?#]+)/i)[0].trim();
            try {
                const yts = require('yt-search');
                const videoIdMatch = youtubeUrl.match(/(?:v=|shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
                if (videoIdMatch) {
                    const videoDetails = await yts({ videoId: videoIdMatch[1] });
                    songTitle = videoDetails.title;
                }
            } catch (e) {}
        } else {
            try {
                const yts = require('yt-search');
                const searchResults = await yts(query);
                if (searchResults && searchResults.videos.length > 0) {
                    youtubeUrl = searchResults.videos[0].url;
                    songTitle = searchResults.videos[0].title;
                }
            } catch (err) {
                 const searchRes = await axios.get(`https://kavindu-download-web.vercel.app/api/search?q=${encodeURIComponent(query)}`).catch(()=>null);
                 if (searchRes && searchRes.data && searchRes.data.status && searchRes.data.result.length > 0) {
                     youtubeUrl = searchRes.data.result[0].url;
                     songTitle = searchRes.data.result[0].title;
                 }
            }
        }

        if (!youtubeUrl) return reply("❌ *Error:* සින්දුව සොයා ගැනීමට නොහැකි විය!");

        // ==========================================
        // 2. Download MP3 
        // ==========================================
        let audioDownloadUrl = null;
        try {
            const res1 = await axios.get(`https://apis.davidcyril.name.ng/download/ytmp33?url=${encodeURIComponent(youtubeUrl)}`, { timeout: 25000 });
            if (res1.data?.success && res1.data?.result?.download_url) {
                audioDownloadUrl = res1.data.result.download_url;
                if (songTitle === "Sadew-MD Audio") songTitle = res1.data.result.title;
            }
        } catch (e1) {}

        if (!audioDownloadUrl) {
            try {
                const res2 = await axios.get(`https://apis.davidcyril.name.ng/download/ytmp3v2?url=${encodeURIComponent(youtubeUrl)}`, { timeout: 25000 });
                if (res2.data?.success && res2.data?.result?.download_url) {
                    audioDownloadUrl = res2.data.result.download_url;
                }
            } catch (e2) {}
        }

        if (!audioDownloadUrl) return reply("❌ *Error:* සේවාදායකයන් කාර්යබහුල බැවින් ඕඩියෝ එක ලබා ගැනීමට නොහැකි විය.");

        // ==========================================
        // 3. Upload to WHATSAPP CHANNEL as VOICE NOTE (PTT)
        // ==========================================
        
        const responseStream = await axios({
            url: audioDownloadUrl,
            method: 'GET',
            responseType: 'stream',
            timeout: 30000 
        });

        reply(`✅ _Uploading as a Voice Note to Channel..._`);

        // Channel එකට Voice Note එක යවනවා (ptt: true තමයි මැජික් එක)
        await socket.sendMessage(channelJID, {
            audio: { stream: responseStream.data }, 
            mimetype: 'audio/mpeg', // සමහරවිට 'audio/ogg; codecs=opus' දාන්නත් වෙන්න පුළුවන් අවුලක් ආවොත්.
            ptt: true // 🔥 මෙන්න මේකෙන් තමයි Voice Record එකක් විදිහට යවන්නේ 🔥
        });

        // සින්දුවේ නම වෙනම මැසේජ් එකක් විදිහට යවමු (මොකද Voice Note වලට Caption දාන්න බෑ)
        const captionMsg = `🎵 *${songTitle}*\n\n╰┈⪼ 𝘗𝘰𝘸𝘦𝘳𝘦𝘥 𝘉𝘺 🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮⪻`;
        await socket.sendMessage(channelJID, { text: captionMsg });

        reply("✅ *සින්දුව සාර්ථකව WhatsApp Channel එකට Voice Note එකක් විදිහට Upload කරන ලදී!*");

    } catch (e) {
        console.log("CHANNEL SONG CMD ERROR:", e);
        reply("❌ *Internal Error:* " + e.message);
    }
    break;
}
