module.exports = {
    name: "add2",
    category: 4, // Admin Menu / Group Menu
    description: "Add a user to the group using LID or normal number.",
    commands: ["add2"], 
    
    handler: async ({ socket, msg, sender, command, args, reply, store }) => {
        
        // 1. Basic Group & Admin Checks (අතින්ම Check කිරීම)
        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        
        if (!isGroup) return reply("❌ මේ කමාන්ඩ් එක පාවිච්චි කරන්න පුළුවන් ගෲප් වල විතරයි.");

        // Group එකේ ඇඩ්මින්ලා කවුද කියලා හොයාගැනීම
        const groupMetadata = await socket.groupMetadata(from);
        const groupAdmins = groupMetadata.participants.filter(p => p.admin !== null).map(p => p.id);
        
        // Bot ගේ සහ කමාන්ඩ් එක ගහන කෙනාගේ Admin බලතල බැලීම
        const botNumber = socket.user.id.split(':')[0] + '@s.whatsapp.net';
        const isBotAdmins = groupAdmins.includes(botNumber);
        const isAdmins = groupAdmins.includes(sender);

        if (!isBotAdmins) return reply("❌ කෙනෙක්ව Add කරන්න මාව මුලින්ම ඇඩ්මින් කරන්න!");
        if (!isAdmins) return reply("❌ මේක ගෲප් ඇඩ්මින්ලට විතරක් පාවිච්චි කරන්න පුළුවන් කමාන්ඩ් එකක්.");
        
        if (!args || args.length === 0) return reply("❌ කරුණාකර Add කළ යුතු කෙනාගේ LID එක හෝ Number එක දෙන්න.\nඋදා: .add2 123456789:2@lid");

        // 2. Input එක සකස් කිරීම
        let userInput = args.join("").trim();
        let userToAdd = "";

        // 3. LID එකක් දුන්නොත් වැඩ කරන විදිහ
        if (userInput.includes("@lid")) {
            // බොට්ගේ Store එකෙන් (මතකයෙන්) ඇත්ත JID එක හොයනවා
            let contactInfo = store?.contacts?.[userInput] || (store?.contacts && Object.values(store.contacts).find(c => c.lid === userInput));
            
            if (contactInfo && contactInfo.id) {
                userToAdd = contactInfo.id; // ඇත්ත නම්බර් එක හොයාගත්තා
            } else {
                return reply("❌ මේ LID එකට අදාළ ඇත්ත නම්බර් එක මගේ මතකයේ (Store එකේ) නෑ බ්‍රෝ!\nකරුණාකර ඒ කෙනාට බොට් ඉන්න තැනක මැසේජ් එකක් දාන්න කියන්න.");
            }
        } 
        // 4. සාමාන්‍ය නම්බර් එකක් හෝ JID එකක් දුන්නොත්
        else {
            // අකුරු කෑලි අයින් කරලා ඉලක්කම් ටික විතරක් අරන් @s.whatsapp.net එකතු කරනවා
            userToAdd = userInput.includes("@s.whatsapp.net") ? userInput : userInput.replace(/[^0-9]/g, '') + "@s.whatsapp.net";
        }

        // 5. අදාළ කෙනාව ගෲප් එකට Add කිරීම
        if (userToAdd) {
            try {
                await socket.groupParticipantsUpdate(from, [userToAdd], "add");
                reply(`✅ සාර්ථකව ගෲප් එකට Add කළා!\n(Number: ${userToAdd.split('@')[0]})`);
            } catch (error) {
                console.log(error);
                reply("❌ Add කරන්න ගිහින් අවුලක් වුණා. සමහරවිට ඒ කෙනාගේ Privacy Settings නිසා කෙලින්ම Add කරන්න බැරි වෙන්න පුළුවන්.");
            }
        }
    }
};
