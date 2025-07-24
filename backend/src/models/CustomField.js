const mongoose = require('mongoose');

const customFieldSchema = new mongoose.Schema({
    fieldName: { type: String, required: true },
    fieldType: { type: String, enum: ['text', 'number', 'date', 'dropdown'], default: 'text' },
    dropdownOptions: [String],
    isActive: { type: Boolean, default: true },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CustomField', customFieldSchema);