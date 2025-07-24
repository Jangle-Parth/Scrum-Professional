
// src/services/jobService.js
const JobEntry = require('../models/JobEntry');
const Task = require('../models/Task');
const User = require('../models/User');
const StageAssignment = require('../models/StageAssignment');
const DispatchedJob = require('../models/DispatchedJob');
const emailService = require('./emailService');
const activityService = require('./activityService');
const { JOB_STATUS_MAP, DEPARTMENT_MAP, STAGE_ORDER, NOTIFICATION_RECIPIENTS } = require('../utils/constants');

class JobService {
    formatJobStatus(status) {
        return JOB_STATUS_MAP[status] || status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    async moveJobToNextStage(jobEntry, adminId) {
        try {
            const currentIndex = STAGE_ORDER.indexOf(jobEntry.status);
            if (currentIndex === -1 || currentIndex === STAGE_ORDER.length - 1) {
                return;
            }

            const nextStage = STAGE_ORDER[currentIndex + 1];
            const nextDepartment = DEPARTMENT_MAP[nextStage];

            const nextStageAssignment = await StageAssignment.findOne({
                stage: nextStage,
                isActive: true,
                adminId: adminId
            });

            const previousStage = jobEntry.stageHistory[jobEntry.stageHistory.length - 1];
            if (previousStage && !previousStage.completedAt) {
                previousStage.completedAt = new Date();
            }

            jobEntry.stageHistory.push({
                stage: nextStage,
                timestamp: new Date(),
                changedBy: 'System Auto-Progression',
                department: nextDepartment
            });

            const updatedJobEntry = await JobEntry.findByIdAndUpdate(jobEntry._id, {
                status: nextStage,
                currentDepartment: nextDepartment,
                assignedUsername: nextStageAssignment ? nextStageAssignment.assignedUsername : '',
                stageHistory: jobEntry.stageHistory,
                updatedAt: new Date()
            }, { new: true });

            if (nextStage === 'dispatched') {
                await this.createDispatchedJobAnalysis(updatedJobEntry);
            }

            if (nextStageAssignment) {
                await this.createAndNotifyStageTask(updatedJobEntry, nextStage, nextStageAssignment);
            }

            await activityService.logActivity(
                adminId,
                'auto_progress',
                'job_entry',
                jobEntry._id,
                `Auto-progressed job ${jobEntry.soNumber} from ${this.formatJobStatus(jobEntry.status)} to ${this.formatJobStatus(nextStage)} - assigned to ${nextDepartment} department`
            );

        } catch (error) {
            console.error('Error moving job to next stage:', error);
        }
    }

    async createDispatchedJobAnalysis(jobEntry) {
        try {
            const stageAnalysis = [];

            for (let i = 0; i < jobEntry.stageHistory.length; i++) {
                const currentStage = jobEntry.stageHistory[i];
                const nextStage = jobEntry.stageHistory[i + 1];

                const analysis = {
                    stage: currentStage.stage,
                    startDate: currentStage.timestamp,
                    completedDate: nextStage ? nextStage.timestamp : currentStage.completedAt,
                    assignedTo: jobEntry.assignedUsername,
                    remarks: currentStage.remarks
                };

                if (analysis.completedDate) {
                    analysis.duration = Math.ceil((new Date(analysis.completedDate) - new Date(analysis.startDate)) / (1000 * 60 * 60 * 24));
                }

                stageAnalysis.push(analysis);
            }

            const totalDuration = Math.ceil((new Date() - new Date(jobEntry.createdAt)) / (1000 * 60 * 60 * 24));

            const dispatchedJob = new DispatchedJob({
                jobEntryId: jobEntry._id,
                soNumber: jobEntry.soNumber,
                customer: jobEntry.customer,
                itemCode: jobEntry.itemCode,
                particularsAndModels: jobEntry.particularsAndModels,
                qty: jobEntry.qty,
                stageAnalysis,
                totalDuration,
                adminId: jobEntry.adminId
            });

            await dispatchedJob.save();
        } catch (error) {
            console.error('Error creating dispatched job analysis:', error);
        }
    }

    async createAndNotifyStageTask(jobEntry, currentStage, stageAssignment) {
        try {
            const user = await User.findOne({
                username: stageAssignment.assignedUsername,
                adminId: jobEntry.adminId
            });

            if (user) {
                const taskData = {
                    title: `${stageAssignment.taskTitle} - ${jobEntry.soNumber}`,
                    description: `${stageAssignment.taskDescription || ''}\n\nJob Details:\nSO#: ${jobEntry.soNumber}\nCustomer: ${jobEntry.customer}\nItem: ${jobEntry.itemCode}\nParticulars: ${jobEntry.particularsAndModels}\n\nStage: ${this.formatJobStatus(currentStage)}`,
                    assignedTo: user._id,
                    assignedToName: user.name,
                    priority: 'medium',
                    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    adminId: jobEntry.adminId,
                    status: 'pending'
                };

                const task = new Task(taskData);
                await task.save();

                // Send email notification to assigned user
                await this.sendJobStageTaskEmail(user, jobEntry, currentStage, task);

                await activityService.logActivity(
                    jobEntry.adminId,
                    'create',
                    'task',
                    task._id,
                    `Auto-created task for job ${jobEntry.soNumber} stage ${currentStage} - assigned to ${user.name}`
                );
            }
        } catch (error) {
            console.error('Error creating and notifying stage task:', error);
        }
    }

    async createInitialSalesTask(jobEntry, stageAssignment, adminId) {
        try {
            const user = await User.findOne({
                username: stageAssignment.assignedUsername,
                adminId: adminId
            });

            if (user) {
                const taskData = {
                    title: `${stageAssignment.taskTitle} - ${jobEntry.soNumber}`,
                    description: `${stageAssignment.taskDescription || 'Process sales order'}\n\nJob Details:\nSO#: ${jobEntry.soNumber}\nCustomer: ${jobEntry.customer}\nItem: ${jobEntry.itemCode}\nParticulars: ${jobEntry.particularsAndModels}\nQuantity: ${jobEntry.qty}`,
                    assignedTo: user._id,
                    assignedToName: user.name,
                    priority: 'medium',
                    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    adminId: adminId,
                    status: 'pending'
                };

                const task = new Task(taskData);
                await task.save();

                await this.sendJobStageTaskEmail(user, jobEntry, 'sales_order_received', task);

                await activityService.logActivity(
                    adminId,
                    'create',
                    'task',
                    task._id,
                    `Auto-created sales task for new job ${jobEntry.soNumber} - assigned to ${user.name}`
                );
            }
        } catch (error) {
            console.error('Error creating initial sales task:', error);
        }
    }

    async updateJobStatus(jobId, { status, changedBy, remarks, holdReason, cancelReason, restartReason }) {
        try {
            const jobEntry = await JobEntry.findById(jobId);
            if (!jobEntry) {
                throw new Error('Job entry not found');
            }

            // Handle restarting from hold
            if (jobEntry.status === 'hold' && status !== 'hold' && status !== 'so_cancelled') {
                const stageAssignment = await StageAssignment.findOne({
                    stage: status,
                    isActive: true,
                    adminId: jobEntry.adminId
                });

                let assignedUsername = '';
                if (stageAssignment) {
                    assignedUsername = stageAssignment.assignedUsername;
                }

                const updateData = {
                    status,
                    assignedUsername: assignedUsername,
                    currentDepartment: DEPARTMENT_MAP[status],
                    holdReason: null,
                    holdDate: null,
                    updatedAt: new Date()
                };

                const previousStage = jobEntry.stageHistory[jobEntry.stageHistory.length - 1];
                if (previousStage && !previousStage.completedAt) {
                    previousStage.completedAt = new Date();
                }

                jobEntry.stageHistory.push({
                    stage: status,
                    timestamp: new Date(),
                    changedBy: changedBy || 'Admin',
                    remarks: restartReason || remarks || `Restarted from hold to ${this.formatJobStatus(status)} `,
                    department: DEPARTMENT_MAP[status]
                });

                const updatedEntry = await JobEntry.findByIdAndUpdate(
                    jobId,
                    { ...updateData, stageHistory: jobEntry.stageHistory },
                    { new: true }
                );

                if (stageAssignment && assignedUsername) {
                    await this.createAndNotifyStageTask(updatedEntry, status, stageAssignment);
                }

                // Send restart notification email
                await this.sendJobRestartEmail(updatedEntry, status, restartReason || remarks, changedBy || 'Admin');

                await activityService.logActivity(
                    jobEntry.adminId,
                    'restart',
                    'job_entry',
                    jobEntry._id,
                    `Restarted job ${jobEntry.soNumber} from hold to ${this.formatJobStatus(status)}${restartReason ? ': ' + restartReason : ''} `
                );

                return {
                    success: true,
                    entry: updatedEntry,
                    message: `Job restarted from hold to ${this.formatJobStatus(status)}. Task assigned and notifications sent.`
                };
            }

            // Handle hold status
            if (status === 'hold') {
                // Cancel any existing tasks for this job
                await Task.updateMany(
                    {
                        adminId: jobEntry.adminId,
                        $or: [
                            { description: { $regex: `SO#: ${jobEntry.soNumber} `, $options: 'i' } },
                            { description: { $regex: `S.O#: ${jobEntry.soNumber} `, $options: 'i' } },
                            { title: { $regex: `${jobEntry.soNumber} `, $options: 'i' } }
                        ],
                        status: { $in: ['pending', 'in_progress', 'pending_approval'] },
                        title: { $not: { $regex: 'Hold Resolution|Clear Hold', $options: 'i' } }
                    },
                    {
                        status: 'cancelled',
                        updatedAt: new Date(),
                        remarks: `Job ${jobEntry.soNumber} put on hold: ${holdReason || remarks || 'No reason provided'} `
                    }
                );

                const salesAssignment = await StageAssignment.findOne({
                    stage: 'sales_order_received',
                    isActive: true,
                    adminId: jobEntry.adminId
                });

                let assignedSalesUsername = '';
                if (salesAssignment) {
                    assignedSalesUsername = salesAssignment.assignedUsername;
                }

                const updateData = {
                    status: 'hold',
                    holdReason: holdReason || remarks,
                    holdDate: new Date(),
                    assignedUsername: assignedSalesUsername,
                    currentDepartment: 'Sales',
                    updatedAt: new Date()
                };

                const previousStage = jobEntry.stageHistory[jobEntry.stageHistory.length - 1];
                if (previousStage && !previousStage.completedAt) {
                    previousStage.completedAt = new Date();
                }

                jobEntry.stageHistory.push({
                    stage: 'hold',
                    timestamp: new Date(),
                    changedBy: changedBy || 'Admin',
                    remarks: holdReason || remarks || 'Job put on hold',
                    department: 'Sales'
                });

                const updatedEntry = await JobEntry.findByIdAndUpdate(
                    jobId,
                    { ...updateData, stageHistory: jobEntry.stageHistory },
                    { new: true }
                );

                if (salesAssignment && assignedSalesUsername) {
                    await this.createHoldResolutionTask(updatedEntry, salesAssignment, jobEntry.adminId, holdReason || remarks);
                }

                await this.sendJobHoldEmail(updatedEntry, holdReason || remarks, changedBy || 'Admin');

                await activityService.logActivity(
                    jobEntry.adminId,
                    'hold',
                    'job_entry',
                    jobEntry._id,
                    `Put job ${jobEntry.soNumber} on hold${holdReason ? ': ' + holdReason : ''} `
                );

                return {
                    success: true,
                    entry: updatedEntry,
                    message: 'Job put on hold successfully. All related tasks cancelled and notifications sent.'
                };
            }

            // Handle SO cancellation
            if (status === 'so_cancelled') {
                await Task.updateMany(
                    {
                        adminId: jobEntry.adminId,
                        $or: [
                            { description: { $regex: `SO#: ${jobEntry.soNumber} `, $options: 'i' } },
                            { description: { $regex: `S.O#: ${jobEntry.soNumber} `, $options: 'i' } },
                            { title: { $regex: `${jobEntry.soNumber} `, $options: 'i' } }
                        ],
                        status: { $in: ['pending', 'in_progress', 'pending_approval'] }
                    },
                    {
                        status: 'cancelled',
                        updatedAt: new Date(),
                        remarks: `Sales Order ${jobEntry.soNumber} cancelled: ${cancelReason || remarks || 'No reason provided'} `
                    }
                );

                const updateData = {
                    status: 'so_cancelled',
                    cancelReason: cancelReason || remarks,
                    cancelDate: new Date(),
                    assignedUsername: '',
                    currentDepartment: 'Cancelled',
                    updatedAt: new Date()
                };

                const previousStage = jobEntry.stageHistory[jobEntry.stageHistory.length - 1];
                if (previousStage && !previousStage.completedAt) {
                    previousStage.completedAt = new Date();
                }

                jobEntry.stageHistory.push({
                    stage: 'so_cancelled',
                    timestamp: new Date(),
                    changedBy: changedBy || 'Admin',
                    remarks: cancelReason || remarks || 'Sales order cancelled',
                    department: 'Cancelled'
                });

                const updatedEntry = await JobEntry.findByIdAndUpdate(
                    jobId,
                    { ...updateData, stageHistory: jobEntry.stageHistory },
                    { new: true }
                );

                await this.sendJobCancelEmail(updatedEntry, cancelReason || remarks, changedBy || 'Admin');

                await activityService.logActivity(
                    jobEntry.adminId,
                    'cancel',
                    'job_entry',
                    jobEntry._id,
                    `Cancelled sales order ${jobEntry.soNumber}${cancelReason ? ': ' + cancelReason : ''} `
                );

                return {
                    success: true,
                    entry: updatedEntry,
                    message: 'Sales order cancelled successfully. All related tasks cancelled and notifications sent.'
                };
            }

            // Handle normal status updates
            const stageAssignment = await StageAssignment.findOne({
                stage: status,
                isActive: true,
                adminId: jobEntry.adminId
            });

            let assignedUsername = '';
            if (stageAssignment) {
                assignedUsername = stageAssignment.assignedUsername;
            }

            const updateData = {
                status,
                assignedUsername: assignedUsername,
                currentDepartment: DEPARTMENT_MAP[status] || 'Unknown',
                updatedAt: new Date()
            };

            const previousStage = jobEntry.stageHistory[jobEntry.stageHistory.length - 1];
            if (previousStage && !previousStage.completedAt) {
                previousStage.completedAt = new Date();
            }

            jobEntry.stageHistory.push({
                stage: status,
                timestamp: new Date(),
                changedBy: changedBy || 'Admin',
                remarks: remarks,
                department: DEPARTMENT_MAP[status] || 'Unknown'
            });

            const updatedEntry = await JobEntry.findByIdAndUpdate(
                jobId,
                { ...updateData, stageHistory: jobEntry.stageHistory },
                { new: true }
            );

            if (status === 'dispatched') {
                await this.createDispatchedJobAnalysis(updatedEntry);
            }

            if (stageAssignment && assignedUsername) {
                await this.createAndNotifyStageTask(updatedEntry, status, stageAssignment);
            }

            await activityService.logActivity(
                jobEntry.adminId,
                'update',
                'job_entry',
                jobEntry._id,
                `Updated job ${jobEntry.soNumber} status to ${status}${remarks ? ' with remarks: ' + remarks : ''} `
            );

            return {
                success: true,
                entry: updatedEntry,
                message: 'Job status updated successfully'
            };

        } catch (error) {
            console.error('Error updating job status:', error);
            throw error;
        }
    }

    async createHoldResolutionTask(jobEntry, salesAssignment, adminId, holdReason) {
        try {
            const user = await User.findOne({
                username: salesAssignment.assignedUsername,
                adminId: adminId,
                status: 'active'
            });

            if (!user) {
                console.log(`Warning: Sales user ${salesAssignment.assignedUsername} not found or inactive for hold resolution`);
                return;
            }

            const existingTask = await Task.findOne({
                adminId: adminId,
                assignedTo: user._id,
                $or: [
                    { title: { $regex: `Hold Resolution.* ${jobEntry.soNumber} `, $options: 'i' } },
                    { title: { $regex: `Clear Hold.* ${jobEntry.soNumber} `, $options: 'i' } }
                ],
                status: { $in: ['pending', 'in_progress'] }
            });

            if (existingTask) {
                console.log(`Hold resolution task already exists for job ${jobEntry.soNumber}, skipping creation`);
                return;
            }

            const taskData = {
                title: `Hold Resolution Required - ${jobEntry.soNumber} `,
                description: `URGENT: Job has been put on HOLD and requires Sales department attention for resolution.\n\n🚨 HOLD REASON: ${holdReason || 'No reason provided'} \n\nJob Details: \nS.O#: ${jobEntry.soNumber} \nCustomer: ${jobEntry.customer} \nItem: ${jobEntry.itemCode} \nParticulars: ${jobEntry.particularsAndModels} \nQuantity: ${jobEntry.qty} \n\n📋 ACTION REQUIRED: \n1.Review the hold reason above\n2.Contact customer / relevant parties to resolve the issue\n3.Coordinate with internal teams as needed\n4.Once resolved, update job status to appropriate stage\n5.Request task completion when hold is cleared\n\n⚠️ This job is currently BLOCKED and cannot proceed until this hold is resolved.`,
                assignedTo: user._id,
                assignedToName: user.name,
                priority: 'high',
                dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
                adminId: adminId,
                status: 'pending'
            };

            const task = new Task(taskData);
            await task.save();

            await this.sendHoldResolutionTaskEmail(user, jobEntry, task, holdReason);

            await activityService.logActivity(
                adminId,
                'create',
                'task',
                task._id,
                `Created HOLD RESOLUTION task for job ${jobEntry.soNumber} - assigned to Sales(${user.name})`
            );

        } catch (error) {
            console.error('Error creating hold resolution task:', error);
        }
    }



}

module.exports = new JobService(); 