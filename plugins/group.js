const fs = require('fs');

const path = './blacklist.json';

function getBlacklist() {
    if (!fs.existsSync(path)) return [];
    return JSON.parse(fs.readFileSync(path));
}

function saveBlacklist(list) {
    fs.writeFileSync(path, JSON.stringify(list, null, 2));
}

module.exports = {
    name: "group-blacklist",
    category: 1, 
    description: "Blacklist groups to stop bots from replying",
    commands: ["blockgroup", "unblockgroup", "blocklist"],
    
    handler: async ({ socket, msg, sender, command, args, reply }) => {
        // 👑 OWNER CHECK
        const ownerNumbers = ["94769634033", "194601394663437"]; 
        const actualSender = msg.key.participant || msg.key.remoteJid || sender;
        const isOwner = ownerNumbers.some(id => actualSender.includes(id));
        
        if (!isOwner) return reply("❌ මේ කමාන්ඩ් එක පාවිච්චි කරන්න පුළුවන් Bot Owner ට විතරයි!");

        // 🚫 BLOCK GROUP
        if (command === "blockgroup") {
            let targetJid = '';
            if (args.length > 0) {
                const input = args[0];
                if (input.includes('@g.us')) {
                    targetJid = input;
                } else if (input.includes('chat.whatsapp.com/')) {
                    const inviteCode = input.split('chat.whatsapp.com/')[1].split('/')[0].split('?')[0];
                    try {
                        const groupInfo = await socket.groupGetInviteInfo(inviteCode);
                        targetJid = groupInfo.id;
                    } catch (e) {
                        return reply("❌ Group Link එක වැරදියි හෝ Bot ට ඒක කියවන්න බෑ.");
                    }
                } else {
                    return reply("❌ කරුණාකර නිවැරදි Group JID එකක් හෝ Link එකක් දෙන්න.");
                }
            } else {
                if (msg.key.remoteJid.endsWith('@g.us')) {
                    targetJid = msg.key.remoteJid;
                } else {
                    return reply("❌ කරුණාකර අදාල Group එකේ ඉඳන් කමාන්ඩ් එක ගහන්න, නැත්නම් Link එක දෙන්න.\nඋදා: .blockgroup https://chat.whatsapp.com/...");
                }
            }

            let list = getBlacklist();
            if (!list.includes(targetJid)) {
                list.push(targetJid);
                saveBlacklist(list);
                reply(`✅ සාර්ථකයි! මින් ඉදිරියට මේ Bot මේ Group එකේ කිසිම කමාන්ඩ් එකකට වැඩ කරන්නේ නෑ.\n\n🔒 Blocked JID: ${targetJid}`);
            } else {
                reply(`⚠️ මේ Group එක දැනටමත් Block කරලයි තියෙන්නේ.`);
            }
        }

        // 🔓 UNBLOCK GROUP
        else if (command === "unblockgroup") {
            let targetJid = '';
            if (args.length > 0) {
                const input = args[0];
                if (input.includes('@g.us')) targetJid = input;
                else return reply("❌ කරුණාකර අයින් කරන්න ඕනේ Group JID එක දෙන්න. (JID එක බලාගන්න .blocklist ගහන්න)");
            } else {
                if (msg.key.remoteJid.endsWith('@g.us')) targetJid = msg.key.remoteJid;
                else return reply("❌ අදාල Group එකේ ඉඳන් කමාන්ඩ් එක ගහන්න.");
            }

            let list = getBlacklist();
            if (list.includes(targetJid)) {
                list = list.filter(jid => jid !== targetJid);
                saveBlacklist(list);
                reply(`✅ සාර්ථකයි! Group එක Unblock කළා. දැන් ඉඳන් මේ Group එකේ Bot වැඩ කරනවා.`);
            } else {
                reply(`⚠️ මේ Group එක Blocked ලිස්ට් එකේ නෑ.`);
            }
        }

        // 📋 VIEW BLOCKED GROUPS
        else if (command === "blocklist") {
            let list = getBlacklist();
            if (list.length === 0) return reply("📂 දැනට කිසිම Group එකක් Block කරලා නෑ.");
            let txt = "🚫 *BLOCKED GROUPS LIST*\n\n";
            list.forEach((jid, i) => {
                txt += `${i + 1}. ${jid}\n`;
            });
            txt += "\n> _Group එකක් අයින් කරන්න .unblockgroup [JID] ගහන්න._";
            reply(txt);
        }
    }
};
