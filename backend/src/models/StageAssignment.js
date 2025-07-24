const mongoose = require('mongoose');

const stageAssignmentSchema = new mongoose.Schema({
    stage: { type: String, required: true },
    assignedUsername: { type: String, required: true },
    taskTitle: { type: String, required: true },
    taskDescription: String,
    isActive: { type: Boolean, default: true },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('StageAssignment', stageAssignmentSchema);
