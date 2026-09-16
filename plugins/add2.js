module.exports = {
    name: "add2",
    category: 4, 
    description: "Add multiple users with Human Mode (34s initial delay).",
    commands: ["add2"], 
    
    handler: async ({ socket, msg, args, reply, store }) => {
        
        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        
        if (!isGroup) return reply("❌ මේ කමාන්ඩ් එක ගෲප් වල විතරයි පාවිච්චි කරන්න පුළුවන්.");
        if (!args || args.length === 0) return reply("❌ කරුණාකර නම්බර්ස්/LIDs ලබා දෙන්න.");

        // නම්බර්ස් ටික Array එකකට ගැනීම
        let inputList = args.join("").split(",");
        
        // Anti-Crash Lock (එකපාර 20කට වඩා දාන්න බැරි වෙන්න)
        if (inputList.length > 20) {
            return reply("❌ එකපාර ගොඩක් දුන්නොත් බොට් ලොග් අවුට් වෙනවා බ්‍රෝ! කරුණාකර උපරිම 20 ගාණේ කඩලා දෙන්න.");
        }

        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        const getRandomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

        // 🔥 1. මුලින්ම රිප්ලයි මැසේජ් එක දානවා
        await reply(`⏳ නම්බර්ස් ${inputList.length} ක් Add කිරීම ආරම්භ කරනවා... \n(🛡️ ආරක්ෂාව සඳහා පළමු කෙනාව Add වීමට තත්පර 34ක් ගතවේ. කරුණාකර රැඳී සිටින්න...)`);

        // 🔥 2. හරියටම තත්පර 34ක (34000ms) Delay එකක් පළවෙනි කෙනාව Add කරන්න කලින් දෙනවා
        console.log("⏳ මැසේජ් එක දැම්මා, පළවෙනි කෙනාව Add කරන්න තත්පර 34ක් බලන් ඉන්නවා...");
        await sleep(34000);

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < inputList.length; i++) {
            let userInput = inputList[i].trim();
            if (!userInput) continue;

            let userToAdd = "";

            if (userInput.includes("@lid")) {
                try {
                    let pn = await socket.signalRepository.lidMapping.getPNForLID(userInput);
                    if (pn) {
                        userToAdd = pn.includes("@s.whatsapp.net") ? pn : pn + "@s.whatsapp.net";
                    } else {
                        let contactInfo = store?.contacts?.[userInput] || (store?.contacts && Object.values(store.contacts).find(c => c.lid === userInput));
                        if (contactInfo && contactInfo.id) userToAdd = contactInfo.id;
                    }
                } catch (err) { console.log(err); }
            } else {
                userToAdd = userInput.includes("@s.whatsapp.net") ? userInput : userInput.replace(/[^0-9]/g, '') + "@s.whatsapp.net";
            }

            if (userToAdd) {
                try {
                    await socket.groupParticipantsUpdate(from, [userToAdd], "add");
                    successCount++;
                    console.log(`✅ Add කළා: ${userToAdd}`);
                } catch (error) {
                    failCount++;
                    console.log(`❌ Add කරන්න බැරි වුණා: ${userToAdd}`);
                }
            } else {
                failCount++;
            }

            // අන්තිම කෙනා නෙමෙයි නම්, ඊළඟ අයටත් තත්පර 30-60 අතර Random කාලයක් ගන්නවා
            if (i < inputList.length - 1) {
                let delay = getRandomDelay(30000, 60000); 
                console.log(`⏳ ඊළඟ කෙනාට කලින් තත්පර ${delay/1000} ක් බලන් ඉන්නවා...`);
                await sleep(delay);
            }
        }

        reply(`✅ බැච් එක සම්පූර්ණයි!\n🟢 සාර්ථක: ${successCount}\n🔴 අසාර්ථක: ${failCount}`);
    }
};
