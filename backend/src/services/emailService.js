
// src/services/emailService.js
const transporter = require('../config/email');
const { NOTIFICATION_RECIPIENTS } = require('../utils/constants');

class EmailService {
    async sendEmail(to, subject, htmlContent) {
        try {
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to,
                subject,
                html: htmlContent
            });
            console.log('Email sent successfully to:', to);
        } catch (error) {
            console.error('Failed to send email:', error);
            throw error;
        }
    }

    async sendUserTaskAssignmentEmail(assignedUser, assigningUser, userTask) {
        const htmlContent = this.generateTaskAssignmentEmailTemplate(
            assignedUser,
            assigningUser,
            userTask
        );

        try {
            await this.sendEmail(
                assignedUser.email,
                `📋 New Task from ${assigningUser.name}: ${userTask.title} `,
                htmlContent
            );
            console.log(`User task assignment email sent to ${assignedUser.email} `);
        } catch (error) {
            console.error(`Failed to send user task assignment email: `, error);
            throw error;
        }
    }


    async sendTaskCompletionNotificationEmail(assigningUser, completingUser, userTask) {
        const htmlContent = `
    < div style = "font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;" >
            <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0;">✅ Task Completed by Team Member</h1>
            </div>
            <div style="padding: 30px;">
                <h2>Hello ${assigningUser.name}!</h2>
                <p><strong>${completingUser.name}</strong> has completed the task you assigned:</p>
                
                <div style="border: 2px solid #28a745; border-radius: 12px; padding: 25px; margin: 25px 0;">
                    <h3 style="color: #28a745;">📋 ${userTask.title}</h3>
                    <div><strong>✅ Status:</strong> Completed ${userTask.isOnTime ? 'ON TIME' : 'LATE'}</div>
                    <div><strong>👤 Completed by:</strong> ${completingUser.name}</div>
                    <div><strong>📅 Due Date:</strong> ${new Date(userTask.dueDate).toLocaleDateString()}</div>
                    <div><strong>🏁 Completed Date:</strong> ${new Date(userTask.completedAt).toLocaleString()}</div>
                </div>
            </div>
        </div >
    `;

        try {
            await this.sendEmail(
                assigningUser.email,
                `✅ Task Completed: ${userTask.title} `,
                htmlContent
            );
        } catch (error) {
            console.log('Completion notification email failed:', error);
        }
    }

    async sendMiddleLevelValidationRequest(validator, assignee, task) {
        const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0;">⚡ Middle Level Validation Required</h1>
            </div>
            <div style="padding: 30px;">
                <h2>Hello ${validator.name}!</h2>
                <p><strong>${assignee.name}</strong> has completed a task that requires your validation before admin approval:</p>
                
                <div style="border: 2px solid #ffc107; border-radius: 12px; padding: 25px; margin: 25px 0;">
                    <h3 style="color: #856404;">📋 ${task.title}</h3>
                    <div><strong>📝 Description:</strong> ${task.description || 'No description provided'}</div>
                    <div><strong>👤 Completed by:</strong> ${assignee.name}</div>
                    <div><strong>📅 Due Date:</strong> ${new Date(task.dueDate).toLocaleDateString()}</div>
                    <div><strong>🚨 Priority:</strong> ${task.priority.toUpperCase()}</div>
                    <div><strong>📊 Progress:</strong> ${task.progress || 0}%</div>
                    <div><strong>⏰ Completion Date:</strong> ${new Date(task.completedAt).toLocaleString()}</div>
                </div>

                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h4 style="color: #856404; margin: 0 0 10px 0;">🎯 Your Action Required:</h4>
                    <p style="margin: 0; color: #856404;">
                        Please review the task completion and either <strong>approve</strong> or <strong>reject</strong> it. 
                        If approved, it will go to admin for final approval. If rejected, it will be sent back to ${assignee.name}.
                    </p>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
                       style="background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%); 
                              color: white; padding: 15px 30px; border-radius: 25px; 
                              text-decoration: none; font-weight: bold; display: inline-block;">
                        🔍 Review & Validate Task
                    </a>
                </div>
            </div>
        </div>
    `;

        try {
            await this.sendEmail(
                validator.email,
                `⚡ Middle Level Validation Required: ${task.title}`,
                htmlContent
            );
            console.log(`Middle level validation email sent to ${validator.email}`);
        } catch (error) {
            console.error('Failed to send middle level validation email:', error);
        }
    }

    // Enhanced task assignment email with document attachment info
    async sendUserTaskAssignmentEmail(assignedUser, assigningUser, userTask) {
        const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0;">📋 New Task Assignment</h1>
            </div>
            <div style="padding: 30px;">
                <h2 style="color: #2c3e50;">Hello ${assignedUser.name}!</h2>
                <p style="font-size: 16px; color: #555;">
                    <strong>${assigningUser.name}</strong> has assigned you a new task:
                </p>
                
                <div style="border: 2px solid #4facfe; border-radius: 12px; padding: 25px; margin: 25px 0; background: #f0f8ff;">
                    <h3 style="color: #4facfe;">📋 ${userTask.title}</h3>
                    
                    <div><strong>📝 Description:</strong> ${userTask.description || 'No description provided'}</div>
                    <div><strong>📅 Due Date:</strong> ${new Date(userTask.dueDate).toLocaleDateString()}</div>
                    <div><strong>🚨 Priority:</strong> ${userTask.priority.toUpperCase()}</div>
                    <div><strong>⏰ Assigned Date:</strong> ${new Date().toLocaleString()}</div>
                    
                    ${userTask.attachedDocument ? `
                        <div style="background: #e8f5e8; padding: 10px; border-radius: 6px; margin: 10px 0;">
                            <strong>📎 Document Attached:</strong> ${userTask.attachedDocument.originalName}
                            <br><small>Size: ${Math.round(userTask.attachedDocument.size / 1024)} KB</small>
                        </div>
                    ` : ''}
                    
                    ${userTask.notes ? `
                        <div style="background: #fff3cd; padding: 10px; border-radius: 6px; margin: 10px 0;">
                            <strong>📝 Additional Notes:</strong> ${userTask.notes}
                        </div>
                    ` : ''}
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

        try {
            await this.sendEmail(
                assignedUser.email,
                `📋 New Task from ${assigningUser.name}: ${userTask.title}`,
                htmlContent
            );
            console.log(`Task assignment email sent to ${assignedUser.email}`);
        } catch (error) {
            console.error('Failed to send task assignment email:', error);
        }
    }

    // Enhanced delay request notification email
    async sendDelayRequestEmail(adminUser, employee, task, delayRequest) {
        const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #ff9500 0%, #ff5722 100%); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0;">⏰ Task Delay Request</h1>
            </div>
            <div style="padding: 30px;">
                <h2>Hello Admin!</h2>
                <p><strong>${employee.name}</strong> has requested a delay for the following task:</p>
                
                <div style="border: 2px solid #ff9500; border-radius: 12px; padding: 25px; margin: 25px 0;">
                    <h3 style="color: #e65100;">📋 ${task.title}</h3>
                    <div><strong>📝 Description:</strong> ${task.description || 'No description provided'}</div>
                    <div><strong>👤 Assigned to:</strong> ${employee.name}</div>
                    <div><strong>📅 Current Due Date:</strong> ${new Date(delayRequest.currentDueDate).toLocaleDateString()}</div>
                    <div><strong>📅 Requested Due Date:</strong> ${new Date(delayRequest.requestedDueDate).toLocaleDateString()}</div>
                    <div><strong>📊 Current Progress:</strong> ${task.progress || 0}%</div>
                    <div><strong>⏰ Request Date:</strong> ${new Date(delayRequest.requestDate).toLocaleString()}</div>
                    
                    <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin: 15px 0;">
                        <strong>💬 Reason for Delay:</strong>
                        <p style="margin: 5px 0 0 0;">${delayRequest.reason}</p>
                    </div>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
                       style="background: linear-gradient(135deg, #ff9500 0%, #ff5722 100%); 
                              color: white; padding: 15px 30px; border-radius: 25px; 
                              text-decoration: none; font-weight: bold; display: inline-block;">
                        🏛️ Review Delay Request
                    </a>
                </div>
            </div>
        </div>
    `;

        try {
            await this.sendEmail(
                adminUser.email,
                `⏰ Task Delay Request: ${task.title}`,
                htmlContent
            );
            console.log(`Delay request email sent to admin: ${adminUser.email}`);
        } catch (error) {
            console.error('Failed to send delay request email:', error);
        }
    }

    // Enhanced completion request email with middle level validation info
    async sendCompletionRequestEmail(adminUser, employee, task) {
        const validationInfo = task.needsMiddleLevelValidation ?
            `<div style="background: #d1edff; padding: 10px; border-radius: 6px; margin: 10px 0;">
            <strong>✅ Middle Level Validation:</strong> Approved by ${task.middleLevelValidatedBy}
            ${task.middleLevelRemarks ? `<br><strong>Validator Notes:</strong> ${task.middleLevelRemarks}` : ''}
        </div>` : '';

        const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0;">⏳ Task Completion Request</h1>
            </div>
            <div style="padding: 30px;">
                <h2>Hello Admin!</h2>
                <p><strong>${employee.name}</strong> has requested approval to mark the following task as completed:</p>
                
                <div style="border: 2px solid #ffc107; border-radius: 12px; padding: 25px; margin: 25px 0;">
                    <h3 style="color: #856404;">📋 ${task.title}</h3>
                    <div><strong>📝 Description:</strong> ${task.description || 'No description provided'}</div>
                    <div><strong>👤 Assigned to:</strong> ${employee.name}</div>
                    <div><strong>📅 Due Date:</strong> ${new Date(task.dueDate).toLocaleDateString()}</div>
                    <div><strong>🚨 Priority:</strong> ${task.priority.toUpperCase()}</div>
                    <div><strong>📊 Progress:</strong> ${task.progress || 0}%</div>
                    <div><strong>⏰ Request Date:</strong> ${new Date().toLocaleString()}</div>
                    ${task.remarks ? `<div><strong>💬 Remarks:</strong> ${task.remarks}</div>` : ''}
                    
                    ${validationInfo}
                    
                    ${task.attachedDocument ? `
                        <div style="background: #e8f5e8; padding: 10px; border-radius: 6px; margin: 10px 0;">
                            <strong>📎 Document:</strong> ${task.attachedDocument.originalName}
                        </div>
                    ` : ''}
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
                       style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                              color: white; padding: 15px 30px; border-radius: 25px; 
                              text-decoration: none; font-weight: bold; display: inline-block;">
                        🏛️ Open Admin Dashboard
                    </a>
                </div>
            </div>
        </div>
    `;

        try {
            await this.sendEmail(
                adminUser.email,
                `⏳ Task Completion Request: ${task.title}`,
                htmlContent
            );
            console.log(`Completion request email sent to admin: ${adminUser.email}`);
        } catch (error) {
            console.error(`Failed to send completion request email:`, error);
        }
    }


    async sendCompletionRequestEmail(adminUser, employee, task) {
        const htmlContent = `
    < div style = "font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;" >
            <div style="background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0;">⏳ Task Completion Request</h1>
            </div>
            <div style="padding: 30px;">
                <h2>Hello Admin!</h2>
                <p><strong>${employee.name}</strong> has requested approval to mark the following task as completed:</p>
                
                <div style="border: 2px solid #ffc107; border-radius: 12px; padding: 25px; margin: 25px 0;">
                    <h3 style="color: #856404;">📋 ${task.title}</h3>
                    <div><strong>📝 Description:</strong> ${task.description || 'No description provided'}</div>
                    <div><strong>👤 Assigned to:</strong> ${employee.name}</div>
                    <div><strong>📅 Due Date:</strong> ${new Date(task.dueDate).toLocaleDateString()}</div>
                    <div><strong>🚨 Priority:</strong> ${task.priority.toUpperCase()}</div>
                    <div><strong>📊 Progress:</strong> ${task.progress || 0}%</div>
                    <div><strong>⏰ Request Date:</strong> ${new Date().toLocaleString()}</div>
                    ${task.remarks ? `<div><strong>💬 Remarks:</strong> ${task.remarks}</div>` : ''}
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
                       style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                              color: white; padding: 15px 30px; border-radius: 25px; 
                              text-decoration: none; font-weight: bold; display: inline-block;">
                        🏛️ Open Admin Dashboard
                    </a>
                </div>
            </div>
        </div >
    `;

        try {
            await this.sendEmail(
                adminUser.email,
                `⏳ Task Completion Request: ${task.title} `,
                htmlContent
            );
            console.log(`Completion request email sent to admin: ${adminUser.email} `);
        } catch (error) {
            console.error(`Failed to send completion request email: `, error);
        }
    }

    async sendTaskCompletionEmail(user, task) {
        const htmlContent = `
    < div style = "font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;" >
            <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0;">🎉 Task Completed!</h1>
            </div>
            <div style="padding: 30px;">
                <h2>Congratulations ${user.name}!</h2>
                <p>You have successfully completed: <strong>${task.title}</strong></p>
                <div style="text-align: center; margin: 30px 0;">
                    <span style="background: #28a745; color: white; padding: 10px 20px; border-radius: 20px; font-weight: bold;">
                        ✅ COMPLETED ${task.isOnTime ? 'ON TIME' : 'LATE'}
                    </span>
                </div>
            </div>
        </div >
    `;

        try {
            await this.sendEmail(user.email, '🎉 Task Completed - ScrumFlow', htmlContent);
        } catch (error) {
            console.log('Email sending failed:', error);
        }
    }


    async sendPendingTasksEmail(user, tasks) {
        const htmlContent = `
    < div style = "font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;" >
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0;">📋 ScrumFlow - Daily Task Reminder</h1>
            </div>
            <div style="padding: 30px;">
                <h2>Hello ${user.name}!</h2>
                <p>You have <strong>${tasks.length}</strong> pending task(s) that need your attention:</p>
                
                ${tasks.map(task => {
            const isOverdue = new Date(task.dueDate) < new Date();
            const priorityColors = {
                low: '#28a745',
                medium: '#ffc107',
                high: '#fd7e14',
                critical: '#dc3545'
            };

            return `
                        <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin: 15px 0; border-left: 4px solid ${priorityColors[task.priority]};">
                            <h3 style="margin: 0 0 10px 0; color: #2c3e50;">${task.title}</h3>
                            <p style="margin: 5px 0; color: #666;">${task.description || 'No description'}</p>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px;">
                                <span style="background: ${priorityColors[task.priority]}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; text-transform: uppercase;">${task.priority}</span>
                                <span style="color: ${isOverdue ? '#dc3545' : '#555'}; font-weight: ${isOverdue ? 'bold' : 'normal'};">
                                    Due: ${new Date(task.dueDate).toLocaleDateString()}
                                    ${isOverdue ? ' (OVERDUE)' : ''}
                                </span>
                            </div>
                            <div style="background: #f8f9fa; border-radius: 4px; height: 8px; margin-top: 10px; overflow: hidden;">
                                <div style="background: #667eea; height: 100%; width: ${task.progress}%; transition: width 0.3s ease;"></div>
                            </div>
                            <small style="color: #888;">${task.progress}% Complete</small>
                        </div>
                    `;
        }).join('')}
                
                <div style="text-align: center; margin-top: 30px;">
                    <a href="https://atpl-scrum.netlify.app/" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; border-radius: 25px; text-decoration: none; font-weight: bold;">
                        Open ScrumFlow Dashboard
                    </a>
                </div>
            </div>
        </div >
    `;

        await this.sendEmail(user.email, '📋 Daily Task Reminder - ScrumFlow', htmlContent);
    }

    generateTaskAssignmentEmailTemplate(assignedUser, assigningUser, userTask) {
        return `
    < div style = "font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;" >
            <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0;">📋 New Task from Team Member</h1>
            </div>
            <div style="padding: 30px;">
                <h2 style="color: #2c3e50;">Hello ${assignedUser.name}!</h2>
                <p style="font-size: 16px; color: #555;">
                    <strong>${assigningUser.name}</strong> has assigned you a new task:
                </p>
                
                <div style="border: 2px solid #4facfe; border-radius: 12px; padding: 25px; margin: 25px 0; background: #f0f8ff;">
                    <h3 style="color: #4facfe;">📋 ${task.title}</h3>
                    
                    <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 15px 0;">
                        <h4 style="color: #1976d2;">🏭 Job Details:</h4>
                        <div><strong>S.O#:</strong> ${jobEntry.soNumber}</div>
                        <div><strong>Customer:</strong> ${jobEntry.customer}</div>
                        <div><strong>Item Code:</strong> ${jobEntry.itemCode}</div>
                        <div><strong>Particulars:</strong> ${jobEntry.particularsAndModels}</div>
                        <div><strong>Quantity:</strong> ${jobEntry.qty}</div>
                    </div>

                    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0;">
                        <h4 style="color: #856404;">🎯 Your Stage:</h4>
                        <div style="font-size: 18px; font-weight: bold; color: #856404;">${this.formatJobStatus(stage)}</div>
                    </div>

                    <div><strong>📝 Task Description:</strong> ${task.description || 'No description provided'}</div>
                    <div><strong>📅 Due Date:</strong> ${new Date(task.dueDate).toLocaleDateString()}</div>
                    <div><strong>🚨 Priority:</strong> ${task.priority.toUpperCase()}</div>
                    <div><strong>⏰ Assigned Date:</strong> ${new Date().toLocaleString()}</div>
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
        </div >
    `;


    }


    async sendHoldResolutionTaskEmail(assignedUser, jobEntry, task, holdReason) {
        const htmlContent = `
    < div style = "font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;" >
            <div style="background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0;">🚨 URGENT: Hold Resolution Required</h1>
            </div>
            <div style="padding: 30px;">
                <h2>Hello ${assignedUser.name} (Sales Department)!</h2>
                <p>A job has been put on <strong style="color: #ff6b35;">HOLD</strong> and requires immediate Sales department attention:</p>
                
                <div style="border: 3px solid #ff6b35; border-radius: 12px; padding: 25px; margin: 25px 0;">
                    <h3 style="color: #ff6b35;">🔥 ${task.title}</h3>
                    
                    <div style="background: #ffe6d1; padding: 15px; border-radius: 8px; margin: 15px 0;">
                        <h4 style="color: #e55a00;">🚨 HOLD REASON:</h4>
                        <div style="font-size: 16px; font-weight: bold; color: #e55a00;">${holdReason || 'No reason provided'}</div>
                    </div>

                    <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 15px 0;">
                        <h4 style="color: #1976d2;">🏭 Job Details:</h4>
                        <div><strong>S.O#:</strong> ${jobEntry.soNumber}</div>
                        <div><strong>Customer:</strong> ${jobEntry.customer}</div>
                        <div><strong>Item Code:</strong> ${jobEntry.itemCode}</div>
                        <div><strong>Particulars:</strong> ${jobEntry.particularsAndModels}</div>
                        <div><strong>Quantity:</strong> ${jobEntry.qty}</div>
                    </div>

                    <div><strong>📅 Due Date:</strong> ${new Date(task.dueDate).toLocaleDateString()} (3 days to resolve)</div>
                    <div><strong>🚨 Priority:</strong> HIGH</div>
                    <div><strong>⏰ Hold Date:</strong> ${new Date().toLocaleString()}</div>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
                       style="background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); 
                              color: white; padding: 15px 30px; border-radius: 25px; 
                              text-decoration: none; font-weight: bold; display: inline-block;">
                        🚨 Resolve Hold Now
                    </a>
                </div>
            </div>
        </div >
    `;

        try {
            await emailService.sendEmail(
                assignedUser.email,
                `🚨 URGENT: Hold Resolution Required - ${jobEntry.soNumber} `,
                htmlContent
            );
            console.log(`Hold resolution task email sent to ${assignedUser.email} `);
        } catch (error) {
            console.error(`Failed to send hold resolution task email: `, error);
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


module.exports = new EmailService();