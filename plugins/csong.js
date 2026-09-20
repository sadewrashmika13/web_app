const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 🔥 ffmpeg-static පැකේජ් එක භාවිතා කිරීම 🔥
const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

// 🔥 Channel එකට Media යවන විශේෂ Function එක (Wrong File මඟහරින) 🔥
async function sendNewsletterMedia(sock, jid, media, type, caption = '', options = {}) {
    let Baileys;
    try { 
        Baileys = require('baileys'); 
    } catch (e) {
        throw new Error('Baileys library එක හොයාගන්න බැරි වුණා!');
    }

    const { generateWAMessage, encodeNewsletterMessage, generateMessageID } = Baileys;

    const mediaSource = (typeof media === 'string' && (media.startsWith('http') || media.startsWith('./')))
        ? { url: media }
        : media;

    let content = {};
    
    if (type === 'image') {
        content = { image: mediaSource, caption: caption };
    } else if (type === 'audio') {
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
    description: "Search and upload songs to WhatsApp Channels.",
    commands: ["csong", "channelsong", "csongdown"], // csongdown එක අලුතින් එකතු කළා Button Click එකට
    
    handler: async ({ socket, msg, sender, command, args, reply }) => {
        try {
            const actualSender = msg.key.participant || msg.key.remoteJid || sender;

            // ════════════ 1. MAIN COMMAND (.csong) ════════════
            if (command === "csong" || command === "channelsong") {
                let fullQuery = args.join(' ');
                if (!fullQuery) return reply("🎵 *කරුණාකර සින්දුවක නමක් සහ Channel Link/JID එක ලබා දෙන්න!*\n💡 උදා: `.csong https://whatsapp.com/channel/... සින්දුවේ නම`");

                let channelJid = null;
                let query = fullQuery;

                // 🔍 Channel Link එකක් තියෙනවද බලනවා
                const linkMatch = fullQuery.match(/(?:whatsapp\.com\/channel\/)([A-Za-z0-9]+)/i);
                // 🔍 JID එකක් තියෙනවද බලනවා
                const jidMatch = fullQuery.match(/([0-9]+@newsletter)/i);

                if (linkMatch) {
                    const inviteCode = linkMatch[1];
                    try {
                        reply("⏳ _Channel Link එක Check කරමින් පවතී..._");
                        const meta = await socket.newsletterMetadata("invite", inviteCode);
                        channelJid = meta.id;
                    } catch (e) {
                        return reply("❌ *Error:* Channel Link එක හරහා විස්තර ගත නොහැක. (Link එක වැරදියි හෝ අවලංගුයි).");
                    }
                    query = fullQuery.replace(linkMatch[0], '').replace('https://', '').replace('http://', '').trim();
                } 
                else if (jidMatch) {
                    channelJid = jidMatch[1];
                    query = fullQuery.replace(jidMatch[0], '').trim();
                } 
                else {
                    return reply("❌ *Error:* කරුණාකර Channel JID එකක් හෝ Channel Link එකක් ලබා දෙන්න!");
                }

                // කොමා (,) සහ වැඩිපුර හිස්තැන් අයින් කරලා පිරිසිදු සින්දුවේ නම ගන්නවා
                query = query.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
                if (!query) return reply("❌ සින්දුවේ නම සොයා ගැනීමට නොහැක. කරුණාකර සින්දුවේ නමද ඇතුලත් කරන්න.");

                reply(`🔍 _Searching for "${query}" on YouTube..._`);

                // YouTube Search එක
                const searchResults = await yts(query);
                if (!searchResults || !searchResults.videos.length) return reply("❌ කිසිම සින්දුවක් සොයාගත නොහැකි විය.");

                // 📌 Top 5 Results වලින් Buttons හැදීම
                let cap = `*🔍 සෙවුම් ප්‍රතිඵල (Top 5)*\n\n📌 *සෙවූ නම:* ${query}\n📢 *Channel:* ${channelJid.split('@')[0]}\n\n👇 *පහළින් ඇති බට්න් මගින් ඔබට අවශ්‍ය ගීතය තෝරන්න:*\n\n`;
                let buttons = [];

                for (let i = 0; i < 5 && i < searchResults.videos.length; i++) {
                    const v = searchResults.videos[i];
                    cap += `*${i+1}.* ${v.title}\n⏱️ Duration: ${v.timestamp} | 👁️ Views: ${v.views}\n\n`;
                    
                    buttons.push({
                        buttonId: `.csongdown ${channelJid} ${v.videoId}`,
                        buttonText: { displayText: `🎵 Song ${i+1}` },
                        type: 1
                    });
                }

                // 🖼️ ඔයා දුන්න Photo එකත් එක්ක Result එක යවනවා
                await socket.sendMessage(actualSender, {
                    image: { url: 'https://res.cloudinary.com/p6lu5bpe/image/upload/v1789870165/Gemini_Generated_Image_89j6hx89j6hx89j6_qpx9rn.jpg' },
                    caption: cap,
                    buttons: buttons,
                    headerType: 4
                });
            }

            // ════════════ 2. BUTTON CLICK COMMAND (.csongdown) ════════════
            else if (command === "csongdown") {
                if (args.length < 2) return reply("❌ Invalid Request.");
                const channelJid = args[0];
                const videoId = args[1];

                await socket.sendMessage(actualSender, { text: "⏳ _සින්දුව Download කර Channel එක වෙත Upload කරමින් පවතී..._" });

                // Video ID එකෙන් විස්තර ගන්නවා
                let videoDetails;
                try {
                    videoDetails = await yts({ videoId: videoId });
                } catch (e) {
                    return reply("❌ සින්දුවේ විස්තර ලබාගැනීමට නොහැකි විය.");
                }

                const songTitle = videoDetails.title;
                const thumbnail = videoDetails.thumbnail || videoDetails.image;
                const ytChannel = videoDetails.author.name;
                const views = videoDetails.views;
                const duration = videoDetails.timestamp;
                const youtubeUrl = videoDetails.url;

                // API එකෙන් Audio ලින්ක් එක ගන්නවා
                let audioDownloadUrl = null;
                try {
                    const res1 = await axios.get(`https://apis.davidcyril.name.ng/download/ytmp33?url=${encodeURIComponent(youtubeUrl)}`, { timeout: 25000 });
                    if (res1.data?.success && res1.data?.result?.download_url) audioDownloadUrl = res1.data.result.download_url;
                } catch (e1) {}

                if (!audioDownloadUrl) {
                    try {
                        const res2 = await axios.get(`https://apis.davidcyril.name.ng/download/ytmp3v2?url=${encodeURIComponent(youtubeUrl)}`, { timeout: 25000 });
                        if (res2.data?.success && res2.data?.result?.download_url) audioDownloadUrl = res2.data.result.download_url;
                    } catch (e2) {}
                }

                if (!audioDownloadUrl) return await socket.sendMessage(actualSender, { text: "❌ *Error:* සේවාදායකයන් කාර්යබහුල බැවින් ඕඩියෝ එක ලබා ගැනීමට නොහැකි විය." });

                // 📸 Detail Card එක Channel එකට යැවීම
                const captionMsg = `🎵 *Music Downloader* 🎵\n\n` +
                                   `📌 *Title:* ${songTitle}\n` +
                                   `👤 *Channel:* ${ytChannel}\n` +
                                   `👁️ *Views:* ${views.toLocaleString()}\n` +
                                   `⏱️ *Duration:* ${duration}\n\n` +
                                   `╰┈⪼ _Uploaded Successfully_ ⪻`;
                try {
                    if (thumbnail) {
                        await sendNewsletterMedia(socket, channelJid, thumbnail, "image", captionMsg);
                    }
                } catch (err) {
                    console.log("Image send error:", err);
                }

                // 🎵 MP3 බාගෙන OPUS (Voice Note) බවට පත් කිරීම
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

                // 🎙️ Voice Note එක Channel එකට යැවීම
                const opusBuffer = fs.readFileSync(tempOpus);
                await sendNewsletterMedia(socket, channelJid, opusBuffer, "audio", '', { ptt: true });

                await socket.sendMessage(actualSender, { text: `✅ *"${songTitle}"* සාර්ථකව Channel එකට Upload කළා!` });

                // Temp ෆයිල්ස් මකා දැමීම
                try { fs.unlinkSync(tempMp3); } catch (e) {}
                try { fs.unlinkSync(tempOpus); } catch (e) {}
            }
        } catch (e) {
            console.log("CHANNEL SONG CMD ERROR:", e);
            reply("❌ *Internal Error:* " + e.message);
        }
    }
};
