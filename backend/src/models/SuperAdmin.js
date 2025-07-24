// backend/src/models/SuperAdmin.js
const mongoose = require('mongoose');

const superAdminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, default: 'super_admin' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SuperAdmin', superAdminSchema);