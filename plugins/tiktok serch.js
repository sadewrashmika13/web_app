const axios = require('axios');
const { prepareWAMessageMedia, generateWAMessageFromContent } = require('@whiskeysockets/baileys');

module.exports = {
    name: "tiktoksearch_carousel",
    category: 1,
    description: "Search and send TikTok videos in a Horizontal Carousel",
    commands: ["ts"],

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        const query = args.join(' ').trim();
        if (!query) return reply("🎥 *කරුණාකර TikTok වීඩියෝවක් සෙවීමට නමක් ලබා දෙන්න!*\n💡 `.ts mrbeast`");

        try {
            await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } });
            
            // Carousel එක හදන්න වීඩියෝ 10ම Upload වෙන්න ඕනේ නිසා පොඩි වෙලාවක් යනවා
            await reply(`🔍 _Searching TikTok for: "${query}"..._\n\n⏳ *කරුණාකර රැඳී සිටින්න, වීඩියෝ 10ම Carousel Message එකක් ලෙස සකසමින් පවතී... (මෙයට සුළු වෙලාවක් ගත විය හැක)*`);

            // Kavindu API එකෙන් Search කිරීම
            const searchUrl = `https://kavindu-download-web.vercel.app/api/search/tiktok?q=${encodeURIComponent(query)}`;
            const { data } = await axios.get(searchUrl);

            if (!data.status || !data.result || data.result.length === 0) {
                await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
                return reply("❌ *සෙවූ වීඩියෝව හමු වුනේ නැහැ.*");
            }

            // උපරිම වීඩියෝ 10 වෙන් කරගැනීම (Carousel උපරිමය 10යි)
            const results = data.result.slice(0, 10);
            const cards = [];

            // වීඩියෝ 10 එකින් එක WhatsApp Servers වලට Upload කරලා Card හදනවා
            for (let i = 0; i < results.length; i++) {
                const video = results[i];
                if (!video.play) continue;

                try {
                    // WhatsApp සර්වර් එකට වීඩියෝ එක Upload කිරීම (Card එකට වීඩියෝ දාන්න මේක අනිවාර්යයි)
                    const media = await prepareWAMessageMedia(
                        { video: { url: video.play } },
                        { upload: socket.waUploadToServer }
                    );

                    // එක Card එකක් හැදීම
                    cards.push({
                        body: { text: `*🎬 Title:* ${video.title || 'No Title'}\n👤 *Author:* ${video.author?.nickname || 'Unknown'}\n👁️ *Views:* ${video.play_count || 0}` },
                        footer: { text: "👑 SADEW-MINI 👑" },
                        header: {
                            title: `TikTok Video ${i+1}`,
                            hasMediaAttachment: true,
                            videoMessage: media.videoMessage
                        },
                        nativeFlowMessage: {
                            buttons: [
                                {
                                    name: "cta_url",
                                    buttonParamsJson: JSON.stringify({
                                        display_text: "🔗 Direct Link",
                                        url: video.play
                                    })
                                }
                            ]
                        }
                    });
                } catch (e) {
                    console.error(`Failed to prepare card ${i+1}:`, e.message);
                }
            }

            if (cards.length === 0) {
                return reply("❌ *වීඩියෝ කාඩ්ස් සැකසීමට නොහැකි විය!*");
            }

            // සම්පූර්ණ Carousel (Interactive Message) එක හැදීම
            const msgContent = generateWAMessageFromContent(sender, {
                viewOnceMessage: {
                    message: {
                        messageContextInfo: {
                            deviceListMetadata: {},
                            deviceListMetadataVersion: 2
                        },
                        interactiveMessage: {
                            body: { text: `*🔍 SADEW-MINI TIKTOK SEARCH*\nResults for: _${query}_\n\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*` },
                            footer: { text: "Swipe left to view videos ➡️" },
                            header: { title: "", subtitle: "", hasMediaAttachment: false },
                            carouselMessage: {
                                cards: cards
                            }
                        }
                    }
                }
            }, { quoted: msg });

            // Message එක යැවීම
            await socket.relayMessage(sender, msgContent.message, { messageId: msgContent.key.id });
            await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

        } catch (e) {
            console.error("[tiktok search carousel] Error:", e.message);
            await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
            reply(`❌ *Search error: ${e.message}*`);
        }
    }
};
