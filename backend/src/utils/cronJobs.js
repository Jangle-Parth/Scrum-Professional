const cron = require('node-cron');
const User = require('../models/User');
const Task = require('../models/Task');
const emailService = require('../services/emailService');

// Daily Email Cron Job - Every day at 9 AM
cron.schedule('0 9 * * *', async () => {
    console.log('Running daily email reminder job...');

    try {
        const users = await User.find({ status: 'active' });

        for (const user of users) {
            const pendingTasks = await Task.find({
                assignedTo: user._id,
                status: { $in: ['pending', 'in_progress'] }
            });

            if (pendingTasks.length > 0) {
                await emailService.sendPendingTasksEmail(user, pendingTasks);
            }
        }

        console.log('Daily email reminders sent successfully');
    } catch (error) {
        console.error('Error sending daily email reminders:', error);
    }
});

module.exports = {};