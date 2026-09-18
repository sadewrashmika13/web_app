const axios = require('axios');
const yts = require('yt-search');

module.exports = {
    name: "channel-song",
    category: 1, 
    description: "Download and upload songs to WhatsApp channels as Voice Notes.",
    commands: ["csong", "channelsong"],
    
    handler: async ({ socket, msg, sender, command, args, reply }) => {
        try {
            const fullQuery = args.join(' ');
            if (!fullQuery) return reply("🎵 *කරුණාකර සින්දුවක නමක් සහ Channel ID එක ලබා දෙන්න!*\n💡 උදා: `.csong master sir, 120363XXXXX@newsletter`");

            let query = fullQuery;
            // 👇 ඔයාගේ Default Channel ID එක මෙතන දාන්න
            let channelJID = "120363XXXXXXXXX@newsletter"; 

            if (fullQuery.includes(',')) {
                const parts = fullQuery.split(',');
                const possibleJID = parts[parts.length - 1].trim(); 
                
                if (possibleJID.includes('@newsletter') || /^[0-9]+$/.test(possibleJID)) {
                    channelJID = possibleJID.includes('@newsletter') ? possibleJID : possibleJID + "@newsletter";
                    query = parts.slice(0, -1).join(',').trim(); 
                }
            }

            if (!query) return reply("❌ සින්දුවේ නම සොයා ගැනීමට නොහැක!");

            reply(`⏳ _Searching for "${query}" and preparing upload to ${channelJID}..._`);

            let youtubeUrl = null;
            let songTitle = "Sadew-MD Audio";

            const isLink = /(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)[^\s?#]+)/i.test(query);

            if (isLink) {
                youtubeUrl = query.match(/(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)[^\s?#]+)/i)[0].trim();
                try {
                    const videoIdMatch = youtubeUrl.match(/(?:v=|shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
                    if (videoIdMatch) {
                        const videoDetails = await yts({ videoId: videoIdMatch[1] });
                        songTitle = videoDetails.title;
                    }
                } catch (e) {}
            } else {
                try {
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
            
            const responseStream = await axios({
                url: audioDownloadUrl,
                method: 'GET',
                responseType: 'stream',
                timeout: 30000 
            });

            try {
                // Channel එකට Voice Note එක යවනවා (ptt: true)
                await socket.sendMessage(channelJID, {
                    audio: { stream: responseStream.data }, 
                    mimetype: 'audio/mpeg', 
                    ptt: true 
                });

                // සින්දුවේ නම Caption එකක් විදිහට යටින් යවනවා
                const captionMsg = `🎵 *${songTitle}*\n\n╰┈⪼ 𝘗𝘰𝘸𝘦𝘳𝘦𝘥 𝘉𝘺 🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮⪻`;
                await socket.sendMessage(channelJID, { text: captionMsg });

                reply("✅ *සින්දුව සාර්ථකව අදාල WhatsApp Channel එකට Voice Note එකක් විදිහට Upload කරන ලදී!*");
            } catch (sendErr) {
                console.log("SEND ERROR:", sendErr);
                reply("❌ *Error:* Channel එකට සින්දුව යැවීමට නොහැකි විය. බොට්ව මෙම Channel එකේ Admin කෙනෙක් කර ඇත්දැයි පරීක්ෂා කරන්න.");
            }

        } catch (e) {
            console.log("CHANNEL SONG CMD ERROR:", e);
            reply("❌ *Internal Error:* " + e.message);
        }
    }
};
