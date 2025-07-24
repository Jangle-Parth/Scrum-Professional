const User = require('../models/User');
const UserTask = require('../models/UserTask');
const emailService = require('../services/emailService');
const activityService = require('../services/activityService');
const { validationResult } = require('express-validator');

class UserController {
    // Get team members
    async getTeamMembers(req, res) {
        try {
            const users = await User.findActiveUsers()
                .select('_id name email role');

            res.json(users);
        } catch (error) {
            res.status(500).json({
                message: 'Server error',
                error: error.message
            });
        }
    }

    // Get user statistics
    async getUserStats(req, res) {
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
            res.status(500).json({
                message: 'Server error',
                error: error.message
            });
        }
    }

    // Create user task
    async createUserTask(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    message: 'Validation error',
                    errors: errors.array()
                });
            }

            const { assignedBy, ...taskData } = req.body;

            const [assigningUser, assignedUser] = await Promise.all([
                User.findById(assignedBy),
                User.findById(taskData.assignedTo)
            ]);

            if (!assigningUser) {
                return res.status(404).json({ message: 'Assigning user not found' });
            }

            if (!assignedUser) {
                return res.status(404).json({ message: 'Assigned user not found' });
            }

            const fullTaskData = {
                ...taskData,
                assignedBy: assigningUser._id,
                assignedByName: assigningUser.name,
                assignedToName: assignedUser.name
            };

            const userTask = new UserTask(fullTaskData);
            await userTask.save();

            // Send email notification
            if (assignedUser.email) {
                await emailService.sendUserTaskAssignmentEmail(
                    assignedUser,
                    assigningUser,
                    userTask
                );
            }

            res.status(201).json({
                success: true,
                userTask,
                message: 'Task assigned successfully!'
            });
        } catch (error) {
            console.error('Error creating user task:', error);
            res.status(500).json({
                message: 'Server error',
                error: error.message
            });
        }
    }

    // Additional methods...
}

module.exports = new UserController();