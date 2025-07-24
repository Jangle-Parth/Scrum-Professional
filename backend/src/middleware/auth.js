const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            // For now, we'll skip auth since the original code doesn't use JWT
            // In production, you should implement proper authentication
            return next();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Try to find user or admin
        let user = await User.findById(decoded.id);
        if (!user) {
            user = await Admin.findById(decoded.id);
            if (user) {
                user.role = 'admin';
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