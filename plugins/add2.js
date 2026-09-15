module.exports = {
    name: "add2",
    category: 4, 
    description: "Add a user to the group using LID or normal number.",
    commands: ["add2"], 
    
    handler: async ({ socket, msg, sender, args, reply, store }) => {
        
        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        
        if (!isGroup) return reply("❌ මේ කමාන්ඩ් එක පාවිච්චි කරන්න පුළුවන් ගෲප් වල විතරයි.");

        // 👑 Owner Check (ඔයාගේ Base කෝඩ් එකේ වගේම)
        const actualSender = msg.key.fromMe ? (socket.user?.id || sender) : (msg.key.participant || sender);
        const senderNumber = actualSender ? actualSender.split('@')[0].split(':')[0] : "";
        
        const ownerNumbers = ["94769634033", "194601394663437"];
        const isOwner = ownerNumbers.includes(senderNumber);

        if (!isOwner) return reply("❌ මේ කමාන්ඩ් එක පාවිච්චි කරන්න පුළුවන් Bot Owner ට විතරයි!");
        
        if (!args || args.length === 0) return reply("❌ කරුණාකර Add කළ යුතු කෙනාගේ LID එක හෝ Number එක දෙන්න.\nඋදා: .add2 123456789:2@lid");

        let userInput = args.join("").trim();
        let userToAdd = "";

        // 🔥 LID Logic (Signal Database & Store)
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
        // 🔥 සාමාන්‍ය නම්බර් එකක් දුන්නොත්
        else {
            userToAdd = userInput.includes("@s.whatsapp.net") ? userInput : userInput.replace(/[^0-9]/g, '') + "@s.whatsapp.net";
        }

        // 🔥 අදාළ කෙනාව ගෲප් එකට Add කිරීම (Admin Checks නැතුව කෙලින්ම Action එක දෙනවා) 🔥
        if (userToAdd) {
            try {
                await socket.groupParticipantsUpdate(from, [userToAdd], "add");
                reply(`✅ සාර්ථකව ගෲප් එකට Add කළා!\n(Number: ${userToAdd.split('@')[0]})`);
            } catch (error) {
                console.log(error);
                // බොට් ඇඩ්මින් නැත්තම් WhatsApp Server එකෙන්ම මේ Error එකට පාස් කරනවා
                reply("❌ Add කරන්න ගිහින් අවුලක් වුණා. (මාව Admin කරලා නැති නිසා හෝ අදාළ කෙනාගේ Privacy Settings නිසා වෙන්න පුළුවන්)");
            }
        }
    }
};
