const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');
const os = require('os');

// NPM Packages හරහා FFmpeg ගෙන ඒම
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

module.exports = {
    name: "channel-song",
    category: 1, 
    description: "Download and convert songs to pure Voice Notes for WhatsApp channels.",
    commands: ["csong", "channelsong"],

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        try {
            const fullQuery = args.join(' ');
            if (!fullQuery) return reply("🎵 *කරුණාකර සින්දුවක නමක් සහ Channel ID එක ලබා දෙන්න!*\n💡 උදා: `.csong master sir, 120363XXXXX@newsletter`");

            let query = fullQuery;
            let channelJID = "120363XXXXXXXXX@newsletter"; 

            // Channel JID එක වෙන් කරගැනීම
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

            // 1. YouTube Search
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

            // 2. Get MP3 Download Link (ඔයාගේ API එක)
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

            // 3. Detail Card එක යවනවා
            const captionMsg = `✨ *_🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮⊹ ˚₊ 𝜗𝜚_ Music System* ✨\n\n` +
                               `📌 *Title:* ${songTitle}\n👤 *Channel:* ${ytChannel}\n` +
                               `👁️ *Views:* ${views.toLocaleString()}\n⏱️ *Duration:* ${duration}\n\n` +
                               `╰┈⪼ 𝘗𝘰𝘸𝘦𝘳𝘦𝘥 𝘉𝘺 🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮⪻`;

            try {
                if (thumbnail) {
                    await socket.sendMessage(channelJID, { image: { url: thumbnail }, caption: captionMsg });
                } else {
                    await socket.sendMessage(channelJID, { text: captionMsg });
                }
            } catch (err) {
                return reply("❌ *Error:* Channel එකට යැවීමට නොහැකි විය. Admin කෙනෙක්දැයි පරීක්ෂා කරන්න.");
            }

            // 4. MP3 එක Download කරලා OPUS (Voice Note) එකකට Convert කිරීම
            const tempMp3 = path.join(os.tmpdir(), `song_${Date.now()}.mp3`);
            const tempOgg = path.join(os.tmpdir(), `voice_${Date.now()}.ogg`);

            const responseStream = await axios({
                url: audioDownloadUrl,
                method: 'GET',
                responseType: 'stream',
                timeout: 30000 
            });

            const writer = fs.createWriteStream(tempMp3);
            responseStream.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            // 🔥 NPM FFmpeg හරහා Strict Voice Note Format එකට කන්වර්ට් කිරීම 🔥
            await new Promise((resolve, reject) => {
                ffmpeg(tempMp3)
                    .audioCodec('libopus')
                    .audioChannels(1)       // Mono
                    .audioFrequency(48000)  // 48kHz
                    .audioBitrate('32k')    // Voice Note Bitrate
                    .outputOptions([
                        '-vbr on',
                        '-compression_level 10',
                        '-avoid_negative_ts make_zero' // වැදගත්
                    ])
                    .toFormat('ogg')
                    .save(tempOgg)
                    .on('end', resolve)
                    .on('error', (err) => reject(err));
            });

            // 5. සින්දුවේ තත්පර ගාණ (Duration) ගණනය කිරීම
            let durationSeconds = 180; 
            if (duration && duration.includes(':')) {
                const timeParts = duration.split(':').map(Number);
                if (timeParts.length === 2) {
                    durationSeconds = timeParts[0] * 60 + timeParts[1];
                } else if (timeParts.length === 3) {
                    durationSeconds = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
                }
            }

            // 6. Fake Waveform (තරංග රටාවක්) නිර්මාණය කිරීම
            const fakeWaveform = new Uint8Array(64);
            for (let i = 0; i < 64; i++) {
                fakeWaveform[i] = Math.floor(Math.random() * 100); 
            }

            // 7. Voice Note එකක් විදිහට Channel එකට යවනවා
            await socket.sendMessage(channelJID, {
                audio: { url: tempOgg }, 
                mimetype: 'audio/ogg; codecs=opus', 
                ptt: true,
                seconds: durationSeconds, 
                waveform: fakeWaveform
            });

            reply("✅ *සින්දුව සාර්ථකව Voice Note එකක් විදිහට Upload කළා!*");

            // Server එකේ ඉඩ පිරෙන්නේ නැති වෙන්න Temp ෆයිල්ස් මකලා දානවා
            try { fs.unlinkSync(tempMp3); } catch (e) {}
            try { fs.unlinkSync(tempOgg); } catch (e) {}

        } catch (e) {
            console.log("CHANNEL SONG CMD ERROR:", e);
            reply("❌ *Internal Error:* " + e.message);
        }
    }
};
