module.exports = {
    name: "getjid",
    category: "utility",
    description: "ඔයාගේ WhatsApp ID (JID/LID) එක ලබාගැනීම",
    commands: ["lid"],
    
    handler: async ({ socket, msg, sender, reply }) => {
        // මැසේජ් එක එවපු කෙනාගේ හරියටම ID එක (LID හෝ JID) අල්ලගැනීම
        const actualSender = msg.key.participant || msg.key.remoteJid || sender || "";

        // මැසේජ් එක හැදීම
        const replyText = `📌 *ඔයාගේ WhatsApp ID එක:*\n\n\`${actualSender}\`\n\n> 💡 _Premium ලබාගැනීමට, කරුණාකර ඉහත සම්පූර්ණ අංකය කොපි කර Admin වෙත යවන්න._`;

        // ඒ අංකයත් එක්ක Reply කිරීම
        await reply(replyText);
    }
};
