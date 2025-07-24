// src/services/activityService.js
const Activity = require('../models/Activity');

class ActivityService {
    async logActivity(adminId, action, entityType, entityId, description) {
        try {
            if (!entityId && ['bulk_update', 'upload', 'download_and_remove', 'remove_all'].includes(action)) {
                entityId = adminId;
            }

            if (!entityId) {
                console.error('Cannot log activity: entityId is required', {
                    adminId,
                    action,
                    entityType,
                    description
                });
                return;
            }

            await Activity.create({
                adminId,
                action,
                entityType,
                entityId,
                description
            });
        } catch (error) {
            console.error('Failed to log activity:', error);
        }
    }

    async getRecentActivity(adminId, limit = 10) {
        try {
            return await Activity.find({ adminId })
                .sort({ createdAt: -1 })
                .limit(limit);
        } catch (error) {
            console.error('Failed to get recent activity:', error);
            return [];
        }
    }
}

module.exports = new ActivityService();