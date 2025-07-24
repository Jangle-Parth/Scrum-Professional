// src/routes/auth.js
const express = require('express');
const Admin = require('../models/Admin');
const User = require('../models/User');
const SuperAdmin = require('../models/SuperAdmin');

const initializeSuperAdmin = async () => {
    try {
        const existingSuperAdmin = await SuperAdmin.findOne({ username: 'super-admin' });
        if (!existingSuperAdmin) {
            await SuperAdmin.create({
                username: 'super-admin',
                password: 'super-admin123',
                email: 'ghanshyam@ashtavinayaka.com',
                name: 'Super Administrator'
            });
            console.log('Super Admin initialized');
        }
    } catch (error) {
        console.error('Error initializing super admin:', error);
    }
};

// Initialize on module load
initializeSuperAdmin();

const router = express.Router();

const generateToken = (user, userType) => {
    return jwt.sign(
        {
            id: user._id,
            username: user.username,
            userType: userType
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
    );
};

// Login route
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const superAdmin = await SuperAdmin.findOne({ username });
        if (superAdmin && superAdmin.password === password) {
            const token = generateToken(superAdmin, 'super_admin');
            return res.json({
                success: true,
                token: token,
                user: {
                    id: superAdmin._id,
                    username: superAdmin.username,
                    email: superAdmin.email,
                    name: superAdmin.name,
                    role: 'super_admin'
                }
            });
        }

        // Check if admin login
        const admin = await Admin.findOne({ username });
        if (admin && admin.password === password) {
            const token = generateToken(admin, 'admin');
            return res.json({
                success: true,
                token: token,
                user: {
                    id: admin._id,
                    username: admin.username,
                    email: admin.email,
                    name: admin.name,
                    role: 'admin'
                }
            });
        }

        // Check if user login
        const user = await User.findOne({ username, status: 'active' });
        if (user && user.password === password) {
            const token = generateToken(user, 'user');
            return res.json({
                success: true,
                token: token,
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    name: user.name,
                    role: user.role
                }
            });
        }

        res.status(400).json({ message: 'Invalid credentials' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;