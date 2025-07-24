// src/routes/auth.js
const express = require('express');
const Admin = require('../models/Admin');
const User = require('../models/User');

const router = express.Router();

// Login route
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Check if admin login
        const admin = await Admin.findOne({ username });
        if (admin && admin.password === password) {
            return res.json({
                success: true,
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
            return res.json({
                success: true,
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