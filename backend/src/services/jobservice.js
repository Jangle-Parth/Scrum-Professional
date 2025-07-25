// backend/src/services/jobService.js - Fixed Stage Progression
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
            console.log(`=== STAGE PROGRESSION START ===`);
            console.log(`Job ${jobEntry.soNumber}: Current stage: ${jobEntry.status}`);

            // Get fresh job entry to prevent stale data issues
            const freshJobEntry = await JobEntry.findById(jobEntry._id);
            if (!freshJobEntry) {
                console.error(`Job entry ${jobEntry.soNumber} not found in database`);
                return;
            }

            const currentStatus = freshJobEntry.status;
            console.log(`Fresh job status: ${currentStatus}`);

            // CRITICAL: Validate current stage exists in STAGE_ORDER
            const currentIndex = STAGE_ORDER.indexOf(currentStatus);
            if (currentIndex === -1) {
                console.error(`CRITICAL ERROR: Current status "${currentStatus}" not found in STAGE_ORDER`);
                console.error(`Available stages:`, STAGE_ORDER);
                return;
            }

            // Check if already at final stage
            if (currentIndex === STAGE_ORDER.length - 1) {
                console.log(`Job ${jobEntry.soNumber} is already at final stage: ${currentStatus}`);
                return;
            }

            // CRITICAL: Calculate next stage strictly based on current index
            const nextStageIndex = currentIndex + 1;
            const nextStage = STAGE_ORDER[nextStageIndex];

            console.log(`Next stage calculation:`);
            console.log(`- Current index: ${currentIndex} (${currentStatus})`);
            console.log(`- Next index: ${nextStageIndex} (${nextStage})`);

            if (!nextStage) {
                console.error(`CRITICAL ERROR: No next stage found for index ${nextStageIndex}`);
                return;
            }

            // Double-check the progression is valid
            if (nextStageIndex !== currentIndex + 1) {
                console.error(`CRITICAL ERROR: Invalid stage progression calculation`);
                console.error(`Current: ${currentIndex}, Next: ${nextStageIndex}, Expected: ${currentIndex + 1}`);
                return;
            }

            const nextDepartment = DEPARTMENT_MAP[nextStage];
            console.log(`Next department: ${nextDepartment}`);

            // Get stage assignment for next stage
            const nextStageAssignment = await StageAssignment.findOne({
                stage: nextStage,
                isActive: true,
                adminId: adminId
            });

            // CRITICAL: Build update data with explicit validation
            const updateData = {
                status: nextStage,
                currentDepartment: nextDepartment,
                assignedUsername: nextStageAssignment ? nextStageAssignment.assignedUsername : '',
                updatedAt: new Date()
            };

            // CRITICAL: Update stage history properly
            const stageHistory = [...freshJobEntry.stageHistory];

            // Mark previous stage as completed
            if (stageHistory.length > 0) {
                const lastStage = stageHistory[stageHistory.length - 1];
                if (!lastStage.completedAt) {
                    lastStage.completedAt = new Date();
                    console.log(`Marking previous stage as completed: ${lastStage.stage}`);
                }
            }

            // Add new stage to history
            const newStageEntry = {
                stage: nextStage,
                timestamp: new Date(),
                changedBy: 'System Auto-Progression',
                department: nextDepartment,
                remarks: `Auto-progressed from ${this.formatJobStatus(currentStatus)}`
            };

            stageHistory.push(newStageEntry);
            updateData.stageHistory = stageHistory;

            console.log(`Updating job with data:`, {
                fromStatus: currentStatus,
                toStatus: nextStage,
                department: nextDepartment
            });

            // CRITICAL: Use atomic update with proper conditions to prevent race conditions
            const updatedJobEntry = await JobEntry.findOneAndUpdate(
                {
                    _id: freshJobEntry._id,
                    status: currentStatus // Ensure status hasn't changed since we started
                },
                updateData,
                {
                    new: true,
                    runValidators: true
                }
            );

            if (!updatedJobEntry) {
                console.error(`CRITICAL ERROR: Failed to update job ${jobEntry.soNumber}`);
                console.error(`Possible causes: Job was updated by another process, or invalid data`);
                return;
            }

            // Verify the update was successful
            if (updatedJobEntry.status !== nextStage) {
                console.error(`CRITICAL ERROR: Job update failed. Expected: ${nextStage}, Got: ${updatedJobEntry.status}`);
                return;
            }

            console.log(`✅ Successfully updated job ${jobEntry.soNumber} to stage ${nextStage}`);

            // Handle dispatched stage
            if (nextStage === 'dispatched') {
                await this.createDispatchedJobAnalysis(updatedJobEntry);
            }

            // Create task for next stage
            if (nextStageAssignment) {
                await this.createAndNotifyStageTask(updatedJobEntry, nextStage, nextStageAssignment);
            }

            await activityService.logActivity(
                adminId,
                'auto_progress',
                'job_entry',
                jobEntry._id,
                `Auto-progressed job ${jobEntry.soNumber} from ${this.formatJobStatus(currentStatus)} to ${this.formatJobStatus(nextStage)}`
            );

            console.log(`=== STAGE PROGRESSION SUCCESS ===`);

        } catch (error) {
            console.error(`=== STAGE PROGRESSION FAILED ===`);
            console.error('Critical error in moveJobToNextStage:', error);
            console.error('Stack trace:', error.stack);

            // Log the error but don't throw to prevent cascading failures
            await activityService.logActivity(
                adminId,
                'error',
                'job_entry',
                jobEntry._id,
                `CRITICAL ERROR: Failed to progress job ${jobEntry.soNumber}: ${error.message}`
            );
        }
    }

    async createAndNotifyStageTask(jobEntry, currentStage, stageAssignment) {
        try {
            console.log(`Creating task for job ${jobEntry.soNumber} at stage ${currentStage}`);

            // CRITICAL FIX: Validate user exists and username is not corrupted
            let user = await User.findOne({
                username: stageAssignment.assignedUsername,
                adminId: jobEntry.adminId,
                status: 'active'
            });

            // Additional validation for username corruption
            if (!user || !stageAssignment.assignedUsername || stageAssignment.assignedUsername === 'jpg') {
                console.error(`CRITICAL ERROR: Invalid user assignment detected`);
                console.error(`Stage: ${currentStage}, Username: ${stageAssignment.assignedUsername}`);

                // Try to find any active user for this stage as fallback
                const fallbackUsers = await User.find({
                    adminId: jobEntry.adminId,
                    status: 'active',
                    role: DEPARTMENT_MAP[currentStage]
                }).limit(1);

                if (fallbackUsers.length > 0) {
                    user = fallbackUsers[0];
                    console.log(`Using fallback user: ${user.username} for stage ${currentStage}`);

                    // Update the stage assignment to prevent future issues
                    await StageAssignment.findByIdAndUpdate(stageAssignment._id, {
                        assignedUsername: user.username
                    });
                } else {
                    console.error(`No valid users found for stage ${currentStage}`);
                    return;
                }
            }

            // Create or find parent task
            let parentTask = await Task.findOne({
                soNumber: jobEntry.soNumber,
                parentTask: null,
                adminId: jobEntry.adminId
            });

            if (!parentTask) {
                parentTask = new Task({
                    title: `${jobEntry.soNumber} - ${jobEntry.customer} Tasks`,
                    description: `Parent task group for all tasks related to SO# ${jobEntry.soNumber}`,
                    assignedTo: user._id,
                    assignedToName: user.name,
                    soNumber: jobEntry.soNumber,
                    priority: 'medium',
                    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    adminId: jobEntry.adminId,
                    status: 'pending',
                    stage: 'parent'
                });
                await parentTask.save();
                console.log(`Created parent task for SO# ${jobEntry.soNumber}`);
            }

            // Check for existing tasks
            const existingTask = await Task.findOne({
                soNumber: jobEntry.soNumber,
                stage: currentStage,
                adminId: jobEntry.adminId,
                status: { $in: ['pending', 'in_progress'] }
            });

            if (existingTask) {
                console.log(`Task already exists for SO# ${jobEntry.soNumber} stage ${currentStage}`);
                return;
            }

            // Create new task with proper validation
            const taskData = {
                title: `${stageAssignment.taskTitle} - ${jobEntry.soNumber}`,
                description: `${stageAssignment.taskDescription || ''}\n\nJob Details:\nSO#: ${jobEntry.soNumber}\nCustomer: ${jobEntry.customer}\nItem: ${jobEntry.itemCode}\nParticulars: ${jobEntry.particularsAndModels}\nQuantity: ${jobEntry.qty}\n\nStage: ${this.formatJobStatus(currentStage)}`,
                assignedTo: user._id,
                assignedToName: user.name,
                parentTask: parentTask._id,
                parentTaskName: parentTask.title,
                soNumber: jobEntry.soNumber,
                stage: currentStage,
                priority: 'medium',
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                adminId: jobEntry.adminId,
                status: 'pending'
            };

            const task = new Task(taskData);
            await task.save();

            console.log(`✅ Created task for SO# ${jobEntry.soNumber} stage ${currentStage} assigned to ${user.name}`);

            await activityService.logActivity(
                jobEntry.adminId,
                'create',
                'task',
                task._id,
                `Auto-created task for job ${jobEntry.soNumber} stage ${currentStage} - assigned to ${user.name}`
            );

        } catch (error) {
            console.error('Error creating stage task:', error);
        }
    }

    async updateJobStatus(jobId, { status, changedBy, remarks, holdReason, cancelReason, restartReason }) {
        try {
            console.log(`=== JOB STATUS UPDATE START ===`);
            console.log(`Job ID: ${jobId}, New Status: ${status}`);

            const jobEntry = await JobEntry.findById(jobId);
            if (!jobEntry) {
                throw new Error('Job entry not found');
            }

            const currentStatus = jobEntry.status;
            console.log(`Current status: ${currentStatus}, Requested status: ${status}`);

            // CRITICAL: Enhanced validation to prevent invalid transitions
            if (!this.isValidStatusTransition(currentStatus, status)) {
                const errorMsg = `Invalid status transition from "${currentStatus}" to "${status}"`;
                console.error(`CRITICAL ERROR: ${errorMsg}`);
                throw new Error(errorMsg);
            }

            // Handle special status updates
            if (status === 'hold') {
                return await this.handleJobHold(jobEntry, holdReason || remarks, changedBy);
            }

            if (status === 'so_cancelled') {
                return await this.handleJobCancellation(jobEntry, cancelReason || remarks, changedBy);
            }

            // Handle restart from hold with strict validation
            if (currentStatus === 'hold' && status !== 'hold' && status !== 'so_cancelled') {
                return await this.handleJobRestart(jobEntry, status, restartReason || remarks, changedBy);
            }

            // CRITICAL: Normal status update with stage order validation
            return await this.handleNormalStatusUpdate(jobEntry, status, remarks, changedBy);

        } catch (error) {
            console.error('=== JOB STATUS UPDATE FAILED ===');
            console.error('Error updating job status:', error);
            throw error;
        }
    }

    // CRITICAL: Enhanced validation to prevent stage skipping
    isValidStatusTransition(currentStatus, newStatus) {
        console.log(`Validating transition: ${currentStatus} -> ${newStatus}`);

        // Allow any transition to hold or cancel
        if (newStatus === 'hold' || newStatus === 'so_cancelled') {
            console.log(`✅ Valid transition: Special status (${newStatus})`);
            return true;
        }

        // Allow restart from hold to any valid stage
        if (currentStatus === 'hold') {
            const isValidStage = STAGE_ORDER.includes(newStatus);
            console.log(`${isValidStage ? '✅' : '❌'} Hold restart to: ${newStatus}`);
            return isValidStage;
        }

        // CRITICAL: For normal progression, only allow same stage or next stage
        const currentIndex = STAGE_ORDER.indexOf(currentStatus);
        const newIndex = STAGE_ORDER.indexOf(newStatus);

        if (currentIndex === -1) {
            console.log(`❌ Invalid current status: ${currentStatus}`);
            return false;
        }

        if (newIndex === -1) {
            console.log(`❌ Invalid new status: ${newStatus}`);
            return false;
        }

        // Allow same stage or next stage only (no skipping)
        const isValid = newIndex >= currentIndex && newIndex <= currentIndex + 1;

        console.log(`Stage validation:`);
        console.log(`- Current index: ${currentIndex} (${currentStatus})`);
        console.log(`- New index: ${newIndex} (${newStatus})`);
        console.log(`- Difference: ${newIndex - currentIndex}`);
        console.log(`- Valid: ${isValid ? '✅' : '❌'}`);

        if (!isValid) {
            console.log(`❌ BLOCKED: Attempted to skip ${newIndex - currentIndex - 1} stage(s)`);
        }

        return isValid;
    }

    async handleJobHold(jobEntry, reason, changedBy) {
        // Cancel related tasks
        await Task.updateMany(
            {
                adminId: jobEntry.adminId,
                soNumber: jobEntry.soNumber,
                status: { $in: ['pending', 'in_progress', 'pending_approval'] }
            },
            {
                status: 'cancelled',
                updatedAt: new Date(),
                remarks: `Job ${jobEntry.soNumber} put on hold: ${reason}`
            }
        );

        const updateData = {
            status: 'hold',
            holdReason: reason,
            holdDate: new Date(),
            assignedUsername: '',
            currentDepartment: 'Sales',
            updatedAt: new Date()
        };

        // Update stage history
        const stageHistory = [...jobEntry.stageHistory];
        if (stageHistory.length > 0) {
            const lastStage = stageHistory[stageHistory.length - 1];
            if (!lastStage.completedAt) {
                lastStage.completedAt = new Date();
            }
        }

        stageHistory.push({
            stage: 'hold',
            timestamp: new Date(),
            changedBy: changedBy || 'Admin',
            remarks: reason || 'Job put on hold',
            department: 'Sales'
        });

        updateData.stageHistory = stageHistory;

        const updatedEntry = await JobEntry.findByIdAndUpdate(
            jobEntry._id,
            updateData,
            { new: true, runValidators: true }
        );

        await this.sendJobHoldEmail(updatedEntry, reason, changedBy || 'Admin');

        return {
            success: true,
            entry: updatedEntry,
            message: 'Job put on hold successfully'
        };
    }

    async handleJobCancellation(jobEntry, reason, changedBy) {
        // Cancel all related tasks
        await Task.updateMany(
            {
                adminId: jobEntry.adminId,
                soNumber: jobEntry.soNumber,
                status: { $in: ['pending', 'in_progress', 'pending_approval'] }
            },
            {
                status: 'cancelled',
                updatedAt: new Date(),
                remarks: `Sales Order ${jobEntry.soNumber} cancelled: ${reason}`
            }
        );

        const updateData = {
            status: 'so_cancelled',
            cancelReason: reason,
            cancelDate: new Date(),
            assignedUsername: '',
            currentDepartment: 'Cancelled',
            updatedAt: new Date()
        };

        // Update stage history
        const stageHistory = [...jobEntry.stageHistory];
        if (stageHistory.length > 0) {
            const lastStage = stageHistory[stageHistory.length - 1];
            if (!lastStage.completedAt) {
                lastStage.completedAt = new Date();
            }
        }

        stageHistory.push({
            stage: 'so_cancelled',
            timestamp: new Date(),
            changedBy: changedBy || 'Admin',
            remarks: reason || 'Sales order cancelled',
            department: 'Cancelled'
        });

        updateData.stageHistory = stageHistory;

        const updatedEntry = await JobEntry.findByIdAndUpdate(
            jobEntry._id,
            updateData,
            { new: true, runValidators: true }
        );

        await this.sendJobCancelEmail(updatedEntry, reason, changedBy || 'Admin');

        return {
            success: true,
            entry: updatedEntry,
            message: 'Sales order cancelled successfully'
        };
    }

    async handleJobRestart(jobEntry, newStatus, reason, changedBy) {
        // Validate restart stage
        if (!STAGE_ORDER.includes(newStatus)) {
            throw new Error(`Invalid restart stage: ${newStatus}`);
        }

        const stageAssignment = await StageAssignment.findOne({
            stage: newStatus,
            isActive: true,
            adminId: jobEntry.adminId
        });

        const updateData = {
            status: newStatus,
            assignedUsername: stageAssignment ? stageAssignment.assignedUsername : '',
            currentDepartment: DEPARTMENT_MAP[newStatus],
            holdReason: null,
            holdDate: null,
            updatedAt: new Date()
        };

        // Update stage history
        const stageHistory = [...jobEntry.stageHistory];
        stageHistory.push({
            stage: newStatus,
            timestamp: new Date(),
            changedBy: changedBy || 'Admin',
            remarks: reason || `Restarted from hold to ${this.formatJobStatus(newStatus)}`,
            department: DEPARTMENT_MAP[newStatus]
        });

        updateData.stageHistory = stageHistory;

        const updatedEntry = await JobEntry.findByIdAndUpdate(
            jobEntry._id,
            updateData,
            { new: true, runValidators: true }
        );

        // Create new task for restarted stage
        if (stageAssignment) {
            await this.createAndNotifyStageTask(updatedEntry, newStatus, stageAssignment);
        }

        await this.sendJobRestartEmail(updatedEntry, newStatus, reason, changedBy || 'Admin');

        return {
            success: true,
            entry: updatedEntry,
            message: `Job restarted from hold to ${this.formatJobStatus(newStatus)}`
        };
    }

    async handleNormalStatusUpdate(jobEntry, newStatus, remarks, changedBy) {
        try {
            console.log(`Handling normal status update for ${jobEntry.soNumber}: ${jobEntry.status} -> ${newStatus}`);

            const stageAssignment = await StageAssignment.findOne({
                stage: newStatus,
                isActive: true,
                adminId: jobEntry.adminId
            });

            const updateData = {
                status: newStatus,
                assignedUsername: stageAssignment ? stageAssignment.assignedUsername : '',
                currentDepartment: DEPARTMENT_MAP[newStatus] || 'Unknown',
                updatedAt: new Date()
            };

            // Update stage history
            const stageHistory = [...jobEntry.stageHistory];
            if (stageHistory.length > 0) {
                const lastStage = stageHistory[stageHistory.length - 1];
                if (!lastStage.completedAt) {
                    lastStage.completedAt = new Date();
                }
            }

            stageHistory.push({
                stage: newStatus,
                timestamp: new Date(),
                changedBy: changedBy || 'Admin',
                remarks: remarks,
                department: DEPARTMENT_MAP[newStatus] || 'Unknown'
            });

            updateData.stageHistory = stageHistory;

            const updatedEntry = await JobEntry.findByIdAndUpdate(
                jobEntry._id,
                updateData,
                { new: true, runValidators: true }
            );

            // Handle dispatched status
            if (newStatus === 'dispatched') {
                await this.createDispatchedJobAnalysis(updatedEntry);
            }

            // Create task for new stage
            if (stageAssignment) {
                await this.createAndNotifyStageTask(updatedEntry, newStatus, stageAssignment);
            }

            return {
                success: true,
                entry: updatedEntry,
                message: 'Job status updated successfully'
            };
        } catch (error) {
            console.error('Error in handleNormalStatusUpdate:', error);
            throw error;
        }
    }

    // Rest of the methods remain the same...
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

    async sendJobStageTaskEmail(assignedUser, jobEntry, stage, task) {
        const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0;">🏭 New Job Stage Assignment</h1>
            </div>
            <div style="padding: 30px;">
                <h2>Hello ${assignedUser.name}!</h2>
                <p>A new job has reached your stage and requires your attention:</p>
                
                <div style="border: 2px solid #4facfe; border-radius: 12px; padding: 25px; margin: 25px 0; background: #f0f8ff;">
                    <h3 style="color: #4facfe; margin: 0 0 15px 0;">📋 ${userTask.title}</h3>
                    <div style="margin: 10px 0;">
                        <strong>📝 Description:</strong> ${userTask.description || 'No description provided'}
                    </div>
                    <div style="margin: 10px 0;">
                        <strong>👤 Assigned by:</strong> ${assigningUser.name} (${assigningUser.role})
                    </div>
                    <div style="margin: 10px 0;">
                        <strong>📅 Due Date:</strong> ${new Date(userTask.dueDate).toLocaleDateString()}
                    </div>
                    <div style="margin: 10px 0;">
                        <strong>🚨 Priority:</strong> ${userTask.priority.toUpperCase()}
                    </div>
                    <div style="margin: 10px 0;">
                        <strong>⏰ Assigned Date:</strong> ${new Date().toLocaleString()}
                    </div>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
                       style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); 
                              color: white; padding: 15px 30px; border-radius: 25px; 
                              text-decoration: none; font-weight: bold; display: inline-block;">
                        📊 Open Dashboard
                    </a>
                </div>
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px;">
                <p>Task assigned by ${assigningUser.name} on ${new Date().toLocaleString()}</p>
                <p>ScrumFlow - Team Collaboration Platform 🚀</p>
            </div>
        </div>
        `;


        const subject = `New Job Stage Task Assigned: ${jobEntry.soNumber} - ${this.formatJobStatus(stage)}`;
        await emailService.sendEmail({
            to: assignedUser.email,
            subject,
            html: htmlContent
        });


        console.log(`Sent job stage task email to ${assignedUser.email} for job ${jobEntry.soNumber}`);
    }

    async sendJobHoldEmail(jobEntry, reason, adminName) {
        try {
            const recipients = NOTIFICATION_RECIPIENTS.hold;

            if (!recipients || recipients.length === 0) {
                console.log('No recipients configured for hold notifications');
                return;
            }

            const htmlContent = `
    < div style = "font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;" >
                <div style="background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">⏸️ Job Put on Hold</h1>
                </div>
                <div style="padding: 30px;">
                    <h2>Job Hold Notification</h2>
                    <p>The following job has been put on <strong>HOLD</strong>:</p>
                    
                    <div style="border: 2px solid #ffc107; border-radius: 12px; padding: 25px; margin: 25px 0;">
                        <h3 style="color: #856404;">📋 Job Details</h3>
                        <div><strong>S.O#:</strong> ${jobEntry.soNumber}</div>
                        <div><strong>Customer:</strong> ${jobEntry.customer}</div>
                        <div><strong>Item Code:</strong> ${jobEntry.itemCode}</div>
                        <div><strong>Particulars:</strong> ${jobEntry.particularsAndModels}</div>
                        <div><strong>Quantity:</strong> ${jobEntry.qty}</div>
                        <div><strong>Hold Date:</strong> ${new Date().toLocaleString()}</div>
                        ${reason ? `<div><strong>Hold Reason:</strong> ${reason}</div>` : ''}
                        <div><strong>Put on Hold by:</strong> ${adminName}</div>
                    </div>
                </div>
            </div >
    `;

            const emailPromises = recipients.map(user =>
                emailService.sendEmail(
                    user,
                    `⏸️ Job Hold: ${jobEntry.soNumber} - ${jobEntry.customer} `,
                    htmlContent
                )
            );

            await Promise.all(emailPromises);
            console.log(`Job hold notification sent to ${recipients.length} users for job ${jobEntry.soNumber}`);
        } catch (error) {
            console.error('Error sending job hold email:', error);
        }
    }

    async sendJobCancelEmail(jobEntry, reason, adminName) {
        try {
            const recipients = NOTIFICATION_RECIPIENTS.cancel;

            if (!recipients || recipients.length === 0) {
                console.log('No recipients configured for cancel notifications');
                return;
            }

            const htmlContent = `
    < div style = "font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;" >
                <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">❌ Sales Order Cancelled</h1>
                </div>
                <div style="padding: 30px;">
                    <h2>Sales Order Cancellation Notice</h2>
                    <p>The following sales order has been <strong>CANCELLED</strong>:</p>
                    
                    <div style="border: 2px solid #dc3545; border-radius: 12px; padding: 25px; margin: 25px 0;">
                        <h3 style="color: #721c24;">📋 Cancelled Job Details</h3>
                        <div><strong>S.O#:</strong> ${jobEntry.soNumber}</div>
                        <div><strong>Customer:</strong> ${jobEntry.customer}</div>
                        <div><strong>Item Code:</strong> ${jobEntry.itemCode}</div>
                        <div><strong>Particulars:</strong> ${jobEntry.particularsAndModels}</div>
                        <div><strong>Quantity:</strong> ${jobEntry.qty}</div>
                        <div><strong>Cancellation Date:</strong> ${new Date().toLocaleString()}</div>
                        ${reason ? `<div><strong>Cancellation Reason:</strong> ${reason}</div>` : ''}
                        <div><strong>Cancelled by:</strong> ${adminName}</div>
                    </div>
                </div>
            </div >
    `;

            const emailPromises = recipients.map(user =>
                emailService.sendEmail(
                    user,
                    `❌ SO Cancelled: ${jobEntry.soNumber} - ${jobEntry.customer} `,
                    htmlContent
                )
            );

            await Promise.all(emailPromises);
            console.log(`Job cancellation notification sent to ${recipients.length} users for job ${jobEntry.soNumber}`);
        } catch (error) {
            console.error('Error sending job cancellation email:', error);
        }
    }

    async sendJobRestartEmail(jobEntry, fromStage, reason, adminName) {
        try {
            const recipients = NOTIFICATION_RECIPIENTS.restart;

            if (!recipients || recipients.length === 0) {
                console.log('No recipients configured for restart notifications');
                return;
            }

            const htmlContent = `
    < div style = "font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;" >
                <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">▶️ Job Restarted from Hold</h1>
                </div>
                <div style="padding: 30px;">
                    <h2>Job Restart Notification</h2>
                    <p>The following job has been <strong>RESTARTED</strong> from hold status:</p>
                    
                    <div style="border: 2px solid #28a745; border-radius: 12px; padding: 25px; margin: 25px 0;">
                        <h3 style="color: #155724;">📋 Job Details</h3>
                        <div><strong>S.O#:</strong> ${jobEntry.soNumber}</div>
                        <div><strong>Customer:</strong> ${jobEntry.customer}</div>
                        <div><strong>Item Code:</strong> ${jobEntry.itemCode}</div>
                        <div><strong>Particulars:</strong> ${jobEntry.particularsAndModels}</div>
                        <div><strong>Quantity:</strong> ${jobEntry.qty}</div>
                        <div><strong>Restart Date:</strong> ${new Date().toLocaleString()}</div>
                        <div><strong>Restarting from Stage:</strong> ${this.formatJobStatus(fromStage)}</div>
                        ${reason ? `<div><strong>Restart Reason:</strong> ${reason}</div>` : ''}
                        <div><strong>Restarted by:</strong> ${adminName}</div>
                    </div>
                </div>
            </div >
    `;

            const emailPromises = recipients.map(user =>
                emailService.sendEmail(
                    user,
                    `▶️ Job Restarted: ${jobEntry.soNumber} - ${jobEntry.customer} `,
                    htmlContent
                )
            );

            await Promise.all(emailPromises);
            console.log(`Job restart notification sent to ${recipients.length} users for job ${jobEntry.soNumber}`);
        } catch (error) {
            console.error('Error sending job restart email:', error);
        }
    }
}

module.exports = new JobService();