const { cmd, commands } = require('../command'); // ඔයාගේ බොට්ගේ base එක අනුව මේක වෙනස් වෙන්න පුළුවන් (උදා: '../lib')

cmd({
    pattern: "add2",
    desc: "Add a user to the group using LID or normal number.",
    category: "group",
    react: "➕",
    use: '.add2 <LID or Number>'
},
async (conn, m, store, { from, text, isGroup, isBotAdmins, isAdmins, reply }) => {
    try {
        // 1. Basic චෙක් කිරීම් ටික
        if (!isGroup) return reply("❌ මේ කමාන්ඩ් එක පාවිච්චි කරන්න පුළුවන් ගෲප් වල විතරයි.");
        if (!isBotAdmins) return reply("❌ කෙනෙක්ව Add කරන්න මාව මුලින්ම ඇඩ්මින් කරන්න!");
        if (!isAdmins) return reply("❌ මේක ගෲප් ඇඩ්මින්ලට විතරක් පාවිච්චි කරන්න පුළුවන් කමාන්ඩ් එකක්.");
        if (!text) return reply("❌ කරුණාකර Add කළ යුතු කෙනාගේ LID එක හෝ Number එක දෙන්න.\nඋදා: .add2 123456789:2@lid");

        let userInput = text.trim();
        let userToAdd = "";

        // 2. LID එකක් දුන්නොත් වැඩ කරන විදිහ
        if (userInput.includes("@lid")) {
            // බොට්ගේ Store එකෙන් (මතකයෙන්) ඇත්ත JID එක හොයනවා
            let contactInfo = store?.contacts?.[userInput] || (store?.contacts && Object.values(store.contacts).find(c => c.lid === userInput));
            
            if (contactInfo && contactInfo.id) {
                userToAdd = contactInfo.id; // ඇත්ත නම්බර් එක හොයාගත්තා
            } else {
                return reply("❌ මේ LID එකට අදාළ ඇත්ත නම්බර් එක මගේ මතකයේ (Store එකේ) නෑ බ්‍රෝ!\nකරුණාකර ඒ කෙනාට බොට් ඉන්න තැනක මැසේජ් එකක් දාන්න කියන්න.");
            }
        } 
        // 3. සාමාන්‍ය නම්බර් එකක් හෝ JID එකක් දුන්නොත්
        else {
            // අකුරු කෑලි අයින් කරලා ඉලක්කම් ටික විතරක් අරන් @s.whatsapp.net එකතු කරනවා
            userToAdd = userInput.includes("@s.whatsapp.net") ? userInput : userInput.replace(/[^0-9]/g, '') + "@s.whatsapp.net";
        }

        // 4. අදාළ කෙනාව ගෲප් එකට Add කිරීම
        if (userToAdd) {
            await conn.groupParticipantsUpdate(from, [userToAdd], "add");
            reply(`✅ සාර්ථකව ගෲප් එකට Add කළා!\n(Number: ${userToAdd.split('@')[0]})`);
        }

    } catch (e) {
        console.log(e);
        reply("❌ Add කරන්න ගිහින් අවුලක් වුණා: " + e.message);
    }
});
