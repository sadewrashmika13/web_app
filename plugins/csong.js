const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');
const os = require('os');

// NPM Packages හරහා FFmpeg ගෙන ඒම
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

// 🔥 Error එක ආපු තැන (import වෙනුවට require පාවිච්චි කර ඇත) 🔥
const {
    generateWAMessage,
    encodeNewsletterMessage,
    unixTimestampSeconds,
    generateMessageID
} = require('@whiskeysockets/baileys');

async function sendNewsletterMedia(sock, jid, media, type, caption = '', options = {}) {
    try {
        const mediaSource = (typeof media === 'string' && (media.startsWith('http') || media.startsWith('./')))
            ? { url: media }
            : media;

        let content = {};

        if (type === 'image') {
            content = { image: mediaSource, caption: caption };
        } else if (type === 'video') {
            content = { video: mediaSource, caption: caption };
        } else if (type === 'audio') {
            content = {
                audio: mediaSource,
                ptt: options.ptt || false,
                mimetype: 'audio/ogg; codecs=opus'
            };

            if (options.ptt) {
                content.waveform = options.waveform && options.waveform.length
                    ? new Uint8Array(options.waveform)
                    : new Uint8Array([0, 0, 50, 100, 150, 200, 150, 100, 50, 0, 120, 180, 250, 180, 120, 0]);
            }
        } else {
            content = { document: mediaSource, caption: caption, mimetype: options.mimetype || 'application/pdf' };
        }

        const fullMsg = await generateWAMessage(jid, content, {
            logger: sock.logger,
            userJid: sock.user.id,
            upload: async (readStream, opts) => {
                return sock.waUploadToServer(readStream, {
                    ...opts,
                    newsletter: true
                });
            }
        });

        const msgId = generateMessageID();
        const messageProto = fullMsg.message;
        const encodedBytes = encodeNewsletterMessage(messageProto);

        const stanza = {
            tag: 'message',
            attrs: {
                to: jid,
                id: msgId,
                type: 'media'
            },
            content: [
                {
                    tag: 'plaintext',
                    attrs: {
                        mediatype: type === 'audio' ? 'audio' : type
                    },
                    content: encodedBytes
                }
            ]
        };

        await sock.sendNode(stanza);

        return {
            key: { remoteJid: jid, fromMe: true, id: msgId },
            message: messageProto,
            messageTimestamp: unixTimestampSeconds()
        };

    } catch (error) {
        console.log('[csong] sendNewsletterMedia error:', error.message);
        return null;
    }
}

module.exports = {
    name: "channel-song",
    category: 1, 
    description: "Download and convert songs to pure Voice Notes for WhatsApp channels with Multi-API Backup.",
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

            // 2. Get MP3 Download Link (Multi-API Backup System 🚀)
            let audioDownloadUrl = null;

            // 🌟 Try API 1 (ඔයාගේ David Cyril API - Primary Priority)
            try {
                const res1 = await axios.get(`https://apis.davidcyril.name.ng/download/ytmp33?url=${encodeURIComponent(youtubeUrl)}`, { timeout: 25000 });
                if (res1.data?.success && res1.data?.result?.download_url) {
                    audioDownloadUrl = res1.data.result.download_url;
                    if (songTitle === "Sadew-MD Audio") songTitle = res1.data.result.title;
                }
            } catch (e1) {
                console.log('[csong] David Cyril API 1 failed, trying v2...');
            }

            // 🌟 Try API 2 (ඔයාගේ David Cyril v2 API - Backup 1)
            if (!audioDownloadUrl) {
                try {
                    const res2 = await axios.get(`https://apis.davidcyril.name.ng/download/ytmp3v2?url=${encodeURIComponent(youtubeUrl)}`, { timeout: 25000 });
                    if (res2.data?.success && res2.data?.result?.download_url) {
                        audioDownloadUrl = res2.data.result.download_url;
                    }
                } catch (e2) {
                    console.log('[csong] David Cyril v2 failed, trying external backup...');
                }
            }

            // 🌟 Try API 3 (යාළුවාගේ API එක - Final Backup)
            if (!audioDownloadUrl) {
                try {
                    const apiResp = await axios.get('https://mr-thinuzz-api-build.zone.id/api/ytmp3/download', {
                        params: {
                            url: youtubeUrl,
                            apiKey: 'key_094bb23f6672ed25'
                        },
                        timeout: 25000
                    });
                    const data = apiResp.data;
                    if (data?.status && data?.data?.links?.audio) {
                        audioDownloadUrl = data.data.links.audio;
                        if (songTitle === "Sadew-MD Audio" && data?.data?.title) songTitle = data.data.title;
                    }
                } catch (e3) {
                    console.log('[csong] All APIs failed.');
                }
            }

            if (!audioDownloadUrl) return reply("❌ *Error:* සියලුම සේවාදායකයන් (APIs) කාර්යබහුල බැවින් ඕඩියෝ එක ලබා ගැනීමට නොහැකි විය.");

            // 3. Detail Card එක යවනවා (Block වෙන්නෙ නැති විදිහට)
            const captionMsg = `✨ *_🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮⊹ ˚₊ 𝜗𝜚_ Music System* ✨\n\n` +
                               `📌 *Title:* ${songTitle}\n👤 *Channel:* ${ytChannel}\n` +
                               `👁️ *Views:* ${views.toLocaleString()}\n⏱️ *Duration:* ${duration}\n\n` +
                               `╰┈⪼ 𝘗𝘰𝘸𝘦𝘳𝘦𝘥 𝘉𝘺 🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮⪻`;

            try {
                if (thumbnail) {
                    await sendNewsletterMedia(socket, channelJID, thumbnail, "image", captionMsg);
                } else {
                    await socket.sendMessage(channelJID, { text: captionMsg });
                }
            } catch (err) {
                console.log("[csong] Thumbnail send warning:", err.message);
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
                        '-avoid_negative_ts make_zero'
                    ])
                    .toFormat('ogg')
                    .save(tempOgg)
                    .on('end', resolve)
                    .on('error', (err) => reject(err));
            });

            let durationSeconds = 180; 
            if (duration && duration.includes(':')) {
                const timeParts = duration.split(':').map(Number);
                if (timeParts.length === 2) {
                    durationSeconds = timeParts[0] * 60 + timeParts[1];
                } else if (timeParts.length === 3) {
                    durationSeconds = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
                }
            }

            const fakeWaveform = new Uint8Array(64);
            for (let i = 0; i < 64; i++) {
                fakeWaveform[i] = Math.floor(Math.random() * 100); 
            }

            // 7. Voice Note එකක් විදිහට Channel එකට යවනවා 
            await sendNewsletterMedia(
                socket,
                channelJID,
                fs.readFileSync(tempOgg),
                "audio",
                '',
                { ptt: true, waveform: fakeWaveform }
            );

            reply("✅ *සින්දුව සාර්ථකව Voice Note එකක් විදිහට Channel එකට Upload කළා!*");

            try { fs.unlinkSync(tempMp3); } catch (e) {}
            try { fs.unlinkSync(tempOgg); } catch (e) {}

        } catch (e) {
            console.log("CHANNEL SONG CMD ERROR:", e);
            reply("❌ *Internal Error:* " + e.message);
        }
    }
};
