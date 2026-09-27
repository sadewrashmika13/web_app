const mongoose = require('mongoose');

const AdminSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true, 
        unique: true 
    },
    password: { 
        type: String, 
        required: true 
    },
    role: { 
        type: String, 
        default: 'sub_admin' 
    }
});

module.exports = mongoose.models.Admin || mongoose.model('Admin', AdminSchema);
