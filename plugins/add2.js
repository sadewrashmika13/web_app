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
            .filter(p => p.admin === 'admin' || p.admin === 'superadmin') 
            .map(p => normalizeJid(p.id));
        
        // Bot ගේ නම්බර් එක
        const botJid = normalizeJid(socket.user.id);
        
        // 🔥 ප්‍රධානම වෙනස: Sender ව හරියටම අල්ලගැනීම 🔥
        // ඔයා බොට්ගේ ෆෝන් එකෙන්ම (Linked Device) මැසේජ් කළොත් ඒක අඳුරගන්නවා
        let actualSender = msg.key.fromMe ? socket.user.id : (msg.key.participant || sender);
        const senderJid = normalizeJid(actualSender);

        // 👑 Owner Check: ඔයාගේ නම්බර්ස් වලට හැමදාම Admin බලය දෙනවා
        const ownerNumbers = ["94769634033", "194601394663437"].map(n => n + "@s.whatsapp.net");
        const isOwner = ownerNumbers.includes(senderJid);

        const isBotAdmins = groupAdmins.includes(botJid);
        // ඇඩ්මින් කෙනෙක් නම් "හෝ" බොට්ගේ Owner නම් කමාන්ඩ් එක වැඩ කරනවා
        const isAdmins = isOwner || groupAdmins.includes(senderJid);

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
