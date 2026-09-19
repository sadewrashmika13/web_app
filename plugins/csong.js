const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

// 🔥 Channel එකට Media යවන විශේෂ Function එක 🔥
async function sendNewsletterMedia(sock, jid, media, type, caption = '', options = {}) {
    let Baileys;
    try { 
        Baileys = require('baileys'); 
    } catch (e1) {
        throw new Error('Baileys library එක හොයාගන්න බැරි වුණා!');
    }

    const {
        generateWAMessage,
        encodeNewsletterMessage,
        generateMessageID
    } = Baileys;

    const mediaSource = (typeof media === 'string' && (media.startsWith('http') || media.startsWith('./')))
        ? { url: media }
        : media;

    let content = {};
    
    // ෆොටෝ දාන කොටස
    if (type === 'image') {
        content = { image: mediaSource, caption: caption };
    } 
    // Audio දාන කොටස
    else if (type === 'audio') {
        content = {
            audio: mediaSource,
            ptt: options.ptt || false,
            mimetype: 'audio/ogg; codecs=opus'
        };

        if (options.ptt) {
            content.waveform = new Uint8Array([0, 0, 50, 100, 150, 200, 150, 100, 50, 0, 120, 180, 250, 180, 120, 0]);
        }
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
                attrs: { mediatype: type === 'audio' ? 'audio' : 'image' },
                content: encodedBytes
            }
        ]
    };

    await sock.sendNode(stanza);
    return true;
}

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
            let songTitle = "Unknown Audio";
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

            // 2. Get MP3 Download Link
            let audioDownloadUrl = null;
            try {
                const res1 = await axios.get(`https://apis.davidcyril.name.ng/download/ytmp33?url=${encodeURIComponent(youtubeUrl)}`, { timeout: 25000 });
                if (res1.data?.success && res1.data?.result?.download_url) {
                    audioDownloadUrl = res1.data.result.download_url;
                    if (songTitle === "Unknown Audio") songTitle = res1.data.result.title;
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

            // 3. Detail Card එක යවනවා (නම අයින් කරලා, අලුත් Function එක හරහා)
            const captionMsg = `🎵 *Music Downloader* 🎵\n\n` +
                               `📌 *Title:* ${songTitle}\n` +
                               `👤 *Channel:* ${ytChannel}\n` +
                               `👁️ *Views:* ${views.toLocaleString()}\n` +
                               `⏱️ *Duration:* ${duration}\n\n` +
                               `╰┈⪼ _Uploaded Successfully_ ⪻`;
            
            try {
                if (thumbnail) {
                    // Image එකත් අලුත් ක්‍රමයටම යවනවා
                    await sendNewsletterMedia(socket, channelJID, thumbnail, "image", captionMsg);
                }
            } catch (err) {
                console.log("Image send error:", err);
            }

            // 4. MP3 එක Download කරලා OPUS (Voice Note) එකකට Convert කිරීම
            const tempMp3 = path.join(os.tmpdir(), `song_${Date.now()}.mp3`);
            const tempOpus = path.join(os.tmpdir(), `voice_${Date.now()}.opus`);

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

            await new Promise((resolve, reject) => {
                ffmpeg(tempMp3)
                    .audioBitrate('64k')
                    .audioCodec('libopus')
                    .format('opus')
                    .save(tempOpus)
                    .on('end', resolve)
                    .on('error', (err) => reject(err));
            });

            // 5. Voice Note එක අලුත් Function එක හරහා යැවීම
            const opusBuffer = fs.readFileSync(tempOpus);
            await sendNewsletterMedia(socket, channelJID, opusBuffer, "audio", '', { ptt: true });

            reply("✅ *සින්දුව සාර්ථකව Voice Note එකක් විදිහට Upload කළා!*");

            // Temp ෆයිල්ස් මකා දැමීම
            try { fs.unlinkSync(tempMp3); } catch (e) {}
            try { fs.unlinkSync(tempOpus); } catch (e) {}

        } catch (e) {
            console.log("CHANNEL SONG CMD ERROR:", e);
            reply("❌ *Internal Error:* " + e.message);
        }
    }
};
