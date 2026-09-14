const axios = require('axios');

// 🔴 ඔයාගේ Mod Baileys එක ඔටෝම හොයාගන්න හදපු කෑල්ල 🔴
let baileysPkg;
try { baileysPkg = require('@whiskeysockets/baileys'); } 
catch (e1) {
    try { baileysPkg = require('@adiwajshing/baileys'); } 
    catch (e2) {
        try { baileysPkg = require('baileys'); } 
        catch (e3) {
            console.error("Baileys module එක හොයාගන්න බැහැ! කරුණාකර package.json එකේ තියෙන නම දෙන්න.");
        }
    }
}

const { prepareWAMessageMedia, generateWAMessageFromContent } = baileysPkg || {};

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
            
            // Baileys අවුලක් තියේනම් මෙතනින් නවතිනවා
            if (!prepareWAMessageMedia || !generateWAMessageFromContent) {
                await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
                return reply("❌ *Mod Baileys එක හඳුනාගැනීමට නොහැකි විය. කරුණාකර 'baileys' module නම පරීක්ෂා කරන්න.*");
            }
            
            await reply(`🔍 _Searching TikTok for: "${query}"..._\n\n⏳ *කරුණාකර රැඳී සිටින්න, වීඩියෝ 10ම Carousel Message එකක් ලෙස සකසමින් පවතී... (මෙයට සුළු වෙලාවක් ගත විය හැක)*`);

            const searchUrl = `https://kavindu-download-web.vercel.app/api/search/tiktok?q=${encodeURIComponent(query)}`;
            const { data } = await axios.get(searchUrl);

            if (!data.status || !data.result || data.result.length === 0) {
                await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
                return reply("❌ *සෙවූ වීඩියෝව හමු වුනේ නැහැ.*");
            }

            const results = data.result.slice(0, 10);
            const cards = [];

            for (let i = 0; i < results.length; i++) {
                const video = results[i];
                if (!video.play) continue;

                try {
                    // WhatsApp සර්වර් එකට Video එක Upload කරනවා
                    const media = await prepareWAMessageMedia(
                        { video: { url: video.play } },
                        { upload: socket.waUploadToServer }
                    );

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

            await socket.relayMessage(sender, msgContent.message, { messageId: msgContent.key.id });
            await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

        } catch (e) {
            console.error("[tiktok search carousel] Error:", e.message);
            await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
            reply(`❌ *Search error: ${e.message}*`);
        }
    }
};
