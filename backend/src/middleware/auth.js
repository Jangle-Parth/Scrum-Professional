const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');
const SuperAdmin = require('../models/SuperAdmin');

const auth = async (req, res, next) => {
    try {
        // Skip auth for certain routes or if no token is expected
        const authHeader = req.header('Authorization');

        if (!authHeader) {
            // For backwards compatibility, allow access without token for now
            // In production, you should require authentication
            console.log('No authorization header found, allowing access');
            return next();
        }

        const token = authHeader.replace('Bearer ', '');

        if (!token) {
            console.log('No token found in authorization header');
            return next(); // Allow access for now
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key');

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

            if (user) {
                req.user = user;
            }
        } catch (jwtError) {
            console.log('JWT verification failed:', jwtError.message);
        }

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        next(); // Continue without auth for now
    }
};

module.exports = auth;