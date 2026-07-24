const mongoose = require('mongoose');
const { downloadContentFromMessage } = require('baileys');
const axios = require('axios');
const FormData = require('form-data');

module.exports = {
    name: "settings",
    category: 4, 
    description: "Bot Main Settings & Customization",
    commands: ["settings", "panel", "mode", "addpp", "delpp", "btnmode", "prefix", "setprefix", "ban", "unban"],

    handler: async ({ socket, msg, sender, command, args, reply, botNumber, sessionConfig, activeSockets, isOwner }) => {
        
        // 🔴 OWNER CHECK
        if (!isOwner) {
            return reply('❌ *මෙම විධානය භාවිතා කළ හැක්කේ Bot Owner ට පමණි!*');
        }

        const sanitizedNumber = botNumber.replace(/[^0-9]/g, '');
        const Session = mongoose.models.SessionNew;

        // Database එකට සේව් කරන Function එක
        const saveConfig = async () => {
            const currentData = activeSockets.get(sanitizedNumber);
            if (currentData) {
                currentData.config = sessionConfig;
                activeSockets.set(sanitizedNumber, currentData);
            }
            await Session.findOneAndUpdate(
                { number: sanitizedNumber },
                { config: sessionConfig, updatedAt: new Date() },
                { upsert: true }
            );
        };

        const cmd = command.replace(/^\./, '').toLowerCase();

        // 🔘 බොත්තම් ක්‍රමය On / Off කිරීම
        if (cmd === 'btnmode') {
            const option = args[0] ? args[0].toLowerCase() : '';
            if (option === 'on') {
                sessionConfig.BUTTON_MODE = 'true';
                await saveConfig();
                return reply(`✅ *Global Button Mode ON!*\nමින් ඉදිරියට බොට් භාවිතා කරන සියලු දෙනාට Buttons පෙනෙනු ඇත.`);
            } else if (option === 'off') {
                sessionConfig.BUTTON_MODE = 'false';
                await saveConfig();
                return reply(`✅ *Global Button Mode OFF!*\nමින් ඉදිරියට බොට් භාවිතා කරන සියලු දෙනාට Buttons වෙනුවට Number Reply පෙනෙනු ඇත.`);
            } else {
                return reply(`❌ *කරුණාකර නිවැරදි විධානයක් ලබාදෙන්න!*\nඋදා: .btnmode on (හෝ) .btnmode off`);
            }
        }

        // 🔘 PREFIX වෙනස් කිරීම
        if (cmd === 'prefix' || cmd === 'setprefix') {
            const newPrefix = args[0];
            if (!newPrefix) return reply(`❌ *කරුණාකර අලුත් Prefix එකක් ලබාදෙන්න!*\n💡 උදා: .prefix !`);
            if (newPrefix.length > 3) return reply(`❌ *Prefix එක අකුරු 3 කට වඩා වැඩි විය නොහැක!*`);
            
            sessionConfig.PREFIX = newPrefix;
            await saveConfig(); 
            return reply(`✅ *Bot Prefix එක සාර්ථකව [ ${newPrefix} ] ලෙස වෙනස් කරන ලදී!*\n\nමින් ඉදිරියට බොට්ගේ විධානයන් භාවිතා කිරීම සඳහා ${newPrefix} යොදන්න.`);
        }

        // 🚫 USER BAN කිරීම
        if (cmd === 'ban') {
            let targetUser;
            if (msg.key.remoteJid.endsWith('@g.us')) {
                const quotedCtx = msg.message?.extendedTextMessage?.contextInfo;
                targetUser = quotedCtx?.participant || quotedCtx?.remoteJid;
                if (!targetUser) return reply("❌ *Group එකකදී නම් Ban කිරීමට අවශ්‍ය කෙනාගේ Message එකකට Reply කර .ban යොදන්න.*");
            } else {
                targetUser = msg.key.remoteJid;
            }

            const ownerNumberClean = botNumber.replace(/[^0-9]/g, '');
            if (targetUser.includes(ownerNumberClean)) return reply("❌ *ඔයාවම Ban කරගන්න බෑ යකෝ!* 😂");

            if (!sessionConfig.BANNED_USERS) sessionConfig.BANNED_USERS = [];
            if (sessionConfig.BANNED_USERS.includes(targetUser)) return reply("⚠️ *මෙම පරිශීලකයා දැනටමත් Ban කර ඇත.*");

            sessionConfig.BANNED_USERS.push(targetUser);
            await saveConfig();
            return reply(`🚫 *පරිශීලකයාව සාර්ථකව Ban කරන ලදී!*\nමින් ඉදිරියට මොහුට බොට් භාවිතා කළ නොහැක.`);
        }

        // ♻️ USER UNBAN කිරීම
        if (cmd === 'unban') {
            let targetUser;
            if (msg.key.remoteJid.endsWith('@g.us')) {
                const quotedCtx = msg.message?.extendedTextMessage?.contextInfo;
                targetUser = quotedCtx?.participant || quotedCtx?.remoteJid;
                if (!targetUser) return reply("❌ *Group එකකදී නම් Unban කිරීමට අවශ්‍ය කෙනාගේ Message එකකට Reply කර .unban යොදන්න.*");
            } else {
                targetUser = msg.key.remoteJid;
            }

            if (!sessionConfig.BANNED_USERS || !sessionConfig.BANNED_USERS.includes(targetUser)) {
                return reply("⚠️ *මෙම පරිශීලකයා Ban කර නොමැත.*");
            }

            sessionConfig.BANNED_USERS = sessionConfig.BANNED_USERS.filter(user => user !== targetUser);
            await saveConfig();
            return reply(`✅ *පරිශීලකයාව සාර්ථකව Unban කරන ලදී!*\nමින් ඉදිරියට මොහුට නැවතත් බොට් භාවිතා කළ හැක.`);
        }

        // ════════ 1. SETTINGS PANEL ════════
        if (cmd === 'settings' || cmd === 'panel') {
            const currentMode = sessionConfig?.MODE || 'public';
            const currentPrefix = sessionConfig?.PREFIX || '.';
            const customLogos = sessionConfig?.CUSTOM_LOGOS || [];
            const bannedCount = sessionConfig?.BANNED_USERS?.length || 0;
            const btnStatus = (sessionConfig?.BUTTON_MODE === 'false') ? "🔴 OFF" : "🟢 ON";
            
            const panelText = `*↳ ❝ [⚙️ 𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗦𝗲𝘁𝘁𝗶𝗻𝗴𝘀 ⚙️] ¡! ❞*\n\n` +
                              `*1️⃣ 𝗪𝗼𝗿𝗸 𝗠𝗼𝗱𝗲 𝗦𝗲𝘁𝘁𝗶𝗻𝗴𝘀:*\n` +
                              `🔸 Current Mode: *${currentMode.toUpperCase()}*\n` +
                              `  [1] Public | [2] Private | [3] Inbox\n\n` +
                              `*2️⃣ 𝗣𝗿𝗲𝗳𝗶𝘅 𝗦𝗲𝘁𝘁𝗶𝗻𝗴𝘀:*\n` +
                              `🔸 Current Prefix: *[ ${currentPrefix} ]*\n\n` +
                              `*3️⃣ 𝗠𝗲𝗻𝘂 𝗟𝗼𝗴𝗼 𝗦𝗲𝘁𝘁𝗶𝗻𝗴𝘀:*\n` +
                              `🖼️ Custom Logos: *${customLogos.length}*\n` +
                              `  • .addpp / .delpp\n\n` +
                              `*4️⃣ 𝗕𝗮𝗻𝗻𝗲𝗱 𝗨𝘀𝗲𝗿𝘀:*\n` +
                              `🚫 Banned Count: *${bannedCount} Users*\n` +
                              `  • .ban / .unban\n\n` +
                              `*5️⃣ 𝗕𝘂𝘁𝘁𝗼𝗻 𝗠𝗼𝗱𝗲 (Global):*\n` +
                              `🔘 Current Status: *${btnStatus}*\n\n` +
                              `> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

            let displayLogo = 'https://res.cloudinary.com/dqlh378fb/image/upload/v1780590033/zanta_media_uploads/dttqjshprca9zvqcpbwg.jpg';
            if (customLogos.length > 0) displayLogo = customLogos[Math.floor(Math.random() * customLogos.length)];

            const sentMsg = await socket.sendMessage(sender, {
                image: { url: displayLogo }, 
                caption: panelText
            }, { quoted: msg });

            global.sadewSettingsTracker = global.sadewSettingsTracker || {};
            global.sadewSettingsTracker[sender] = sentMsg.key.id;
            return;
        }

        // ════════ 2. MODE CHANGE (COMMAND) ════════
        if (cmd === 'mode') {
            const option = args[0] ? args[0].toLowerCase() : '';
            let newMode = '';
            if (option === '1' || option === 'public') newMode = 'public';
            else if (option === '2' || option === 'private') newMode = 'private';
            else if (option === '3' || option === 'inbox') newMode = 'inbox';
            
            if (newMode) {
                sessionConfig.MODE = newMode;
                await saveConfig();
                return reply(`✅ *Bot mode successfully changed to ${newMode.toUpperCase()} mode.*`);
            } else return reply(`❌ *කරුණාකර නිවැරදි Mode එකක් ලබාදෙන්න!*\nඋදා: .mode 1`);
        }

        // ════════ 3. ADD CUSTOM MENU LOGO (.addpp) [OFFICIAL IMGBB API] ════════
        if (cmd === 'addpp') {
            const qMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!qMsg || !qMsg.imageMessage) return reply("🖼️ *කරුණාකර පින්තූරයකට Reply කර .addpp ලෙස යවන්න!*");

            try {
                await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });
                const stream = await downloadContentFromMessage(qMsg.imageMessage, 'image');
                let buffer = Buffer.from([]);
                for await(const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

                const base64Image = buffer.toString('base64');
                
                // 🔴 ඔයාගේ ImgBB API Key එක මෙතනට දාන්න 🔴
                const IMGBB_API_KEY = "0b678f04eef35a50b7a998a3be666140"; 

                const form = new FormData();
                form.append('key', IMGBB_API_KEY);
                form.append('image', base64Image);

                const response = await axios.post('https://api.imgbb.com/1/upload', form, {
                    headers: form.getHeaders(),
                    timeout: 25000
                });

                if (!response.data || !response.data.success || !response.data.data.url) {
                    throw new Error("Official ImgBB Upload Failed");
                }

                const imgUrl = response.data.data.url;

                if (!sessionConfig.CUSTOM_LOGOS) sessionConfig.CUSTOM_LOGOS = [];
                sessionConfig.CUSTOM_LOGOS.push(imgUrl);
                
                await saveConfig();
                await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
                return reply(`✅ *පින්තූරය සාර්ථකව එකතු කරන ලදී!*`);
            } catch (e) { 
                return reply(`❌ *Error:* පින්තූරය සේව් කිරීම අසාර්ථකයි! (${e.message})`); 
            }
        }

        // ════════ 4. DELETE ALL CUSTOM LOGOS (.delpp) ════════
        if (cmd === 'delpp') {
            sessionConfig.CUSTOM_LOGOS = [];
            await saveConfig();
            return reply(`✅ *Custom Logo ලැයිස්තුව මකා දමන ලදී!*`);
        }
    }
};
