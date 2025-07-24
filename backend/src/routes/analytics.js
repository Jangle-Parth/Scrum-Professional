
const express = require('express');
const User = require('../models/User');
const Task = require('../models/Task');
const Admin = require('../models/Admin');

const router = express.Router();

// Admin analytics
router.get('/admin', async (req, res) => {
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
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Task statistics
router.get('/task-stats', async (req, res) => {
    try {
        let admin = await Admin.findOne();
        if (!admin) {
            return res.json({
                total: 0,
                active: 0,
                completed: 0,
                pending: 0,
                inProgress: 0,
                pendingApproval: 0,
                overdue: 0,
                highPriority: 0,
                critical: 0,
                completedOnTime: 0,
                completedLate: 0
            });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const allTasks = await Task.find({ adminId: admin._id });

        const stats = {
            total: allTasks.length,
            active: allTasks.filter(task => task.status !== 'completed').length,
            completed: allTasks.filter(task => task.status === 'completed').length,
            pending: allTasks.filter(task => task.status === 'pending').length,
            inProgress: allTasks.filter(task => task.status === 'in_progress').length,
            pendingApproval: allTasks.filter(task => task.status === 'pending_approval').length,
            overdue: allTasks.filter(task =>
                (task.status === 'pending' || task.status === 'in_progress') &&
                new Date(task.dueDate) < today
            ).length,
            highPriority: allTasks.filter(task => task.priority === 'high').length,
            critical: allTasks.filter(task => task.priority === 'critical').length,
            completedOnTime: allTasks.filter(task => task.status === 'completed' && task.isOnTime === true).length,
            completedLate: allTasks.filter(task => task.status === 'completed' && task.isOnTime === false).length
        };

        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get pending tasks
router.get('/pending-tasks', async (req, res) => {
    try {
        let admin = await Admin.findOne();
        if (!admin) {
            return res.json([]);
        }

        const pendingTasks = await Task.find({
            adminId: admin._id,
            status: { $in: ['pending', 'in_progress'] }
        })
            .populate('assignedTo', 'name')
            .sort({ dueDate: 1 });

        const tasksWithNames = pendingTasks.map(task => ({
            ...task.toObject(),
            assignedToName: task.assignedTo ? task.assignedTo.name : 'Unassigned'
        }));

        res.json(tasksWithNames);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get active tasks with filters
router.get('/active-tasks', async (req, res) => {
    try {
        let admin = await Admin.findOne();
        if (!admin) {
            return res.json([]);
        }

        const { filter, priority } = req.query;
        let query = {
            adminId: admin._id,
            status: { $ne: 'completed' }
        };

        if (filter) {
            switch (filter) {
                case 'pending':
                    query.status = 'pending';
                    break;
                case 'in_progress':
                    query.status = 'in_progress';
                    break;
                case 'pending_approval':
                    query.status = 'pending_approval';
                    break;
                case 'overdue':
                    query.status = { $in: ['pending', 'in_progress'] };
                    query.dueDate = { $lt: new Date() };
                    break;
                case 'high_priority':
                    query.priority = 'high';
                    break;
                case 'critical_priority':
                    query.priority = 'critical';
                    break;
            }
        }

        if (priority) {
            query.priority = priority;
        }

        const tasks = await Task.find(query)
            .populate('assignedTo', 'name')
            .sort({
                priority: 1,
                dueDate: 1,
                createdAt: -1
            });

        const tasksWithNames = tasks.map(task => ({
            ...task.toObject(),
            assignedToName: task.assignedTo ? task.assignedTo.name : 'Unassigned'
        }));

        res.json(tasksWithNames);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get completed tasks with filters
router.get('/completed-tasks', async (req, res) => {
    try {
        let admin = await Admin.findOne();
        if (!admin) {
            return res.json([]);
        }

        const { filter, timeframe } = req.query;
        let query = {
            adminId: admin._id,
            status: 'completed'
        };

        if (timeframe) {
            const now = new Date();
            switch (timeframe) {
                case 'today':
                    query.completedAt = {
                        $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
                        $lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
                    };
                    break;
                case 'this_week':
                    const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
                    query.completedAt = { $gte: weekStart };
                    break;
                case 'this_month':
                    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                    query.completedAt = { $gte: monthStart };
                    break;
            }
        }

        if (filter) {
            switch (filter) {
                case 'on_time':
                    query.isOnTime = true;
                    break;
                case 'late':
                    query.isOnTime = false;
                    break;
            }
        }

        const tasks = await Task.find(query)
            .populate('assignedTo', 'name')
            .sort({ completedAt: -1 });

        const tasksWithNames = tasks.map(task => ({
            ...task.toObject(),
            assignedToName: task.assignedTo ? task.assignedTo.name : 'Unassigned'
        }));

        res.json(tasksWithNames);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Bulk update tasks
router.patch('/tasks/bulk-update', async (req, res) => {
    try {
        const { taskIds, updateData } = req.body;

        if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
            return res.status(400).json({ message: 'Task IDs are required' });
        }

        const result = await Task.updateMany(
            { _id: { $in: taskIds } },
            { ...updateData, updatedAt: new Date() }
        );

        const admin = await Admin.findOne();
        if (admin) {
            await activityService.logActivity(
                admin._id,
                'bulk_update',
                'task',
                taskIds[0] || admin._id,
                `Bulk updated ${result.modifiedCount} tasks`
            );
        }

        res.json({
            success: true,
            message: `${result.modifiedCount} tasks updated successfully`,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Search tasks
router.get('/tasks/search', async (req, res) => {
    try {
        let admin = await Admin.findOne();
        if (!admin) {
            return res.json([]);
        }

        const { q } = req.query;
        if (!q) {
            return res.status(400).json({ message: 'Search query is required' });
        }

        const tasks = await Task.find({
            adminId: admin._id,
            $or: [
                { title: { $regex: q, $options: 'i' } },
                { description: { $regex: q, $options: 'i' } }
            ]
        })
            .populate('assignedTo', 'name')
            .sort({ createdAt: -1 });

        const tasksWithNames = tasks.map(task => ({
            ...task.toObject(),
            assignedToName: task.assignedTo ? task.assignedTo.name : 'Unassigned'
        }));

        res.json(tasksWithNames);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get tasks by date range
router.get('/tasks/date-range', async (req, res) => {
    try {
        let admin = await Admin.findOne();
        if (!admin) {
            return res.json([]);
        }

        const { startDate, endDate, field = 'dueDate' } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ message: 'Start date and end date are required' });
        }

        let query = {
            adminId: admin._id,
            [field]: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            }
        };

        const tasks = await Task.find(query)
            .populate('assignedTo', 'name')
            .sort({ [field]: 1 });

        const tasksWithNames = tasks.map(task => ({
            ...task.toObject(),
            assignedToName: task.assignedTo ? task.assignedTo.name : 'Unassigned'
        }));

        res.json(tasksWithNames);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;
