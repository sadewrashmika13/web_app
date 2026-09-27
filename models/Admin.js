const mongoose = require('mongoose');

const AdminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'sub_admin' },
    
    // 🔥 අලුතින් එකතු කරපු SaaS Fields ටික 🔥
    bot_number: { type: String, default: '94705236759' }, // ඔයාගේ Default නම්බර් එක
    group_jid: { type: String, default: '120363425721300928@g.us' }, // Default Group එක
    footer_text: { type: String, default: 'Sadew Web Sender' }
});

module.exports = mongoose.models.Admin || mongoose.model('Admin', AdminSchema);
