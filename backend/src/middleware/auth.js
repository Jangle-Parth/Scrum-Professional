const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');
const SuperAdmin = require('../models/SuperAdmin');

// CONSISTENT SECRET
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-12345';

const auth = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');

        if (!authHeader) {
            console.log('No authorization header found, allowing access');
            return next();
        }

        const token = authHeader.replace('Bearer ', '');

        if (!token) {
            console.log('No token found in authorization header');
            return next();
        }

        try {
            // FIXED: Use consistent secret
            const decoded = jwt.verify(token, JWT_SECRET);

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
            // OPTIONAL: Clear invalid tokens on client side
            if (jwtError.message === 'invalid signature') {
                console.log('Invalid signature detected - token may be from different secret');
            }
        }

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        next();
    }
};

module.exports = auth;