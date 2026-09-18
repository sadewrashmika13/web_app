const axios = require('axios');
const yts = require('yt-search');

module.exports = {
    name: "channel-song",
    category: 1, 
    description: "Download and upload songs to WhatsApp channels with a Detail Card.",
    commands: ["csong", "channelsong"],
    
    handler: async ({ socket, msg, sender, command, args, reply }) => {
        try {
            const fullQuery = args.join(' ');
            if (!fullQuery) return reply("🎵 *කරුණාකර සින්දුවක නමක් සහ Channel ID එක ලබා දෙන්න!*\n💡 උදා: `.csong master sir, 120363XXXXX@newsletter`");

            let query = fullQuery;
            let channelJID = "120363XXXXXXXXX@newsletter"; // ඔයාගේ Default Channel ID එක

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
            let thumbnail = "";
            let ytChannel = "Unknown";
            let views = "0";
            let duration = "0:00";

            const isLink = /(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)[^\s?#]+)/i.test(query);

            if (isLink) {
                youtubeUrl = query.match(/(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)[^\s?#]+)/i)[0].trim();
                try {
                    const videoIdMatch = youtubeUrl.match(/(?:v=|shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
                    if (videoIdMatch) {
                        const videoDetails = await yts({ videoId: videoIdMatch[1] });
                        songTitle = videoDetails.title;
                        thumbnail = videoDetails.thumbnail || videoDetails.image;
                        ytChannel = videoDetails.author.name;
                        views = videoDetails.views || "N/A";
                        duration = videoDetails.timestamp || "N/A";
                    }
                } catch (e) {}
            } else {
                try {
                    const searchResults = await yts(query);
                    if (searchResults && searchResults.videos.length > 0) {
                        youtubeUrl = searchResults.videos[0].url;
                        songTitle = searchResults.videos[0].title;
                        thumbnail = searchResults.videos[0].thumbnail || searchResults.videos[0].image;
                        ytChannel = searchResults.videos[0].author.name;
                        views = searchResults.videos[0].views;
                        duration = searchResults.videos[0].timestamp;
                    }
                } catch (err) {}
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
                // 1. මුලින්ම Detail Card එක (Thumbnail එකත් එක්ක) යවනවා!
                const captionMsg = `✨ *_🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮⊹ ˚₊ 𝜗𝜚_ Music System* ✨\n\n` +
                                   `📌 *Title:* ${songTitle}\n` +
                                   `👤 *Channel:* ${ytChannel}\n` +
                                   `👁️ *Views:* ${views.toLocaleString()}\n` +
                                   `⏱️ *Duration:* ${duration}\n\n` +
                                   `╰┈⪼ 𝘗𝘰𝘸𝘦𝘳𝘦𝘥 𝘉𝘺 🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮⪻`;
                
                if (thumbnail) {
                    await socket.sendMessage(channelJID, { image: { url: thumbnail }, caption: captionMsg });
                } else {
                    await socket.sendMessage(channelJID, { text: captionMsg });
                }

                // 2. ඊටපස්සේ ඕඩියෝ එක යවනවා (Audio / File Mode)
                await socket.sendMessage(channelJID, {
                    audio: { stream: responseStream.data }, 
                    mimetype: 'audio/mp4', // සමහරවිට mp4 දුන්නම ප්ලේයර් එකක් විදිහට යන්න චාන්ස් එකක් තියෙනවා
                    ptt: true 
                });

                reply("✅ *සින්දුව සහ Detail Card එක සාර්ථකව WhatsApp Channel එකට Upload කරන ලදී!*");
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
