module.exports = {
    name: "add2",
    category: 4, 
    description: "Add a user to the group using LID or normal number.",
    commands: ["add2"], 
    
    handler: async ({ socket, msg, sender, args, reply, store }) => {
        
        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        
        if (!isGroup) return reply("❌ මේ කමාන්ඩ් එක පාවිච්චි කරන්න පුළුවන් ගෲප් වල විතරයි.");

        // 🔥 JID එක 100% ක් පිරිසිදු කරන අලුත් ෆන්ක්ෂන් එක 🔥
        const normalizeJid = (jid) => {
            if (!jid) return "";
            return jid.split('@')[0].split(':')[0] + '@s.whatsapp.net';
        };

        // Group ඇඩ්මින්ලා කවුද කියලා හොයාගැනීම
        const groupMetadata = await socket.groupMetadata(from);
        const groupAdmins = groupMetadata.participants
            .filter(p => p.admin !== null) // admin සහ superadmin දෙගොල්ලොම ගන්නවා
            .map(p => normalizeJid(p.id));
        
        // Bot ගේ සහ ඔයාගේ (Sender) නම්බර් එක හරියටම ගන්නවා
        const botJid = normalizeJid(socket.user.id);
        
        // msg.key.participant එක හරහා තමයි Group එකකදි හරියටම යවපු කෙනාව අල්ලගන්නේ
        const senderJid = normalizeJid(msg.key.participant || msg.participant || sender);

        const isBotAdmins = groupAdmins.includes(botJid);
        const isAdmins = groupAdmins.includes(senderJid);

        if (!isBotAdmins) return reply("❌ කෙනෙක්ව Add කරන්න මාව මුලින්ම ඇඩ්මින් කරන්න!");
        if (!isAdmins) return reply("❌ මේක ගෲප් ඇඩ්මින්ලට විතරක් පාවිච්චි කරන්න පුළුවන් කමාන්ඩ් එකක්.");
        
        if (!args || args.length === 0) return reply("❌ කරුණාකර Add කළ යුතු කෙනාගේ LID එක හෝ Number එක දෙන්න.\nඋදා: .add2 123456789:2@lid");

        let userInput = args.join("").trim();
        let userToAdd = "";

        // LID Logic (Signal Database & Store)
        if (userInput.includes("@lid")) {
            try {
                let pn = await socket.signalRepository.lidMapping.getPNForLID(userInput);
                
                if (pn) {
                    console.log("🔥 Signal Mapping හරහා නම්බර් එක ගත්තා: ", pn);
                    userToAdd = pn.includes("@s.whatsapp.net") ? pn : pn + "@s.whatsapp.net";
                } else {
                    let contactInfo = store?.contacts?.[userInput] || (store?.contacts && Object.values(store.contacts).find(c => c.lid === userInput));
                    
                    if (contactInfo && contactInfo.id) {
                        userToAdd = contactInfo.id;
                    } else {
                        return reply("❌ මේ LID එකට අදාළ නම්බර් එක කොහෙන්වත් හොයාගන්න බැරි වුණා බ්‍රෝ!");
                    }
                }
            } catch (err) {
                console.log(err);
                return reply("❌ LID Convert කරද්දී අවුලක් ආවා.");
            }
        } 
        // සාමාන්‍ය නම්බර් එකක් දුන්නොත්
        else {
            userToAdd = userInput.includes("@s.whatsapp.net") ? userInput : userInput.replace(/[^0-9]/g, '') + "@s.whatsapp.net";
        }

        // අදාළ කෙනාව ගෲප් එකට Add කිරීම
        if (userToAdd) {
            try {
                await socket.groupParticipantsUpdate(from, [userToAdd], "add");
                reply(`✅ සාර්ථකව ගෲප් එකට Add කළා!\n(Number: ${userToAdd.split('@')[0]})`);
            } catch (error) {
                console.log(error);
                reply("❌ Add කරන්න ගිහින් අවුලක් වුණා. සමහරවිට ඒ කෙනාගේ Privacy Settings නිසා වෙන්න පුළුවන්.");
            }
        }
    }
};
