module.exports = {
    name: "add2",
    category: 4, 
    description: "Add multiple users to the group with a 15s delay.",
    commands: ["add2"], 
    
    handler: async ({ socket, msg, args, reply, store }) => {
        
        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        
        if (!isGroup) return reply("❌ මේ කමාන්ඩ් එක පාවිච්චි කරන්න පුළුවන් ගෲප් වල විතරයි.");

        if (!args || args.length === 0) return reply("❌ කරුණාකර Add කළ යුතු නම්බර්ස් කොමාවෙන් (,) වෙන් කර දෙන්න.\nඋදා: .add2 9477..., 9471..., 1234:2@lid");

        // 🔥 තත්පර ගාණක් රඳවාගන්නා (Delay) ෆන්ක්ෂන් එක 🔥
        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        // කොමාවෙන් (,) නම්බර්ස් ටික වෙන් කරලා Array එකකට ගන්නවා
        let inputList = args.join("").split(",");
        
        let successCount = 0;
        let failCount = 0;

        await reply(`⏳ නම්බර්ස්/LIDs ${inputList.length} ක් Add කිරීම ආරම්භ කරනවා.\n(එකක් Add වී තත්පර 15කට පසුව ඊළඟ එක Add වේ. කරුණාකර රැඳී සිටින්න...)`);

        // එකින් එක Add කරන Loop එක
        for (let i = 0; i < inputList.length; i++) {
            let userInput = inputList[i].trim();
            if (!userInput) continue; // හිස් නම්බර්ස් මඟ හරිනවා

            let userToAdd = "";

            // LID Logic (Signal Database & Store)
            if (userInput.includes("@lid")) {
                try {
                    let pn = await socket.signalRepository.lidMapping.getPNForLID(userInput);
                    if (pn) {
                        userToAdd = pn.includes("@s.whatsapp.net") ? pn : pn + "@s.whatsapp.net";
                    } else {
                        let contactInfo = store?.contacts?.[userInput] || (store?.contacts && Object.values(store.contacts).find(c => c.lid === userInput));
                        if (contactInfo && contactInfo.id) {
                            userToAdd = contactInfo.id;
                        }
                    }
                } catch (err) {
                    console.log(err);
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
                    successCount++;
                    console.log(`✅ Add කළා: ${userToAdd}`);
                } catch (error) {
                    console.log(`❌ Add කරන්න බැරි වුණා: ${userToAdd}`);
                    failCount++;
                }
            } else {
                failCount++;
            }

            // අන්තිම නම්බර් එක නෙමෙයි නම්, තත්පර 15ක (15000ms) විරාමයක් ගන්නවා
            if (i < inputList.length - 1) {
                await sleep(15000);
            }
        }

        // වැඩේ ඉවර වුණාම සම්පූර්ණ රිපෝට් එක යවනවා
        reply(`✅ සම්පූර්ණයි!\n\n🟢 සාර්ථකව Add කළ ගණන: ${successCount}\n🔴 අසමත් වූ ගණන: ${failCount}`);
    }
};
