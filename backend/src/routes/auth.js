// src/routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
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

        console.log(`Login attempt: ${username}`);

        // Check super admin first
        const superAdmin = await SuperAdmin.findOne({ username });
        if (superAdmin && superAdmin.password === password) {
            const token = generateToken(superAdmin, 'super_admin');
            console.log(`✅ Super Admin login successful: ${username}`);
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

        // Check admin
        const admin = await Admin.findOne({ username });
        if (admin && admin.password === password) {
            const token = generateToken(admin, 'admin');
            console.log(`✅ Admin login successful: ${username}`);
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

        // Check regular user
        const user = await User.findOne({ username, status: 'active' });
        if (user && user.password === password) {
            const token = generateToken(user, 'user');
            console.log(`✅ User login successful: ${username}`);
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

        console.log(`❌ Login failed for: ${username}`);
        res.status(400).json({ message: 'Invalid credentials' });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.get('/me', async (req, res) => {
    try {
        const authHeader = req.header('Authorization');
        if (!authHeader) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

        let user;
        if (decoded.userType === 'super_admin') {
            user = await SuperAdmin.findById(decoded.id);
        } else if (decoded.userType === 'admin') {
            user = await Admin.findById(decoded.id);
        } else {
            user = await User.findById(decoded.id);
        }

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            id: user._id,
            username: user.username,
            email: user.email,
            name: user.name,
            role: user.role || decoded.userType
        });
    } catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
});

module.exports = router;