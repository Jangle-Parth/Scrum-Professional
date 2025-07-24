const mongoose = require('mongoose');

const dispatchedJobSchema = new mongoose.Schema({
    jobEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobEntry', required: true },
    soNumber: { type: String, required: true },
    customer: { type: String, required: true },
    itemCode: { type: String, required: true },
    particularsAndModels: { type: String, required: true },
    qty: { type: Number, required: true },
    stageAnalysis: [{
        stage: String,
        startDate: Date,
        completedDate: Date,
        duration: Number,
        assignedTo: String,
        remarks: String
    }],
    totalDuration: Number,
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    dispatchedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DispatchedJob', dispatchedJobSchema);