const mongoose = require('mongoose');

const jobEntrySchema = new mongoose.Schema({
    month: { type: String, required: true },
    team: { type: String },
    soNumber: { type: String, required: true },
    customer: { type: String, required: true },
    itemCode: { type: String, required: true },
    particularsAndModels: { type: String, required: true },
    qty: { type: Number, required: true },
    week: { type: Number, required: true },
    status: {
        type: String,
        enum: [
            'sales_order_received',
            'drawing_approved',
            'long_lead_item_details_given',
            'drawing_bom_issued',
            'production_order_purchase_request_prepared',
            'rm_received',
            'production_started',
            'production_completed',
            'qc_clear_for_dispatch',
            'dispatch_clearance',
            'dispatched',
            'hold',
            'so_cancelled'
        ],
        default: 'sales_order_received'
    },
    currentDepartment: { type: String },
    assignedUsername: String,
    holdReason: { type: String },
    cancelReason: { type: String },
    holdDate: { type: Date },
    cancelDate: { type: Date },
    stageHistory: [{
        stage: String,
        timestamp: { type: Date, default: Date.now },
        changedBy: String,
        completedAt: Date,
        remarks: String,
        department: String
    }],
    customFields: [{
        fieldName: String,
        fieldValue: String
    }],
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('JobEntry', jobEntrySchema);