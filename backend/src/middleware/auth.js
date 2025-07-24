// backend/src/middleware/auth.js - FIXED VERSION
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');
const SuperAdmin = require('../models/SuperAdmin');

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            // PROBLEM: This was skipping auth entirely!
            // Instead, we should handle session-based auth or require tokens
            return res.status(401).json({ message: 'Access denied. No token provided.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Try to find user in all user types
        let user = await User.findById(decoded.id);
        if (user) {
            user.userType = 'user';
        } else {
            user = await Admin.findById(decoded.id);
            if (user) {
                user.userType = 'admin';
            } else {
                user = await SuperAdmin.findById(decoded.id);
                if (user) {
                    user.userType = 'super_admin';
                }
            }
        }

        if (!user) {
            return res.status(401).json({ message: 'Access denied. User not found.' });
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Access denied. Invalid token.' });
    }
};

module.exports = auth;