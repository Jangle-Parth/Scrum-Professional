// Enhanced UserTask.js Model (replace your existing UserTask.js)
const mongoose = require('mongoose');

const userTaskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedToName: String,
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedByName: String,

    // Privacy for self-assigned tasks
    isPrivate: { type: Boolean, default: false },

    // Multiple assignees support
    visibleTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Document attachment
    attachedDocument: {
        filename: String,
        originalName: String,
        mimeType: String,
        size: Number,
        uploadDate: { type: Date, default: Date.now },
        data: Buffer
    },

    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'cancelled'],
        default: 'pending'
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    dueDate: { type: Date, required: true },
    completedAt: Date,
    isOnTime: { type: Boolean, default: null },
    notes: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Add indexes
userTaskSchema.index({ assignedTo: 1, status: 1 });
userTaskSchema.index({ assignedBy: 1 });
userTaskSchema.index({ isPrivate: 1 });

module.exports = mongoose.model('UserTask', userTaskSchema);