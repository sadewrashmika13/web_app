module.exports = {
    name: "add2",
    category: 4, 
    description: "Add a user to the group using LID or normal number.",
    commands: ["add2"], 
    
    handler: async ({ socket, msg, sender, args, reply, store }) => {
        
        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        
        if (!isGroup) return reply("❌ මේ කමාන්ඩ් එක පාවිච්චි කරන්න පුළුවන් ගෲප් වල විතරයි.");

        // 🟢 ADMIN CHECKS (FOOLPROOF METHOD) 🟢
        const groupMetadata = await socket.groupMetadata(from);
        
        // Bot ගේ සහ මැසේජ් යවපු කෙනාගේ පිරිසිදු නම්බර්ස් විතරක් ගන්නවා
        const botBase = (socket.user?.id || socket.user?.jid || "").split('@')[0].split(':')[0];
        const senderBase = (sender || msg.key.participant || msg.key.remoteJid || "").split('@')[0].split(':')[0];

        // ඇඩ්මින් කෙනෙක්ද කියලා බලනවා (නියම නම්බර් එක ලිස්ට් එකේ කොහේ හරි තියෙනවද කියලා)
        const isBotAdmins = groupMetadata.participants.some(p => 
            (p.admin === 'admin' || p.admin === 'superadmin') && p.id.includes(botBase)
        );
        
        const isAdmins = groupMetadata.participants.some(p => 
            (p.admin === 'admin' || p.admin === 'superadmin') && p.id.includes(senderBase)
        );

        // ⚠️ තවමත් "මාව ඇඩ්මින් කරන්න" කියලා එනවා නම්, මේ යට පේළිය මකලා දාන්න (නැත්නම් ඉස්සරහින් // දාන්න).
        if (!isBotAdmins) return reply("❌ කෙනෙක්ව Add කරන්න මාව මුලින්ම ඇඩ්මින් කරන්න!");
        
        if (!isAdmins) return reply("❌ මේක ගෲප් ඇඩ්මින්ලට විතරක් පාවිච්චි කරන්න පුළුවන් කමාන්ඩ් එකක්.");
        
        if (!args || args.length === 0) return reply("❌ කරුණාකර Add කළ යුතු කෙනාගේ LID එක හෝ Number එක දෙන්න.\nඋදා: .add2 123456789@lid");

        let userInput = args.join("").trim();
        let userToAdd = "";

        // 🟢 LID එකක් දුන්නොත් වැඩ කරන අලුත්ම විදිහ (HUNTER's Method) 🟢
        if (userInput.includes("@lid")) {
            try {
                // 1. මුලින්ම Signal Protocol එකෙන් කෙලින්ම ගන්න ට්‍රයි කරනවා!
                let pn = await socket.signalRepository.lidMapping.getPNForLID(userInput);
                
                if (pn) {
                    console.log("🔥 Signal Mapping හරහා නම්බර් එක ගත්තා: ", pn);
                    userToAdd = pn.includes("@s.whatsapp.net") ? pn : pn + "@s.whatsapp.net";
                } else {
                    // 2. ඒක වැඩ කරේ නැත්තම් විතරක් Store එකෙන් හොයනවා
                    let contactInfo = store?.contacts?.[userInput] || (store?.contacts && Object.values(store.contacts).find(c => c.lid === userInput));
                    
                    if (contactInfo && contactInfo.id) {
                        userToAdd = contactInfo.id;
                        console.log("✅ Store එක හරහා නම්බර් එක ගත්තා.");
                    } else {
                        return reply("❌ මේ LID එකට අදාළ නම්බර් එක කොහෙන්වත් හොයාගන්න බැරි වුණා බ්‍රෝ!");
                    }
                }
            } catch (err) {
                console.log(err);
                return reply("❌ LID Convert කරද්දී අවුලක් ආවා.");
            }
        } 
        // 🟢 සාමාන්‍ය නම්බර් එකක් දුන්නොත් 🟢
        else {
            userToAdd = userInput.includes("@s.whatsapp.net") ? userInput : userInput.replace(/[^0-9]/g, '') + "@s.whatsapp.net";
        }

        // 🟢 අදාළ කෙනාව ගෲප් එකට Add කිරීම 🟢
        if (userToAdd) {
            try {
                await socket.groupParticipantsUpdate(from, [userToAdd], "add");
                reply(`✅ සාර්ථකව ගෲප් එකට Add කළා!\n(Number: ${userToAdd.split('@')[0]})`);
            } catch (error) {
                console.log(error);
                reply("❌ Add කරන්න ගිහින් අවුලක් වුණා. සමහරවිට Privacy Settings නිසා වෙන්න පුළුවන්.");
            }
        }
    }
};
