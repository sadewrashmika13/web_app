const axios = require("axios");

module.exports = {
    name: "apk_downloader",
    category: "download",
    description: "📲 Download APK files from Aptoide",
    commands: ["apk", "apkdl", "getapk"],

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        try {
            // Args ටික එකට එකතු කරලා Query එක හදාගන්නවා
            const query = args.join(" ").trim();

            if (!query) {
                return await socket.sendMessage(sender, {
                    text: `📲 *APK Downloader*\n\n*Usage:* .${command} <app name>\n*Example:* .${command} whatsapp\n\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`
                }, { quoted: msg });
            }

            // ⏳ රිඇක්ෂන් එක සහ Typing Status එක
            await socket.sendMessage(sender, { react: { text: "⏳", key: msg.key } });
            await socket.sendPresenceUpdate('composing', sender);
            
            await socket.sendMessage(sender, { text: `🔍 *Searching for "${query}"...*` }, { quoted: msg });

            const API_TOKEN = "4ehG6P";
            const API_BASE = "https://whiteshadow-x-api.onrender.com/api";

            // 1. Search for the app
            const searchUrl = `${API_BASE}/search/aptoide?q=${encodeURIComponent(query)}&apitoken=${API_TOKEN}`;
            const searchRes = await axios.get(searchUrl, { timeout: 15000 });

            if (!searchRes.data?.success || !searchRes.data?.data?.length) {
                throw new Error("No apps found");
            }

            // 🛑 Find best match
            let bestMatch = searchRes.data.data[0];
            const exactMatch = searchRes.data.data.find(app => 
                app.package === query.toLowerCase() || 
                app.title.toLowerCase() === query.toLowerCase()
            );
            if (exactMatch) bestMatch = exactMatch;

            const packageName = bestMatch.package;
            const appName = bestMatch.title;
            const appSize = bestMatch.size;

            await socket.sendMessage(sender, { 
                text: `✅ *Found:* ${appName}\n📦 *Size:* ${appSize}\n⬇️ *Getting Sadew-Mini download link...*` 
            }, { quoted: msg });

            // 2. Get the download link from the API
            const downloadApiUrl = `${API_BASE}/download/aptoide?package=${packageName}&apitoken=${API_TOKEN}`;
            const jsonRes = await axios.get(downloadApiUrl, { 
                timeout: 15000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });

            if (!jsonRes.data?.success || !jsonRes.data?.download_link) {
                console.error("Invalid API response:", jsonRes.data);
                throw new Error("No download link found in API response");
            }

            const directApkUrl = jsonRes.data.download_link;
            console.log(`[APK] Direct APK URL: ${directApkUrl}`);

            await socket.sendMessage(sender, { 
                text: `✅ *Got direct APK URL. Downloading file...*\n_මඳ වේලාවක් රැඳී සිටින්න..._` 
            }, { quoted: msg });

            // 3. Download the actual APK file from the direct URL
            const apkRes = await axios.get(directApkUrl, {
                responseType: 'arraybuffer',
                timeout: 90000, // 90 seconds for large files
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                maxRedirects: 5
            });

            const buffer = Buffer.from(apkRes.data);
            const actualSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
            
            if (buffer.length < 500000) { // Less than ~0.5 MB is suspicious
                throw new Error(`Downloaded file too small (${actualSizeMB} MB). Might be invalid.`);
            }

            const fileName = `${appName.replace(/[^a-z0-9]/gi, '_')}.apk`;
            const caption = `📲 *${appName}*\n📦 *Size:* ${actualSizeMB} MB\n📥 *APK ready for installation*\n\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

            // 📩 Document එක විදිහට APK එක යැවීම
            await socket.sendMessage(sender, {
                document: buffer,
                mimetype: "application/vnd.android.package-archive",
                fileName: fileName,
                caption: caption
            }, { quoted: msg });

            await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

        } catch (error) {
            console.error("APK error:", error);
            await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
            
            let errMsg = `❌ *APK Download Failed*\n\n`;
            if (error.message.includes("No apps")) {
                errMsg += `No results for your query.\nTry using the exact package name (e.g., .apk com.whatsapp)`;
            } else if (error.message.includes("download link")) {
                errMsg += `Could not get download link. The API might have changed.\n\n📝 ${error.message}`;
            } else if (error.message.includes("too small")) {
                errMsg += `Downloaded file appears to be invalid.\nThe direct APK link might be broken or expired.`;
            } else {
                errMsg += `📝 Error: ${error.message.substring(0, 150)}`;
            }
            
            await socket.sendMessage(sender, { text: errMsg }, { quoted: msg });
        }
    }
};
