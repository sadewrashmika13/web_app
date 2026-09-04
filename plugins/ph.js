const axios = require('axios');

// තත්පර 5ක් රඳවන්න හදපු function එක
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
    name: "xx_search",
    category: "18+",
    description: "Search videos and send photos with CTA buttons one by one",
    commands: ["xx"],

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        const API_KEY = "slk_feb4c1b4888e42998f43b746336ca25e";

        if (command === "xx") {
            const query = args.join(' ').trim();
            if (!query) return reply("🔍 *කරුණාකර නමක් ලබා දෙන්න!*\n💡 උදා: `.xx new`");

            try {
                await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } });
                
                // API Request
                const searchUrl = `https://mizuki-md-api.netlify.app/api/search/pornhub?q=${encodeURIComponent(query)}&apiKey=${API_KEY}`;
                const res = await axios.get(searchUrl, { timeout: 15000 });
                
                const items = res.data?.data || [];
                if (!res.data?.status || items.length === 0) {
                    await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
                    return reply("❌ *සමාවෙන්න, කිසිවක් සොයාගත නොහැකි විය!*");
                }

                await reply("✅ *ප්‍රතිඵල සොයාගන්නා ලදී. එකින් එක එවීම ආරම්භ කරමි...*");

                // මුල් ප්‍රතිඵල 4 පමණක් ගන්නවා
                const topItems = items.slice(0, 4);

                for (let i = 0; i < topItems.length; i++) {
                    const item = topItems[i];
                    
                    let captionText = `*🎬 Title:* ${item.title}\n`;
                    captionText += `⏱️ *Duration:* ${item.duration}\n\n`;
                    captionText += `> *👑 SADEW-MINI 👑*`;

                    // Open Browser සහ Copy Link Buttons දෙක
                    const buttons = [
                        {
                            name: "cta_url",
                            buttonParamsJson: JSON.stringify({
                                display_text: "🌐 Open in Browser",
                                url: item.url,
                                merchant_url: item.url
                            })
                        },
                        {
                            name: "cta_copy",
                            buttonParamsJson: JSON.stringify({
                                display_text: "📋 Copy Link",
                                id: `copy_btn_${i}`,
                                copy_code: item.url
                            })
                        }
                    ];

                    const msgOpts = {
                        image: { url: item.thumb },
                        caption: captionText,
                        footer: "SADEW-MINI",
                        buttons: buttons,
                        headerType: 4
                    };

                    // Message එක යවනවා
                    await socket.sendMessage(sender, msgOpts, { quoted: msg });

                    // අන්තිම Video එකට පස්සේ Delay එකක් ඕනේ නෑ
                    if (i < topItems.length - 1) {
                        await delay(5000); // හරියටම තත්පර 5ක් ඉන්නවා
                    }
                }

                await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

            } catch (e) {
                console.error(e);
                reply("❌ *API දෝෂයකි! පසුව නැවත උත්සාහ කරන්න.*");
            }
        }
    }
};
