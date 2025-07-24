const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedToName: String,
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'cancelled', 'pending_approval'],
        default: 'pending'
    },
    completionRequestDate: Date,
    requestedBy: String,
    requestedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedBy: String,
    approvedAt: Date,
    remarks: String,
    progress: { type: Number, default: 0, min: 0, max: 100 },
    dueDate: { type: Date, required: true },
    completedAt: Date,
    isOnTime: { type: Boolean, default: null },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Task', taskSchema);