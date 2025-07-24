// src/routes/user.js
const express = require('express');
const User = require('../models/User');
const UserTask = require('../models/UserTask');
const Task = require('../models/Task');
const emailService = require('../services/emailService');

const router = express.Router();

// Get team members
router.get('/team-members', async (req, res) => {
    try {
        const users = await User.find({ status: 'active' })
            .select('_id name email role')
            .sort({ name: 1 });

        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get user statistics
router.get('/:id/stats', async (req, res) => {
    try {
        const userId = req.params.id;

        const [totalTasks, completedTasks, pendingTasks, pendingApproval] = await Promise.all([
            Task.countDocuments({ assignedTo: userId }),
            Task.countDocuments({ assignedTo: userId, status: 'completed' }),
            Task.countDocuments({
                assignedTo: userId,
                status: { $in: ['pending', 'in_progress'] }
            }),
            Task.countDocuments({
                assignedTo: userId,
                status: 'pending_approval'
            })
        ]);

        const completionRate = totalTasks > 0 ?
            Math.round((completedTasks / totalTasks) * 100) : 0;

        res.json({
            totalTasks,
            completedTasks,
            pendingTasks,
            pendingApproval,
            completionRate
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.get('/:id/tasks', async (req, res) => {
    try {
        const userId = req.params.id;
        const currentUser = req.query.currentUser ? JSON.parse(req.query.currentUser) : null;

        let query = { assignedTo: userId };

        // Apply privacy filters
        if (currentUser && currentUser.role !== 'super_admin') {
            if (currentUser.role === 'admin') {
                query.isSuperAdminTask = { $ne: true };
            } else if (currentUser.id !== userId) {
                // User can only see their own tasks unless they created the task
                query.$or = [
                    { assignedTo: userId, isPrivate: { $ne: true } },
                    { assignedBy: currentUser.id }
                ];
            }
        }

        const tasks = await Task.find(query)
            .populate('parentTask', 'title')
            .sort({ dueDate: 1 });

        // FIXED: Proper overdue calculation
        const tasksWithStatus = tasks.map(task => {
            const taskObj = task.toObject();

            if (task.status === 'pending' || task.status === 'in_progress') {
                const today = new Date();
                const dueDate = new Date(task.dueDate);

                // Set to start of day for comparison
                const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

                // Task is overdue only if due date has passed (next day)
                if (dueDateStart < todayStart) {
                    taskObj.isOverdue = true;
                }
            }

            return taskObj;
        });

        res.json(tasksWithStatus);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


// Get user progress
router.get('/:id/progress', async (req, res) => {
    try {
        const userId = req.params.id;
        const userTasks = await Task.find({ assignedTo: userId });
        const completed = userTasks.filter(task => task.status === 'completed');
        const onTime = completed.filter(task => task.isOnTime === true);
        const late = completed.filter(task => task.isOnTime === false);

        const successRate = userTasks.length > 0 ?
            Math.round((completed.length / userTasks.length) * 100) : 0;

        let avgCompletionDays = 0;
        if (completed.length > 0) {
            const totalDays = completed.reduce((sum, task) => {
                const created = new Date(task.createdAt);
                const completedDate = new Date(task.completedAt);
                const days = Math.ceil((completedDate - created) / (1000 * 60 * 60 * 24));
                return sum + days;
            }, 0);
            avgCompletionDays = Math.round(totalDays / completed.length);
        }

        res.json({
            totalTasks: userTasks.length,
            completed: completed.length,
            onTime: onTime.length,
            late: late.length,
            successRate,
            avgCompletionDays
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// User task management
router.post('/user-tasks', upload.single('document'), async (req, res) => {
    try {
        const { assignedBy, assignedToMultiple, ...taskData } = req.body;

        const assigningUser = await User.findById(assignedBy);
        if (!assigningUser) {
            return res.status(404).json({ message: 'Assigning user not found' });
        }

        // Handle multiple assignees
        const assignees = assignedToMultiple ? JSON.parse(assignedToMultiple) : [taskData.assignedTo];
        const createdTasks = [];

        for (const assigneeId of assignees) {
            const assignedUser = await User.findById(assigneeId);
            if (!assignedUser) {
                continue; // Skip invalid users
            }

            const fullTaskData = {
                ...taskData,
                assignedTo: assigneeId,
                assignedBy: assigningUser._id,
                assignedByName: assigningUser.name,
                assignedToName: assignedUser.name
            };

            // Handle privacy for self-assigned tasks
            if (assigningUser._id.toString() === assigneeId.toString()) {
                fullTaskData.isPrivate = true;
            }

            // Handle document upload
            if (req.file) {
                fullTaskData.attachedDocument = {
                    filename: Date.now() + '_' + req.file.originalname,
                    originalName: req.file.originalname,
                    mimeType: req.file.mimetype,
                    size: req.file.size,
                    data: req.file.buffer
                };
            }

            const userTask = new UserTask(fullTaskData);
            await userTask.save();
            createdTasks.push(userTask);

            // Send email notification only if not self-assigned
            if (assigningUser._id.toString() !== assigneeId.toString() && assignedUser.email) {
                await emailService.sendUserTaskAssignmentEmail(assignedUser, assigningUser, userTask);
            }
        }

        res.status(201).json({
            success: true,
            tasks: createdTasks,
            message: `Task(s) assigned successfully to ${createdTasks.length} user(s)!`
        });
    } catch (error) {
        console.error('Error creating user task:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get parent tasks for grouping
router.get('/parent-tasks', async (req, res) => {
    try {
        const { soNumber } = req.query;

        let query = { parentTask: null };
        if (soNumber) {
            query.soNumber = soNumber;
        }

        const parentTasks = await Task.find(query)
            .select('_id title soNumber stage')
            .sort({ soNumber: 1, stage: 1 });

        // Group by SO number
        const groupedTasks = parentTasks.reduce((groups, task) => {
            const key = task.soNumber || 'general';
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(task);
            return groups;
        }, {});

        res.json(groupedTasks);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


// Get tasks assigned by a specific user
router.get('/:id/assigned-user-tasks', async (req, res) => {
    try {
        const userId = req.params.id;

        const userTasks = await UserTask.find({ assignedBy: userId })
            .populate('assignedTo', 'name email')
            .sort({ createdAt: -1 });

        const tasksWithNames = userTasks.map(task => ({
            ...task.toObject(),
            assignedToName: task.assignedTo ? task.assignedTo.name : 'Unassigned'
        }));

        res.json(tasksWithNames);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get tasks assigned TO a specific user
router.get('/:id/received-user-tasks', async (req, res) => {
    try {
        const userId = req.params.id;

        const userTasks = await UserTask.find({ assignedTo: userId })
            .populate('assignedBy', 'name email')
            .sort({ dueDate: 1 });

        const tasksWithNames = userTasks.map(task => ({
            ...task.toObject(),
            assignedByName: task.assignedBy ? task.assignedBy.name : 'Unknown'
        }));

        res.json(tasksWithNames);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get specific user task details
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

// Update user task
router.put('/user-tasks/:id', async (req, res) => {
    try {
        const taskId = req.params.id;
        const updateData = { ...req.body, updatedAt: new Date() };

        const userTask = await UserTask.findById(taskId);
        if (!userTask) {
            return res.status(404).json({ message: 'User task not found' });
        }

        if (req.body.assignedTo) {
            const assignedUser = await User.findById(req.body.assignedTo);
            updateData.assignedToName = assignedUser ? assignedUser.name : 'Unassigned';
        }

        const updatedTask = await UserTask.findByIdAndUpdate(taskId, updateData, { new: true })
            .populate('assignedTo', 'name email')
            .populate('assignedBy', 'name email');

        res.json({
            success: true,
            userTask: updatedTask,
            message: 'Task updated successfully!'
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Mark user task as complete
router.patch('/user-tasks/:id/complete', async (req, res) => {
    try {
        const taskId = req.params.id;
        const { completedBy } = req.body;

        const userTask = await UserTask.findById(taskId);
        if (!userTask) {
            return res.status(404).json({ message: 'User task not found' });
        }

        const completedAt = new Date();

        const dueDate = new Date(userTask.dueDate);
        const completedDate = new Date(completedAt);

        // Set both dates to start of day for proper comparison
        const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        const completedDateStart = new Date(completedDate.getFullYear(), completedDate.getMonth(), completedDate.getDate());

        // Task is on time if completed on or before due date
        const isOnTime = completedDateStart <= dueDateStart;

        const updateData = {
            status: 'completed',
            progress: 100,
            completedAt: completedAt,
            isOnTime: isOnTime,
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
            message: 'Task completed successfully!'
        });
    } catch (error) {
        console.error('User task completion error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.patch('/tasks/:id/complete', async (req, res) => {
    try {
        const taskId = req.params.id;
        const { completedBy } = req.body;

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        const completedAt = new Date();

        // FIXED: Proper date comparison for same day completion
        const dueDate = new Date(task.dueDate);
        const completedDate = new Date(completedAt);

        // Set both dates to start of day for proper comparison
        const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        const completedDateStart = new Date(completedDate.getFullYear(), completedDate.getMonth(), completedDate.getDate());

        // Task is on time if completed on or before due date
        const isOnTime = completedDateStart <= dueDateStart;

        let updateData = {
            progress: 100,
            completedAt: completedAt,
            isOnTime: isOnTime,
            updatedAt: new Date()
        };

        // Handle middle level validation
        if (task.needsMiddleLevelValidation) {
            updateData.status = 'pending_middle_validation';
            updateData.completionRequestDate = new Date();
            updateData.requestedBy = completedBy;
        } else {
            updateData.status = 'pending_approval';
            updateData.completionRequestDate = new Date();
            updateData.requestedBy = completedBy;
        }

        const updatedTask = await Task.findByIdAndUpdate(taskId, updateData, { new: true })
            .populate('assignedTo', 'name email')
            .populate('middleLevelValidator', 'name email');

        // Send appropriate notifications
        if (task.needsMiddleLevelValidation && updatedTask.middleLevelValidator) {
            // Send to middle level validator
            await emailService.sendMiddleLevelValidationRequest(
                updatedTask.middleLevelValidator,
                updatedTask.assignedTo,
                updatedTask
            );
        } else {
            // Send to admin for approval
            const admin = await Admin.findById(task.adminId);
            if (admin) {
                await emailService.sendCompletionRequestEmail(admin, updatedTask.assignedTo, updatedTask);
            }
        }

        res.json({
            success: true,
            task: updatedTask,
            message: task.needsMiddleLevelValidation
                ? 'Task sent for middle level validation!'
                : 'Task completion request sent to admin!'
        });
    } catch (error) {
        console.error('Task completion error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


// Delete user task
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
            message: 'Task deleted successfully!'
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get user task statistics
router.get('/:id/user-task-stats', async (req, res) => {
    try {
        const userId = req.params.id;

        const [assignedByMe, assignedByMeCompleted, assignedByMePending, assignedToMe, assignedToMeCompleted, assignedToMePending] = await Promise.all([
            UserTask.countDocuments({ assignedBy: userId }),
            UserTask.countDocuments({ assignedBy: userId, status: 'completed' }),
            UserTask.countDocuments({
                assignedBy: userId,
                status: { $in: ['pending', 'in_progress'] }
            }),
            UserTask.countDocuments({ assignedTo: userId }),
            UserTask.countDocuments({ assignedTo: userId, status: 'completed' }),
            UserTask.countDocuments({
                assignedTo: userId,
                status: { $in: ['pending', 'in_progress'] }
            })
        ]);

        const assignedCompletionRate = assignedByMe > 0 ? Math.round((assignedByMeCompleted / assignedByMe) * 100) : 0;
        const receivedCompletionRate = assignedToMe > 0 ? Math.round((assignedToMeCompleted / assignedToMe) * 100) : 0;

        res.json({
            assignedByMe,
            assignedByMeCompleted,
            assignedByMePending,
            assignedCompletionRate,
            assignedToMe,
            assignedToMeCompleted,
            assignedToMePending,
            receivedCompletionRate
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get user task analytics
router.get('/:id/user-task-analytics', async (req, res) => {
    try {
        const userId = req.params.id;

        const [assignedTasks, receivedTasks] = await Promise.all([
            UserTask.find({ assignedBy: userId }).populate('assignedTo', 'name'),
            UserTask.find({ assignedTo: userId }).populate('assignedBy', 'name')
        ]);

        const assignedAnalytics = {
            totalAssigned: assignedTasks.length,
            completedOnTime: assignedTasks.filter(task =>
                task.status === 'completed' && task.isOnTime === true
            ).length,
            completedLate: assignedTasks.filter(task =>
                task.status === 'completed' && task.isOnTime === false
            ).length,
            stillPending: assignedTasks.filter(task =>
                task.status === 'pending' || task.status === 'in_progress'
            ).length,
            byPriority: {
                low: assignedTasks.filter(task => task.priority === 'low').length,
                medium: assignedTasks.filter(task => task.priority === 'medium').length,
                high: assignedTasks.filter(task => task.priority === 'high').length,
                critical: assignedTasks.filter(task => task.priority === 'critical').length
            }
        };

        const receivedAnalytics = {
            totalReceived: receivedTasks.length,
            completedOnTime: receivedTasks.filter(task =>
                task.status === 'completed' && task.isOnTime === true
            ).length,
            completedLate: receivedTasks.filter(task =>
                task.status === 'completed' && task.isOnTime === false
            ).length,
            stillPending: receivedTasks.filter(task =>
                task.status === 'pending' || task.status === 'in_progress'
            ).length
        };

        const assignedCompleted = assignedAnalytics.completedOnTime + assignedAnalytics.completedLate;
        assignedAnalytics.successRate = assignedTasks.length > 0 ?
            Math.round((assignedCompleted / assignedTasks.length) * 100) : 0;

        const receivedCompleted = receivedAnalytics.completedOnTime + receivedAnalytics.completedLate;
        receivedAnalytics.successRate = receivedTasks.length > 0 ?
            Math.round((receivedCompleted / receivedTasks.length) * 100) : 0;

        res.json({
            assigned: assignedAnalytics,
            received: receivedAnalytics
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;