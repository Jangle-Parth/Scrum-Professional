const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    username: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, required: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    createdAt: { type: Date, default: Date.now }
});

userSchema.methods.toPublicJSON = function () {
    return {
        id: this._id,
        name: this.name,
        username: this.username,
        email: this.email,
        role: this.role,
        status: this.status
    };
};

userSchema.statics.findActiveUsers = function (adminId) {
    return this.find({ adminId, status: 'active' }).sort({ name: 1 });
};

module.exports = mongoose.model('User', userSchema);
