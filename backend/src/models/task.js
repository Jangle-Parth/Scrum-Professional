const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedToName: String,

    middleLevelValidator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    middleLevelValidatorName: String,
    needsMiddleLevelValidation: { type: Boolean, default: false },
    middleLevelValidationStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'not_required'],
        default: 'not_required'
    },
    middleLevelValidatedBy: String,
    middleLevelValidatedAt: Date,

    parentTask: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
    parentTaskName: String,
    soNumber: String, // For grouping daily job entry tasks
    stage: String,

    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedByName: String,
    isPrivate: { type: Boolean, default: false }, // For self-assigned tasks
    isSuperAdminTask: { type: Boolean, default: false }, // Only visible to super admin and assignee
    visibleTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    attachedDocument: {
        filename: String,
        originalName: String,
        mimeType: String,
        size: Number,
        uploadDate: { type: Date, default: Date.now },
        data: Buffer // Store file in MongoDB
    },

    delayRequests: [{
        requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        requestedByName: String,
        requestDate: { type: Date, default: Date.now },
        currentDueDate: Date,
        requestedDueDate: Date,
        reason: String,
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        },
        reviewedBy: String,
        reviewedAt: Date,
        reviewComments: String
    }],

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