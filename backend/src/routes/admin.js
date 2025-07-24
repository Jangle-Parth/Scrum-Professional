// src/routes/admin.js
const express = require('express');
const multer = require('multer');
const Admin = require('../models/Admin');
const SuperAdmin = require('../models/SuperAdmin');
const User = require('../models/User');
const Task = require('../models/Task');
const UserTask = require('../models/UserTask');
const DispatchedJob = require('../models/DispatchedJob');
const StageAssignment = require('../models/StageAssignment');
const CustomField = require('../models/CustomField');
const Activity = require('../models/Activity');

const JobEntry = require('../models/JobEntry');

const activityService = require('../services/activityService');
const emailService = require('../services/emailService');
const jobService = require('../services/jobService');

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        // Allow common file types
        const allowedTypes = /jpeg|jpg|png|pdf|doc|docx|txt|xlsx|xls/;
        const extname = allowedTypes.test(file.originalname.toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});


// Notification count
router.get('/notification-count', async (req, res) => {
    try {
        let admin = await Admin.findOne();
        if (!admin) {
            return res.json({ pendingApprovals: 0 });
        }

        const pendingApprovals = await Task.countDocuments({
            adminId: admin._id,
            status: 'pending_approval'
        });

        res.json({ pendingApprovals });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Recent activity
router.get('/recent-activity', async (req, res) => {
    try {
        let admin = await Admin.findOne();
        if (!admin) {
            return res.json([]);
        }

        const activities = await activityService.getRecentActivity(admin._id);
        res.json(activities);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Users management
router.get('/users', async (req, res) => {
    try {
        let admin = await Admin.findOne();
        if (!admin) {
            return res.json([]);
        }

        const users = await User.find({ adminId: admin._id }).sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.post('/users', async (req, res) => {
    try {
        let admin = await Admin.findOne();
        if (!admin) {
            admin = await Admin.create({
                username: 'admin',
                password: 'admin123',
                email: 'admin@scrumflow.com',
                name: 'System Admin'
            });
        }

        const userData = { ...req.body, adminId: admin._id };
        const user = new User(userData);
        await user.save();

        await activityService.logActivity(
            admin._id,
            'create',
            'user',
            user._id,
            `Created user: ${user.name}`
        );

        res.status(201).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.put('/users/:id', async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const admin = await Admin.findOne();
        await activityService.logActivity(
            admin._id,
            'update',
            'user',
            user._id,
            `Updated user: ${user.name}`
        );

        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.delete('/users/:id', async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const admin = await Admin.findOne();
        await activityService.logActivity(
            admin._id,
            'delete',
            'user',
            user._id,
            `Deleted user: ${user.name}`
        );

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.post('/tasks', upload.single('document'), async (req, res) => {
    try {
        let admin = await Admin.findOne();
        let superAdmin = null;

        // Check if current user is super admin
        if (req.body.createdBy && req.body.createdBy.role === 'super_admin') {
            superAdmin = await SuperAdmin.findById(req.body.createdBy.id);
        }

        if (!admin && !superAdmin) {
            admin = await Admin.create({
                username: 'admin',
                password: 'admin123',
                email: 'planning@ashtavinayaka.com',
                name: 'System Admin'
            });
        }

        const taskData = {
            ...req.body,
            adminId: admin ? admin._id : superAdmin._id,
        };

        // Handle multiple assignees
        if (req.body.assignedToMultiple) {
            const assignees = JSON.parse(req.body.assignedToMultiple);
            taskData.visibleTo = assignees;
            taskData.assignedTo = assignees[0]; // Primary assignee
        }

        // Handle middle level validation
        if (req.body.middleLevelValidator) {
            taskData.needsMiddleLevelValidation = true;
            taskData.middleLevelValidationStatus = 'pending';
        }

        // Handle privacy settings
        if (req.body.assignedBy === req.body.assignedTo) {
            taskData.isPrivate = true;
        }

        if (superAdmin) {
            taskData.isSuperAdminTask = true;
        }

        // Handle file upload
        if (req.file) {
            taskData.attachedDocument = {
                filename: Date.now() + '_' + req.file.originalname,
                originalName: req.file.originalname,
                mimeType: req.file.mimetype,
                size: req.file.size,
                data: req.file.buffer
            };
        }

        // Handle parent task grouping for job entries
        if (req.body.soNumber && req.body.stage) {
            // Find or create parent task
            let parentTask = await Task.findOne({
                soNumber: req.body.soNumber,
                parentTask: null,
                adminId: taskData.adminId
            });

            if (!parentTask) {
                parentTask = new Task({
                    title: `${req.body.soNumber} - Daily Job Tasks`,
                    description: `Parent task for all tasks related to SO# ${req.body.soNumber}`,
                    assignedTo: taskData.assignedTo,
                    soNumber: req.body.soNumber,
                    priority: 'medium',
                    dueDate: taskData.dueDate,
                    adminId: taskData.adminId,
                    status: 'pending'
                });
                await parentTask.save();
            }

            taskData.parentTask = parentTask._id;
            taskData.parentTaskName = parentTask.title;
        }

        const task = new Task(taskData);
        await task.save();

        // If multiple assignees, create individual tasks for each
        if (req.body.assignedToMultiple && JSON.parse(req.body.assignedToMultiple).length > 1) {
            const assignees = JSON.parse(req.body.assignedToMultiple);
            const additionalTasks = [];

            for (let i = 1; i < assignees.length; i++) {
                const additionalTaskData = { ...taskData };
                additionalTaskData.assignedTo = assignees[i];
                additionalTaskData._id = undefined;

                const additionalTask = new Task(additionalTaskData);
                await additionalTask.save();
                additionalTasks.push(additionalTask);
            }
        }

        res.status(201).json({
            success: true,
            task,
            message: 'Task created successfully!'
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get tasks with enhanced filtering for privacy
router.get('/tasks', async (req, res) => {
    try {
        let admin = await Admin.findOne();
        const currentUser = req.query.currentUser ? JSON.parse(req.query.currentUser) : null;

        if (!admin) {
            return res.json([]);
        }

        let query = { adminId: admin._id };

        // Apply privacy filters
        if (currentUser) {
            if (currentUser.role === 'super_admin') {
                // Super admin sees all tasks
            } else if (currentUser.role === 'admin') {
                // Admin doesn't see super admin tasks or private tasks
                query.$and = [
                    { isSuperAdminTask: { $ne: true } },
                    { isPrivate: { $ne: true } }
                ];
            } else {
                // Regular users only see tasks assigned to them or tasks they created
                query.$or = [
                    { assignedTo: currentUser.id },
                    { assignedBy: currentUser.id },
                    { visibleTo: currentUser.id }
                ];
            }
        }

        // Handle existing filters
        const { filter, status, priority, completed } = req.query;

        if (completed === 'true') {
            query.status = 'completed';
        } else if (completed === 'false') {
            query.status = { $ne: 'completed' };
        }

        if (status) {
            if (status === 'overdue') {
                const today = new Date();
                today.setHours(23, 59, 59, 999); // End of today
                query.status = { $in: ['pending', 'in_progress'] };
                query.dueDate = { $lt: today };
            } else {
                query.status = status;
            }
        }

        if (priority) {
            query.priority = priority;
        }

        const tasks = await Task.find(query)
            .populate('assignedTo', 'name')
            .populate('middleLevelValidator', 'name')
            .populate('parentTask', 'title')
            .sort({
                status: 1,
                dueDate: 1,
                createdAt: -1
            });

        const tasksWithNames = tasks.map(task => ({
            ...task.toObject(),
            assignedToName: task.assignedTo ? task.assignedTo.name : 'Unassigned',
            middleLevelValidatorName: task.middleLevelValidator ? task.middleLevelValidator.name : null
        }));

        res.json(tasksWithNames);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.get('/tasks/:id', async (req, res) => {
    try {
        const task = await Task.findById(req.params.id)
            .populate('assignedTo', 'name email')
            .populate('requestedById', 'name email');

        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        const taskWithNames = {
            ...task.toObject(),
            assignedToName: task.assignedTo ? task.assignedTo.name : 'Unassigned'
        };

        res.json(taskWithNames);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.put('/tasks/:id', async (req, res) => {
    try {
        const updateData = { ...req.body, updatedAt: new Date() };

        if (req.body.status === 'completed') {
            updateData.completedAt = new Date();
            updateData.progress = 100;

            const task = await Task.findById(req.params.id);
            if (task) {
                updateData.isOnTime = new Date() <= new Date(task.dueDate);
            }
        }

        if (req.body.assignedTo) {
            const assignedUser = await User.findById(req.body.assignedTo);
            updateData.assignedToName = assignedUser ? assignedUser.name : 'Unassigned';
        }

        const task = await Task.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        const admin = await Admin.findOne();
        await activityService.logActivity(
            admin._id,
            'update',
            'task',
            task._id,
            `Updated task: ${task.title}`
        );

        res.json(task);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.delete('/tasks/:id', async (req, res) => {
    try {
        const task = await Task.findByIdAndDelete(req.params.id);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }


        const admin = await Admin.findOne();
        await activityService.logActivity(
            admin._id,
            'delete',
            'task',
            task._id,
            `Deleted task: ${task.title}`
        );

        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.get('/analytics', async (req, res) => {
    try {
        let admin = await Admin.findOne();
        if (!admin) {
            return res.json({
                completedOnTime: 0,
                completedLate: 0,
                completionRate: 0,
                pendingApprovals: 0,
                topPerformer: 'N/A',
                userPerformance: []
            });
        }

        const completedTasks = await Task.find({
            adminId: admin._id,
            status: 'completed'
        }).populate('assignedTo', 'name');

        const completedOnTime = completedTasks.filter(task => task.isOnTime === true).length;
        const completedLate = completedTasks.filter(task => task.isOnTime === false).length;

        const totalTasks = await Task.countDocuments({ adminId: admin._id });
        const completionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

        const pendingApprovals = await Task.countDocuments({
            adminId: admin._id,
            status: 'pending_approval'
        });

        // Calculate user performance
        const users = await User.find({ adminId: admin._id, status: 'active' });
        const userPerformance = [];

        for (const user of users) {
            const userTasks = await Task.find({ assignedTo: user._id });
            const userCompleted = userTasks.filter(task => task.status === 'completed');
            const userOnTime = userCompleted.filter(task => task.isOnTime === true);
            const userLate = userCompleted.filter(task => task.isOnTime === false);
            const userPending = userTasks.filter(task => task.status !== 'completed');
            const userPendingApproval = userTasks.filter(task => task.status === 'pending_approval');

            const successRate = userTasks.length > 0 ? Math.round((userCompleted.length / userTasks.length) * 100) : 0;

            userPerformance.push({
                name: user.name,
                totalTasks: userTasks.length,
                completed: userCompleted.length,
                onTime: userOnTime.length,
                late: userLate.length,
                pending: userPending.length,
                pendingApproval: userPendingApproval.length,
                successRate
            });
        }

        // Find top performer
        const topPerformer = userPerformance.length > 0
            ? userPerformance.reduce((prev, current) =>
                (prev.successRate > current.successRate) ? prev : current
            ).name
            : 'N/A';

        res.json({
            completedOnTime,
            completedLate,
            completionRate,
            pendingApprovals,
            topPerformer,
            userPerformance
        });
    } catch (error) {
        console.error('Error loading analytics:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Completion requests

router.patch('/tasks/:id/approve-completion', async (req, res) => {
    try {
        const taskId = req.params.id;

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        if (task.status !== 'pending_approval') {
            return res.status(400).json({ message: 'Task is not pending approval' });
        }

        const admin = await Admin.findById(task.adminId);

        const updatedTask = await Task.findByIdAndUpdate(taskId, {
            status: 'completed',
            approvedBy: admin ? admin.name : 'Admin',
            approvedAt: new Date(),
            progress: 100,
            updatedAt: new Date()
        }, { new: true }).populate('assignedTo', 'name email');

        // Check if this is a job task and move to next stage
        const soMatch = task.title.match(/- ([A-Z0-9]+)$/);
        if (soMatch) {
            const soNumber = soMatch[1];
            const jobEntry = await JobEntry.findOne({ soNumber: soNumber, adminId: task.adminId });

            if (jobEntry) {
                await jobService.moveJobToNextStage(jobEntry, task.adminId);
            }
        }

        if (updatedTask.assignedTo && updatedTask.assignedTo.email) {
            await emailService.sendTaskCompletionEmail(updatedTask.assignedTo, updatedTask);
        }

        await activityService.logActivity(
            task.adminId,
            'approve_completion',
            'task',
            task._id,
            `Admin approved completion of task: ${task.title} for ${updatedTask.assignedTo ? updatedTask.assignedTo.name : 'Unknown'}`
        );

        res.json({
            success: true,
            task: updatedTask,
            message: 'Task completion approved successfully!'
        });
    } catch (error) {
        console.error('Error approving task completion:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.patch('/tasks/:id/reject-completion', async (req, res) => {
    try {
        const taskId = req.params.id;

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        if (task.status !== 'pending_approval') {
            return res.status(400).json({ message: 'Task is not pending approval' });
        }

        const updatedTask = await Task.findByIdAndUpdate(taskId, {
            status: 'in_progress',
            completionRequestDate: null,
            requestedBy: null,
            requestedById: null,
            progress: 80,
            updatedAt: new Date()
        }, { new: true }).populate('assignedTo', 'name email');

        if (updatedTask.assignedTo && updatedTask.assignedTo.email) {
            const rejectionEmailContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); padding: 30px; text-align: center;">
                        <h1 style="color: white; margin: 0;">❌ Completion Request Rejected</h1>
                    </div>
                    <div style="padding: 30px;">
                        <h2 style="color: #2c3e50;">Hello ${updatedTask.assignedTo.name}!</h2>
                        <p>Your completion request for "${task.title}" has been rejected by the admin.</p>
                    </div>
                </div>
            `;

            await emailService.sendEmail(
                updatedTask.assignedTo.email,
                `❌ Task Completion Request Rejected: ${task.title}`,
                rejectionEmailContent
            );
        }

        await activityService.logActivity(
            task.adminId,
            'reject_completion',
            'task',
            task._id,
            `Admin rejected completion request for task: ${task.title}`
        );

        res.json({
            success: true,
            task: updatedTask,
            message: 'Task completion request rejected.'
        });
    } catch (error) {
        console.error('Error rejecting task completion:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


router.get('/user-tasks/:id', async (req, res) => {
    try {
        const userTask = await UserTask.findById(req.params.id)
            .populate('assignedTo', 'name email')
            .populate('assignedBy', 'name email');

        if (!userTask) {
            return res.status(404).json({ message: 'User task not found' });
        }

        const taskWithNames = {
            ...userTask.toObject(),
            assignedToName: userTask.assignedTo ? userTask.assignedTo.name : 'Unassigned',
            assignedByName: userTask.assignedBy ? userTask.assignedBy.name : 'Unknown'
        };

        res.json(taskWithNames);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// backend/src/routes/admin.js - Fix missing data issues

// Enhanced completion requests route
router.get('/completion-requests', async (req, res) => {
    try {
        console.log('Loading completion requests...');

        let admin = await Admin.findOne();
        if (!admin) {
            console.log('No admin found, creating default admin');
            admin = await Admin.create({
                username: 'admin',
                password: 'admin123',
                email: 'planning@ashtavinayaka.com',
                name: 'System Admin'
            });
        }

        // Get all tasks with pending_approval status
        const completionRequests = await Task.find({
            adminId: admin._id,
            status: 'pending_approval'
        })
            .populate('assignedTo', 'name email username')
            .populate('requestedById', 'name email username')
            .sort({ completionRequestDate: -1 });

        console.log(`Found ${completionRequests.length} completion requests`);

        const requestsWithNames = completionRequests.map(task => ({
            ...task.toObject(),
            assignedToName: task.assignedTo ? task.assignedTo.name : 'Unassigned'
        }));

        res.json(requestsWithNames);
    } catch (error) {
        console.error('Error loading completion requests:', error);
        res.status(500).json({
            message: 'Server error loading completion requests',
            error: error.message
        });
    }
});

// Enhanced dispatched jobs route with better error handling
router.get('/dispatched-jobs', async (req, res) => {
    try {
        console.log('Loading dispatched jobs...');

        let admin = await Admin.findOne();
        if (!admin) {
            console.log('No admin found for dispatched jobs');
            return res.json([]);
        }

        const dispatchedJobs = await DispatchedJob.find({ adminId: admin._id })
            .sort({ dispatchedAt: -1 })
            .limit(100); // Limit to prevent memory issues

        console.log(`Found ${dispatchedJobs.length} dispatched jobs`);
        res.json(dispatchedJobs);
    } catch (error) {
        console.error('Error loading dispatched jobs:', error);
        res.status(500).json({
            message: 'Server error loading dispatched jobs',
            error: error.message
        });
    }
});

// Enhanced job entries route with better debugging
router.get('/job-entries', async (req, res) => {
    try {
        console.log('Loading job entries with filters:', req.query);

        let admin = await Admin.findOne();
        if (!admin) {
            console.log('No admin found for job entries');
            return res.json([]);
        }

        const { month, team, status, customer } = req.query;
        let query = { adminId: admin._id };

        if (month && month.trim() !== '') {
            query.month = { $regex: month.trim(), $options: 'i' };
        }

        if (team && team.trim() !== '') {
            query.team = team.trim();
        }

        if (status && status.trim() !== '') {
            query.status = status.trim();
        }

        if (customer && customer.trim() !== '') {
            query.customer = { $regex: customer.trim(), $options: 'i' };
        }

        console.log('Job entries query:', query);

        const entries = await JobEntry.find(query)
            .sort({ createdAt: -1 })
            .limit(500); // Prevent memory issues

        console.log(`Found ${entries.length} job entries`);

        // Fix the assignedUsername issue
        const fixedEntries = entries.map(entry => {
            const entryObj = entry.toObject();

            // Fix any entries still showing 'jpg' 
            if (entryObj.assignedUsername === 'jpg') {
                entryObj.assignedUsername = '';
            }

            return entryObj;
        });

        res.json(fixedEntries);
    } catch (error) {
        console.error('Error loading job entries:', error);
        res.status(500).json({
            message: 'Server error loading job entries',
            error: error.message
        });
    }
});

// Enhanced user assigned tasks route
router.get('/user-assigned-tasks', async (req, res) => {
    try {
        console.log('Loading user assigned tasks with filters:', req.query);

        let admin = await Admin.findOne();
        if (!admin) {
            console.log('No admin found for user assigned tasks');
            return res.json([]);
        }

        const { status, assignedBy, assignedTo } = req.query;
        let query = {};

        if (status && status !== '') {
            if (status === 'overdue') {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                query.status = { $in: ['pending', 'in_progress'] };
                query.dueDate = { $lt: today };
            } else {
                query.status = status;
            }
        }

        console.log('User tasks query:', query);

        const userTasks = await UserTask.find(query)
            .populate('assignedTo', 'name email username')
            .populate('assignedBy', 'name email username')
            .sort({ createdAt: -1 })
            .limit(200);

        console.log(`Found ${userTasks.length} user tasks before filtering`);

        let filteredTasks = userTasks;

        if (assignedBy && assignedBy !== '') {
            filteredTasks = filteredTasks.filter(task =>
                task.assignedBy && task.assignedBy.name === assignedBy
            );
        }

        if (assignedTo && assignedTo !== '') {
            filteredTasks = filteredTasks.filter(task =>
                task.assignedTo && task.assignedTo.name === assignedTo
            );
        }

        console.log(`Filtered to ${filteredTasks.length} user tasks`);

        const tasksWithNames = filteredTasks.map(task => ({
            ...task.toObject(),
            assignedToName: task.assignedTo ? task.assignedTo.name : 'Unassigned',
            assignedByName: task.assignedBy ? task.assignedBy.name : 'Unknown'
        }));

        res.json(tasksWithNames);
    } catch (error) {
        console.error('Error loading user assigned tasks:', error);
        res.status(500).json({
            message: 'Server error loading user assigned tasks',
            error: error.message
        });
    }
});

// Enhanced dashboard stats with better error handling
router.get('/dashboard-stats', async (req, res) => {
    try {
        let admin = await Admin.findOne();
        if (!admin) {
            admin = await Admin.create({
                username: 'admin',
                password: 'admin123',
                email: 'planning@ashtavinayaka.com',
                name: 'System Admin'
            });
        }

        const [totalUsers, totalTasks, pendingTasks, pendingApprovals] = await Promise.all([
            User.countDocuments({ adminId: admin._id }),
            Task.countDocuments({ adminId: admin._id }),
            Task.countDocuments({
                adminId: admin._id,
                status: { $in: ['pending', 'in_progress'] }
            }),
            Task.countDocuments({
                adminId: admin._id,
                status: 'pending_approval'
            })
        ]);

        console.log('Dashboard stats:', { totalUsers, totalTasks, pendingTasks, pendingApprovals });

        res.json({
            totalUsers,
            totalTasks,
            pendingTasks,
            pendingApprovals
        });
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        res.status(500).json({
            message: 'Server error loading dashboard stats',
            error: error.message
        });
    }
});

// Database cleanup utility route (run once to fix data)
router.post('/cleanup-database', async (req, res) => {
    try {
        console.log('Starting database cleanup...');

        // Fix assignedUsername 'jpg' issue
        const jpgFix = await JobEntry.updateMany(
            { assignedUsername: 'jpg' },
            { $set: { assignedUsername: '' } }
        );

        console.log(`Fixed ${jpgFix.modifiedCount} job entries with 'jpg' assignment`);

        // Remove orphaned tasks (tasks without valid assignedTo)
        const orphanedTasks = await Task.deleteMany({
            assignedTo: { $exists: false }
        });

        console.log(`Removed ${orphanedTasks.deletedCount} orphaned tasks`);

        // Fix missing adminId references
        let admin = await Admin.findOne();
        if (admin) {
            const noAdminTasks = await Task.updateMany(
                { adminId: { $exists: false } },
                { $set: { adminId: admin._id } }
            );

            console.log(`Fixed ${noAdminTasks.modifiedCount} tasks without adminId`);
        }

        res.json({
            success: true,
            message: 'Database cleanup completed',
            results: {
                jpgFixCount: jpgFix.modifiedCount,
                orphanedTasksRemoved: orphanedTasks.deletedCount,
                adminIdFixed: noAdminTasks ? noAdminTasks.modifiedCount : 0
            }
        });
    } catch (error) {
        console.error('Database cleanup error:', error);
        res.status(500).json({
            message: 'Database cleanup failed',
            error: error.message
        });
    }
});

router.patch('/user-tasks/:id/complete', async (req, res) => {
    try {
        const taskId = req.params.id;
        const { completedBy } = req.body;

        const userTask = await UserTask.findById(taskId);
        if (!userTask) {
            return res.status(404).json({ message: 'User task not found' });
        }

        const completedAt = new Date();
        const updateData = {
            status: 'completed',
            progress: 100,
            completedAt: completedAt,
            isOnTime: completedAt <= new Date(userTask.dueDate),
            updatedAt: new Date()
        };

        const updatedTask = await UserTask.findByIdAndUpdate(taskId, updateData, { new: true })
            .populate('assignedTo', 'name email')
            .populate('assignedBy', 'name email');

        if (updatedTask.assignedTo && updatedTask.assignedTo.email) {
            await emailService.sendUserTaskCompletionEmail(updatedTask.assignedTo, updatedTask);
        }

        if (updatedTask.assignedBy && updatedTask.assignedBy.email) {
            await emailService.sendTaskCompletionNotificationEmail(updatedTask.assignedBy, updatedTask.assignedTo, updatedTask);
        }

        res.json({
            success: true,
            userTask: updatedTask,
            message: 'User task completed successfully by admin!'
        });
    } catch (error) {
        console.error('Admin user task completion error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Middle level validation approval
router.patch('/tasks/:id/middle-validation', async (req, res) => {
    try {
        const { status, remarks } = req.body;
        const currentUser = req.body.validatedBy;

        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        if (!task.needsMiddleLevelValidation) {
            return res.status(400).json({ message: 'Task does not require middle level validation' });
        }

        const updateData = {
            middleLevelValidationStatus: status,
            middleLevelValidatedBy: currentUser,
            middleLevelValidatedAt: new Date(),
            remarks: remarks
        };

        if (status === 'approved') {
            updateData.status = 'pending_approval'; // Goes to admin for final approval
        } else if (status === 'rejected') {
            updateData.status = 'in_progress'; // Back to assignee
        }

        const updatedTask = await Task.findByIdAndUpdate(req.params.id, updateData, { new: true });

        res.json({
            success: true,
            task: updatedTask,
            message: `Task ${status} by middle level validator`
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Request task delay
router.post('/tasks/:id/request-delay', async (req, res) => {
    try {
        const { requestedDueDate, reason, requestedBy } = req.body;

        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        const delayRequest = {
            requestedBy: requestedBy.id,
            requestedByName: requestedBy.name,
            currentDueDate: task.dueDate,
            requestedDueDate: new Date(requestedDueDate),
            reason: reason,
            status: 'pending'
        };

        task.delayRequests.push(delayRequest);
        await task.save();

        res.json({
            success: true,
            message: 'Delay request submitted successfully'
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Approve/Reject delay request
router.patch('/tasks/:id/delay-request/:requestId', async (req, res) => {
    try {
        const { status, reviewComments, reviewedBy } = req.body;

        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        const delayRequest = task.delayRequests.id(req.params.requestId);
        if (!delayRequest) {
            return res.status(404).json({ message: 'Delay request not found' });
        }

        delayRequest.status = status;
        delayRequest.reviewedBy = reviewedBy;
        delayRequest.reviewedAt = new Date();
        delayRequest.reviewComments = reviewComments;

        if (status === 'approved') {
            task.dueDate = delayRequest.requestedDueDate;
        }

        await task.save();

        res.json({
            success: true,
            message: `Delay request ${status}`,
            task
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Download task document
router.get('/tasks/:id/document', async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task || !task.attachedDocument) {
            return res.status(404).json({ message: 'Document not found' });
        }

        res.set({
            'Content-Type': task.attachedDocument.mimeType,
            'Content-Disposition': `attachment; filename="${task.attachedDocument.originalName}"`
        });

        res.send(task.attachedDocument.data);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.delete('/user-tasks/:id', async (req, res) => {
    try {
        const taskId = req.params.id;

        const userTask = await UserTask.findById(taskId);
        if (!userTask) {
            return res.status(404).json({ message: 'User task not found' });
        }

        await UserTask.findByIdAndDelete(taskId);

        res.json({
            success: true,
            message: 'User task deleted successfully by admin!'
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.get('/user-assigned-tasks/stats', async (req, res) => {
    try {
        const [totalUserTasks, completedUserTasks, pendingUserTasks] = await Promise.all([
            UserTask.countDocuments({}),
            UserTask.countDocuments({ status: 'completed' }),
            UserTask.countDocuments({
                status: { $in: ['pending', 'in_progress'] }
            })
        ]);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const overdueUserTasks = await UserTask.countDocuments({
            status: { $in: ['pending', 'in_progress'] },
            dueDate: { $lt: today }
        });

        const completionRate = totalUserTasks > 0 ?
            Math.round((completedUserTasks / totalUserTasks) * 100) : 0;

        res.json({
            totalUserTasks,
            completedUserTasks,
            pendingUserTasks,
            overdueUserTasks,
            completionRate
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Reports
router.get('/tasks-report', async (req, res) => {
    try {
        let admin = await Admin.findOne();
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        const tasks = await Task.find({ adminId: admin._id })
            .populate('assignedTo', 'name email username')
            .populate('requestedById', 'name email username')
            .sort({ createdAt: -1 });

        const reportData = tasks.map(task => ({
            'Task ID': task._id,
            'Title': task.title,
            'Description': task.description || '',
            'Assigned To': task.assignedToName || '',
            'Assigned To Email': task.assignedTo?.email || '',
            'Assigned To Username': task.assignedTo?.username || '',
            'Priority': task.priority,
            'Status': task.status,
            'Progress (%)': task.progress || 0,
            'Due Date': new Date(task.dueDate).toLocaleDateString(),
            'Created Date': new Date(task.createdAt).toLocaleDateString(),
            'Updated Date': new Date(task.updatedAt).toLocaleDateString(),
            'Completion Request Date': task.completionRequestDate ? new Date(task.completionRequestDate).toLocaleDateString() : '',
            'Requested By': task.requestedBy || '',
            'Requested By Username': task.requestedById?.username || '',
            'Approved By': task.approvedBy || '',
            'Approved Date': task.approvedAt ? new Date(task.approvedAt).toLocaleDateString() : '',
            'Completed Date': task.completedAt ? new Date(task.completedAt).toLocaleDateString() : '',
            'Is On Time': task.isOnTime !== null ? (task.isOnTime ? 'Yes' : 'No') : 'N/A',
            'Remarks/Comments': task.remarks || '',
        }));

        res.json({
            success: true,
            data: reportData,
            filename: `tasks_report_${new Date().toISOString().split('T')[0]}.xlsx`
        });
    } catch (error) {
        console.error('Error generating tasks report:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


router.post('/job-entries/manual', async (req, res) => {
    try {
        let admin = await Admin.findOne();
        if (!admin) {
            admin = await Admin.create({
                username: 'admin',
                password: 'admin123',
                email: 'planning@ashtavinayaka.com',
                name: 'System Admin'
            });
        }

        const { month, team, soNumber, customer, itemCode, particularsAndModels, qty, week, status, remarks } = req.body;

        const stageAssignment = await StageAssignment.findOne({
            stage: status,
            isActive: true,
            adminId: admin._id
        });

        const departmentMap = {
            'sales_order_received': 'Sales',
            'drawing_approved': 'Design',
            'long_lead_item_details_given': 'Procurement',
            'drawing_bom_issued': 'Design',
            'production_order_purchase_request_prepared': 'Planning',
            'rm_received': 'Store',
            'production_started': 'Production',
            'production_completed': 'Production',
            'qc_clear_for_dispatch': 'Quality',
            'dispatch_clearance': 'Admin',
            'dispatched': 'Logistics'
        };

        const jobEntry = new JobEntry({
            month,
            team: team || '',
            soNumber: soNumber.trim(),
            customer: customer.trim(),
            itemCode: itemCode.trim(),
            particularsAndModels: particularsAndModels.trim(),
            qty,
            week,
            status,
            assignedUsername: stageAssignment ? stageAssignment.assignedUsername : '',
            currentDepartment: departmentMap[status] || 'Unknown',
            adminId: admin._id,
            stageHistory: [{
                stage: status,
                timestamp: new Date(),
                changedBy: admin.name,
                remarks: remarks || `Manually added at ${jobService.formatJobStatus(status)} stage`,
                department: departmentMap[status] || 'Unknown'
            }]
        });

        const savedEntry = await jobEntry.save();

        if (stageAssignment) {
            await jobService.createAndNotifyStageTask(savedEntry, status, stageAssignment);
        }

        await activityService.logActivity(
            admin._id,
            'create',
            'job_entry',
            savedEntry._id,
            `Manually added job entry: ${soNumber} for ${customer}`
        );

        res.json({
            success: true,
            message: `Job entry ${soNumber} added successfully`,
            entry: savedEntry
        });
    } catch (error) {
        console.error('Manual job entry error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

router.post('/job-entries/upload-excel', upload.single('excel'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const XLSX = require('xlsx');
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        let admin = await Admin.findOne();
        if (!admin) {
            admin = await Admin.create({
                username: 'admin',
                password: 'admin123',
                email: 'planning@ashtavinayaka.com',
                name: 'System Admin'
            });
        }

        const salesStageAssignment = await StageAssignment.findOne({
            stage: 'sales_order_received',
            isActive: true,
            adminId: admin._id
        });

        const entries = data.map(row => ({
            month: row['Month'] || row['month'],
            soNumber: String(row['Doc No.'] || row['Doc No'] || row['S.O#'] || row['SO#'] || row['soNumber'] || ''),
            customer: row['Customer Name'] || row['CUSTOMER'] || row['Customer'] || row['customer'],
            itemCode: row['Item Code'] || row['ITEM CODE'] || row['itemCode'],
            particularsAndModels: row['Description'] || row['PARTICULARS & MODELS'] || row['Particulars & Models'] || row['particularsAndModels'] || row['description'],
            qty: parseInt(row['Qty'] || row['QTY'] || row['Qty.'] || row['qty']) || 1,
            week: parseInt(row['Week'] || row['week']) || 1,
            status: 'sales_order_received',
            assignedUsername: salesStageAssignment ? salesStageAssignment.assignedUsername : '',
            currentDepartment: 'Sales',
            adminId: admin._id,
            stageHistory: [{
                stage: 'sales_order_received',
                timestamp: new Date(),
                changedBy: admin.name,
                department: 'Sales'
            }]
        }));

        const createdEntries = await JobEntry.insertMany(entries);

        if (salesStageAssignment) {
            for (const entry of createdEntries) {
                await jobService.createInitialSalesTask(entry, salesStageAssignment, admin._id);
            }
        }

        await activityService.logActivity(
            admin._id,
            'upload',
            'job_entry',
            admin._id,
            `Uploaded ${createdEntries.length} job entries from Excel file`
        );

        res.json({
            success: true,
            message: `${createdEntries.length} job entries uploaded successfully`,
            entries: createdEntries
        });
    } catch (error) {
        console.error('Excel upload error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.patch('/job-entries/:id/update-field', async (req, res) => {
    try {
        const jobId = req.params.id;
        const updateData = { ...req.body, updatedAt: new Date() };

        const jobEntry = await JobEntry.findByIdAndUpdate(jobId, updateData, { new: true });
        if (!jobEntry) {
            return res.status(404).json({ message: 'Job entry not found' });
        }

        await activityService.logActivity(
            jobEntry.adminId,
            'update',
            'job_entry',
            jobEntry._id,
            `Updated job ${jobEntry.soNumber} field: ${Object.keys(req.body).join(', ')}`
        );

        res.json({
            success: true,
            entry: jobEntry,
            message: 'Job field updated successfully'
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.patch('/job-entries/:id/status', async (req, res) => {
    try {
        const result = await jobService.updateJobStatus(req.params.id, req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.get('/job-entries/download', async (req, res) => {
    try {
        let admin = await Admin.findOne();
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        const entries = await JobEntry.find({ adminId: admin._id })
            .sort({ createdAt: -1 });

        const excelData = entries.map(entry => {
            const baseData = {
                'Month': entry.month,
                'Team': entry.team,
                'S.O#': entry.soNumber,
                'Customer': entry.customer,
                'Item Code': entry.itemCode,
                'Particulars & Models': entry.particularsAndModels,
                'QTY': entry.qty,
                'Week': entry.week,
                'Status': entry.status.replace(/_/g, ' ').toUpperCase(),
                'Assigned Username': entry.assignedUsername || '',
                'Created Date': entry.createdAt.toLocaleDateString(),
                'Updated Date': entry.updatedAt.toLocaleDateString()
            };

            entry.stageHistory.forEach(stage => {
                const stageName = stage.stage.replace(/_/g, ' ').toUpperCase() + ' Date';
                baseData[stageName] = stage.timestamp.toLocaleDateString();
            });

            entry.customFields.forEach(field => {
                baseData[field.fieldName] = field.fieldValue;
            });

            return baseData;
        });

        res.json({
            success: true,
            data: excelData,
            filename: `job_tracking_${new Date().toISOString().split('T')[0]}.xlsx`
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.post('/job-entries/download-and-remove', async (req, res) => {
    try {
        let admin = await Admin.findOne();
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        const entries = await JobEntry.find({ adminId: admin._id })
            .sort({ createdAt: -1 });

        if (entries.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No job entries found to download and remove'
            });
        }

        const excelData = entries.map(entry => {
            const baseData = {
                'Month': entry.month,
                'Team': entry.team,
                'S.O#': entry.soNumber,
                'Customer': entry.customer,
                'Item Code': entry.itemCode,
                'Particulars & Models': entry.particularsAndModels,
                'QTY': entry.qty,
                'Week': entry.week,
                'Status': entry.status.replace(/_/g, ' ').toUpperCase(),
                'Assigned Username': entry.assignedUsername || '',
                'Created Date': entry.createdAt.toLocaleDateString(),
                'Updated Date': entry.updatedAt.toLocaleDateString()
            };

            entry.stageHistory.forEach(stage => {
                const stageName = stage.stage.replace(/_/g, ' ').toUpperCase() + ' Date';
                baseData[stageName] = stage.timestamp.toLocaleDateString();
            });

            entry.customFields.forEach(field => {
                baseData[field.fieldName] = field.fieldValue;
            });

            return baseData;
        });

        const totalEntries = entries.length;

        const deleteResult = await JobEntry.deleteMany({ adminId: admin._id });

        const relatedTasks = await Task.find({
            adminId: admin._id,
            description: { $regex: /Job Details:.*SO#:/, $options: 'i' }
        });

        if (relatedTasks.length > 0) {
            await Task.deleteMany({
                adminId: admin._id,
                description: { $regex: /Job Details:.*SO#:/, $options: 'i' }
            });
        }

        await activityService.logActivity(
            admin._id,
            'download_and_remove',
            'job_entry',
            admin._id,
            `Downloaded and removed ${totalEntries} job entries and ${relatedTasks.length} related tasks`
        );

        res.json({
            success: true,
            data: excelData,
            filename: `job_tracking_backup_${new Date().toISOString().split('T')[0]}.xlsx`,
            message: `Successfully downloaded and removed ${totalEntries} job entries and ${relatedTasks.length} related tasks`,
            removedEntries: totalEntries,
            removedTasks: relatedTasks.length
        });
    } catch (error) {
        console.error('Download and remove error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.delete('/job-entries/remove-all', async (req, res) => {
    try {
        let admin = await Admin.findOne();
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        const totalEntries = await JobEntry.countDocuments({ adminId: admin._id });

        if (totalEntries === 0) {
            return res.status(400).json({
                success: false,
                message: 'No job entries found to remove'
            });
        }

        const deleteResult = await JobEntry.deleteMany({ adminId: admin._id });

        const relatedTasks = await Task.find({
            adminId: admin._id,
            description: { $regex: /Job Details:.*SO#:/, $options: 'i' }
        });

        const deletedTasksCount = relatedTasks.length;
        if (relatedTasks.length > 0) {
            await Task.deleteMany({
                adminId: admin._id,
                description: { $regex: /Job Details:.*SO#:/, $options: 'i' }
            });
        }

        await activityService.logActivity(
            admin._id,
            'remove_all',
            'job_entry',
            admin._id,
            `Removed all ${totalEntries} job entries and ${deletedTasksCount} related tasks`
        );

        res.json({
            success: true,
            message: `Successfully removed ${totalEntries} job entries and ${deletedTasksCount} related tasks`,
            removedEntries: totalEntries,
            removedTasks: deletedTasksCount
        });
    } catch (error) {
        console.error('Remove all error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.get('/job-entries/count', async (req, res) => {
    try {
        let admin = await Admin.findOne();
        if (!admin) {
            return res.json({ count: 0 });
        }

        const count = await JobEntry.countDocuments({ adminId: admin._id });
        res.json({ count });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.delete('/job-entries/:id', async (req, res) => {
    try {
        const entry = await JobEntry.findById(req.params.id);
        if (!entry) {
            return res.status(404).json({ message: 'Job entry not found' });
        }

        // Delete all related tasks
        await Task.deleteMany({
            $or: [
                { description: { $regex: `SO#: ${entry.soNumber}`, $options: 'i' } },
                { description: { $regex: `S.O#: ${entry.soNumber}`, $options: 'i' } },
                { title: { $regex: entry.soNumber, $options: 'i' } },
                { soNumber: entry.soNumber }
            ]
        });

        await JobEntry.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Job entry and related tasks deleted successfully'
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Custom fields
router.get('/custom-fields', async (req, res) => {
    try {
        let admin = await Admin.findOne();
        if (!admin) {
            return res.json([]);
        }

        const fields = await CustomField.find({
            adminId: admin._id,
            isActive: true
        });

        res.json(fields);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.post('/custom-fields', async (req, res) => {
    try {
        let admin = await Admin.findOne();
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        const customField = new CustomField({
            ...req.body,
            adminId: admin._id
        });

        await customField.save();

        res.json({
            success: true,
            field: customField,
            message: 'Custom field added successfully'
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Stage assignments
router.get('/stage-assignments', async (req, res) => {
    try {
        let admin = await Admin.findOne();
        if (!admin) {
            return res.json([]);
        }

        const assignments = await StageAssignment.find({
            adminId: admin._id,
            isActive: true
        });

        res.json(assignments);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.post('/stage-assignments', async (req, res) => {
    try {
        let admin = await Admin.findOne();
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        const assignment = new StageAssignment({
            ...req.body,
            adminId: admin._id
        });

        await assignment.save();

        res.json({
            success: true,
            assignment,
            message: 'Stage assignment created successfully'
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Job stats
router.get('/job-stats', async (req, res) => {
    try {
        let admin = await Admin.findOne();
        if (!admin) {
            return res.json({
                totalJobs: 0,
                statusBreakdown: {},
                teamBreakdown: {},
                monthlyBreakdown: {}
            });
        }

        const jobs = await JobEntry.find({ adminId: admin._id });

        const stats = {
            totalJobs: jobs.length,
            statusBreakdown: {},
            teamBreakdown: {},
            monthlyBreakdown: {}
        };

        jobs.forEach(job => {
            stats.statusBreakdown[job.status] = (stats.statusBreakdown[job.status] || 0) + 1;
            stats.teamBreakdown[job.team] = (stats.teamBreakdown[job.team] || 0) + 1;
            stats.monthlyBreakdown[job.month] = (stats.monthlyBreakdown[job.month] || 0) + 1;
        });

        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Department stats
router.get('/department-stats', async (req, res) => {
    try {
        let admin = await Admin.findOne();
        if (!admin) {
            return res.json({});
        }

        const jobs = await JobEntry.find({ adminId: admin._id });

        const departmentStats = {};
        const departmentMap = {
            'sales_order_received': 'Sales',
            'drawing_approved': 'Design',
            'long_lead_item_details_given': 'Procurement',
            'drawing_bom_issued': 'Design',
            'production_order_purchase_request_prepared': 'Planning',
            'rm_received': 'Store',
            'production_started': 'Production',
            'production_completed': 'Production',
            'qc_clear_for_dispatch': 'Quality',
            'dispatch_clearance': 'Admin',
            'dispatched': 'Logistics'
        };

        jobs.forEach(job => {
            const dept = departmentMap[job.status] || 'Unknown';
            if (!departmentStats[dept]) {
                departmentStats[dept] = 0;
            }
            departmentStats[dept]++;
        });

        res.json(departmentStats);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});



router.get('/dispatched-jobs-report', async (req, res) => {
    try {
        let admin = await Admin.findOne();
        if (!admin) {
            return res.json({ success: false, message: 'Admin not found' });
        }

        const dispatchedJobs = await DispatchedJob.find({ adminId: admin._id })
            .sort({ dispatchedAt: -1 });

        const reportData = [];

        dispatchedJobs.forEach(job => {
            job.stageAnalysis.forEach(stage => {
                reportData.push({
                    'SO Number': job.soNumber,
                    'Customer': job.customer,
                    'Item Code': job.itemCode,
                    'Particulars': job.particularsAndModels,
                    'Quantity': job.qty,
                    'Stage': jobService.formatJobStatus(stage.stage),
                    'Start Date': stage.startDate ? new Date(stage.startDate).toLocaleDateString() : '',
                    'Completed Date': stage.completedDate ? new Date(stage.completedDate).toLocaleDateString() : '',
                    'Duration (Days)': stage.duration || '',
                    'Assigned To': stage.assignedTo || '',
                    'Remarks': stage.remarks || '',
                    'Total Duration (Days)': job.totalDuration,
                    'Dispatched Date': new Date(job.dispatchedAt).toLocaleDateString()
                });
            });
        });

        res.json({
            success: true,
            data: reportData,
            filename: `dispatched_jobs_analysis_${new Date().toISOString().split('T')[0]}.xlsx`
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;