const API_BASE_URL = 'http://localhost:3000/api';
// const API_BASE_URL = 'https://scrum-18k5.onrender.com/api';

// Application State
let currentAdmin = null;
let currentUser = null;
let userType = null; // 'admin' or 'user'
let authToken = null;
let currentTaskFilter = '';
let completedTasksVisible = false;
let allTasks = [];
let completedTasks = [];
let allUserTasks = [];
let filteredUserTasks = [];
let allJobEntries = [];
let stageAssignments = [];

let currentFilters = {
    taskFilter: '',
    completedTaskFilter: '',
    userTaskStatusFilter: 'pending',
    userTaskSortFilter: 'due_date_asc',
    jobFilters: {
        month: '',
        team: '',
        status: '',
        customer: ''
    }
};

// Initialize Application
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM Content Loaded - Initializing application...');

    // Setup basic event listeners first
    setupEventListeners();

    // Set up filter elements with delays to ensure DOM is ready
    setTimeout(() => {
        const taskFilter = document.getElementById('taskFilter');
        if (taskFilter) {
            taskFilter.addEventListener('change', filterTasks);
        }

        const completedTaskFilter = document.getElementById('completedTaskFilter');
        if (completedTaskFilter) {
            completedTaskFilter.addEventListener('change', filterCompletedTasks);
        }

        // Set default values for user task filters if they exist
        const userTaskStatusFilter = document.getElementById('userTaskStatusFilter');
        if (userTaskStatusFilter) {
            userTaskStatusFilter.value = 'pending';
        }

        const userTaskSortFilter = document.getElementById('userTaskSortFilter');
        if (userTaskSortFilter) {
            userTaskSortFilter.value = 'due_date_asc';
        }
    }, 500);

    // Setup job tracking elements
    setTimeout(() => {
        const jobTrackingSection = document.getElementById('job-tracking');
        if (jobTrackingSection) {
            createJobStatusModal();
            setupJobStatusForm();
            updateJobStatusFilter();
            updateJobTrackingHTML();
            setupJobFiltersEventListeners();
        }
    }, 1000);

    // Setup completion request form
    setTimeout(() => {
        const completionRequestForm = document.getElementById('completionRequestForm');
        if (completionRequestForm) {
            completionRequestForm.addEventListener('submit', async function (e) {
                e.preventDefault();

                const taskId = document.getElementById('completionTaskId').value;
                const remarks = document.getElementById('completionRemarks').value;

                try {
                    const response = await apiCall(`/user/tasks/${taskId}/request-completion`, {
                        method: 'PATCH',
                        body: JSON.stringify({
                            requestedBy: currentUser.name,
                            requestedById: currentUser.id,
                            remarks: remarks
                        })
                    });

                    showSuccessMessage('✅ Completion request sent to admin for approval!');
                    closeCompletionRequestModal();
                    await loadUserTasks();
                    await loadUserStats();
                } catch (error) {
                    console.error('Error requesting task completion:', error);
                    showErrorMessage(error.message);
                }
            });
        }
    }, 1000);

    // Setup job status form
    setTimeout(() => {
        const jobStatusForm = document.getElementById('jobStatusForm');
        if (jobStatusForm) {
            jobStatusForm.addEventListener('submit', async function (e) {
                e.preventDefault();

                const jobId = document.getElementById('currentJobId').value;
                const status = document.getElementById('jobStatus').value;
                const remarks = document.getElementById('jobRemarks').value;

                try {
                    const updateData = {
                        status,
                        changedBy: currentAdmin ? currentAdmin.name : 'Admin',
                        remarks: remarks
                    };

                    const response = await apiCall(`/admin/job-entries/${jobId}/status`, {
                        method: 'PATCH',
                        body: JSON.stringify(updateData)
                    });

                    if (response.success) {
                        showSuccessMessage(response.message);
                        closeJobStatusModal();
                        await loadJobTracking();
                    } else {
                        showErrorMessage('Failed to update job status');
                    }
                } catch (error) {
                    console.error('Error updating job status:', error);
                    showErrorMessage(error.message);
                }
            });
        }
    }, 1000);

    // Check authentication status last
    setTimeout(() => {
        checkAuthStatus();
    }, 1500);
});



document.addEventListener('DOMContentLoaded', function () {
    setTimeout(() => {
        const jobStatusForm = document.getElementById('jobStatusForm');
        if (jobStatusForm) {
            jobStatusForm.addEventListener('submit', async function (e) {
                e.preventDefault();

                const jobId = document.getElementById('currentJobId').value;
                const status = document.getElementById('jobStatus').value;
                const remarks = document.getElementById('jobRemarks').value;

                try {
                    const updateData = {
                        status,
                        changedBy: currentAdmin ? currentAdmin.name : 'Admin',
                        remarks: remarks
                    };

                    const response = await apiCall(`/admin/job-entries/${jobId}/status`, {
                        method: 'PATCH',
                        body: JSON.stringify(updateData)
                    });

                    if (response.success) {
                        showSuccessMessage(response.message);
                        closeJobStatusModal();
                        await loadJobTracking();
                    } else {
                        showErrorMessage('Failed to update job status');
                    }
                } catch (error) {
                    console.error('Error updating job status:', error);
                    showErrorMessage(error.message);
                }
            });
        }
    }, 1000);

    checkAuthStatus();
});


const enhancedStyles = `
    .job-hold-row {
        background: #fffbf0 !important;
    border-left: 4px solid #ffc107;
            }

    .job-hold-row:hover {
        background: #fff3cd !important;
            }

    .job-cancelled-row {
        background: #fff5f5 !important;
    border-left: 4px solid #dc3545;
    opacity: 0.9;
            }

    .job-cancelled-row:hover {
        background: #f8d7da !important;
            }

    .status-hold {
        background: #fff3cd;
    color: #856404;
    animation: pulse-hold 2s infinite;
            }

    .status-cancelled {
        background: #f8d7da;
    color: #721c24;
            }

    @keyframes pulse-hold {
        0 % { box- shadow: 0 0 0 0 rgba(255, 193, 7, 0.7); }
    70% {box - shadow: 0 0 0 10px rgba(255, 193, 7, 0); }
    100% {box - shadow: 0 0 0 0 rgba(255, 193, 7, 0); }
            }

    #cancelledJobsCard {
        border: 2px solid #dc3545;
    box-shadow: 0 4px 12px rgba(220, 53, 69, 0.15);
            }

    #cancelledJobsCard .card-header {
        background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
            }

    .restart-button {
        background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
    color: white;
    border: none;
    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s ease;
            }

    .restart-button:hover {
        transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
            }
    `;

function updateJobTrackingHTML() {
    const jobTrackingSection = document.getElementById('job-tracking');
    if (jobTrackingSection) {
        const existingContent = jobTrackingSection.innerHTML;

        // Find the existing job entries card and add cancelled jobs section after it
        const jobEntriesCardEnd = existingContent.lastIndexOf('</div>\n            </section > ');

        const cancelledJobsHTML = `
                        <!-- Cancelled Jobs Section -->
                    <div class="card" id="cancelledJobsCard" style="margin-top: 30px; border: 2px solid #dc3545; background: #fff5f5; display: none;">
                        <div class="card-header" style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white;">
                            <h3 class="card-title">
                                <i class="fas fa-times-circle"></i> Cancelled Sales Orders
                            </h3>
                            <div style="display: flex; gap: 15px; align-items: center;">
                                <div id="cancelledJobCount" style="background: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 20px; font-weight: 500;">
                                    <i class="fas fa-times-circle"></i> <span id="totalCancelledCount">0</span> cancelled
                                </div>
                                <button class="btn" style="background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3);" 
                                        onclick="toggleCancelledJobs()">
                                    <i class="fas fa-eye" id="toggleCancelledIcon"></i>
                                    <span id="toggleCancelledText">Show Cancelled</span>
                                </button>
                            </div>
                        </div>
                        
                        <div id="cancelledJobsContainer" style="display: none;">
                            <div class="table-container" style="max-height: 400px; overflow-y: auto;">
                                <table id="cancelledJobsTable">
                                    <thead style="position: sticky; top: 0; background: #f8f9fa; z-index: 10;">
                                        <tr>
                                            <th>Month</th>
                                            <th>Team</th>
                                            <th>S.O#</th>
                                            <th>Customer</th>
                                            <th>Item Code</th>
                                            <th>Particulars & Models</th>
                                            <th>QTY</th>
                                            <th>Cancelled Date</th>
                                            <th>Cancel Reason</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td colspan="10" style="text-align: center; color: #666; padding: 40px;">Loading cancelled jobs...</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                `;

        // Insert before the closing of the section
        jobTrackingSection.innerHTML = existingContent.replace(
            '</section>',
            cancelledJobsHTML + '\n            </section>'
        );
    }
}





function initializeAfterDOM() {
    // Perform DOM operations here with null checks
    const elements = [
        'taskFilter',
        'userTaskStatusFilter',
        'userTaskSortFilter',
        'completedTaskFilter'
    ];

    elements.forEach(elementId => {
        const element = document.getElementById(elementId);
        if (element) {
            console.log(`✓ Found element: ${elementId}`);
        } else {
            console.warn(`✗ Missing element: ${elementId}`);
        }
    });
}





function setupEnhancedEventListeners() {
    console.log('Setting up enhanced event listeners...');

    // Task delay form
    const taskDelayForm = document.getElementById('taskDelayForm');
    if (taskDelayForm) {
        taskDelayForm.addEventListener('submit', handleTaskDelaySubmit);
    }

    // Enhanced task form
    const enhancedTaskForm = document.getElementById('taskForm');
    if (enhancedTaskForm) {
        enhancedTaskForm.removeEventListener('submit', handleTaskSubmit); // Remove old listener
        enhancedTaskForm.addEventListener('submit', handleEnhancedTaskSubmit);
    }

    // Enhanced user task form
    const enhancedUserTaskForm = document.getElementById('userTaskForm');
    if (enhancedUserTaskForm) {
        enhancedUserTaskForm.removeEventListener('submit', handleUserTaskSubmit); // Remove old listener
        enhancedUserTaskForm.addEventListener('submit', handleEnhancedUserTaskSubmit);
    }
}

async function handleTaskDelaySubmit(e) {
    e.preventDefault();

    const taskId = document.getElementById('delayTaskId').value;
    const requestedDueDate = document.getElementById('requestedDueDate').value;
    const reason = document.getElementById('delayReason').value;

    try {
        showLoadingMessage('Submitting delay request...');

        const response = await apiCall(`/admin/tasks/${taskId}/request-delay`, {
            method: 'POST',
            body: JSON.stringify({
                requestedDueDate,
                reason,
                requestedBy: currentUser
            })
        });

        hideLoadingMessage();

        if (response.success) {
            showSuccessMessage('Delay request submitted successfully!');
            closeTaskDelayModal();
            await loadUserTasks();
        }
    } catch (error) {
        hideLoadingMessage();
        console.error('Error submitting delay request:', error);
        showErrorMessage(error.message);
    }
}


async function handleEnhancedTaskSubmit(e) {
    e.preventDefault();

    const formData = new FormData();

    // Basic task data
    formData.append('title', document.getElementById('taskTitle').value);
    formData.append('assignedTo', document.getElementById('taskAssignedTo').value);
    formData.append('priority', document.getElementById('taskPriority').value);
    formData.append('dueDate', document.getElementById('taskDueDate').value);
    formData.append('description', document.getElementById('taskDescription').value);

    // Parent task
    const parentTask = document.getElementById('taskParentTask').value;
    if (parentTask) {
        formData.append('parentTask', parentTask);
    }

    // Middle level validation
    const middleLevelValidator = document.getElementById('taskMiddleLevelValidator').value;
    if (middleLevelValidator) {
        formData.append('middleLevelValidator', middleLevelValidator);
        formData.append('needsMiddleLevelValidation', 'true');
    }

    // Multiple assignees
    const multipleAssignees = Array.from(document.getElementById('taskMultipleAssignees').selectedOptions)
        .map(option => option.value);
    if (multipleAssignees.length > 0) {
        formData.append('assignedToMultiple', JSON.stringify([document.getElementById('taskAssignedTo').value, ...multipleAssignees]));
    }

    // Job entry fields
    const soNumber = document.getElementById('taskSONumber').value;
    if (soNumber) {
        formData.append('soNumber', soNumber);
        formData.append('stage', document.getElementById('taskStage').value || '');
    }

    // File upload
    const fileInput = document.getElementById('taskDocument');
    if (fileInput && fileInput.files[0]) {
        formData.append('document', fileInput.files[0]);
    }

    // Privacy and super admin settings
    if (currentUser) {
        if (document.getElementById('taskAssignedTo').value === currentUser.id) {
            formData.append('isPrivate', 'true');
        }
        if (currentUser.role === 'super_admin') {
            formData.append('isSuperAdminTask', 'true');
        }
        formData.append('createdBy', JSON.stringify(currentUser));
    }

    const taskId = document.getElementById('taskId').value;

    try {
        showLoadingMessage('Saving task...');

        let response;
        if (taskId) {
            // For updates, convert to JSON (no file updates for now)
            const updateData = {};
            for (let [key, value] of formData.entries()) {
                if (key !== 'document') { // Skip file for updates
                    updateData[key] = value;
                }
            }

            response = await apiCall(`/admin/tasks/${taskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });
        } else {
            // For new tasks with file upload
            response = await fetch(`${API_BASE_URL}/admin/tasks`, {
                method: 'POST',
                headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            response = await response.json();
        }

        hideLoadingMessage();

        if (response.success || response.task) {
            showSuccessMessage(taskId ? 'Task updated successfully!' : 'Task created successfully!');
            closeTaskModal();
            await loadTasks();
        } else {
            throw new Error(response.message || 'Failed to save task');
        }
    } catch (error) {
        hideLoadingMessage();
        console.error('Error saving task:', error);
        showErrorMessage(error.message);
    }
}


async function handleEnhancedUserTaskSubmit(e) {
    e.preventDefault();

    const formData = new FormData();

    // Basic task data
    formData.append('title', document.getElementById('userTaskTitle').value);
    formData.append('assignedTo', document.getElementById('userTaskAssignedTo').value);
    formData.append('priority', document.getElementById('userTaskPriority').value);
    formData.append('dueDate', document.getElementById('userTaskDueDate').value);
    formData.append('description', document.getElementById('userTaskDescription').value);
    formData.append('notes', document.getElementById('userTaskNotes').value);
    formData.append('assignedBy', currentUser.id);

    // Multiple assignees
    const multipleAssignees = Array.from(document.getElementById('userTaskMultipleAssignees').selectedOptions)
        .map(option => option.value);
    if (multipleAssignees.length > 0) {
        formData.append('assignedToMultiple', JSON.stringify([document.getElementById('userTaskAssignedTo').value, ...multipleAssignees]));
    }

    // File upload
    const fileInput = document.getElementById('userTaskDocument');
    if (fileInput && fileInput.files[0]) {
        formData.append('document', fileInput.files[0]);
    }

    const taskId = document.getElementById('userTaskId').value;

    try {
        showLoadingMessage('Saving task...');

        let response;
        if (taskId) {
            // For updates
            const updateData = {};
            for (let [key, value] of formData.entries()) {
                if (key !== 'document') {
                    updateData[key] = value;
                }
            }

            response = await apiCall(`/user/user-tasks/${taskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });
        } else {
            // For new tasks
            response = await fetch(`${API_BASE_URL}/user/user-tasks`, {
                method: 'POST',
                headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            response = await response.json();
        }

        hideLoadingMessage();

        if (response.success || response.tasks) {
            const message = response.tasks
                ? `Task(s) assigned successfully to ${response.tasks.length} user(s)!`
                : 'Task updated successfully!';
            showSuccessMessage(message);
            closeUserTaskModal();
            await loadUserAssignedTasks();
        } else {
            throw new Error(response.message || 'Failed to save task');
        }
    } catch (error) {
        hideLoadingMessage();
        console.error('Error saving user task:', error);
        showErrorMessage(error.message);
    }
}






async function handleJobStatusSubmit(e) {
    e.preventDefault();

    const jobId = document.getElementById('currentJobId').value;
    const status = document.getElementById('jobStatus').value;
    const currentStatus = document.getElementById('currentJobStatus').value;
    const remarks = document.getElementById('jobRemarks').value;
    const reason = document.getElementById('statusReason').value;

    if (!jobId || !status) {
        showErrorMessage('Missing required fields');
        return;
    }

    const isRestartingFromHold = currentStatus === 'hold' && status !== 'hold' && status !== 'so_cancelled';

    // Additional validation
    if ((status === 'hold' || status === 'so_cancelled' || isRestartingFromHold) && !reason.trim()) {
        const actionType = isRestartingFromHold ? 'restart' : (status === 'hold' ? 'hold' : 'cancel');
        showErrorMessage(`Reason is required for ${actionType} actions`);
        return;
    }

    // Confirmation dialogs
    if (isRestartingFromHold) {
        if (!confirm(`Are you sure you want to RESTART this job from "${formatJobStatus(status)}"?\n\nReason: ${reason}\n\nThis will:\n- Restart job processing from selected stage\n- Assign new tasks automatically\n- Send restart notifications to all users`)) {
            return;
        }
    } else if (status === 'hold') {
        if (!confirm(`Are you sure you want to put this job on HOLD?\n\nReason: ${reason}\n\nThis will:\n- Cancel all related tasks\n- Send notifications to all users\n- Stop all work on this job`)) {
            return;
        }
    } else if (status === 'so_cancelled') {
        if (!confirm(`Are you sure you want to CANCEL this sales order?\n\nReason: ${reason}\n\nThis will:\n- Cancel all related tasks\n- Send notifications to all users\n- Move job to cancelled section`)) {
            return;
        }
    }

    try {
        const loadingText = isRestartingFromHold ? 'Restarting job...' :
            status === 'hold' ? 'Putting job on hold...' :
                status === 'so_cancelled' ? 'Cancelling sales order...' :
                    'Updating job status...';

        showLoadingMessage(loadingText);

        const updateData = {
            status,
            changedBy: currentAdmin ? currentAdmin.name : 'Admin',
            remarks: remarks
        };

        // Add specific reason fields
        if (isRestartingFromHold) {
            updateData.restartReason = reason;
        } else if (status === 'hold') {
            updateData.holdReason = reason;
        } else if (status === 'so_cancelled') {
            updateData.cancelReason = reason;
        }

        const response = await apiCall(`/admin/job-entries/${jobId}/status`, {
            method: 'PATCH',
            body: JSON.stringify(updateData)
        });

        hideLoadingMessage();

        if (response.success) {
            showSuccessMessage(response.message);
            closeJobStatusModal();
            await loadJobTracking();
        } else {
            showErrorMessage('Failed to update job status');
        }
    } catch (error) {
        hideLoadingMessage();
        console.error('Error updating job status:', error);
        showErrorMessage(error.message);
    }
}




function setupJobStatusForm() {
    // Add event listener with proper error handling
    document.addEventListener('submit', function (e) {
        if (e.target.id === 'jobStatusForm') {
            handleJobStatusSubmit(e);
        }
    });
}

function toggleRemoveDropdown() {
    const dropdown = document.getElementById('removeDropdown');
    if (dropdown) {
        const isVisible = dropdown.style.display === 'block';
        dropdown.style.display = isVisible ? 'none' : 'block';

        // Close dropdown when clicking outside
        if (!isVisible) {
            document.addEventListener('click', function closeDropdown(e) {
                if (!e.target.closest('#removeDropdownBtn') && !e.target.closest('#removeDropdown')) {
                    dropdown.style.display = 'none';
                    document.removeEventListener('click', closeDropdown);
                }
            });
        }
    }
}

function checkAuthStatus() {
    console.log('Checking authentication status...');

    const savedAuth = sessionStorage.getItem('scrumflow_auth');
    if (savedAuth) {
        try {
            const authData = JSON.parse(savedAuth);
            console.log('Found saved auth:', authData);

            // Set the auth token
            authToken = authData.token;

            if (authData.type === 'admin') {
                currentAdmin = authData.user;
                userType = 'admin';
                showAdminDashboard();
            } else {
                currentUser = authData.user;
                userType = 'user';
                showUserDashboard();
            }
        } catch (error) {
            console.error('Error parsing saved auth:', error);
            sessionStorage.removeItem('scrumflow_auth');
            authToken = null;
            showLoginForm(); // Call the function instead of throwing error
        }
    } else {
        console.log('No saved authentication found');
        showLoginForm(); // Call the function instead of throwing error
    }
}

// 3. Fix setupEventListeners with better element checking
function setupEventListeners() {
    console.log('Setting up event listeners...');

    // Login form - add null check
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Navigation for admin
    document.querySelectorAll('#adminDashboard .nav-link').forEach(link => {
        link.addEventListener('click', (e) => handleAdminNavigation(e));
    });

    // Navigation for user
    document.querySelectorAll('#userDashboard .nav-link').forEach(link => {
        link.addEventListener('click', (e) => handleUserNavigation(e));
    });

    // Forms with null checks
    const userForm = document.getElementById('userForm');
    if (userForm) {
        userForm.addEventListener('submit', handleUserSubmit);
    }

    const taskForm = document.getElementById('taskForm');
    if (taskForm) {
        taskForm.addEventListener('submit', handleTaskSubmit);
    }

    // Filter elements with null checks
    const taskFilter = document.getElementById('taskFilter');
    if (taskFilter) {
        taskFilter.addEventListener('change', filterTasks);
        console.log('✓ Found element: taskFilter');
    } else {
        console.log('✗ Missing element: taskFilter');
    }

    const completedTaskFilter = document.getElementById('completedTaskFilter');
    if (completedTaskFilter) {
        completedTaskFilter.addEventListener('change', filterCompletedTasks);
        console.log('✓ Found element: completedTaskFilter');
    } else {
        console.log('✗ Missing element: completedTaskFilter');
    }

    // User task filters - these seem to be missing from your HTML
    const userTaskStatusFilter = document.getElementById('userTaskStatusFilter');
    if (userTaskStatusFilter) {
        userTaskStatusFilter.addEventListener('change', filterUserTasks);
        console.log('✓ Found element: userTaskStatusFilter');
    } else {
        console.log('✗ Missing element: userTaskStatusFilter');
    }

    const userTaskSortFilter = document.getElementById('userTaskSortFilter');
    if (userTaskSortFilter) {
        userTaskSortFilter.addEventListener('change', filterUserTasks);
        console.log('✓ Found element: userTaskSortFilter');
    } else {
        console.log('✗ Missing element: userTaskSortFilter');
    }

}




// Render dispatched jobs table
function renderDispatchedJobs(jobs) {
    const tbody = document.querySelector('#dispatchedJobsTable tbody');

    if (jobs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #666; padding: 40px;">No dispatched jobs found</td></tr>';
        return;
    }

    tbody.innerHTML = jobs.map(job => `
                <tr>
                    <td><strong>${job.soNumber}</strong></td>
                    <td>${job.customer}</td>
                    <td>${job.itemCode}</td>
                    <td>
                        <span style="background: #e3f2fd; color: #1976d2; padding: 4px 8px; border-radius: 12px; font-weight: 500;">
                            ${job.totalDuration} days
                        </span>
                    </td>
                    <td>${new Date(job.dispatchedAt).toLocaleDateString()}</td>
                    <td>
                        <button class="btn" style="background: #e8f5e8; color: #2e7d32; padding: 4px 8px; font-size: 12px;" 
                                onclick="viewStageAnalysis('${job._id}')" title="View Stage Analysis">
                            <i class="fas fa-chart-line"></i> View Analysis
                        </button>
                    </td>
                    <td>
                        <button class="action-btn btn-edit" onclick="downloadJobAnalysis('${job._id}')" title="Download Analysis">
                            <i class="fas fa-download"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
}

// Manual Job Entry Functions
function openManualJobEntryModal() {
    document.getElementById('manualJobEntryModal').classList.add('active');
    // Set default month to current month
    const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long' });
    document.getElementById('jobMonth').value = currentMonth;
    // Set default week
    const currentWeek = Math.ceil((new Date() - new Date(new Date().getFullYear(), 0, 1)) / (1000 * 60 * 60 * 24 * 7));
    document.getElementById('jobWeek').value = Math.min(currentWeek, 52);
}

function closeManualJobEntryModal() {
    document.getElementById('manualJobEntryModal').classList.remove('active');
    document.getElementById('manualJobEntryForm').reset();
}

function resetManualJobForm() {
    document.getElementById('manualJobEntryForm').reset();
    // Set defaults again
    const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long' });
    document.getElementById('jobMonth').value = currentMonth;
    const currentWeek = Math.ceil((new Date() - new Date(new Date().getFullYear(), 0, 1)) / (1000 * 60 * 60 * 24 * 7));
    document.getElementById('jobWeek').value = Math.min(currentWeek, 52);
}

// Handle manual job entry form submission
async function handleManualJobEntrySubmit(e) {
    e.preventDefault();

    const formData = {
        month: document.getElementById('jobMonth').value,
        team: document.getElementById('jobTeam').value,
        soNumber: document.getElementById('jobSoNumber').value.trim(),
        customer: document.getElementById('jobCustomer').value.trim(),
        itemCode: document.getElementById('jobItemCode').value.trim(),
        particularsAndModels: document.getElementById('jobDescription').value.trim(),
        qty: parseInt(document.getElementById('jobQty').value),
        week: parseInt(document.getElementById('jobWeek').value),
        status: document.getElementById('jobInitialStatus').value,
        remarks: document.getElementById('jobRemarks').value.trim()
    };

    // Validation
    if (!formData.soNumber || !formData.customer || !formData.itemCode || !formData.particularsAndModels) {
        showErrorMessage('Please fill in all required fields');
        return;
    }

    if (formData.qty < 1 || formData.week < 1 || formData.week > 52) {
        showErrorMessage('Please enter valid quantity and week numbers');
        return;
    }

    try {
        showLoadingMessage('Adding job entry...');

        const response = await apiCall('/admin/job-entries/manual', {
            method: 'POST',
            body: JSON.stringify(formData)
        });

        hideLoadingMessage();

        if (response.success) {
            showSuccessMessage(`Job entry ${formData.soNumber} added successfully!`);
            closeManualJobEntryModal();
            await loadJobTracking();
        } else {
            showErrorMessage('Failed to add job entry');
        }
    } catch (error) {
        hideLoadingMessage();
        console.error('Error adding manual job entry:', error);
        showErrorMessage(error.message);
    }
}

// Update dispatched jobs statistics
function updateDispatchedJobsStats(jobs) {
    const total = jobs.length;
    const totalDuration = jobs.reduce((sum, job) => sum + (job.totalDuration || 0), 0);
    const avgDuration = total > 0 ? Math.round(totalDuration / total) : 0;

    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const thisWeek = jobs.filter(job => new Date(job.dispatchedAt) >= weekAgo).length;
    const thisMonth = jobs.filter(job => new Date(job.dispatchedAt) >= monthAgo).length;

    document.getElementById('totalDispatchedJobs').textContent = total;
    document.getElementById('avgDispatchDuration').textContent = avgDuration;
    document.getElementById('thisWeekDispatched').textContent = thisWeek;
    document.getElementById('thisMonthDispatched').textContent = thisMonth;
}

// View stage analysis for a specific job
function viewStageAnalysis(jobId) {
    // Find the job from loaded data
    const job = dispatchedJobsData?.find(j => j._id === jobId);
    if (!job) {
        showErrorMessage('Job not found');
        return;
    }

    let analysisText = `STAGE ANALYSIS - ${job.soNumber}\n`;
    analysisText += `Customer: ${job.customer}\n`;
    analysisText += `Item: ${job.itemCode}\n`;
    analysisText += `Total Duration: ${job.totalDuration} days\n\n`;

    if (job.stageAnalysis && job.stageAnalysis.length > 0) {
        job.stageAnalysis.forEach((stage, index) => {
            analysisText += `${index + 1}. ${formatJobStatus(stage.stage)}\n`;
            analysisText += `   Start: ${stage.startDate ? new Date(stage.startDate).toLocaleDateString() : 'N/A'}\n`;
            analysisText += `   Completed: ${stage.completedDate ? new Date(stage.completedDate).toLocaleDateString() : 'N/A'}\n`;
            analysisText += `   Duration: ${stage.duration || 'N/A'} days\n`;
            analysisText += `   Assigned To: ${stage.assignedTo || 'N/A'}\n`;
            if (stage.remarks) {
                analysisText += `   Remarks: ${stage.remarks}\n`;
            }
            analysisText += `\n`;
        });
    } else {
        analysisText += 'No stage analysis available';
    }

    alert(analysisText);
}

// Download dispatched jobs report
async function downloadDispatchedJobsReport() {
    try {
        showLoadingMessage('Generating dispatched jobs analysis report...');

        const response = await apiCall('/admin/dispatched-jobs-report');

        hideLoadingMessage();

        if (response.success) {
            downloadExcelFromData(response.data, response.filename);
            showSuccessMessage('Dispatched jobs analysis report downloaded successfully!');
        } else {
            showErrorMessage('Failed to generate report');
        }
    } catch (error) {
        hideLoadingMessage();
        console.error('Error downloading dispatched jobs report:', error);
        showErrorMessage('Error downloading report');
    }
}

// Refresh dispatched jobs
async function refreshDispatchedJobs() {
    await loadDispatchedJobs();
    showSuccessMessage('Dispatched jobs refreshed!');
}

// Authentication
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // CRITICAL FIX: Ensure user object has id field
            if (!data.user || !data.user.id) {
                throw new Error('Invalid user data received from server');
            }

            // Show success message
            document.getElementById('loginSuccess').style.display = 'flex';

            // Store auth data with proper validation
            const authData = {
                user: {
                    id: data.user.id,
                    username: data.user.username,
                    email: data.user.email,
                    name: data.user.name,
                    role: data.user.role
                },
                token: data.token,
                type: data.user.role === 'admin' || data.user.role === 'super_admin' ? 'admin' : 'user',
                timestamp: Date.now()
            };

            sessionStorage.setItem('scrumflow_auth', JSON.stringify(authData));
            authToken = data.token;

            setTimeout(() => {
                if (data.user.role === 'admin' || data.user.role === 'super_admin') {
                    currentAdmin = authData.user;
                    userType = 'admin';
                    showAdminDashboard();
                } else {
                    currentUser = authData.user;
                    userType = 'user';
                    showUserDashboard();
                }
            }, 1500);
        } else {
            throw new Error(data.message || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        showErrorMessage('Login failed: ' + error.message);
    }
}


function logout() {
    console.log('Logging out user...');

    // Clear all authentication data
    sessionStorage.removeItem('scrumflow_auth');
    authToken = null;
    currentUser = null;
    currentAdmin = null;
    userType = null;

    // Redirect to login
    showLoginForm();
}

// Dashboard Management
function showAdminDashboard() {
    document.getElementById('currentAdmin').textContent = currentAdmin.username;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminDashboard').classList.add('active');
    userType = 'admin';
    loadAdminDashboardData();
}

function showUserDashboard() {
    document.getElementById('currentUser').textContent = currentUser.username;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('userDashboard').classList.add('active');
    userType = 'user';
    loadUserDashboardData();
}

// Navigation
function handleAdminNavigation(e) {
    e.preventDefault();
    const targetSection = e.target.closest('.nav-link').dataset.section;
    showSection(targetSection);
}

function handleUserNavigation(e) {
    e.preventDefault();
    const targetSection = e.target.closest('.nav-link').dataset.section;
    showUserSection(targetSection);
}

function showSection(sectionName) {
    // Update active nav
    document.querySelectorAll('#adminDashboard .nav-link').forEach(link => link.classList.remove('active'));
    document.querySelector(`#adminDashboard .nav-link[data-section="${sectionName}"]`).classList.add('active');

    // Show target section
    document.querySelectorAll('#adminDashboard .content-section').forEach(section => section.classList.remove('active'));
    document.getElementById(sectionName).classList.add('active');

    // Load section-specific data
    loadSectionData(sectionName);
}

function showUserSection(sectionName) {
    // Update active nav
    document.querySelectorAll('#userDashboard .nav-link').forEach(link => link.classList.remove('active'));
    const activeLink = document.querySelector(`#userDashboard .nav-link[data-section="${sectionName}"]`);
    if (activeLink) activeLink.classList.add('active');

    // Show target section
    document.querySelectorAll('#userDashboard .content-section').forEach(section => section.classList.remove('active'));
    const targetSection = document.getElementById(sectionName);
    if (targetSection) targetSection.classList.add('active');

    // Load section-specific data
    loadUserSectionData(sectionName);
}

// Data Loading Functions
async function loadAdminDashboardData() {
    try {
        await Promise.all([
            loadStats(),
            loadRecentActivity(),
            loadUsers(),
            loadTasks()
        ]);
    } catch (error) {
        console.error('Error loading admin dashboard:', error);
    }
}


// 9. Fix loadUserDashboardData with better error handling
async function loadUserDashboardData() {
    if (!currentUser || !currentUser.id) {
        console.error('No current user found for dashboard data');
        showErrorMessage('User not authenticated');
        return;
    }

    console.log('Loading user dashboard data for user ID:', currentUser.id);

    try {
        // Load data in parallel but handle errors individually
        const promises = [
            loadUserStats().catch(error => {
                console.error('Error loading user stats:', error);
                return null;
            }),
            loadUserTasks().catch(error => {
                console.error('Error loading user tasks:', error);
                return null;
            }),
            loadUserTaskStats().catch(error => {
                console.error('Error loading user task stats:', error);
                return null;
            })
        ];

        await Promise.allSettled(promises);
        console.log('User dashboard data loading completed');
    } catch (error) {
        console.error('Error in loadUserDashboardData:', error);
        showErrorMessage('Error loading dashboard data');
    }
}

async function loadUserTasks() {
    try {
        if (!currentUser || !currentUser.id) {
            console.error('No current user found for loading tasks');
            return;
        }

        console.log('Loading user tasks for user ID:', currentUser.id);
        const tasks = await apiCall(`/user/${currentUser.id}/tasks`);

        // Store tasks globally for filtering
        allUserTasks = tasks || [];
        filteredUserTasks = allUserTasks;

        // Use the grouped rendering instead of table rendering
        renderUserTasks(filteredUserTasks);

    } catch (error) {
        console.error('Error loading user tasks:', error);
        const container = document.getElementById('myTasksContainer');
        if (container) {
            container.innerHTML = '<p style="color: #dc3545; text-align: center; padding: 40px;">Error loading tasks. Please refresh the page.</p>';
        }
    }
}





async function loadUserSectionData(section) {
    console.log('Loading user section:', section);

    switch (section) {
        case 'my-sprints':
            await loadUserTasks();
            await loadUserStats();
            break;
        case 'my-progress':
            await loadUserProgress();
            break;
        case 'assign-user-tasks':
            await loadUserAssignedTasks();
            await loadTeamMembersForAssignment();
            break;
        case 'received-user-tasks':
            await loadReceivedUserTasks();
            break;
    }
}

async function loadUserAssignedTasks() {
    try {
        console.log('Loading tasks assigned by user...');
        const tasks = await apiCall(`/user/${currentUser.id}/assigned-user-tasks`);
        renderUserAssignedTasksTable(tasks);
        updateUserAssignedStats(tasks);
    } catch (error) {
        console.error('Error loading user assigned tasks:', error);
        const tbody = document.querySelector('#userAssignedTasksTable tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #666; padding: 40px;">Error loading tasks</td></tr>';
        }
    }
}

function renderUserAssignedTasksTable(tasks) {
    const tbody = document.querySelector('#userAssignedTasksTable tbody');
    const filter = document.getElementById('userTaskFilter')?.value || '';

    let filteredTasks = tasks;
    if (filter) {
        filteredTasks = applyUserTaskFilter(tasks, filter);
    }

    if (filteredTasks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #666; padding: 40px;">No tasks found</td></tr>';
        return;
    }

    tbody.innerHTML = filteredTasks.map(task => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dueDate = new Date(task.dueDate);
        const taskDueDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

        const isSelfAssigned = task.assignedTo === currentUser.id;
        const assignedToDisplay = isSelfAssigned ?
            `${task.assignedToName} <span style="color: #667eea; font-weight: 500;">(Me)</span>` :
            task.assignedToName;

        let statusClass = task.status;
        if ((task.status === 'pending' || task.status === 'in_progress') && taskDueDate < today) {
            statusClass = 'overdue';
        }

        return `
            <tr>
                <td>
                    <div class="task-title">${task.title}</div>
                    ${task.description ? `<div class="task-description">${task.description.substring(0, 100)}...</div>` : ''}
                    ${task.attachedDocument ? `<div style="color: #28a745; font-size: 0.85rem; margin-top: 5px;"><i class="fas fa-paperclip"></i> Document attached</div>` : ''}
                </td>
                <td>${assignedToDisplay}</td>
                <td><span class="priority-badge priority-${task.priority}">${task.priority.toUpperCase()}</span></td>
                <td>
                    <div style="color: ${taskDueDate < today && task.status !== 'completed' ? '#dc3545' : 'inherit'};">
                        ${dueDate.toLocaleDateString()}
                        ${taskDueDate < today && task.status !== 'completed' ? ' ⚠️' : ''}
                    </div>
                </td>
                <td><span class="status-badge status-${statusClass}">${statusClass.replace('_', ' ').toUpperCase()}</span></td>
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="background: #e0e0e0; border-radius: 10px; height: 8px; flex: 1;">
                            <div style="background: ${getProgressColor(task.progress)}; height: 100%; width: ${task.progress || 0}%; transition: width 0.3s ease;"></div>
                        </div>
                        <small>${task.progress || 0}%</small>
                    </div>
                </td>
                <td>
                    <div style="display: flex; gap: 5px;">
                        <button class="action-btn btn-edit" onclick="editUserTask('${task._id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${task.status !== 'completed' ? `
                            <button class="action-btn btn-complete" onclick="markUserTaskComplete('${task._id}')" title="Mark Complete">
                                <i class="fas fa-check"></i>
                            </button>
                        ` : ''}
                        ${task.attachedDocument ? `
                            <button class="action-btn btn-view" onclick="downloadUserTaskDocument('${task._id}', '${task.attachedDocument.originalName}')" title="Download Document">
                                <i class="fas fa-download"></i>
                            </button>
                        ` : ''}
                        <button class="action-btn btn-delete" onclick="deleteUserTask('${task._id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}


async function loadReceivedUserTasks() {
    if (!currentUser || !currentUser.id) {
        console.error('Cannot load received user tasks: currentUser.id is undefined');
        return;
    }

    try {
        console.log('Loading received user tasks for user ID:', currentUser.id);
        const tasks = await apiCall(`/user/${currentUser.id}/received-user-tasks`);
        renderReceivedUserTasks(tasks);
        updateReceivedUserStats(tasks);
    } catch (error) {
        console.error('Error loading received user tasks:', error);
        const container = document.getElementById('receivedUserTasksContainer');
        if (container) {
            container.innerHTML = '<p style="color: #dc3545; text-align: center; padding: 40px;">Error loading tasks. Please refresh the page.</p>';
        }
    }
}

async function handleUserTaskSubmit(e) {
    e.preventDefault();

    const formData = {
        title: document.getElementById('userTaskTitle').value,
        assignedTo: document.getElementById('userTaskAssignedTo').value,
        priority: document.getElementById('userTaskPriority').value,
        dueDate: document.getElementById('userTaskDueDate').value,
        description: document.getElementById('userTaskDescription').value,
        notes: document.getElementById('userTaskNotes').value,
        assignedBy: currentUser.id
    };

    const taskId = document.getElementById('userTaskId').value;

    try {
        if (taskId) {
            await apiCall(`/user/user-tasks/${taskId}`, {
                method: 'PUT',
                body: JSON.stringify(formData)
            });
        } else {
            await apiCall('/user/user-tasks', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
        }

        showSuccessMessage(taskId ? 'Task updated successfully!' : 'Task assigned successfully!');
        closeUserTaskModal();
        await loadUserAssignedTasks();
    } catch (error) {
        console.error('Error saving task:', error);
        showErrorMessage(error.message);
    }
}


function renderReceivedUserTasks(tasks) {
    const container = document.getElementById('receivedUserTasksContainer');

    if (tasks.length === 0) {
        container.innerHTML = '<p style="color: #666; text-align: center; padding: 40px;">No tasks received from team members</p>';
        return;
    }

    container.innerHTML = tasks.map(task => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dueDate = new Date(task.dueDate);
        const taskDueDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

        let statusColor = '';
        let status = task.status;
        let dateDisplay = dueDate.toLocaleDateString();

        const isOverdue = (task.status === 'pending' || task.status === 'in_progress') && taskDueDate < today;
        const isDueToday = taskDueDate.getTime() === today.getTime();

        if (isOverdue) {
            status = 'overdue';
            statusColor = 'border-left-color: #dc3545;';
            dateDisplay += ' ⚠️ OVERDUE';
        } else if (isDueToday && (task.status === 'pending' || task.status === 'in_progress')) {
            dateDisplay += ' 📅 DUE TODAY';
            statusColor = 'border-left-color: #ffc107;';
        }

        return `
                    <div class="sprint-card priority-${task.priority}" style="${statusColor}">
                        <div class="sprint-header">
                            <div class="sprint-title">${task.title}</div>
                            <div class="sprint-due" style="color: ${isOverdue ? '#dc3545' : 'inherit'};">
                                Due: ${dateDisplay}
                            </div>
                        </div>
                        <div class="sprint-description">${task.description || 'No description'}</div>
                        <div style="margin: 10px 0; color: #666; font-size: 0.9rem;">
                            <strong>Assigned by:</strong> ${task.assignedByName}
                            ${task.notes ? `<br><strong>Notes:</strong> ${task.notes}` : ''}
                        </div>
                        <div class="sprint-progress">
                            <div class="sprint-progress-bar" style="width: ${task.progress || 0}%"></div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span class="status-badge status-${status}">${status}</span>
                            <span style="color: #666; font-size: 0.9rem;">${task.progress || 0}% Complete</span>
                        </div>
                        
                        ${task.status !== 'completed' ? `
                            <div style="margin-top: 15px;">
                                <button class="btn btn-success" onclick="markReceivedUserTaskComplete('${task._id}')" style="width: 100%; padding: 10px;">
                                    <i class="fas fa-check-circle"></i> Mark as Complete
                                </button>
                            </div>
                        ` : ''}
                        
                        ${task.status === 'completed' ? `
                            <div style="margin-top: 15px; padding: 10px; background: #d4edda; border-radius: 8px; text-align: center;">
                                <i class="fas fa-check-circle" style="color: #155724;"></i>
                                <span style="color: #155724; font-weight: 500;">
                                    Completed ${task.isOnTime ? 'On Time' : 'Late'}
                                </span>
                                ${task.completedAt ? `
                                    <div style="margin-top: 5px; font-size: 0.85rem; color: #666;">
                                        ${new Date(task.completedAt).toLocaleString()}
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>
                `;
    }).join('');
}


async function loadTeamMembersForAssignment() {
    try {
        const teamMembers = await apiCall('/user/team-members');
        const selectElement = document.getElementById('userTaskAssignedTo');

        if (!selectElement) {
            console.error('userTaskAssignedTo select element not found');
            return;
        }

        // Clear existing options
        selectElement.innerHTML = '<option value="">Select Team Member</option>';

        // Check if teamMembers is valid and has the expected structure
        if (!teamMembers || !Array.isArray(teamMembers)) {
            console.error('Invalid team members data:', teamMembers);
            return;
        }

        teamMembers.forEach(member => {
            // Add null checks for member properties
            if (member && member.id && member.name) {
                const option = document.createElement('option');
                option.value = member.id;
                option.textContent = member.name;
                selectElement.appendChild(option);
            } else {
                console.warn('Invalid team member data:', member);
            }
        });

    } catch (error) {
        console.error('Error loading team members:', error);
    }
}

// Render user assigned tasks table
function renderUserAssignedTasks(tasks) {
    const tbody = document.querySelector('#userAssignedTasksTable tbody');
    const filter = document.getElementById('userTaskFilter').value;


    let filteredTasks = tasks;
    if (filter) {
        filteredTasks = applyUserTaskFilter(tasks, filter);
    }

    if (filteredTasks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #666; padding: 40px;">No tasks found</td></tr>';
        return;
    }

    tbody.innerHTML = filteredTasks.map(task => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dueDate = new Date(task.dueDate);
        const taskDueDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

        const isSelfAssigned = task.assignedTo === currentUser.id;
        const assignedToDisplay = isSelfAssigned ?
            `${task.assignedToName} <span style="color: #667eea; font-weight: 500;">(Me)</span>` :
            task.assignedToName;


        let statusClass = 'pending';
        let statusIcon = 'fas fa-clock';
        let statusText = 'Pending';

        if (task.status === 'completed') {
            statusClass = 'completed';
            statusIcon = 'fas fa-check-circle';
            statusText = 'Completed';
        } else if (task.status === 'in_progress') {
            statusClass = 'in-progress';
            statusIcon = 'fas fa-spinner';
            statusText = 'In Progress';
        } else if (taskDueDate < today && task.status !== 'completed') {
            statusClass = 'overdue';
            statusIcon = 'fas fa-exclamation-triangle';
            statusText = 'Overdue';
        }

        return `
            <tr>
                <td>
                    <div class="task-info">
                        <div class="task-title">${task.title}</div>
                        ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
                    </div>
                </td>
                <td>${assignedToDisplay}</td>
                <td>
                    <span class="priority-badge priority-${task.priority}">
                        ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                    </span>
                </td>
                <td>
                    <div class="due-date ${taskDueDate < today && task.status !== 'completed' ? 'overdue' : ''}">
                        ${new Date(task.dueDate).toLocaleDateString()}
                    </div>
                </td>
                <td>
                    <span class="status-badge status-${statusClass}">
                        <i class="${statusIcon}"></i> ${statusText}
                    </span>
                </td>
                <td>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${task.progress || 0}%"></div>
                        <span class="progress-text">${task.progress || 0}%</span>
                    </div>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn btn-edit" onclick="openUserTaskModal('${task._id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${task.status !== 'completed' ? `
                            <button class="action-btn btn-complete" onclick="markUserTaskComplete('${task._id}')">
                                <i class="fas fa-check"></i>
                            </button>
                        ` : ''}
                        ${task.description ? `
                            <button class="action-btn btn-view" onclick="viewTaskDescription('${task._id}', '${task.title}', \`${task.description}\`)">
                                <i class="fas fa-eye"></i>
                            </button>
                        ` : ''}
                    </div>
                    ${task.status === 'completed' ? `
                        <div style="margin-top: 15px; padding: 10px; background: #d4edda; border-radius: 8px; text-align: center;">
                            <i class="fas fa-check-circle" style="color: #155724;"></i>
                            <span style="color: #155724; font-weight: 500;">
                                Completed ${task.isOnTime ? 'On Time' : 'Late'}
                                ${isSelfAssigned ? ' (Self-completed)' : ''}
                            </span>
                            ${task.completedAt ? `
                                <div style="margin-top: 5px; font-size: 0.85rem; color: #666;">
                                    ${new Date(task.completedAt).toLocaleString()}
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');
}


function editUserTask(taskId) {
    openUserTaskModal(taskId);
}
// Apply filter to user assigned tasks
function applyUserTaskFilter(tasks, filter) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (filter) {
        case 'pending':
            return tasks.filter(task => task.status === 'pending');
        case 'in_progress':
            return tasks.filter(task => task.status === 'in_progress');
        case 'completed':
            return tasks.filter(task => task.status === 'completed');
        case 'overdue':
            return tasks.filter(task => {
                const dueDate = new Date(task.dueDate);
                const taskDueDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
                return (task.status === 'pending' || task.status === 'in_progress') && taskDueDate < today;
            });
        default:
            return tasks;
    }
}


function updateReceivedUserStats(tasks) {
    const total = tasks.length;
    const completed = tasks.filter(task => task.status === 'completed').length;
    const pending = tasks.filter(task => task.status === 'pending' || task.status === 'in_progress').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    document.getElementById('myReceivedUserTasks').textContent = total;
    document.getElementById('myReceivedUserPending').textContent = pending;
    document.getElementById('myReceivedUserCompleted').textContent = completed;
    document.getElementById('myReceivedUserCompletionRate').textContent = completionRate + '%';
}


function openUserTaskModal(taskId = null) {
    const modal = document.getElementById('userTaskModal');
    const form = document.getElementById('userTaskForm');

    if (taskId) {
        document.getElementById('userTaskModalTitle').textContent = 'Edit Task';
        document.getElementById('userTaskSubmitText').textContent = 'Update Task';
        loadUserTaskForEdit(taskId);
    } else {
        document.getElementById('userTaskModalTitle').textContent = 'Assign New Task';
        document.getElementById('userTaskSubmitText').textContent = 'Assign Task';
        form.reset();
        document.getElementById('userTaskId').value = '';
    }

    // Load team members
    loadTeamMembersForAssignment();
    modal.classList.add('active');
}

function isTaskOnTime(completedDate, dueDate) {
    const completed = new Date(completedDate);
    const due = new Date(dueDate);

    // Set both to end of day for comparison
    const completedEnd = new Date(completed.getFullYear(), completed.getMonth(), completed.getDate(), 23, 59, 59, 999);
    const dueEnd = new Date(due.getFullYear(), due.getMonth(), due.getDate(), 23, 59, 59, 999);

    return completedEnd <= dueEnd;
}

document.addEventListener('DOMContentLoaded', function () {
    setTimeout(() => {
        // Remove old event listeners and add new ones
        const taskForm = document.getElementById('taskForm');
        if (taskForm) {
            taskForm.addEventListener('submit', handleEnhancedTaskSubmit);
        }

        const userTaskForm = document.getElementById('userTaskForm');
        if (userTaskForm) {
            userTaskForm.addEventListener('submit', handleEnhancedUserTaskSubmit);
        }

        // Initialize dropdowns
        populateTaskDropdowns();
        loadTeamMembersForAssignment();
    }, 1500);
});

// Close user task modal
function closeJobStatusModal() {
    const modal = document.getElementById('jobStatusModal');
    if (modal) {
        modal.style.display = 'none';
    }
}


// Mark user assigned task as complete
async function markUserTaskComplete(taskId) {
    if (confirm('Are you sure you want to mark this task as completed?')) {
        try {
            await apiCall(`/user/user-tasks/${taskId}/complete`, {
                method: 'PATCH',
                body: JSON.stringify({
                    completedBy: currentUser.name
                })
            });

            showSuccessMessage('Task marked as completed!');
            await loadUserAssignedTasks();
        } catch (error) {
            console.error('Error completing task:', error);
            showErrorMessage(error.message);
        }
    }
}

function openCompletionRequestModal(taskId) {
    document.getElementById('completionTaskId').value = taskId;
    document.getElementById('completionRemarks').value = '';
    document.getElementById('completionRequestModal').classList.add('active');
}

// Function to close completion request modal
function closeCompletionRequestModal() {
    const modal = document.getElementById('completionRequestModal');
    if (modal) {
        modal.style.display = 'none';
    }
}
// Mark received user task as complete
async function markReceivedUserTaskComplete(taskId) {
    if (confirm('Are you sure you want to mark this task as completed?')) {
        try {
            await apiCall(`/user/user-tasks/${taskId}/complete`, {
                method: 'PATCH',
                body: JSON.stringify({
                    completedBy: currentUser.name
                })
            });

            showSuccessMessage('Task marked as completed!');
            await loadReceivedUserTasks();
        } catch (error) {
            console.error('Error completing task:', error);
            showErrorMessage(error.message);
        }
    }
}

// Edit user assigned task
function editUserTask(taskId) {
    openUserTaskModal(taskId);
}

// Delete user assigned task
async function deleteUserTask(taskId) {
    if (confirm('Are you sure you want to delete this task?')) {
        try {
            await apiCall(`/user/user-tasks/${taskId}`, { method: 'DELETE' });
            showSuccessMessage('Task deleted successfully!');
            await loadUserAssignedTasks();
        } catch (error) {
            console.error('Error deleting task:', error);
            showErrorMessage(error.message);
        }
    }
}


// Load task for editing
async function loadUserTaskForEdit(taskId) {
    try {
        const task = await apiCall(`/user/user-tasks/${taskId}`);

        document.getElementById('userTaskId').value = task._id;
        document.getElementById('userTaskTitle').value = task.title;
        document.getElementById('userTaskAssignedTo').value = task.assignedTo;
        document.getElementById('userTaskPriority').value = task.priority;
        document.getElementById('userTaskDueDate').value = task.dueDate.split('T')[0];
        document.getElementById('userTaskDescription').value = task.description || '';
        document.getElementById('userTaskNotes').value = task.notes || '';
    } catch (error) {
        console.error('Error loading task for edit:', error);
        showErrorMessage(error.message);
    }
}



// Stats Loading
async function loadStats() {
    try {
        const stats = await apiCall('/admin/dashboard-stats');
        if (stats) {
            document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
            document.getElementById('totalTasks').textContent = stats.totalTasks || 0;
            document.getElementById('pendingTasks').textContent = stats.pendingTasks || 0;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
        // Set default values
        document.getElementById('totalUsers').textContent = '0';
        document.getElementById('totalTasks').textContent = '0';
        document.getElementById('pendingTasks').textContent = '0';
    }
}

function safeElementUpdate(elementId, value, defaultValue = '') {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    } else {
        console.warn(`Element with ID '${elementId}' not found`);
    }
}

async function loadUserStats() {
    if (!currentUser || !currentUser.id) {
        console.error('Cannot load user stats: currentUser.id is undefined');
        return;
    }

    try {
        console.log('Loading user stats for user ID:', currentUser.id);
        const stats = await apiCall(`/user/${currentUser.id}/stats`);

        // Update UI elements safely
        const elements = {
            'myTotalTasks': stats.totalTasks || 0,
            'myPendingTasks': stats.pendingTasks || 0,
            'myCompletedTasks': stats.completedTasks || 0,
            'myCompletionRate': `${stats.completionRate || 0}%`
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    } catch (error) {
        console.error('Error loading user stats:', error);
        // Set default values to prevent UI from breaking
        ['myTotalTasks', 'myPendingTasks', 'myCompletedTasks'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = '0';
        });
        const rateElement = document.getElementById('myCompletionRate');
        if (rateElement) rateElement.textContent = '0%';
    }
}

// Recent Activity Loading
async function loadRecentActivity() {
    try {
        const activities = await apiCall('/admin/recent-activity');
        const container = document.getElementById('recentActivity');

        if (activities.length === 0) {
            container.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No recent activity</p>';
            return;
        }

        container.innerHTML = activities.map(activity => `
                    <div style="padding: 10px; border-bottom: 1px solid #f0f0f0;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span>${activity.description}</span>
                            <small style="color: #666;">${new Date(activity.createdAt).toLocaleString()}</small>
                        </div>
                    </div>
                `).join('');
    } catch (error) {
        console.error('Error loading recent activity:', error);
        document.getElementById('recentActivity').innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">Error loading activity</p>';
    }
}

// Users Management
async function loadUsers() {
    try {
        const users = await apiCall('/admin/users');
        const tbody = document.querySelector('#usersTable tbody');

        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666; padding: 40px;">No users found</td></tr>';
            return;
        }

        tbody.innerHTML = users.map(user => `
                    <tr>
                        <td>${user.name}</td>
                        <td>${user.username}</td>
                        <td>${user.email}</td>
                        <td>${user.role}</td>
                        <td>
                            <span class="status-badge status-${user.status}">
                                ${user.status}
                            </span>
                        </td>
                        <td>
                            <button class="action-btn btn-edit" onclick="editUser('${user._id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn btn-delete" onclick="deleteUser('${user._id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `).join('');

        // Populate user dropdowns
        populateUserDropdowns(users);
    } catch (error) {
        console.error('Error loading users:', error);
        document.querySelector('#usersTable tbody').innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666; padding: 40px;">Error loading users</td></tr>';
    }
}

function populateUserDropdowns(users) {
    const dropdowns = ['taskAssignedTo'];

    dropdowns.forEach(dropdownId => {
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            if (dropdownId === 'taskAssignedTo') {
                dropdown.innerHTML = '<option value="">Select User</option>' +
                    users.filter(u => u.status === 'active').map(user =>
                        `<option value="${user._id}">${user.name}</option>`
                    ).join('');
            } else {
                dropdown.innerHTML = users.filter(u => u.status === 'active').map(user =>
                    `<option value="${user._id}">${user.name}</option>`
                ).join('');
            }
        }
    });
}



async function loadTasks(filter = '') {
    try {
        const response = await apiCall('/admin/tasks');
        allTasks = response.filter(task => task.status !== 'completed');
        completedTasks = response.filter(task => task.status === 'completed');

        currentTaskFilter = filter;
        renderActiveTasks(allTasks, filter);
        updateTaskStats();

        // Update filter dropdown
        document.getElementById('taskFilter').value = filter;

    } catch (error) {
        console.error('Error loading tasks:', error);
        document.querySelector('#tasksTable tbody').innerHTML = '<tr><td colspan="7" style="text-align: center; color: #666; padding: 40px;">Error loading tasks</td></tr>';
    }
}

function updateTaskStats() {
    const today = new Date().toISOString().split('T')[0];

    const stats = {
        total: allTasks.length,
        pending: allTasks.filter(task => task.status === 'pending').length,
        inProgress: allTasks.filter(task => task.status === 'in_progress').length,
        pendingApproval: allTasks.filter(task => task.status === 'pending_approval').length,
        overdue: allTasks.filter(task =>
            (task.status === 'pending' || task.status === 'in_progress') &&
            task.dueDate < today
        ).length,
        highPriority: allTasks.filter(task => task.priority === 'high').length,
        critical: allTasks.filter(task => task.priority === 'critical').length
    };

    // Update stats display if you want to show them
    console.log('Task Statistics:', stats);
}

function renderActiveTasks(tasks, filter = '') {
    const tbody = document.querySelector('#tasksTable tbody');
    let filteredTasks = tasks;

    // Apply filters
    if (filter) {
        filteredTasks = applyTaskFilter(tasks, filter);
    }

    if (filteredTasks.length === 0) {
        const message = filter ?
            `No tasks found matching filter: "${getFilterDisplayName(filter)}"` :
            'No active tasks found';
        tbody.innerHTML = `<tr><td colspan="7" class="no-tasks-message">${message}</td></tr>`;
        return;
    }

    tbody.innerHTML = filteredTasks.map(task => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dueDate = new Date(task.dueDate);
        const taskDueDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()); // Start of due date
        let status = task.status;
        let rowClass = 'task-row';

        if ((status === 'pending' || status === 'in_progress') && task.dueDate < today) {
            status = 'overdue';
            rowClass += ' overdue-task';
        } else if (status === 'pending_approval') {
            status = 'pending approval';
            rowClass += ' pending-approval-task';
        }

        const dueDateObj = new Date(task.dueDate);
        const isOverdue = (task.status === 'pending' || task.status === 'in_progress') && taskDueDate < today;


        return `
                    <tr class="${rowClass}">
                        <td>
                            <div class="task-title">${task.title}</div>
                            <div class="task-description task-meta">${task.description || 'No description'}</div>
                        </td>
                        <td>${task.assignedToName || 'Unassigned'}</td>
                        <td>
                            <span class="priority-badge priority-${task.priority}">
                                ${task.priority}
                            </span>
                        </td>
                        <td>
                            <div class="${isOverdue ? 'text-danger' : ''}" style="color: ${isOverdue ? '#dc3545' : 'inherit'};">
                                ${dueDateObj.toLocaleDateString()}
                                ${isOverdue ? ' ⚠️' : ''}
                                ${taskDueDate.getTime() === today.getTime() ? ' 📅 DUE TODAY' : ''}
                            </div>
                        </td>
                        <td>
                            <span class="status-badge status-${status}" style="text-transform: capitalize;">
                                ${status.replace('_', ' ')}
                            </span>
                        </td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="background: #e0e0e0; border-radius: 10px; height: 8px; overflow: hidden; flex: 1;">
                                    <div style="background: ${getProgressColor(task.progress)}; height: 100%; width: ${task.progress || 0}%; transition: width 0.3s ease;"></div>
                                </div>
                                <small>${task.progress || 0}%</small>
                            </div>
                        </td>
                        <td>
                            <div class="task-actions">
                                ${task.status !== 'completed' && task.status !== 'pending_approval' ? `
                                    <button class="action-btn btn-complete" onclick="markTaskComplete('${task._id}')" title="Mark Complete">
                                        <i class="fas fa-check-circle"></i>
                                    </button>
                                ` : ''}
                                <button class="action-btn btn-edit" onclick="editTask('${task._id}')" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="action-btn btn-delete" onclick="deleteTask('${task._id}')" title="Delete">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
    }).join('');
}

function applyTaskFilter(tasks, filter) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (filter) {
        case 'pending':
            return tasks.filter(task => task.status === 'pending');
        case 'in_progress':
            return tasks.filter(task => task.status === 'in_progress');
        case 'pending_approval':
            return tasks.filter(task => task.status === 'pending_approval');
        case 'overdue':
            return tasks.filter(task => {
                const dueDate = new Date(task.dueDate);
                const taskDueDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
                return (task.status === 'pending' || task.status === 'in_progress') && taskDueDate < today;
            });

        case 'high_priority':
            return tasks.filter(task => task.priority === 'high');
        case 'critical_priority':
            return tasks.filter(task => task.priority === 'critical');
        default:
            return tasks;
    }
}

// Function to get filter display name
function getFilterDisplayName(filter) {
    const filterNames = {
        'pending': 'Pending',
        'in_progress': 'In Progress',
        'pending_approval': 'Pending Approval',
        'overdue': 'Overdue',
        'high_priority': 'High Priority',
        'critical_priority': 'Critical Priority'
    };
    return filterNames[filter] || filter;
}

// Function to get progress color
function getProgressColor(progress) {
    if (progress >= 100) return '#28a745';
    if (progress >= 75) return '#17a2b8';
    if (progress >= 50) return '#ffc107';
    if (progress >= 25) return '#fd7e14';
    return '#dc3545';
}

function renderTasksTable(tasks) {
    const tbody = document.querySelector('#tasksTable tbody');

    if (tasks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #666; padding: 40px;">No tasks found</td></tr>';
        return;
    }

    tbody.innerHTML = tasks.map(task => {
        const today = new Date().toISOString().split('T')[0];
        let status = task.status;
        if (status === 'pending' && task.dueDate < today) {
            status = 'overdue';
        }

        return `
                    <tr>
                        <td>
                            <strong>${task.title}</strong><br>
                            <small style="color: #666;">${task.description || ''}</small>
                        </td>
                        <td>${task.assignedToName || 'Unassigned'}</td>
                        <td>
                            <span class="priority-badge priority-${task.priority}">
                                ${task.priority}
                            </span>
                        </td>
                        <td>${new Date(task.dueDate).toLocaleDateString()}</td>
                        <td>
                            <span class="status-badge status-${status}">
                                ${status}
                            </span>
                        </td>
                        <td>
                            <div style="background: #e0e0e0; border-radius: 10px; height: 8px; overflow: hidden;">
                                <div style="background: #667eea; height: 100%; width: ${task.progress || 0}%; transition: width 0.3s ease;"></div>
                            </div>
                            <small>${task.progress || 0}%</small>
                        </td>
                        <td>
                            ${task.status !== 'completed' ? `
                            <button class="action-btn btn-complete" onclick="markTaskComplete('${task._id}')" title="Mark Complete">
                                <i class="fas fa-check-circle"></i>
                            </button>
                        ` : ''}
                            <button class="action-btn btn-edit" onclick="editTask('${task._id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn btn-delete" onclick="deleteTask('${task._id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
    }).join('');
}

async function requestTaskCompletion(taskId) {
    openCompletionRequestModal(taskId);
}


async function approveTaskCompletion(taskId) {
    if (confirm('Are you sure you want to approve this task completion?')) {
        try {
            await apiCall(`/admin/tasks/${taskId}/approve-completion`, {
                method: 'PATCH'
            });

            showSuccessMessage('Task completion approved successfully!');
            await loadCompletionRequests();
            await loadStats();
            await loadTasks();
        } catch (error) {
            console.error('Error approving task completion:', error);
            showErrorMessage(error.message);
        }
    }
}

async function rejectTaskCompletion(taskId) {
    if (confirm('Are you sure you want to reject this task completion request?')) {
        try {
            await apiCall(`/admin/tasks/${taskId}/reject-completion`, {
                method: 'PATCH'
            });

            showSuccessMessage('Task completion request rejected.');
            await loadCompletionRequests();
        } catch (error) {
            console.error('Error rejecting task completion:', error);
            showErrorMessage(error.message);
        }
    }
}

async function loadUserTasks() {
    try {
        if (!currentUser || !currentUser.id) {
            console.error('No current user found for loading tasks');
            return;
        }

        console.log('Loading user tasks for user ID:', currentUser.id);
        const tasks = await apiCall(`/user/${currentUser.id}/tasks`);

        // Check if table body exists before trying to populate it
        const tableBody = document.querySelector('#userTasksTable tbody');
        if (!tableBody) {
            console.log('User tasks table body not found');
            return;
        }

        // Clear existing content
        tableBody.innerHTML = '';

        if (!tasks || tasks.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666; padding: 40px;">No tasks assigned</td></tr>';
            return;
        }

        // Populate table
        tasks.forEach(task => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${task.title}</td>
                <td><span class="status-badge status-${task.status}">${task.status.replace('_', ' ')}</span></td>
                <td><span class="priority-badge priority-${task.priority}">${task.priority}</span></td>
                <td>${new Date(task.dueDate).toLocaleDateString()}</td>
                <td>${task.assignedByName || 'Unknown'}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="viewTask('${task._id}')">View</button>
                    ${task.status === 'pending' || task.status === 'in_progress' ?
                    `<button class="btn btn-success btn-sm" onclick="requestCompletion('${task._id}')">Request Completion</button>` :
                    ''
                }
                </td>
            `;
            tableBody.appendChild(row);
        });

        console.log('User tasks loaded successfully:', tasks.length, 'tasks');
    } catch (error) {
        console.error('Error loading user tasks:', error);
        const tableBody = document.querySelector('#userTasksTable tbody');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666; padding: 40px;">Error loading tasks: ' + error.message + '</td></tr>';
        }
    }
}

async function viewTask(taskId) {
    try {
        const task = await apiCall(`/admin/tasks/${taskId}`);

        // Check if task description modal exists, if not create it
        let modal = document.getElementById('taskDescriptionModal');
        if (!modal) {
            // Create the modal if it doesn't exist
            modal = document.createElement('div');
            modal.id = 'taskDescriptionModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content glass-dark">
                    <div class="modal-header">
                        <h3 id="taskDescriptionModalTitle">Task Details</h3>
                        <button class="close-btn" onclick="closeTaskDescriptionModal()">&times;</button>
                    </div>
                    <div id="taskDescriptionContent" style="padding: 20px;">
                        <!-- Content will be loaded here -->
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        const modalTitle = document.getElementById('taskDescriptionModalTitle');
        const modalContent = document.getElementById('taskDescriptionContent');

        modalTitle.textContent = `Task: ${task.title}`;

        // Build the task details content
        modalContent.innerHTML = `
            <div style="margin-bottom: 15px;">
                <strong>Title:</strong> ${task.title}
            </div>
            <div style="margin-bottom: 15px;">
                <strong>Description:</strong>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 5px; color: #333;">
                    ${task.description || 'No description provided'}
                </div>
            </div>
            <div style="margin-bottom: 15px;">
                <strong>Assigned To:</strong> ${task.assignedToName || 'Unassigned'}
            </div>
            <div style="margin-bottom: 15px;">
                <strong>Assigned By:</strong> ${task.assignedByName || 'Unknown'}
            </div>
            <div style="margin-bottom: 15px;">
                <strong>Priority:</strong> 
                <span class="priority-badge priority-${task.priority}" style="text-transform: capitalize;">
                    ${task.priority}
                </span>
            </div>
            <div style="margin-bottom: 15px;">
                <strong>Due Date:</strong> ${new Date(task.dueDate).toLocaleDateString()}
            </div>
            <div style="margin-bottom: 15px;">
                <strong>Status:</strong> 
                <span class="status-badge status-${task.status}" style="text-transform: capitalize;">
                    ${task.status.replace('_', ' ')}
                </span>
            </div>
            <div style="margin-bottom: 15px;">
                <strong>Progress:</strong> 
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="background: #e0e0e0; border-radius: 10px; height: 8px; overflow: hidden; flex: 1;">
                        <div style="background: #4caf50; height: 100%; width: ${task.progress || 0}%; transition: width 0.3s ease;"></div>
                    </div>
                    <span>${task.progress || 0}%</span>
                </div>
            </div>
            ${task.soNumber ? `
                <div style="margin-bottom: 15px;">
                    <strong>SO Number:</strong> ${task.soNumber}
                </div>
            ` : ''}
            ${task.parentTaskName ? `
                <div style="margin-bottom: 15px;">
                    <strong>Parent Task:</strong> ${task.parentTaskName}
                </div>
            ` : ''}
            ${task.remarks ? `
                <div style="margin-bottom: 15px;">
                    <strong>Remarks:</strong>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 5px; color: #333;">
                        ${task.remarks}
                    </div>
                </div>
            ` : ''}
            ${task.attachedDocument ? `
                <div style="margin-bottom: 15px;">
                    <strong>Attached Document:</strong>
                    <div style="margin-top: 5px;">
                        <button class="btn btn-secondary" onclick="downloadTaskDocument('${task._id}', '${task.attachedDocument.originalName}')" style="padding: 8px 15px; font-size: 14px;">
                            <i class="fas fa-download"></i> Download ${task.attachedDocument.originalName}
                        </button>
                    </div>
                </div>
            ` : ''}
            ${task.status === 'completed' && task.completedAt ? `
                <div style="margin-top: 15px; padding: 10px; background: #d4edda; border-radius: 8px; text-align: center;">
                    <i class="fas fa-check-circle" style="color: #155724;"></i>
                    <span style="color: #155724; font-weight: 500;">
                        Completed ${task.isOnTime ? 'On Time' : 'Late'}
                    </span>
                    <div style="margin-top: 5px; font-size: 0.85rem; color: #666;">
                        ${new Date(task.completedAt).toLocaleString()}
                    </div>
                </div>
            ` : ''}
            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                ${task.status !== 'completed' ? `
                    <button class="btn btn-primary" onclick="editTask('${task._id}'); closeTaskDescriptionModal();" style="padding: 8px 15px;">
                        <i class="fas fa-edit"></i> Edit Task
                    </button>
                ` : ''}
                <button class="btn btn-secondary" onclick="closeTaskDescriptionModal()" style="padding: 8px 15px;">
                    <i class="fas fa-times"></i> Close
                </button>
            </div>
        `;

        modal.classList.add('active');
        modal.style.display = 'flex';

    } catch (error) {
        console.error('Error loading task details:', error);
        showErrorMessage('Error loading task details: ' + error.message);
    }
}



function requestTaskDelay(taskId) {
    document.getElementById('delayTaskId').value = taskId;
    document.getElementById('taskDelayModal').classList.add('active');

    // Set minimum date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('requestedDueDate').min = tomorrow.toISOString().split('T')[0];
}

// Approve/Reject delay request
async function handleDelayRequest(taskId, requestId, action) {
    const reason = action === 'rejected' ?
        prompt('Please provide a reason for rejection:') :
        prompt('Any comments for approval (optional):') || '';

    if (action === 'rejected' && !reason) {
        showErrorMessage('Reason is required for rejection');
        return;
    }

    try {
        const response = await apiCall(`/admin/tasks/${taskId}/delay-request/${requestId}`, {
            method: 'PATCH',
            body: JSON.stringify({
                status: action,
                reviewComments: reason,
                reviewedBy: (currentAdmin || currentUser).name
            })
        });

        if (response.success) {
            showSuccessMessage(`Delay request ${action} successfully!`);
            await loadTasks();
        }
    } catch (error) {
        showErrorMessage(error.message);
    }
}

// Middle level validation approval
async function handleMiddleLevelValidation(taskId, action) {
    const remarks = prompt(`Please provide remarks for ${action}:`);
    if (!remarks && action === 'rejected') {
        showErrorMessage('Remarks are required for rejection');
        return;
    }

    try {
        const response = await apiCall(`/admin/tasks/${taskId}/middle-validation`, {
            method: 'PATCH',
            body: JSON.stringify({
                status: action,
                remarks: remarks,
                validatedBy: (currentUser || currentAdmin).name
            })
        });

        if (response.success) {
            showSuccessMessage(`Task ${action} by middle level validator!`);
            await loadTasks();
        }
    } catch (error) {
        showErrorMessage(error.message);
    }
}

// Download task document
async function downloadTaskDocument(taskId, filename) {
    try {
        // Show loading message
        showLoadingMessage('Downloading document...');

        const response = await fetch(`${API_BASE_URL}/admin/tasks/${taskId}/document`);

        if (response.ok) {
            const blob = await response.blob();

            // Check if blob is valid and not empty
            if (blob.size === 0) {
                throw new Error('Document is empty or corrupted');
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename || `document_${taskId}`;
            a.style.display = 'none'; // Hide the link element

            document.body.appendChild(a);
            a.click();

            // Clean up
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }, 100);

            hideLoadingMessage();
            showSuccessMessage(`Document "${filename}" downloaded successfully!`);

        } else {
            // Handle different error status codes
            let errorMessage;

            switch (response.status) {
                case 404:
                    errorMessage = 'Document not found. It may have been deleted or never uploaded.';
                    break;
                case 403:
                    errorMessage = 'You do not have permission to download this document.';
                    break;
                case 401:
                    errorMessage = 'Authentication required. Please login again.';
                    break;
                case 500:
                    errorMessage = 'Server error occurred while downloading the document.';
                    break;
                default:
                    errorMessage = `Failed to download document. Server returned status: ${response.status}`;
            }

            throw new Error(errorMessage);
        }

    } catch (error) {
        hideLoadingMessage();
        console.error('Error downloading document:', error);

        // Show user-friendly error message
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            showErrorMessage('Network error: Unable to connect to server. Please check your internet connection.');
        } else if (error.message.includes('aborted')) {
            showErrorMessage('Download was cancelled or timed out. Please try again.');
        } else {
            showErrorMessage('Error downloading document: ' + error.message);
        }
    }
}

async function downloadTaskDocumentWithProgress(taskId, filename) {
    try {
        // Create progress modal
        const progressModal = createProgressModal('Downloading document...');
        document.body.appendChild(progressModal);

        const response = await fetch(`${API_BASE_URL}/admin/tasks/${taskId}/document`);

        if (!response.ok) {
            throw new Error(`Download failed: ${response.status} ${response.statusText}`);
        }

        // Get file size for progress calculation
        const contentLength = response.headers.get('content-length');
        const total = parseInt(contentLength, 10);
        let loaded = 0;

        // Create a readable stream to track progress
        const reader = response.body.getReader();
        const chunks = [];

        while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            chunks.push(value);
            loaded += value.length;

            // Update progress if we have total size
            if (total) {
                const progress = Math.round((loaded / total) * 100);
                updateProgressModal(progressModal, progress);
            }
        }

        // Create blob from chunks
        const blob = new Blob(chunks);

        if (blob.size === 0) {
            throw new Error('Downloaded document is empty');
        }

        // Download the file
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `document_${taskId}`;
        a.style.display = 'none';

        document.body.appendChild(a);
        a.click();

        // Clean up
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            document.body.removeChild(progressModal);
        }, 1000);

        showSuccessMessage(`Document "${filename}" downloaded successfully!`);

    } catch (error) {
        // Remove progress modal on error
        const progressModal = document.getElementById('progressModal');
        if (progressModal) {
            document.body.removeChild(progressModal);
        }

        console.error('Error downloading document:', error);
        showErrorMessage('Failed to download document: ' + error.message);
    }
}

// Helper function to create progress modal
function createProgressModal(message) {
    const modal = document.createElement('div');
    modal.id = 'progressModal';
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content glass-dark" style="max-width: 400px;">
            <div class="modal-header">
                <h3>${message}</h3>
            </div>
            <div style="padding: 20px;">
                <div class="progress-bar" style="width: 100%; height: 20px; background: #e0e0e0; border-radius: 10px; overflow: hidden;">
                    <div id="progressFill" class="progress-fill" style="width: 0%; height: 100%; background: linear-gradient(135deg, var(--primary), var(--accent)); transition: width 0.3s ease;"></div>
                </div>
                <div id="progressText" style="text-align: center; margin-top: 10px; color: white;">0%</div>
            </div>
        </div>
    `;
    return modal;
}

// Helper function to update progress modal
function updateProgressModal(modal, progress) {
    const progressFill = modal.querySelector('#progressFill');
    const progressText = modal.querySelector('#progressText');

    if (progressFill) {
        progressFill.style.width = `${progress}%`;
    }

    if (progressText) {
        progressText.textContent = `${progress}%`;
    }
}

// Alternative version for user tasks documents
async function downloadUserTaskDocument(taskId, filename) {
    try {
        showLoadingMessage('Downloading document...');

        const response = await fetch(`${API_BASE_URL}/user/user-tasks/${taskId}/document`);

        if (response.ok) {
            const blob = await response.blob();

            if (blob.size === 0) {
                throw new Error('Document is empty');
            }

            // Get the correct filename from response headers if available
            const contentDisposition = response.headers.get('content-disposition');
            let downloadFilename = filename;

            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                if (filenameMatch) {
                    downloadFilename = filenameMatch[1];
                }
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = downloadFilename || `document_${taskId}`;
            a.style.display = 'none';

            document.body.appendChild(a);
            a.click();

            setTimeout(() => {
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }, 100);

            hideLoadingMessage();
            showSuccessMessage(`Document downloaded successfully!`);

        } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Download failed: ${response.status}`);
        }

    } catch (error) {
        hideLoadingMessage();
        console.error('Error downloading user task document:', error);
        showErrorMessage('Error downloading document: ' + error.message);
    }
}

// Utility function to check if browser supports file downloads
function checkDownloadSupport() {
    const a = document.createElement('a');
    return typeof a.download !== 'undefined';
}

// Enhanced download with fallback for older browsers
async function downloadTaskDocumentWithFallback(taskId, filename) {
    // Check browser support
    if (!checkDownloadSupport()) {
        showErrorMessage('Your browser does not support file downloads. Please use a modern browser.');
        return;
    }

    try {
        await downloadTaskDocument(taskId, filename);
    } catch (error) {
        // Fallback: open in new tab if download fails
        console.warn('Download failed, trying fallback method');

        try {
            const newWindow = window.open(`${API_BASE_URL}/admin/tasks/${taskId}/document`, '_blank');
            if (!newWindow) {
                throw new Error('Popup blocked. Please allow popups for this site.');
            }
            showSuccessMessage('Document opened in new tab. Right-click and save to download.');
        } catch (fallbackError) {
            showErrorMessage('Unable to download or open document: ' + fallbackError.message);
        }
    }
}



function renderUserTasks(tasks) {
    const container = document.getElementById('myTasksContainer');

    if (!container) {
        console.error('myTasksContainer not found');
        return;
    }

    if (tasks.length === 0) {
        const statusFilter = document.getElementById('userTaskStatusFilter')?.value || 'pending';
        const filterMessage = getFilterMessage(statusFilter);
        container.innerHTML = `<p style="color: #666; text-align: center; padding: 40px;">No ${filterMessage} found</p>`;
        return;
    }

    // Hide the table view since we're using grouped cards
    const tableContainer = document.querySelector('.table-responsive');
    if (tableContainer) {
        tableContainer.style.display = 'none';
    }

    // Group by exact title match
    const groupedTasks = groupTasksByExactTitle(tasks);

    let html = '';

    // Sort groups alphabetically for consistent display
    const sortedGroupNames = Object.keys(groupedTasks).sort();

    sortedGroupNames.forEach(groupName => {
        const groupTasks = groupedTasks[groupName];

        // Only show group header if there are multiple tasks with the same title
        if (groupTasks.length > 1) {
            html += `
                <div class="task-group" style="margin-bottom: 30px;">
                    <div class="task-group-header" style="background: rgba(102, 126, 234, 0.1); padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #667eea;">
                        <h3 style="margin: 0; color: #667eea; font-size: 1.2rem;">
                            <i class="fas fa-folder"></i> ${groupName}
                        </h3>
                        <small style="color: #888;">${groupTasks.length} identical tasks</small>
                    </div>
                    <div class="task-group-tasks">
                        ${groupTasks.map(task => renderSingleUserTask(task)).join('')}
                    </div>
                </div>
            `;
        } else {
            // For single tasks, show them without group header
            html += `
                <div class="task-group" style="margin-bottom: 20px;">
                    <div class="task-group-tasks">
                        ${renderSingleUserTask(groupTasks[0])}
                    </div>
                </div>
            `;
        }
    });

    container.innerHTML = html;
}


function groupTasksByExactTitle(tasks) {
    const groups = {};

    tasks.forEach(task => {
        let groupName;

        if (task.parentTaskName) {
            groupName = task.parentTaskName;
        } else if (task.title) {
            // Use the exact title as the group name
            groupName = task.title;
        } else {
            groupName = 'Untitled Tasks';
        }

        if (!groups[groupName]) {
            groups[groupName] = [];
        }
        groups[groupName].push(task);
    });

    return groups;
}

function renderSingleUserTask(task) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDate = new Date(task.dueDate);
    const taskDueDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

    let statusColor = '';
    let status = task.status;
    let dateDisplay = dueDate.toLocaleDateString();

    const isOverdue = (task.status === 'pending' || task.status === 'in_progress') && taskDueDate < today;
    const isDueToday = taskDueDate.getTime() === today.getTime();

    if (isOverdue) {
        status = 'overdue';
        statusColor = 'border-left-color: #dc3545;';
        dateDisplay += ' ⚠️ OVERDUE';
    } else if (status === 'pending_approval') {
        statusColor = 'border-left-color: #ffc107;';
    } else if (status === 'pending_middle_validation') {
        statusColor = 'border-left-color: #17a2b8;';
        status = 'pending validation';
    } else if (isDueToday && (task.status === 'pending' || task.status === 'in_progress')) {
        dateDisplay += ' 📅 DUE TODAY';
        statusColor = 'border-left-color: #ffc107;';
    }

    return `
        <div class="sprint-card priority-${task.priority}" style="${statusColor}">
            <div class="sprint-header">
                <div class="sprint-title">${task.title}</div>
                <div class="sprint-due" style="color: ${isOverdue ? '#dc3545' : 'inherit'};">
                    Due: ${dateDisplay}
                </div>
            </div>
            <div class="sprint-description">${task.description || 'No description'}</div>
            
            ${task.attachedDocument ? `
                <div style="background: #e8f5e8; padding: 10px; border-radius: 6px; margin: 10px 0;">
                    <i class="fas fa-paperclip" style="color: #28a745;"></i>
                    <strong>Document:</strong> ${task.attachedDocument.originalName}
                    <button onclick="downloadTaskDocument('${task._id}', '${task.attachedDocument.originalName}')" 
                            style="background: none; border: none; color: #007bff; cursor: pointer; margin-left: 10px;">
                        <i class="fas fa-download"></i> Download
                    </button>
                </div>
            ` : ''}
            
            <div style="margin: 10px 0; display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: #666;">
                <span>Created: ${new Date(task.createdAt).toLocaleDateString()}</span>
                <span class="priority-badge priority-${task.priority}">${task.priority.toUpperCase()}</span>
            </div>
            
            <div class="sprint-progress">
                <div class="sprint-progress-bar" style="width: ${task.progress || 0}%"></div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="status-badge status-${status.replace(' ', '_')}">${status.replace('_', ' ')}</span>
                <span style="color: #666; font-size: 0.9rem;">${task.progress || 0}% Complete</span>
            </div>
            
            ${task.needsMiddleLevelValidation && task.middleLevelValidationStatus === 'pending' ? `
                <div style="margin-top: 15px; padding: 10px; background: #e1f5fe; border-radius: 8px; text-align: center;">
                    <i class="fas fa-user-check" style="color: #0277bd;"></i>
                    <span style="color: #0277bd; font-weight: 500;">Awaiting Middle Level Validation</span>
                    <div style="margin-top: 5px; font-size: 0.85rem; color: #666;">
                        Validator: ${task.middleLevelValidatorName}
                    </div>
                </div>
            ` : ''}
            
            ${task.status !== 'completed' && task.status !== 'pending_approval' && task.status !== 'pending_middle_validation' ? `
                <div style="margin-top: 15px; display: flex; gap: 10px;">
                    <button class="btn btn-success" onclick="requestTaskCompletion('${task._id}')" style="flex: 1; padding: 10px;">
                        <i class="fas fa-check-circle"></i> Request Completion
                    </button>
                    <button class="btn btn-warning" onclick="requestTaskDelay('${task._id}')" style="padding: 10px;">
                        <i class="fas fa-clock"></i> Request Delay
                    </button>
                </div>
            ` : ''}
            
            ${task.status === 'pending_approval' ? `
                <div style="margin-top: 15px; padding: 10px; background: #fff3cd; border-radius: 8px; text-align: center;">
                    <i class="fas fa-clock" style="color: #856404;"></i>
                    <span style="color: #856404; font-weight: 500;">Awaiting Admin Approval</span>
                </div>
            ` : ''}
            
            ${task.status === 'completed' ? `
                <div style="margin-top: 15px; padding: 10px; background: #d4edda; border-radius: 8px; text-align: center;">
                    <i class="fas fa-check-circle" style="color: #155724;"></i>
                    <span style="color: #155724; font-weight: 500;">
                        Completed ${task.isOnTime ? 'On Time' : 'Late'}
                    </span>
                    ${task.completedAt ? `
                        <div style="margin-top: 5px; font-size: 0.85rem; color: #666;">
                            ${new Date(task.completedAt).toLocaleString()}
                        </div>
                    ` : ''}
                </div>
            ` : ''}
        </div>
    `;
}
function getFilterMessage(statusFilter) {
    const messages = {
        'pending': 'pending tasks',
        'completed': 'completed tasks',
        'in_progress': 'in progress tasks',
        'overdue': 'overdue tasks',
        'all': 'tasks'
    };
    return messages[statusFilter] || 'tasks';
}

// Update filter info display
function updateUserTaskFilterInfo(filter, filteredCount, totalCount) {
    // Remove existing filter info
    const existingInfo = document.querySelector('.user-task-filter-info');
    if (existingInfo) {
        existingInfo.remove();
    }

    // Add new filter info if not showing all
    if (filter !== 'all') {
        const filterInfo = document.createElement('div');
        filterInfo.className = 'user-task-filter-info';
        filterInfo.style.cssText = `
                    background: #e3f2fd; 
                    padding: 10px 15px; 
                    border-radius: 8px; 
                    margin-bottom: 15px; 
                    color: #1976d2; 
                    font-weight: 500;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                `;

        const filterName = getFilterMessage(filter);
        filterInfo.innerHTML = `
                    <span><i class="fas fa-filter"></i> Showing: ${filteredCount} ${filterName}</span>
                    <span style="font-size: 0.9rem; opacity: 0.8;">Total: ${totalCount} tasks</span>
                `;

        document.getElementById('myTasksContainer').insertAdjacentElement('beforebegin', filterInfo);
    }
}

// Reset filters to default
function resetUserTaskFilters() {
    document.getElementById('userTaskStatusFilter').value = 'pending';
    document.getElementById('userTaskSortFilter').value = 'due_date_asc';
    filterUserTasks();
    showSuccessMessage('Filters reset to default');
}

async function loadParentTasks() {
    try {
        const soNumber = document.getElementById('taskSONumber').value;
        const url = soNumber ? `/admin/parent-tasks?soNumber=${soNumber}` : '/admin/parent-tasks';

        const parentTasks = await apiCall(url);
        const dropdown = document.getElementById('taskParentTask');

        dropdown.innerHTML = '<option value="">Select Parent Task</option>';

        Object.keys(parentTasks).forEach(soNumber => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = `SO# ${soNumber}`;

            parentTasks[soNumber].forEach(task => {
                const option = document.createElement('option');
                option.value = task._id;
                option.textContent = task.title;
                optgroup.appendChild(option);
            });

            dropdown.appendChild(optgroup);
        });
    } catch (error) {
        console.error('Error loading parent tasks:', error);
    }
}

// Toggle job entry fields
function toggleJobEntryFields() {
    const fields = document.getElementById('jobEntryFields');
    const isVisible = fields.style.display !== 'none';

    fields.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
        loadParentTasks();
    }
}


// Pending Tasks
async function loadPendingTasks() {
    try {
        const pendingTasks = await apiCall('/admin/pending-tasks');
        const container = document.getElementById('pendingSprintsContainer');

        if (pendingTasks.length === 0) {
            container.innerHTML = '<div class="card"><p style="color: #666; text-align: center; padding: 40px;">No pending tasks</p></div>';
            return;
        }

        // Group tasks by user
        const tasksByUser = pendingTasks.reduce((acc, task) => {
            const userName = task.assignedToName || 'Unassigned';
            if (!acc[userName]) {
                acc[userName] = [];
            }
            acc[userName].push(task);
            return acc;
        }, {});

        container.innerHTML = Object.keys(tasksByUser).map(userName => `
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">${userName}</h3>
                            <span class="status-badge status-pending">${tasksByUser[userName].length} pending</span>
                        </div>
                        ${tasksByUser[userName].map(task => {
            const today = new Date().toISOString().split('T')[0];
            const isOverdue = task.dueDate < today;

            return `
                                <div class="sprint-card ${isOverdue ? 'priority-high' : `priority-${task.priority}`}">
                                    <div class="sprint-header">
                                        <div class="sprint-title">${task.title}</div>
                                        <div class="sprint-due ${isOverdue ? 'text-danger' : ''}">
                                            Due: ${new Date(task.dueDate).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div class="sprint-description">${task.description || 'No description'}</div>
                                    <div class="sprint-progress">
                                        <div class="sprint-progress-bar" style="width: ${task.progress || 0}%"></div>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <span class="status-badge ${isOverdue ? 'status-overdue' : 'status-pending'}">
                                            ${isOverdue ? 'overdue' : 'pending'}
                                        </span>
                                        <span style="color: #666; font-size: 0.9rem;">${task.progress || 0}% Complete</span>
                                    </div>
                                </div>
                            `;
        }).join('')}
                    </div>
                `).join('');
    } catch (error) {
        console.error('Error loading pending tasks:', error);
        document.getElementById('pendingSprintsContainer').innerHTML = '<div class="card"><p style="color: #666; text-align: center; padding: 40px;">Error loading pending tasks</p></div>';
    }
}

// Analytics
async function loadAnalytics() {
    try {
        const analytics = await apiCall('/admin/analytics');

        // Update analytics stats
        document.getElementById('completedOnTime').textContent = analytics.completedOnTime || 0;
        document.getElementById('completedLate').textContent = analytics.completedLate || 0;
        document.getElementById('completionRate').textContent = `${analytics.completionRate || 0}%`;
        document.getElementById('topPerformer').textContent = analytics.topPerformer || 'N/A';

        // Update performance table
        const tbody = document.querySelector('#performanceTable tbody');
        if (analytics.userPerformance && analytics.userPerformance.length > 0) {
            tbody.innerHTML = analytics.userPerformance.map(user => `
                        <tr>
                            <td>${user.name}</td>
                            <td>${user.totalTasks}</td>
                            <td>${user.completed}</td>
                            <td>${user.onTime}</td>
                            <td>${user.late}</td>
                            <td>${user.pending}</td>
                            <td>${user.successRate}%</td>
                        </tr>
                    `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #666; padding: 40px;">No performance data available</td></tr>';
        }
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

// User Progress
async function loadUserProgress() {
    try {
        const progress = await apiCall(`/user/${currentUser.id}/progress`);
        const container = document.getElementById('myPerformanceData');

        container.innerHTML = `
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
                        <div style="text-align: center; padding: 20px;">
                            <h4 style="color: #667eea;">Total Tasks</h4>
                            <p style="font-size: 2rem; font-weight: bold; color: #2c3e50;">${progress.totalTasks || 0}</p>
                        </div>
                        <div style="text-align: center; padding: 20px;">
                            <h4 style="color: #667eea;">Completed</h4>
                            <p style="font-size: 2rem; font-weight: bold; color: #2c3e50;">${progress.completed || 0}</p>
                        </div>
                        <div style="text-align: center; padding: 20px;">
                            <h4 style="color: #667eea;">On Time</h4>
                            <p style="font-size: 2rem; font-weight: bold; color: #2c3e50;">${progress.onTime || 0}</p>
                        </div>
                        <div style="text-align: center; padding: 20px;">
                            <h4 style="color: #667eea;">Late</h4>
                            <p style="font-size: 2rem; font-weight: bold; color: #2c3e50;">${progress.late || 0}</p>
                        </div>
                        <div style="text-align: center; padding: 20px;">
                            <h4 style="color: #667eea;">Success Rate</h4>
                            <p style="font-size: 2rem; font-weight: bold; color: #2c3e50;">${progress.successRate || 0}%</p>
                        </div>
                        <div style="text-align: center; padding: 20px;">
                            <h4 style="color: #667eea;">Average Days</h4>
                            <p style="font-size: 2rem; font-weight: bold; color: #2c3e50;">${progress.avgCompletionDays || 0}</p>
                        </div>
                    </div>
                `;
    } catch (error) {
        console.error('Error loading user progress:', error);
        document.getElementById('myPerformanceData').innerHTML = '<p style="color: #666; text-align: center; padding: 40px;">Error loading progress data</p>';
    }
}

// Modal Management
function openUserModal(userId = null) {
    const modal = document.getElementById('userModal');
    const form = document.getElementById('userForm');

    if (userId) {
        // Edit mode - load user data
        document.getElementById('userModalTitle').textContent = 'Edit User';
        document.getElementById('userSubmitText').textContent = 'Update User';
        loadUserForEdit(userId);
    } else {
        // Add mode
        document.getElementById('userModalTitle').textContent = 'Add New User';
        document.getElementById('userSubmitText').textContent = 'Save User';
        form.reset();
        document.getElementById('userId').value = '';
    }

    modal.classList.add('active');
}

function closeUserModal() {
    document.getElementById('userModal').classList.remove('active');
    document.getElementById('userForm').reset();
}


function openTaskModal(taskId = null) {
    const modal = document.getElementById('taskModal');
    const form = document.getElementById('taskForm');

    if (taskId) {
        document.getElementById('taskModalTitle').textContent = 'Edit Task';
        document.getElementById('taskSubmitText').textContent = 'Update Task';
        loadTaskForEdit(taskId);
    } else {
        document.getElementById('taskModalTitle').textContent = 'Add New Task';
        document.getElementById('taskSubmitText').textContent = 'Save Task';
        form.reset();
        document.getElementById('taskId').value = '';
        document.getElementById('jobEntryFields').style.display = 'none';
    }

    // Load dropdowns
    populateTaskDropdowns();
    modal.classList.add('active');
}

async function populateTaskDropdowns() {
    try {
        const users = await apiCall('/admin/users');
        const activeUsers = users.filter(u => u.status === 'active');

        // Primary assignee dropdown
        const assigneeDropdown = document.getElementById('taskAssignedTo');
        assigneeDropdown.innerHTML = '<option value="">Select User</option>' +
            activeUsers.map(user => `<option value="${user._id}">${user.name} (${user.role})</option>`).join('');

        // Multiple assignees dropdown
        const multipleDropdown = document.getElementById('taskMultipleAssignees');
        multipleDropdown.innerHTML = activeUsers.map(user =>
            `<option value="${user._id}">${user.name} (${user.role})</option>`
        ).join('');

        // Middle level validator dropdown
        const validatorDropdown = document.getElementById('taskMiddleLevelValidator');
        validatorDropdown.innerHTML = '<option value="">No Middle Level Validation</option>' +
            activeUsers.map(user => `<option value="${user._id}">${user.name} (${user.role})</option>`).join('');

        // Load parent tasks
        loadParentTasks();

    } catch (error) {
        console.error('Error loading task dropdowns:', error);
    }
}


function closeTaskModal() {
    document.getElementById('taskModal').classList.remove('active');
    document.getElementById('taskForm').reset();
}




function applyUserTaskStatusFilter(tasks, filter) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (filter) {
        case 'all':
            return tasks;
        case 'pending':
            return tasks.filter(task => task.status === 'pending' || task.status === 'in_progress');
        case 'completed':
            return tasks.filter(task => task.status === 'completed');
        case 'in_progress':
            return tasks.filter(task => task.status === 'in_progress');
        case 'pending_approval':
            return tasks.filter(task => task.status === 'pending_approval');
        case 'overdue':
            return tasks.filter(task => {
                const dueDate = new Date(task.dueDate);
                const taskDueDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
                return (task.status === 'pending' || task.status === 'in_progress') && taskDueDate < today;
            });
        default:
            return tasks.filter(task => task.status === 'pending' || task.status === 'in_progress');
    }
}

// Apply sorting
function applyUserTaskSorting(tasks, sortType) {
    const sortedTasks = [...tasks];

    switch (sortType) {
        case 'due_date_asc':
            return sortedTasks.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        case 'due_date_desc':
            return sortedTasks.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));
        case 'created_asc':
            return sortedTasks.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        case 'created_desc':
            return sortedTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        case 'priority_high':
            const priorityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
            return sortedTasks.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
        case 'priority_low':
            const priorityOrderLow = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
            return sortedTasks.sort((a, b) => priorityOrderLow[a.priority] - priorityOrderLow[b.priority]);
        case 'status':
            const statusOrder = { 'pending': 1, 'in_progress': 2, 'pending_approval': 3, 'completed': 4 };
            return sortedTasks.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
        default:
            return sortedTasks.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    }
}


// Update user assigned task statistics
function updateUserAssignedStats(tasks) {
    const total = tasks.length;
    const completed = tasks.filter(task => task.status === 'completed').length;
    const pending = tasks.filter(task => task.status === 'pending' || task.status === 'in_progress').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    document.getElementById('myAssignedTasks').textContent = total;
    document.getElementById('myAssignedPending').textContent = pending;
    document.getElementById('myAssignedCompleted').textContent = completed;
    document.getElementById('myAssignedCompletionRate').textContent = completionRate + '%';
}



function closeUserTaskModal() {
    document.getElementById('userTaskModal').classList.remove('active');
    document.getElementById('userTaskForm').reset();
}

function closeMiddleLevelValidationModal() {
    document.getElementById('middleLevelValidationModal').classList.remove('active');
}

// Form Handlers
async function handleUserSubmit(e) {
    e.preventDefault();

    const formData = {
        name: document.getElementById('userName').value,
        username: document.getElementById('userUsername').value,
        email: document.getElementById('userEmail').value,
        password: document.getElementById('userPassword').value,
        role: document.getElementById('userRole').value,
        status: document.getElementById('userStatus').value
    };

    const userId = document.getElementById('userId').value;

    try {
        let response;
        if (userId) {
            response = await apiCall(`/admin/users/${userId}`, {
                method: 'PUT',
                body: JSON.stringify(formData)
            });
        } else {
            response = await apiCall('/admin/users', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
        }

        showSuccessMessage(userId ? 'User updated successfully!' : 'User created successfully!');
        closeUserModal();
        await loadUsers();
    } catch (error) {
        console.error('Error saving user:', error);
        showErrorMessage(error.message);
    }
}


async function handleTaskSubmit(e) {
    e.preventDefault();

    const formData = new FormData();

    // Basic task data
    formData.append('title', document.getElementById('taskTitle').value);
    formData.append('assignedTo', document.getElementById('taskAssignedTo').value);
    formData.append('priority', document.getElementById('taskPriority').value);
    formData.append('dueDate', document.getElementById('taskDueDate').value);
    formData.append('description', document.getElementById('taskDescription').value);

    // Middle level validation
    const middleLevelValidator = document.getElementById('taskMiddleLevelValidator')?.value;
    if (middleLevelValidator) {
        formData.append('middleLevelValidator', middleLevelValidator);
        formData.append('needsMiddleLevelValidation', 'true');
    }

    // Multiple assignees
    const multipleAssignees = document.getElementById('taskMultipleAssignees')?.value;
    if (multipleAssignees) {
        formData.append('assignedToMultiple', JSON.stringify(multipleAssignees.split(',')));
    }

    // Parent task for job entries
    const parentTask = document.getElementById('taskParentTask')?.value;
    if (parentTask) {
        formData.append('parentTask', parentTask);
    }

    const soNumber = document.getElementById('taskSONumber')?.value;
    if (soNumber) {
        formData.append('soNumber', soNumber);
        formData.append('stage', document.getElementById('taskStage')?.value || '');
    }

    // File upload
    const fileInput = document.getElementById('taskDocument');
    if (fileInput && fileInput.files[0]) {
        formData.append('document', fileInput.files[0]);
    }

    // Privacy settings
    if (currentUser && document.getElementById('taskAssignedTo').value === currentUser.id) {
        formData.append('isPrivate', 'true');
    }

    // Super admin task
    if (currentUser && currentUser.role === 'super_admin') {
        formData.append('isSuperAdminTask', 'true');
    }

    const taskId = document.getElementById('taskId').value;

    try {
        let response;
        if (taskId) {
            // For updates, convert FormData back to JSON (or handle file updates separately)
            const updateData = {
                title: formData.get('title'),
                assignedTo: formData.get('assignedTo'),
                priority: formData.get('priority'),
                dueDate: formData.get('dueDate'),
                description: formData.get('description')
            };

            response = await fetch(`${API_BASE_URL}/admin/tasks/${taskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });
        } else {
            // For new tasks with file upload
            response = await fetch(`${API_BASE_URL}/admin/tasks`, {
                method: 'POST',
                body: formData // Send as FormData for file upload
            });
        }

        const result = await response.json();

        if (response.ok) {
            showSuccessMessage(taskId ? 'Task updated successfully!' : 'Task created successfully!');
            closeTaskModal();
            await loadTasks();
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Error saving task:', error);
        showErrorMessage(error.message);
    }
}

// CRUD Operations
async function editUser(userId) {
    openUserModal(userId);
}

async function deleteUser(userId) {
    if (confirm('Are you sure you want to delete this user?')) {
        try {
            await apiCall(`/admin/users/${userId}`, { method: 'DELETE' });
            showSuccessMessage('User deleted successfully!');
            await loadUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
            showErrorMessage(error.message);
        }
    }
}

async function editTask(taskId) {
    // Load task data and open modal
    try {
        const task = await apiCall(`/admin/tasks/${taskId}`);

        document.getElementById('taskId').value = task._id;
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskAssignedTo').value = task.assignedTo;
        document.getElementById('taskPriority').value = task.priority;
        document.getElementById('taskDueDate').value = task.dueDate.split('T')[0];
        document.getElementById('taskDescription').value = task.description || '';

        document.getElementById('taskModalTitle').textContent = 'Edit Task';
        document.getElementById('taskSubmitText').textContent = 'Update Task';
        document.getElementById('taskModal').classList.add('active');
    } catch (error) {
        console.error('Error loading task for edit:', error);
        showErrorMessage(error.message);
    }
}

async function deleteTask(taskId) {
    if (confirm('Are you sure you want to delete this task?')) {
        try {
            await apiCall(`/admin/tasks/${taskId}`, { method: 'DELETE' });
            showSuccessMessage('Task deleted successfully!');
            await loadTasks();
        } catch (error) {
            console.error('Error deleting task:', error);
            showErrorMessage(error.message);
        }
    }
}



function toggleCompletedTasks() {
    const container = document.getElementById('completedTasksContainer');
    const toggleIcon = document.getElementById('toggleCompletedIcon');
    const toggleText = document.getElementById('toggleCompletedText');

    completedTasksVisible = !completedTasksVisible;

    if (completedTasksVisible) {
        container.style.display = 'block';
        toggleIcon.className = 'fas fa-eye-slash';
        toggleText.textContent = 'Hide Completed';
        loadCompletedTasks();
    } else {
        container.style.display = 'none';
        toggleIcon.className = 'fas fa-eye';
        toggleText.textContent = 'Show Completed';
    }
}

async function loadCompletedTasks(filter = '') {
    try {
        if (completedTasks.length === 0) {
            const response = await apiCall('/admin/tasks');
            completedTasks = response.filter(task => task.status === 'completed');
        }

        renderCompletedTasks(completedTasks, filter);

    } catch (error) {
        console.error('Error loading completed tasks:', error);
        document.querySelector('#completedTasksTable tbody').innerHTML = '<tr><td colspan="7" style="text-align: center; color: #666; padding: 40px;">Error loading completed tasks</td></tr>';
    }
}

function getCompletedFilterDisplayName(filter) {
    const filterNames = {
        'on_time': 'Completed On Time',
        'late': 'Completed Late',
        'this_week': 'This Week',
        'this_month': 'This Month'
    };
    return filterNames[filter] || filter;
}



// Function to view task details (for completed tasks)
function viewTaskDetails(taskId) {
    const task = completedTasks.find(t => t._id === taskId);
    if (task) {
        let alertText = `Task: ${task.title}\nDescription: ${task.description || 'No description'}\nCompleted: ${new Date(task.completedAt).toLocaleString()}\nStatus: ${task.isOnTime ? 'On Time' : 'Late'}`;

        // Add remarks if they exist
        if (task.remarks) {
            alertText += `\nRemarks: ${task.remarks}`;
        }

        alert(alertText);
    }
}

// Function to render completed tasks
function renderCompletedTasks(tasks, filter = '') {
    const tbody = document.querySelector('#completedTasksTable tbody');
    let filteredTasks = tasks;

    // Apply completed task filters
    if (filter) {
        filteredTasks = applyCompletedTaskFilter(tasks, filter);
    }

    if (filteredTasks.length === 0) {
        const message = filter ?
            `No completed tasks found matching filter: "${getCompletedFilterDisplayName(filter)}"` :
            'No completed tasks found';
        tbody.innerHTML = `<tr><td colspan="7" class="no-tasks-message">${message}</td></tr>`;
        return;
    }

    tbody.innerHTML = filteredTasks.map(task => `
                <tr class="completed-task-row">
                    <td>
                        <div class="task-title">${task.title}</div>
                        <div class="task-description task-meta">${task.description || 'No description'}</div>
                    </td>
                    <td>${task.assignedToName || 'Unassigned'}</td>
                    <td>
                        <span class="priority-badge priority-${task.priority}">
                            ${task.priority}
                        </span>
                    </td>
                    <td>${new Date(task.dueDate).toLocaleDateString()}</td>
                    <td>
                        <div class="task-meta">
                            ${new Date(task.completedAt).toLocaleDateString()}
                        </div>
                    </td>
                    <td>
                        <span class="completion-badge ${task.isOnTime ? 'completion-on-time' : 'completion-late'}">
                            ${task.isOnTime ? 'On Time' : 'Late'}
                        </span>
                    </td>
                    <td>
                        <div class="task-actions">
                            <button class="action-btn btn-edit" onclick="viewTaskDetails('${task._id}')" title="View Details">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="action-btn btn-delete" onclick="deleteTask('${task._id}')" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
}

function applyCompletedTaskFilter(tasks, filter) {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    switch (filter) {
        case 'on_time':
            return tasks.filter(task => task.isOnTime === true);
        case 'late':
            return tasks.filter(task => task.isOnTime === false);
        case 'this_week':
            return tasks.filter(task => new Date(task.completedAt) >= weekAgo);
        case 'this_month':
            return tasks.filter(task => new Date(task.completedAt) >= monthAgo);
        default:
            return tasks;
    }
}

// Function to clear task filter
function clearTaskFilter() {
    document.getElementById('taskFilter').value = '';
    currentTaskFilter = '';
    renderActiveTasks(allTasks, '');

    // Remove filter info
    const filterInfo = document.querySelector('.filter-info');
    if (filterInfo) {
        filterInfo.remove();
    }
}

function createEnhancedTaskModal() {
    const existingModal = document.getElementById('taskModal');
    if (existingModal) {
        existingModal.innerHTML = `
            <div class="modal-content glass-dark">
                <div class="modal-header">
                    <h3 id="taskModalTitle">Add New Task</h3>
                    <button class="close-btn" onclick="closeTaskModal()">&times;</button>
                </div>
                <form id="taskForm" enctype="multipart/form-data">
                    <input type="hidden" id="taskId">

                    <div class="form-row">
                        <div class="form-group">
                            <label for="taskTitle">Task Title</label>
                            <input type="text" id="taskTitle" class="form-control" required placeholder="Enter task title">
                        </div>
                        <div class="form-group">
                            <label for="taskParentTask">Parent Task (Optional)</label>
                            <select id="taskParentTask" class="form-control">
                                <option value="">Select Parent Task</option>
                                <!-- Will be populated dynamically -->
                            </select>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="taskAssignedTo">Assigned To</label>
                            <select id="taskAssignedTo" class="form-control" required>
                                <option value="">Select User</option>
                                <!-- Users will be populated here -->
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="taskMultipleAssignees">Additional Assignees (Optional)</label>
                            <select id="taskMultipleAssignees" class="form-control" multiple>
                                <!-- Users will be populated here -->
                            </select>
                            <small class="help-text">Hold Ctrl/Cmd to select multiple users</small>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="taskMiddleLevelValidator">Middle Level Validator (Optional)</label>
                            <select id="taskMiddleLevelValidator" class="form-control">
                                <option value="">No Middle Level Validation</option>
                                <!-- Users will be populated here -->
                            </select>
                            <small class="help-text">Task will go to this person for approval before admin</small>
                        </div>
                        <div class="form-group">
                            <label for="taskPriority">Priority</label>
                            <select id="taskPriority" class="form-control" required>
                                <option value="">Select Priority</option>
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="critical">Critical</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="taskDueDate">Due Date</label>
                            <input type="date" id="taskDueDate" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="taskDocument">Upload Document (Optional)</label>
                            <input type="file" id="taskDocument" class="form-control" 
                                   accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.xlsx,.xls">
                            <small class="help-text">Max size: 10MB</small>
                        </div>
                    </div>

                    <!-- Job Entry Fields (for daily job tasks) -->
                    <div class="form-group" id="jobEntryFields" style="display: none;">
                        <label for="taskSONumber">S.O Number (For Job Tasks)</label>
                        <input type="text" id="taskSONumber" class="form-control" placeholder="Enter SO Number">
                        <label for="taskStage" style="margin-top: 10px;">Job Stage</label>
                        <select id="taskStage" class="form-control">
                            <option value="">Select Stage</option>
                            <option value="sales_order_received">Sales Order Received</option>
                            <option value="drawing_approved">Drawing Approved</option>
                            <option value="production_started">Production Started</option>
                            <!-- Add other stages -->
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="taskDescription">Description</label>
                        <textarea id="taskDescription" class="form-control" rows="3" 
                                  placeholder="Task description and requirements"></textarea>
                    </div>
                    
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-save"></i> <span id="taskSubmitText">Save Task</span>
                    </button>
                </form>
            </div>
        `;
    }
}

// Enhanced User Task Modal
function createEnhancedUserTaskModal() {
    const existingModal = document.getElementById('userTaskModal');
    if (existingModal) {
        existingModal.innerHTML = `
            <div class="modal-content glass-dark">
                <div class="modal-header">
                    <h3 id="userTaskModalTitle">Assign New Task</h3>
                    <button class="close-btn" onclick="closeUserTaskModal()">&times;</button>
                </div>
                <form id="userTaskForm" enctype="multipart/form-data">
                    <input type="hidden" id="userTaskId">
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="userTaskTitle">Task Title</label>
                            <input type="text" id="userTaskTitle" class="form-control" required placeholder="Enter task title">
                        </div>
                        <div class="form-group">
                            <label for="userTaskAssignedTo">Assign To</label>
                            <select id="userTaskAssignedTo" class="form-control" required>
                                <option value="">Select Team Member</option>
                                <!-- Users will be populated here -->
                            </select>
                        </div>
                    </div>

                    <!-- Multiple Assignees Option -->
                    <div class="form-group">
                        <label for="userTaskMultipleAssignees">Additional Assignees (Optional)</label>
                        <select id="userTaskMultipleAssignees" class="form-control" multiple>
                            <!-- Users will be populated here -->
                        </select>
                        <small class="help-text">Hold Ctrl/Cmd to select multiple users</small>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="userTaskPriority">Priority</label>
                            <select id="userTaskPriority" class="form-control" required>
                                <option value="">Select Priority</option>
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="critical">Critical</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="userTaskDueDate">Due Date</label>
                            <input type="date" id="userTaskDueDate" class="form-control" required>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="userTaskDocument">Upload Document (Optional)</label>
                        <input type="file" id="userTaskDocument" class="form-control" 
                               accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.xlsx,.xls">
                        <small class="help-text">Max size: 10MB</small>
                    </div>

                    <div class="form-group">
                        <label for="userTaskDescription">Description</label>
                        <textarea id="userTaskDescription" class="form-control" rows="3" 
                                  placeholder="Task description and requirements"></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label for="userTaskNotes">Additional Notes</label>
                        <textarea id="userTaskNotes" class="form-control" rows="2" 
                                  placeholder="Any additional notes or instructions"></textarea>
                    </div>
                    
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-save"></i> <span id="userTaskSubmitText">Assign Task</span>
                    </button>
                </form>
            </div>
        `;
    }
}


function showSuccessMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message success';
    messageDiv.style.display = 'flex';
    messageDiv.style.position = 'fixed';
    messageDiv.style.top = '20px';
    messageDiv.style.right = '20px';
    messageDiv.style.zIndex = '1001';
    messageDiv.innerHTML = `
                <i class="fas fa-check-circle"></i>
                <span>${message}</span>
            `;

    document.body.appendChild(messageDiv);

    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

function showErrorMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message error';
    messageDiv.style.display = 'flex';
    messageDiv.style.position = 'fixed';
    messageDiv.style.top = '20px';
    messageDiv.style.right = '20px';
    messageDiv.style.zIndex = '1001';
    messageDiv.innerHTML = `
                <i class="fas fa-exclamation-circle"></i>
                <span>${message}</span>
            `;

    document.body.appendChild(messageDiv);

    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}
async function markTaskComplete(taskId) {
    if (confirm('Are you sure you want to mark this task as completed?')) {
        try {
            const response = await apiCall(`/tasks/${taskId}/complete`, {
                method: 'PATCH',
                body: JSON.stringify({
                    progress: 100,
                    completedBy: currentUser ? currentUser.name : currentAdmin.name
                })
            });

            showSuccessMessage('🎉 Task marked as completed!');

            // Reload data
            if (userType === 'admin') {
                await loadTasks();
                await loadPendingTasks();
                await loadStats();
            } else {
                await loadUserTasks();
                await loadUserStats();
            }
        } catch (error) {
            console.error('Error completing task:', error);
            showErrorMessage(error.message);
        }
    }
}


async function generateReport() {
    try {
        showLoadingMessage('Generating comprehensive tasks report...');

        const response = await apiCall('/admin/tasks-report');

        hideLoadingMessage();

        if (response.success) {
            downloadExcelFromData(response.data, response.filename);
            showSuccessMessage('Tasks report downloaded successfully!');
        } else {
            showErrorMessage('Failed to generate report');
        }
    } catch (error) {
        hideLoadingMessage();
        console.error('Error generating report:', error);
        showErrorMessage('Error generating report');
    }
}




// Load job count
async function loadJobCount() {
    try {
        const response = await apiCall('/admin/job-entries/count');
        document.getElementById('totalJobCount').textContent = response.count || 0;
    } catch (error) {
        console.error('Error loading job count:', error);
        document.getElementById('totalJobCount').textContent = '0';
    }
}


function renderCancelledJobs(cancelledJobs) {
    const tbody = document.querySelector('#cancelledJobsTable tbody');

    if (!tbody) return;

    if (cancelledJobs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #666; padding: 40px;">No cancelled jobs found</td></tr>';
        return;
    }

    tbody.innerHTML = cancelledJobs.map(job => `
                <tr class="job-cancelled-row">
                    <td>${job.month}</td>
                    <td>${job.team}</td>
                    <td><strong style="color: #dc3545;">${job.soNumber}</strong></td>
                    <td>${job.customer}</td>
                    <td>${job.itemCode}</td>
                    <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" 
                        title="${job.particularsAndModels}">${job.particularsAndModels}</td>
                    <td>${job.qty}</td>
                    <td>
                        <div style="color: #721c24;">
                            ${job.cancelDate ? new Date(job.cancelDate).toLocaleDateString() : 'N/A'}
                        </div>
                    </td>
                    <td>
                        <div style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #721c24;" 
                            title="${job.cancelReason || 'No reason provided'}">
                            ${job.cancelReason || 'No reason provided'}
                        </div>
                    </td>
                    <td>
                        <div style="display: flex; gap: 5px;">
                            <button class="action-btn" style="background: #e8f5e8; color: #2e7d32;" 
                                    onclick="viewJobDetails('${job._id}')" title="View Details">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="action-btn" style="background: #e3f2fd; color: #1976d2;" 
                                    onclick="viewStageHistory('${job._id}')" title="View History">
                                <i class="fas fa-history"></i>
                            </button>
                            <button class="action-btn btn-delete" onclick="deleteJobEntry('${job._id}')" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
}

// 8. FUNCTION TO TOGGLE CANCELLED JOBS VISIBILITY
function toggleCancelledJobs() {
    const container = document.getElementById('cancelledJobsContainer');
    const toggleIcon = document.getElementById('toggleCancelledIcon');
    const toggleText = document.getElementById('toggleCancelledText');

    const isVisible = container.style.display === 'block';

    if (isVisible) {
        container.style.display = 'none';
        toggleIcon.className = 'fas fa-eye';
        toggleText.textContent = 'Show Cancelled';
    } else {
        container.style.display = 'block';
        toggleIcon.className = 'fas fa-eye-slash';
        toggleText.textContent = 'Hide Cancelled';
    }
}



function renderJobEntries(entries) {
    const tbody = document.querySelector('#jobEntriesTable tbody');

    if (!tbody) {
        console.error('Job entries table body not found');
        return;
    }

    if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; color: #666; padding: 40px;">No active job entries found</td></tr>';
        return;
    }

    tbody.innerHTML = entries.map(entry => {
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
            'dispatched': 'Logistics',
            'hold': 'Sales'
        };

        const currentDept = departmentMap[entry.status] || 'Unknown';
        const isHoldJob = entry.status === 'hold';

        return `
                    <tr class="${isHoldJob ? 'job-hold-row' : ''}">
                        <td>
                            <input type="text" value="${entry.month}" 
                                onchange="updateJobField('${entry._id}', 'month', this.value)"
                                style="border: none; background: transparent; width: 80px;" />
                        </td>
                        <td><strong style="color: ${isHoldJob ? '#856404' : 'inherit'};">${entry.soNumber}</strong></td>
                        <td>${entry.customer}</td>
                        <td>${entry.itemCode}</td>
                        <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" 
                            title="${entry.particularsAndModels}">${entry.particularsAndModels}</td>
                        <td>${entry.qty}</td>
                        <td>
                            <input type="number" value="${entry.week}" 
                                onchange="updateJobField('${entry._id}', 'week', this.value)"
                                style="border: none; background: transparent; width: 60px;" min="1" max="52" />
                        </td>
                        <td>
                            <div style="text-align: center;">
                                <span class="status-badge ${getJobStatusClass(entry.status)}" title="${formatJobStatus(entry.status)}">
                                    ${formatJobStatus(entry.status)}
                                </span>
                                <div style="font-size: 11px; color: #666; margin-top: 2px;">
                                    📍 ${currentDept} Dept
                                </div>
                                ${entry.status === 'hold' && entry.holdReason ? `
                                    <div style="font-size: 10px; color: #ff6b35; margin-top: 2px;" title="Hold Reason: ${entry.holdReason}">
                                        ⏸️ ${entry.holdReason.length > 15 ? entry.holdReason.substring(0, 15) + '...' : entry.holdReason}
                                    </div>
                                ` : ''}
                                ${entry.status === 'hold' && entry.holdDate ? `
                                    <div style="font-size: 10px; color: #856404; margin-top: 2px;">
                                        Since: ${new Date(entry.holdDate).toLocaleDateString()}
                                    </div>
                                ` : ''}
                            </div>
                        </td>
                        <td>
                            ${entry.assignedUsername && entry.status !== 'hold' ? `
                                <span style="background: #e8f5e8; color: #2e7d32; padding: 4px 8px; border-radius: 12px; font-size: 12px;">
                                    👤 ${entry.assignedUsername}
                                </span>
                            ` : entry.status === 'hold' ? `
                                <span style="background: #fff3cd; color: #856404; padding: 4px 8px; border-radius: 12px; font-size: 12px;">
                                    ⏸️ On Hold
                                </span>
                            ` : `
                                <span style="color: #666; font-style: italic;">Awaiting assignment</span>
                            `}
                        </td>
                        <td>
                            <button class="btn" style="background: #e3f2fd; color: #1976d2; padding: 4px 8px; font-size: 12px;" 
                                    onclick="viewStageHistory('${entry._id}')" title="View Stage History">
                                <i class="fas fa-history"></i> History
                            </button>
                        </td>
                        <td>
                            <div style="display: flex; gap: 5px;">
                                <button class="action-btn" style="background: #e8f5e8; color: #2e7d32;" 
                                        onclick="viewJobDetails('${entry._id}')" title="View Details">
                                    <i class="fas fa-eye"></i>
                                </button>
                              
                                <button class="action-btn btn-delete" onclick="deleteJobEntry('${entry._id}')" title="Delete">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
    }).join('');
}

async function updateJobField(jobId, fieldName, newValue) {
    try {
        const updateData = {};
        updateData[fieldName] = fieldName === 'week' ? parseInt(newValue) : newValue;

        const response = await apiCall(`/admin/job-entries/${jobId}/update-field`, {
            method: 'PATCH',
            body: JSON.stringify(updateData)
        });

        if (response.success) {
            showSuccessMessage(`${fieldName} updated successfully!`);
        } else {
            showErrorMessage('Failed to update job field');
        }
    } catch (error) {
        console.error('Error updating job field:', error);
        showErrorMessage(error.message);
    }
}


// Render admin user assigned tasks
function renderAdminUserAssignedTasks(tasks) {
    const tbody = document.querySelector('#adminUserAssignedTasksTable tbody');

    if (tasks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #666; padding: 40px;">No user assigned tasks found</td></tr>';
        return;
    }

    tbody.innerHTML = tasks.map(task => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dueDate = new Date(task.dueDate);
        const taskDueDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

        let status = task.status;
        let rowClass = 'task-row';

        if ((status === 'pending' || status === 'in_progress') && taskDueDate < today) {
            status = 'overdue';
            rowClass += ' overdue-task';
        }

        return `
                    <tr class="${rowClass}">
                        <td>
                            <div class="task-title">${task.title}</div>
                            <div class="task-description task-meta" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">
                                ${task.description ? task.description.substring(0, 50) + '...' : 'No description'}
                            </div>
                        </td>
                        <td>${task.assignedByName || 'Unknown'}</td>
                        <td>${task.assignedToName || 'Unassigned'}</td>
                        <td>
                            <span class="priority-badge priority-${task.priority}">
                                ${task.priority}
                            </span>
                        </td>
                        <td>
                            <div class="${taskDueDate < today && (task.status === 'pending' || task.status === 'in_progress') ? 'text-danger' : ''}" 
                                style="color: ${taskDueDate < today && (task.status === 'pending' || task.status === 'in_progress') ? '#dc3545' : 'inherit'};">
                                ${dueDate.toLocaleDateString()}
                                ${taskDueDate < today && (task.status === 'pending' || task.status === 'in_progress') ? ' ⚠️' : ''}
                                ${taskDueDate.getTime() === today.getTime() ? ' 📅 DUE TODAY' : ''}
                            </div>
                        </td>
                        <td>
                            <span class="status-badge status-${status}" style="text-transform: capitalize;">
                                ${status.replace('_', ' ')}
                            </span>
                        </td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="background: #e0e0e0; border-radius: 10px; height: 8px; overflow: hidden; flex: 1;">
                                    <div style="background: ${getProgressColor(task.progress)}; height: 100%; width: ${task.progress || 0}%; transition: width 0.3s ease;"></div>
                                </div>
                                <small>${task.progress || 0}%</small>
                            </div>
                        </td>
                        <td>
                            <div class="task-actions">
                                <button class="action-btn btn-edit" onclick="viewTaskDescription('${task._id}')" title="View Details">
                                    <i class="fas fa-eye"></i>
                                </button>
                                ${task.status !== 'completed' ? `
                                    <button class="action-btn btn-complete" onclick="markUserTaskCompleteByAdmin('${task._id}')" title="Mark Complete">
                                        <i class="fas fa-check-circle"></i>
                                    </button>
                                ` : ''}
                                <button class="action-btn btn-delete" onclick="deleteUserTaskByAdmin('${task._id}')" title="Delete">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
    }).join('');
}

// View task description modal
async function viewTaskDescription(taskId) {
    try {
        const task = await apiCall(`/admin/user-tasks/${taskId}`);

        const modalTitle = document.getElementById('taskDescriptionModalTitle');
        const modalContent = document.getElementById('taskDescriptionContent');

        modalTitle.textContent = `Task: ${task.title}`;

        modalContent.innerHTML = `
                    <div style="margin-bottom: 15px;">
                        <strong>Title:</strong> ${task.title}
                    </div>
                    <div style="margin-bottom: 15px;">
                        <strong>Description:</strong>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 5px;">
                            ${task.description || 'No description provided'}
                        </div>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <strong>Assigned By:</strong> ${task.assignedByName || 'Unknown'}
                    </div>
                    <div style="margin-bottom: 15px;">
                        <strong>Assigned To:</strong> ${task.assignedToName || 'Unassigned'}
                    </div>
                    <div style="margin-bottom: 15px;">
                        <strong>Priority:</strong> 
                        <span class="priority-badge priority-${task.priority}">${task.priority.toUpperCase()}</span>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <strong>Due Date:</strong> ${new Date(task.dueDate).toLocaleDateString()}
                    </div>
                    <div style="margin-bottom: 15px;">
                        <strong>Status:</strong> 
                        <span class="status-badge status-${task.status}">${task.status.replace('_', ' ')}</span>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <strong>Progress:</strong> ${task.progress || 0}%
                    </div>
                    ${task.notes ? `
                        <div style="margin-bottom: 15px;">
                            <strong>Notes:</strong>
                            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-top: 5px;">
                                ${task.notes}
                            </div>
                        </div>
                    ` : ''}
                    <div style="margin-bottom: 15px;">
                        <strong>Created:</strong> ${new Date(task.createdAt).toLocaleString()}
                    </div>
                    ${task.completedAt ? `
                        <div style="margin-bottom: 15px;">
                            <strong>Completed:</strong> ${new Date(task.completedAt).toLocaleString()}
                            <span style="margin-left: 10px; color: ${task.isOnTime ? '#28a745' : '#dc3545'};">
                                (${task.isOnTime ? 'On Time' : 'Late'})
                            </span>
                        </div>
                    ` : ''}
                `;

        document.getElementById('taskDescriptionModal').classList.add('active');
    } catch (error) {
        console.error('Error loading task description:', error);
        showErrorMessage('Error loading task details');
    }
}

function closeTaskDescriptionModal() {
    const modal = document.getElementById('taskDescriptionModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
}

function closeTaskDelayModal() {
    document.getElementById('taskDelayModal').classList.remove('active');
    document.getElementById('taskDelayForm').reset();
}


// Populate user filters
function populateUserFilters(tasks) {
    const assigners = [...new Set(tasks.map(task => task.assignedByName).filter(name => name))];
    const assignees = [...new Set(tasks.map(task => task.assignedToName).filter(name => name))];

    const assignerFilter = document.getElementById('assignerFilter');
    const assigneeFilter = document.getElementById('assigneeFilter');

    if (assignerFilter) {
        assignerFilter.innerHTML = '<option value="">All Assigners</option>' +
            assigners.map(name => `<option value="${name}">${name}</option>`).join('');
    }

    if (assigneeFilter) {
        assigneeFilter.innerHTML = '<option value="">All Assignees</option>' +
            assignees.map(name => `<option value="${name}">${name}</option>`).join('');
    }
}

// Update admin user assigned task stats
function updateAdminUserAssignedTaskStats(tasks) {
    const total = tasks.length;
    const completed = tasks.filter(task => task.status === 'completed').length;
    const pending = tasks.filter(task => task.status === 'pending' || task.status === 'in_progress').length;
    const overdue = tasks.filter(task => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dueDate = new Date(task.dueDate);
        const taskDueDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        return (task.status === 'pending' || task.status === 'in_progress') && taskDueDate < today;
    }).length;

    console.log('Admin User Task Stats:', { total, completed, pending, overdue });
}

// Mark user task complete by admin
async function markUserTaskCompleteByAdmin(taskId) {
    if (confirm('Are you sure you want to mark this user task as completed?')) {
        try {
            await apiCall(`/admin/user-tasks/${taskId}/complete`, {
                method: 'PATCH',
                body: JSON.stringify({
                    completedBy: 'Admin'
                })
            });

            showSuccessMessage('User task marked as completed!');
            await loadAdminUserAssignedTasks();
        } catch (error) {
            console.error('Error completing user task:', error);
            showErrorMessage(error.message);
        }
    }
}

// Delete user task by admin
async function deleteUserTaskByAdmin(taskId) {
    if (confirm('Are you sure you want to delete this user task?')) {
        try {
            await apiCall(`/admin/user-tasks/${taskId}`, { method: 'DELETE' });
            showSuccessMessage('User task deleted successfully!');
            await loadAdminUserAssignedTasks();
        } catch (error) {
            console.error('Error deleting user task:', error);
            showErrorMessage(error.message);
        }
    }
}

// Clear user assigned task filters





function updateJobStatusFilter() {
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.innerHTML = `
                    <option value="">All Status</option>
                    <option value="sales_order_received">Sales Order Received</option>
                    <option value="drawing_approved">Drawing Approved</option>
                    <option value="long_lead_item_details_given">Long Lead Item Details Given</option>
                    <option value="drawing_bom_issued">Drawing/BOM Issued</option>
                    <option value="production_order_purchase_request_prepared">Production Order & Purchase Request Prepared</option>
                    <option value="rm_received">RM Received</option>
                    <option value="production_started">Production Started</option>
                    <option value="production_completed">Production Completed</option>
                    <option value="qc_clear_for_dispatch">QC Clear for Dispatch</option>
                    <option value="dispatch_clearance">Dispatch Clearance</option>
                    <option value="dispatched">Dispatched</option>
                    <option value="hold">On Hold</option>
                    <option value="so_cancelled">SO Cancelled</option>
                `;
    }
}


function getJobStatusClass(status) {
    const statusClasses = {
        'sales_order_received': 'status-pending',
        'drawing_approved': 'status-active',
        'long_lead_item_details_given': 'status-active',
        'drawing_bom_issued': 'status-active',
        'production_order_purchase_request_prepared': 'status-active',
        'rm_received': 'status-active',
        'production_started': 'status-active',
        'production_completed': 'status-completed',
        'qc_clear_for_dispatch': 'status-completed',
        'dispatch_clearance': 'status-completed',
        'dispatched': 'status-completed',
        'hold': 'status-hold',           // NEW
        'so_cancelled': 'status-cancelled'  // NEW
    };
    return statusClasses[status] || 'status-pending';
}

function downloadExcelFromData(data, filename) {
    // Convert JSON data to CSV format for Excel compatibility
    if (data.length === 0) {
        showErrorMessage('No data available to download');
        return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row =>
            headers.map(header => {
                const value = row[header] || '';
                // Escape commas and quotes in CSV
                if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',')
        )
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename.replace('.xlsx', '.csv'));
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}


// Format job status for display
function formatJobStatus(status) {
    const statusMap = {
        'sales_order_received': 'Sales Order Received',
        'drawing_approved': 'Drawing Approved',
        'long_lead_item_details_given': 'Long Lead Item Details Given',
        'drawing_bom_issued': 'Drawing/BOM Issued',
        'production_order_purchase_request_prepared': 'Production Order & Purchase Request Prepared',
        'rm_received': 'RM Received',
        'production_started': 'Production Started',
        'production_completed': 'Production Completed',
        'qc_clear_for_dispatch': 'QC Clear for Dispatch',
        'dispatch_clearance': 'Dispatch Clearance',
        'dispatched': 'Dispatched',
        'hold': 'On Hold',              // NEW
        'so_cancelled': 'SO Cancelled'
    };
    return statusMap[status] || status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Load job statistics
async function loadJobStats() {
    try {
        const stats = await apiCall('/admin/job-stats');

        document.getElementById('totalJobs').textContent = stats.totalJobs || 0;
        document.getElementById('pendingJobs').textContent = stats.statusBreakdown?.so_received || 0;
        document.getElementById('productionJobs').textContent =
            (stats.statusBreakdown?.taken_on_production || 0) + (stats.statusBreakdown?.production_completed || 0);
        document.getElementById('dispatchedJobs').textContent = stats.statusBreakdown?.dispatched || 0;
    } catch (error) {
        console.error('Error loading job stats:', error);
    }
}

// Load stage assignments
async function loadStageAssignments() {
    try {
        stageAssignments = await apiCall('/admin/stage-assignments');
        renderCurrentAssignments();
    } catch (error) {
        console.error('Error loading stage assignments:', error);
    }
}

async function loadUsersForJobTracking() {
    try {
        const users = await apiCall('/admin/users');
        const activeUsers = users.filter(user => user.status === 'active');

        // Populate assignment username dropdown - check if element exists
        const assignmentDropdown = document.getElementById('assignmentUsername');
        if (assignmentDropdown) {
            assignmentDropdown.innerHTML = '<option value="">Select User</option>' +
                activeUsers.map(user => `<option value="${user.username}">${user.name} (${user.username})</option>`).join('');
        }

        // Note: We removed jobAssignedUsername dropdown since it's no longer needed for auto-assignment
        // But we'll keep this for backwards compatibility if the element exists
        const jobUsernameDropdown = document.getElementById('jobAssignedUsername');
        if (jobUsernameDropdown) {
            jobUsernameDropdown.innerHTML = '<option value="">Select User</option>' +
                activeUsers.map(user => `<option value="${user.username}">${user.name} (${user.username})</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading users for job tracking:', error);
    }
}

function openExcelUploadModal() {
    document.getElementById('excelUploadModal').classList.add('active');
}

function closeExcelUploadModal() {
    document.getElementById('excelUploadModal').classList.remove('active');
    document.getElementById('excelFile').value = '';
}

async function uploadExcelFile() {
    const fileInput = document.getElementById('excelFile');
    if (!fileInput.files[0]) {
        showErrorMessage('Please select an Excel file');
        return;
    }

    const formData = new FormData();
    formData.append('excel', fileInput.files[0]);

    try {
        const response = await fetch(`${API_BASE_URL}/admin/job-entries/upload-excel`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok && result.success) {
            showSuccessMessage(`${result.entries.length} job entries uploaded successfully!`);
            closeExcelUploadModal();
            await loadJobTracking();
        } else {
            throw new Error(result.message || 'Upload failed');
        }
    } catch (error) {
        console.error('Excel upload error:', error);
        showErrorMessage(error.message);
    }
}

// Stage assignment functions
function openStageAssignmentModal() {
    loadUsersForJobTracking().then(() => {
        document.getElementById('stageAssignmentModal').classList.add('active');
        renderCurrentAssignments();
    });
}

function closeStageAssignmentModal() {
    document.getElementById('stageAssignmentModal').classList.remove('active');
    // Clear form
    document.getElementById('assignmentStage').value = '';
    document.getElementById('assignmentUsername').value = '';
    document.getElementById('assignmentTaskTitle').value = '';
    document.getElementById('assignmentTaskDescription').value = '';
}

async function saveStageAssignment() {
    const assignmentData = {
        stage: document.getElementById('assignmentStage').value,
        assignedUsername: document.getElementById('assignmentUsername').value,
        taskTitle: document.getElementById('assignmentTaskTitle').value,
        taskDescription: document.getElementById('assignmentTaskDescription').value
    };

    if (!assignmentData.stage || !assignmentData.assignedUsername || !assignmentData.taskTitle) {
        showErrorMessage('Please fill in all required fields');
        return;
    }

    try {
        const response = await apiCall('/admin/stage-assignments', {
            method: 'POST',
            body: JSON.stringify(assignmentData)
        });

        showSuccessMessage('Stage assignment saved successfully!');
        await loadStageAssignments();

        // Clear form
        document.getElementById('assignmentStage').value = '';
        document.getElementById('assignmentUsername').value = '';
        document.getElementById('assignmentTaskTitle').value = '';
        document.getElementById('assignmentTaskDescription').value = '';
    } catch (error) {
        console.error('Error saving stage assignment:', error);
        showErrorMessage(error.message);
    }
}
function renderCurrentAssignments() {
    const container = document.getElementById('currentAssignments');

    if (stageAssignments.length === 0) {
        container.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No stage assignments configured</p>';
        return;
    }

    container.innerHTML = stageAssignments.map(assignment => `
                <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin: 10px 0; background: #f8f9fa;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>${formatJobStatus(assignment.stage)}</strong> → 
                            <span style="color: #667eea;">${assignment.assignedUsername}</span>
                            <div style="color: #666; font-size: 0.9rem; margin-top: 5px;">
                                Task: ${assignment.taskTitle}
                            </div>
                        </div>
                        <button class="action-btn btn-delete" onclick="deleteStageAssignment('${assignment._id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');
}

async function deleteStageAssignment(assignmentId) {
    if (confirm('Are you sure you want to delete this stage assignment?')) {
        try {
            await apiCall(`/admin/stage-assignments/${assignmentId}`, { method: 'DELETE' });
            showSuccessMessage('Stage assignment deleted successfully!');
            await loadStageAssignments();
        } catch (error) {
            console.error('Error deleting stage assignment:', error);
            showErrorMessage(error.message);
        }
    }
}

function filterTasks() {
    const filter = document.getElementById('taskFilter').value;
    currentFilters.taskFilter = filter;
    renderActiveTasks(allTasks, filter);
    updateFilterInfo('taskFilter', filter);
}

function filterCompletedTasks() {
    const filter = document.getElementById('completedTaskFilter').value;
    currentFilters.completedTaskFilter = filter;
    renderCompletedTasks(completedTasks, filter);
}

function filterUserTasks() {
    const statusFilter = document.getElementById('userTaskStatusFilter');
    const sortFilter = document.getElementById('userTaskSortFilter');

    // Check if elements exist before accessing their values
    if (!statusFilter || !sortFilter) {
        console.error('Filter elements not found:', {
            statusFilter: !!statusFilter,
            sortFilter: !!sortFilter
        });
        return;
    }

    const statusValue = statusFilter.value;
    const sortValue = sortFilter.value;

    currentFilters.userTaskStatusFilter = statusValue;
    currentFilters.userTaskSortFilter = sortValue;

    filteredUserTasks = applyUserTaskStatusFilter(allUserTasks, statusValue);
    filteredUserTasks = applyUserTaskSorting(filteredUserTasks, sortValue);
    renderUserTasks(filteredUserTasks);
    updateUserTaskFilterInfo(statusValue, filteredUserTasks.length, allUserTasks.length);
}

// Restore filters after any operation
function restoreFilters() {
    if (document.getElementById('taskFilter')) {
        document.getElementById('taskFilter').value = currentFilters.taskFilter;
    }
    if (document.getElementById('completedTaskFilter')) {
        document.getElementById('completedTaskFilter').value = currentFilters.completedTaskFilter;
    }
    if (document.getElementById('userTaskStatusFilter')) {
        document.getElementById('userTaskStatusFilter').value = currentFilters.userTaskStatusFilter;
    }
    if (document.getElementById('userTaskSortFilter')) {
        document.getElementById('userTaskSortFilter').value = currentFilters.userTaskSortFilter;
    }
}

async function loadCompletionRequests() {
    try {
        console.log('Loading completion requests...');

        let admin = await Admin.findOne();
        if (!admin) {
            console.log('No admin found, creating default admin...');
            admin = await Admin.create({
                username: 'admin',
                password: 'admin123',
                email: 'planning@ashtavinayaka.com',
                name: 'System Admin'
            });
        }

        const requests = await apiCall('/admin/completion-requests');
        console.log('Completion requests loaded:', requests.length);

        const tbody = document.querySelector('#completionRequestsTable tbody');
        if (!tbody) {
            console.error('Completion requests table not found in DOM');
            return;
        }

        if (requests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666; padding: 40px;">No pending completion requests</td></tr>';
            return;
        }

        tbody.innerHTML = requests.map(task => `
            <tr>
                <td>
                    <strong>${task.title}</strong><br>
                    <small style="color: #666;">${task.description ? task.description.substring(0, 100) + '...' : ''}</small>
                </td>
                <td>${task.assignedToName || 'Unknown'}</td>
                <td>${task.completionRequestDate ? new Date(task.completionRequestDate).toLocaleDateString() : 'N/A'}</td>
                <td>${new Date(task.dueDate).toLocaleDateString()}</td>
                <td>
                    <span class="priority-badge priority-${task.priority}">
                        ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                    </span>
                </td>
                <td>
                    <button class="action-btn btn-complete" onclick="approveTaskCompletion('${task._id}')" title="Approve">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="action-btn btn-delete" onclick="rejectTaskCompletion('${task._id}')" title="Reject">
                        <i class="fas fa-times"></i> Reject
                    </button>
                </td>
            </tr>
        `).join('');

        restoreFilters(); // Restore filters after loading
    } catch (error) {
        console.error('Error loading completion requests:', error);
        const tbody = document.querySelector('#completionRequestsTable tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666; padding: 40px;">Error loading completion requests</td></tr>';
        }
    }
}

// Enhanced job tracking load with better error handling
async function loadJobTracking() {
    try {
        console.log('Loading job tracking data...');

        // Check if user is logged in and has proper permissions
        if (!currentAdmin && !currentUser) {
            console.error('No authenticated user found');
            return;
        }

        updateJobTrackingHTML();

        await Promise.all([
            loadJobEntries(),
            loadJobStats(),
            loadDepartmentStats(),
            loadStageAssignments(),
            loadUsersForJobTracking(),
            loadJobCount()
        ]);

        setTimeout(() => {
            setupJobFiltersEventListeners();
            restoreJobFilters();
        }, 500);

        console.log('Job tracking data loaded successfully');
    } catch (error) {
        console.error('Error loading job tracking data:', error);
        showErrorMessage('Error loading job tracking data: ' + error.message);
    }
}

// Fix job filters persistence
function restoreJobFilters() {
    if (document.getElementById('monthFilter')) {
        document.getElementById('monthFilter').value = currentFilters.jobFilters.month;
    }
    if (document.getElementById('teamFilter')) {
        document.getElementById('teamFilter').value = currentFilters.jobFilters.team;
    }
    if (document.getElementById('statusFilter')) {
        document.getElementById('statusFilter').value = currentFilters.jobFilters.status;
    }
    if (document.getElementById('customerFilter')) {
        document.getElementById('customerFilter').value = currentFilters.jobFilters.customer;
    }
}

// Enhanced job entries loading with better error handling
async function loadJobEntries() {
    try {
        if (!currentAdmin) {
            console.error('Admin not authenticated for job entries');
            return;
        }

        const month = document.getElementById('monthFilter')?.value || '';
        const team = document.getElementById('teamFilter')?.value || '';
        const status = document.getElementById('statusFilter')?.value || '';
        const customer = document.getElementById('customerFilter')?.value || '';

        // Store current filters
        currentFilters.jobFilters = { month, team, status, customer };

        const params = new URLSearchParams();
        if (month.trim()) params.append('month', month.trim());
        if (team.trim()) params.append('team', team.trim());
        if (status.trim()) params.append('status', status.trim());
        if (customer.trim()) params.append('customer', customer.trim());

        const queryString = params.toString();
        const url = `/admin/job-entries${queryString ? '?' + queryString : ''}`;
        console.log('Loading job entries from:', url);

        const response = await apiCall(url);
        console.log('Job entries response:', response.length, 'entries');

        allJobEntries = response;

        const activeJobs = response.filter(job => job.status !== 'so_cancelled');
        const cancelledJobs = response.filter(job => job.status === 'so_cancelled');

        renderJobEntries(activeJobs);

        const cancelledCountElement = document.getElementById('totalCancelledCount');
        if (cancelledCountElement) {
            cancelledCountElement.textContent = cancelledJobs.length;
        }
        renderCancelledJobs(cancelledJobs);

        const cancelledCard = document.getElementById('cancelledJobsCard');
        if (cancelledCard) {
            cancelledCard.style.display = cancelledJobs.length > 0 ? 'block' : 'none';
        }

        updateFilterInfo(month, team, status, customer, activeJobs.length, response.length);

    } catch (error) {
        console.error('Error loading job entries:', error);
        const tbody = document.querySelector('#jobEntriesTable tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: #666; padding: 40px;">Error loading job entries: ' + error.message + '</td></tr>';
        }
    }
}

// Enhanced dispatched jobs loading
async function loadDispatchedJobs() {
    try {
        console.log('Loading dispatched jobs...');

        if (!currentAdmin) {
            console.error('Admin not authenticated for dispatched jobs');
            return;
        }

        const response = await apiCall('/admin/dispatched-jobs');
        console.log('Dispatched jobs response:', response.length, 'jobs');

        dispatchedJobsData = response;
        renderDispatchedJobs(response);
        updateDispatchedJobsStats(response);

        restoreFilters();
    } catch (error) {
        console.error('Error loading dispatched jobs:', error);
        const tbody = document.querySelector('#dispatchedJobsTable tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #666; padding: 40px;">Error loading dispatched jobs: ' + error.message + '</td></tr>';
        }
    }
}

// Enhanced user assigned tasks loading
async function loadAdminUserAssignedTasks() {
    try {
        console.log('Loading admin user assigned tasks...');

        if (!currentAdmin) {
            console.error('Admin not authenticated for user assigned tasks');
            return;
        }

        const status = document.getElementById('userAssignedTaskFilter')?.value || '';
        const assignedBy = document.getElementById('assignerFilter')?.value || '';
        const assignedTo = document.getElementById('assigneeFilter')?.value || '';

        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (assignedBy) params.append('assignedBy', assignedBy);
        if (assignedTo) params.append('assignedTo', assignedTo);

        const url = `/admin/user-assigned-tasks?${params.toString()}`;
        console.log('Loading user assigned tasks from:', url);

        const tasks = await apiCall(url);
        console.log('User assigned tasks response:', tasks.length, 'tasks');

        renderAdminUserAssignedTasks(tasks);
        updateAdminUserAssignedTaskStats(tasks);

        if (!status && !assignedBy && !assignedTo) {
            populateUserFilters(tasks);
        }

        restoreFilters();
    } catch (error) {
        console.error('Error loading admin user assigned tasks:', error);
        const tbody = document.querySelector('#adminUserAssignedTasksTable tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #666; padding: 40px;">Error loading user assigned tasks: ' + error.message + '</td></tr>';
        }
    }
}

// Fix section loading with proper authentication checks
async function loadSectionData(section) {
    console.log('Loading section data for:', section);

    if (!currentAdmin && !currentUser) {
        console.error('No authenticated user for section:', section);
        showErrorMessage('Please login to access this section');
        return;
    }

    try {
        switch (section) {
            case 'overview':
                await loadStats();
                await loadRecentActivity();
                break;
            case 'users':
                await loadUsers();
                break;
            case 'tasks':
                await loadTasks();
                break;
            case 'completion-requests':
                await loadCompletionRequests();
                break;
            case 'analytics':
                await loadAnalytics();
                break;
            case 'job-tracking':
                await loadJobTracking();
                break;
            case 'dispatched-jobs':
                await loadDispatchedJobs();
                break;
            case 'user-assigned-tasks':
                await loadAdminUserAssignedTasks();
                break;
            default:
                console.warn('Unknown section:', section);
        }
    } catch (error) {
        console.error('Error loading section data:', error);
        showErrorMessage('Error loading section: ' + error.message);
    }
}

function showLoginForm() {
    console.log('Showing login form...');
    // Hide all dashboard sections
    const adminDashboard = document.getElementById('adminDashboard');
    const userDashboard = document.getElementById('userDashboard');
    const loginForm = document.getElementById('loginForm');

    if (adminDashboard) adminDashboard.style.display = 'none';
    if (userDashboard) userDashboard.style.display = 'none';
    if (loginForm) loginForm.style.display = 'block';

    // Clear any stored auth data
    sessionStorage.removeItem('scrumflow_auth');
    authToken = null;
    currentAdmin = null;
    currentUser = null;
    userType = null;
}


function ensureAuthenticated() {
    if (userType === 'user' && (!currentUser || !currentUser.id)) {
        console.error('User not properly authenticated');
        logout();
        return false;
    }

    if (userType === 'admin' && (!currentAdmin || !currentAdmin.id)) {
        console.error('Admin not properly authenticated');
        logout();
        return false;
    }

    return true;
}
async function handleTokenRefresh() {
    try {
        // Clear the invalid token
        sessionStorage.removeItem('scrumflow_auth');
        authToken = null;
        currentUser = null;
        currentAdmin = null;
        userType = null;

        console.log('Invalid token detected, redirecting to login');
        showLoginForm();
        showErrorMessage('Your session has expired. Please login again.');
    } catch (error) {
        console.error('Error handling token refresh:', error);
        showLoginForm();
    }
}

async function apiCall(endpoint, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (authToken) {
        defaultOptions.headers['Authorization'] = `Bearer ${authToken}`;
    }

    console.log('API Call:', endpoint, options.method || 'GET');

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        });

        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
            }

            console.error('API Error:', response.status, errorData);

            // Handle authentication errors
            if (response.status === 401) {
                // Check if it's a JWT signature error
                if (errorData.message && errorData.message.includes('token')) {
                    await handleTokenRefresh();
                    return null;
                }

                console.log('Authentication failed, redirecting to login');
                logout();
                return null;
            }

            throw new Error(errorData.message || `API call failed with status ${response.status}`);
        }

        const data = await response.json();
        console.log('API Response for', endpoint, ':', data);
        return data;
    } catch (error) {
        console.error('API Call failed:', endpoint, error);
        throw error;
    }
}

// Job status update functions
function updateJobStatus(jobId) {
    const job = allJobEntries.find(j => j._id === jobId);
    if (!job) return;

    document.getElementById('currentJobId').value = jobId;
    document.getElementById('currentJobStatus').value = job.status;
    document.getElementById('jobStatus').value = job.status;
    document.getElementById('jobRemarks').value = '';
    document.getElementById('statusReason').value = '';

    // Show/hide hold restart section
    const holdRestartSection = document.getElementById('holdRestartSection');
    if (job.status === 'hold') {
        holdRestartSection.style.display = 'block';
        document.getElementById('jobStatusModalTitle').textContent = `Restart Job from Hold - ${job.soNumber}`;

        // Pre-fill hold reason if available
        if (job.holdReason) {
            const holdInfo = document.createElement('div');
            holdInfo.style.cssText = 'background: #f8d7da; padding: 10px; border-radius: 4px; margin-top: 10px; color: #721c24;';
            holdInfo.innerHTML = `<strong>Current Hold Reason:</strong> ${job.holdReason}`;
            holdRestartSection.appendChild(holdInfo);
        }
    } else {
        holdRestartSection.style.display = 'none';
        document.getElementById('jobStatusModalTitle').textContent = `Update Status - ${job.soNumber}`;
    }

    // Handle status options based on current status
    const statusSelect = document.getElementById('jobStatus');
    if (job.status === 'so_cancelled') {
        // For cancelled jobs, disable the modal or show read-only info
        showErrorMessage('Cannot update status of cancelled jobs. Job is permanently cancelled.');
        return;
    } else if (job.status === 'hold') {
        // For hold jobs, remove hold and cancel options from dropdown
        Array.from(statusSelect.options).forEach(option => {
            if (option.value === 'hold' || option.value === 'so_cancelled') {
                option.style.display = 'none';
            } else {
                option.style.display = 'block';
            }
        });
        // Set default to sales_order_received for restart
        statusSelect.value = 'sales_order_received';
    } else {
        // For normal jobs, show all options
        Array.from(statusSelect.options).forEach(option => {
            option.style.display = 'block';
        });
    }

    handleStatusChange();
    document.getElementById('jobStatusModal').classList.add('active');
}


function closeJobStatusModal() {
    document.getElementById('jobStatusModal').classList.remove('active');
}



async function deleteJobEntry(jobId) {
    if (confirm('Are you sure you want to delete this job entry?')) {
        try {
            await apiCall(`/admin/job-entries/${jobId}`, { method: 'DELETE' });
            showSuccessMessage('Job entry deleted successfully!');
            await loadJobTracking();
        } catch (error) {
            console.error('Error deleting job entry:', error);
            showErrorMessage(error.message);
        }
    }
}

function handleStatusChange() {
    const status = document.getElementById('jobStatus').value;
    const currentStatus = document.getElementById('currentJobStatus').value;
    const reasonGroup = document.getElementById('reasonGroup');
    const reasonField = document.getElementById('statusReason');
    const reasonLabel = document.getElementById('reasonLabel');
    const reasonHelpText = document.getElementById('reasonHelpText');
    const warningMessage = document.getElementById('warningMessage');
    const warningText = document.getElementById('warningText');
    const helpText = document.getElementById('statusHelpText');
    const submitButton = document.getElementById('submitButtonText');

    // Reset
    reasonGroup.style.display = 'none';
    warningMessage.style.display = 'none';
    reasonField.required = false;

    // Check if restarting from hold
    const isRestartingFromHold = currentStatus === 'hold' && status !== 'hold' && status !== 'so_cancelled';

    if (isRestartingFromHold) {
        reasonGroup.style.display = 'block';
        reasonLabel.textContent = 'Restart Reason';
        reasonField.placeholder = 'Please provide a reason for restarting this job...';
        reasonField.required = true;
        reasonHelpText.textContent = 'This reason will be included in the restart notification email to all users.';
        warningMessage.style.display = 'block';
        warningMessage.style.background = '#d1edff';
        warningText.innerHTML = '<strong style="color: #0c5460;">Restart Action:</strong> <span style="color: #0c5460;">Job will be restarted from the selected stage and new tasks will be assigned.</span>';
        helpText.innerHTML = '▶️ Job will restart from selected stage with automatic task assignment';
        submitButton.textContent = `Restart from ${formatJobStatus(status)}`;
    } else if (status === 'hold') {
        reasonGroup.style.display = 'block';
        reasonLabel.textContent = 'Hold Reason';
        reasonField.placeholder = 'Please provide a reason for putting this job on hold...';
        reasonField.required = true;
        reasonHelpText.textContent = 'This reason will be included in the notification email to all users and will be visible to the Sales department.';
        warningMessage.style.display = 'block';
        warningMessage.style.background = '#fff3cd';
        warningText.innerHTML = '<strong style="color: #856404;">Hold Action:</strong> <span style="color: #856404;">All related tasks will be cancelled. A HIGH PRIORITY hold resolution task will be assigned to the Sales department.</span>';
        helpText.innerHTML = '⏸️ Job will be put on hold - Sales department will receive urgent task to resolve the hold';
        submitButton.textContent = 'Put Job on Hold & Assign to Sales';
    } else if (status === 'so_cancelled') {
        reasonGroup.style.display = 'block';
        reasonLabel.textContent = 'Cancellation Reason';
        reasonField.placeholder = 'Please provide a reason for cancelling this sales order...';
        reasonField.required = true;
        reasonHelpText.textContent = 'This reason will be included in the notification email to all users.';
        warningMessage.style.display = 'block';
        warningMessage.style.background = '#f8d7da';
        warningText.innerHTML = '<strong style="color: #721c24;">Cancellation Action:</strong> <span style="color: #721c24;">All related tasks will be cancelled and job will be moved to cancelled section.</span>';
        helpText.innerHTML = '❌ Sales order will be cancelled - all work must stop';
        submitButton.textContent = 'Cancel Sales Order';
    } else {
        helpText.innerHTML = '🤖 Task will be automatically assigned based on stage assignments';
        submitButton.textContent = 'Update Status & Auto-Assign';
    }
}


function updateJobStatusModalHTML() {
    const jobStatusModal = document.getElementById('jobStatusModal');
    if (jobStatusModal) {
        jobStatusModal.innerHTML = `
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 id="jobStatusModalTitle">Update Job Status</h3>
                            <button class="close-btn" onclick="closeJobStatusModal()">&times;</button>
                        </div>
                        <form id="jobStatusForm">
                            <input type="hidden" id="currentJobId">
                            <input type="hidden" id="currentJobStatus">
                            <div style="padding: 20px;">
                                
                                <!-- Hold Restart Section -->
                                <div id="holdRestartSection" style="display: none; background: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                                    <h4 style="color: #856404; margin: 0 0 15px 0;">
                                        <i class="fas fa-play-circle"></i> Restart Job from Hold
                                    </h4>
                                    <p style="color: #856404; margin-bottom: 15px;">
                                        This job is currently on hold. Select the stage from which you want to restart the job:
                                    </p>
                                </div>
                                
                                <div class="form-group">
                                    <label for="jobStatus">Status</label>
                                    <select id="jobStatus" class="form-control" required onchange="handleStatusChange()">
                                        <option value="sales_order_received">Sales Order Received</option>
                                        <option value="drawing_approved">Drawing Approved</option>
                                        <option value="long_lead_item_details_given">Long Lead Item Details Given</option>
                                        <option value="drawing_bom_issued">Drawing/BOM Issued</option>
                                        <option value="production_order_purchase_request_prepared">Production Order & Purchase Request Prepared</option>
                                        <option value="rm_received">RM Received</option>
                                        <option value="production_started">Production Started</option>
                                        <option value="production_completed">Production Completed</option>
                                        <option value="qc_clear_for_dispatch">QC Clear for Dispatch</option>
                                        <option value="dispatch_clearance">Dispatch Clearance</option>
                                        <option value="dispatched">Dispatched</option>
                                        <option value="hold" style="color: #ff6b35;">⏸️ Put on Hold</option>
                                        <option value="so_cancelled" style="color: #dc3545;">❌ Cancel Sales Order</option>
                                    </select>
                                    <small id="statusHelpText" style="color: #666; margin-top: 5px; display: block;">
                                        🤖 Task will be automatically assigned based on stage assignments
                                    </small>
                                </div>
                                
                                <!-- Reason field for Hold/Cancel/Restart -->
                                <div class="form-group" id="reasonGroup" style="display: none;">
                                    <label for="statusReason" id="reasonLabel">Reason</label>
                                    <textarea id="statusReason" class="form-control" rows="3" 
                                            placeholder="Please provide a reason..." required></textarea>
                                            <small id="reasonHelpText" style="color: #666; margin-top: 5px; display: block;">
                                    This reason will be included in the notification email to all users.
                                </small>
                                </div>
                                
                                <div class="form-group">
                                    <label for="jobRemarks">Additional Remarks (Optional)</label>
                                    <textarea id="jobRemarks" class="form-control" rows="3" 
                                            placeholder="Add any additional remarks or comments..."></textarea>
                                </div>
                                
                                <!-- Warning for Hold/Cancel/Restart -->
                                <div id="warningMessage" style="display: none; padding: 15px; border-radius: 8px; margin: 15px 0;">
                                    <div style="font-weight: 500;">
                                        <i class="fas fa-exclamation-triangle"></i> 
                                        <span id="warningText">Warning text will appear here</span>
                                    </div>
                                </div>
                                
                                <button type="submit" class="btn btn-primary" id="submitButton">
                                    <i class="fas fa-save"></i> <span id="submitButtonText">Update Status & Auto-Assign</span>
                                </button>
                            </div>
                        </form>
                    </div>
                `;
    }
}

function updateFilterInfo(month, team, status, customer, activeCount, totalCount) {
    // Remove existing filter info
    const existingInfo = document.querySelector('.job-filter-info');
    if (existingInfo) {
        existingInfo.remove();
    }

    // Check if any filters are applied
    const hasFilters = month || team || status || customer;

    if (hasFilters) {
        const filterInfo = document.createElement('div');
        filterInfo.className = 'job-filter-info';
        filterInfo.style.cssText = `
                    background: #e3f2fd; 
                    padding: 12px 15px; 
                    border-radius: 8px; 
                    margin-bottom: 15px; 
                    color: #1976d2; 
                    font-weight: 500;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    animation: slideIn 0.3s ease;
                `;

        let filterText = 'Applied Filters: ';
        const appliedFilters = [];

        if (month) appliedFilters.push(`Month: "${month}"`);
        if (team) appliedFilters.push(`Team: "${team}"`);
        if (status) appliedFilters.push(`Status: "${formatJobStatus(status)}"`);
        if (customer) appliedFilters.push(`Customer: "${customer}"`);

        filterText += appliedFilters.join(', ');

        filterInfo.innerHTML = `
                    <span><i class="fas fa-filter"></i> ${filterText}</span>
                    <span style="font-size: 0.9rem; opacity: 0.8;">
                        Showing: ${activeCount} active jobs ${totalCount !== activeCount ? `(${totalCount - activeCount} cancelled)` : ''}
                    </span>
                `;

        // Insert before the job entries table
        const tableContainer = document.querySelector('#jobEntriesTable').parentNode;
        tableContainer.parentNode.insertBefore(filterInfo, tableContainer);
    }
}

function setupJobFiltersEventListeners() {
    console.log('Setting up job filter event listeners...');

    const monthFilter = document.getElementById('monthFilter');
    if (monthFilter) {
        monthFilter.addEventListener('change', loadJobEntries);
        console.log('✓ Found element: monthFilter');
    } else {
        console.log('monthFilter element not found');
    }

    const teamFilter = document.getElementById('teamFilter');
    if (teamFilter) {
        teamFilter.addEventListener('change', loadJobEntries);
        console.log('✓ Found element: teamFilter');
    } else {
        console.log('teamFilter element not found');
    }

    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', loadJobEntries);
        console.log('✓ Found element: statusFilter');
    } else {
        console.log('statusFilter element not found');
    }

    const customerFilter = document.getElementById('customerFilter');
    if (customerFilter) {
        customerFilter.addEventListener('change', loadJobEntries);
        console.log('✓ Found element: customerFilter');
    } else {
        console.log('customerFilter element not found');
    }
}


// Update the clearJobFilters function
function clearJobFilters() {
    console.log('Clearing job filters...');

    // Clear all filter inputs
    const monthFilter = document.getElementById('monthFilter');
    const teamFilter = document.getElementById('teamFilter');
    const statusFilter = document.getElementById('statusFilter');
    const customerFilter = document.getElementById('customerFilter');

    if (monthFilter) monthFilter.value = '';
    if (teamFilter) teamFilter.value = '';
    if (statusFilter) statusFilter.value = '';
    if (customerFilter) customerFilter.value = '';

    // Remove filter info display
    const filterInfo = document.querySelector('.job-filter-info');
    if (filterInfo) {
        filterInfo.remove();
    }

    // Reload job entries without filters
    loadJobEntries();

    showSuccessMessage('Filters cleared successfully!');
}





// Add event listeners for filters
document.getElementById('monthFilter').addEventListener('change', loadJobEntries);
document.getElementById('teamFilter').addEventListener('change', loadJobEntries);
document.getElementById('statusFilter').addEventListener('change', loadJobEntries);
document.getElementById('customerFilter').addEventListener('input', debounce(loadJobEntries, 500));

// Debounce function for search input
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Download Excel function
async function downloadJobExcel() {
    try {
        const response = await apiCall('/admin/job-entries/download');

        if (response.success) {
            // Convert data to Excel using SheetJS (you'll need to include this library)
            const XLSX = window.XLSX; // Make sure to include SheetJS in your HTML

            if (XLSX) {
                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.json_to_sheet(response.data);
                XLSX.utils.book_append_sheet(wb, ws, 'Job Tracking');
                XLSX.writeFile(wb, response.filename);
                showSuccessMessage('Excel file downloaded successfully!');
            } else {
                // Fallback: download as JSON if XLSX not available
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(response.data, null, 2));
                const downloadAnchor = document.createElement('a');
                downloadAnchor.href = dataStr;
                downloadAnchor.download = response.filename.replace('.xlsx', '.json');
                downloadAnchor.click();
                showSuccessMessage('Data downloaded as JSON file!');
            }
        }
    } catch (error) {
        console.error('Error downloading Excel:', error);
        showErrorMessage('Error downloading Excel file');
    }
}

function handleStatusChange() {
    const status = document.getElementById('jobStatus').value;
    const currentStatus = document.getElementById('currentJobStatus').value;
    const reasonGroup = document.getElementById('reasonGroup');
    const reasonField = document.getElementById('statusReason');
    const reasonLabel = document.getElementById('reasonLabel');
    const reasonHelpText = document.getElementById('reasonHelpText');
    const warningMessage = document.getElementById('warningMessage');
    const warningText = document.getElementById('warningText');
    const helpText = document.getElementById('statusHelpText');
    const submitButton = document.getElementById('submitButtonText');

    // Reset
    reasonGroup.style.display = 'none';
    warningMessage.style.display = 'none';
    reasonField.required = false;

    // Check if restarting from hold
    const isRestartingFromHold = currentStatus === 'hold' && status !== 'hold' && status !== 'so_cancelled';

    if (isRestartingFromHold) {
        reasonGroup.style.display = 'block';
        reasonLabel.textContent = 'Restart Reason';
        reasonField.placeholder = 'Please provide a reason for restarting this job...';
        reasonField.required = true;
        reasonHelpText.textContent = 'This reason will be included in the restart notification email to all users.';
        warningMessage.style.display = 'block';
        warningMessage.style.background = '#d1edff';
        warningText.innerHTML = '<strong style="color: #0c5460;">Restart Action:</strong> <span style="color: #0c5460;">Job will be restarted from the selected stage and new tasks will be assigned.</span>';
        helpText.innerHTML = '▶️ Job will restart from selected stage with automatic task assignment';
        submitButton.textContent = `Restart from ${formatJobStatus(status)}`;
    } else if (status === 'hold') {
        reasonGroup.style.display = 'block';
        reasonLabel.textContent = 'Hold Reason';
        reasonField.placeholder = 'Please provide a reason for putting this job on hold...';
        reasonField.required = true;
        reasonHelpText.textContent = 'This reason will be included in the notification email to all users.';
        warningMessage.style.display = 'block';
        warningMessage.style.background = '#fff3cd';
        warningText.innerHTML = '<strong style="color: #856404;">Hold Action:</strong> <span style="color: #856404;">All related tasks will be cancelled and notifications sent to all users.</span>';
        helpText.innerHTML = '⏸️ Job will be put on hold - no tasks will be assigned';
        submitButton.textContent = 'Put Job on Hold';
    } else if (status === 'so_cancelled') {
        reasonGroup.style.display = 'block';
        reasonLabel.textContent = 'Cancellation Reason';
        reasonField.placeholder = 'Please provide a reason for cancelling this sales order...';
        reasonField.required = true;
        reasonHelpText.textContent = 'This reason will be included in the notification email to all users.';
        warningMessage.style.display = 'block';
        warningMessage.style.background = '#f8d7da';
        warningText.innerHTML = '<strong style="color: #721c24;">Cancellation Action:</strong> <span style="color: #721c24;">All related tasks will be cancelled and job will be moved to cancelled section.</span>';
        helpText.innerHTML = '❌ Sales order will be cancelled - all work must stop';
        submitButton.textContent = 'Cancel Sales Order';
    } else {
        helpText.innerHTML = '🤖 Task will be automatically assigned based on stage assignments';
        submitButton.textContent = 'Update Status & Auto-Assign';
    }
}


function createJobStatusModal() {
    // Check if modal already exists
    let modal = document.getElementById('jobStatusModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'jobStatusModal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="jobStatusModalTitle">Update Job Status</h3>
                    <button class="close-btn" onclick="closeJobStatusModal()">&times;</button>
                </div>
                <form id="jobStatusForm">
                    <input type="hidden" id="currentJobId">
                    <input type="hidden" id="currentJobStatus">
                    <div style="padding: 20px;">
                        
                        <!-- Hold Restart Section -->
                        <div id="holdRestartSection" style="display: none; background: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                            <h4 style="color: #856404; margin: 0 0 15px 0;">
                                <i class="fas fa-play-circle"></i> Restart Job from Hold
                            </h4>
                            <p style="color: #856404; margin-bottom: 15px;">
                                This job is currently on hold. Select the stage from which you want to restart the job:
                            </p>
                        </div>
                        
                        <div class="form-group">
                            <label for="jobStatus">Status</label>
                            <select id="jobStatus" class="form-control" required onchange="handleStatusChange()">
                                <option value="sales_order_received">Sales Order Received</option>
                                <option value="drawing_approved">Drawing Approved</option>
                                <option value="long_lead_item_details_given">Long Lead Item Details Given</option>
                                <option value="drawing_bom_issued">Drawing/BOM Issued</option>
                                <option value="production_order_purchase_request_prepared">Production Order & Purchase Request Prepared</option>
                                <option value="rm_received">RM Received</option>
                                <option value="production_started">Production Started</option>
                                <option value="production_completed">Production Completed</option>
                                <option value="qc_clear_for_dispatch">QC Clear for Dispatch</option>
                                <option value="dispatch_clearance">Dispatch Clearance</option>
                                <option value="dispatched">Dispatched</option>
                                <option value="hold" style="color: #ff6b35;">⏸️ Put on Hold</option>
                                <option value="so_cancelled" style="color: #dc3545;">❌ Cancel Sales Order</option>
                            </select>
                            <small id="statusHelpText" style="color: #666; margin-top: 5px; display: block;">
                                🤖 Task will be automatically assigned based on stage assignments
                            </small>
                        </div>
                        
                        <!-- Reason field for Hold/Cancel/Restart -->
                        <div class="form-group" id="reasonGroup" style="display: none;">
                            <label for="statusReason" id="reasonLabel">Reason</label>
                            <textarea id="statusReason" class="form-control" rows="3" 
                                    placeholder="Please provide a reason..." required></textarea>
                                    <small id="reasonHelpText" style="color: #666; margin-top: 5px; display: block;">
                                    This reason will be included in the notification email to all users.
                                </small>
                            </div>
                            
                            <div class="form-group">
                                <label for="jobRemarks">Additional Remarks (Optional)</label>
                                <textarea id="jobRemarks" class="form-control" rows="3" 
                                        placeholder="Add any additional remarks or comments..."></textarea>
                            </div>
                            
                            <!-- Warning for Hold/Cancel/Restart -->
                            <div id="warningMessage" style="display: none; padding: 15px; border-radius: 8px; margin: 15px 0;">
                                <div style="font-weight: 500;">
                                    <i class="fas fa-exclamation-triangle"></i> 
                                    <span id="warningText">Warning text will appear here</span>
                                </div>
                            </div>
                            
                            <button type="submit" class="btn btn-primary" id="submitButton">
                                <i class="fas fa-save"></i> <span id="submitButtonText">Update Status & Auto-Assign</span>
                            </button>
                        </div>
                    </form>
                </div>
            `;
}


// Add dropdown styles to your CSS
const dropdownStyles = `
        .dropdown-item:hover {
            background-color: #f8f9fa !important;
            color: #dc3545 !important;
        }

        .dropdown-menu {
            border: 1px solid #dee2e6;
            box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
        }

        #removeDropdown button {
            transition: all 0.2s ease;
            font-size: 14px;
        }

        #removeDropdown button:hover {
            background-color: #f8f9fa;
            transform: translateX(5px);
        }

        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid rgba(255,255,255,.3);
            border-radius: 50%;
            border-top-color: #fff;
            animation: spin 1s ease-in-out infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        `;

// Add styles to document
if (!document.getElementById('jobTrackingStyles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'jobTrackingStyles';
    styleSheet.textContent = dropdownStyles;
    document.head.appendChild(styleSheet);
}

if (!document.getElementById('enhancedHoldCancelStyles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'enhancedHoldCancelStyles';
    styleSheet.textContent = enhancedStyles;
    document.head.appendChild(styleSheet);
}



// Loading message functions
function showLoadingMessage(message) {
    // Remove any existing loading message
    hideLoadingMessage();

    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loadingMessage';
    loadingDiv.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 30px 40px;
                border-radius: 12px;
                z-index: 10000;
                text-align: center;
                font-size: 16px;
                font-weight: 500;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                backdrop-filter: blur(5px);
            `;

    loadingDiv.innerHTML = `
                <div style="margin-bottom: 15px;">
                    <div class="loading" style="margin: 0 auto 15px auto;"></div>
                </div>
                <div>${message}</div>
            `;

    document.body.appendChild(loadingDiv);
}

function hideLoadingMessage() {
    const loadingDiv = document.getElementById('loadingMessage');
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

// View stage history

function viewStageHistory(jobId) {
    const job = allJobEntries.find(j => j._id === jobId);
    if (!job) return;

    let historyText = `STAGE HISTORY - ${job.soNumber}\n`;
    historyText += `Customer: ${job.customer}\n`;
    historyText += `Item: ${job.itemCode}\n\n`;

    if (job.stageHistory && job.stageHistory.length > 0) {
        job.stageHistory.forEach((stage, index) => {
            historyText += `${index + 1}. ${formatJobStatus(stage.stage)}\n`;
            historyText += `   Date: ${new Date(stage.timestamp).toLocaleString()}\n`;
            historyText += `   By: ${stage.changedBy}\n\n`;
            if (stage.remarks) {
                historyText += `   Remarks: ${stage.remarks}\n`;
            }
            if (stage.department) {
                historyText += `   Department: ${stage.department}\n`;
            }
            historyText += `\n`;
        });
    } else {
        historyText += 'No stage history available';
    }

    alert(historyText);
}

function viewJobDetails(jobId) {
    const job = allJobEntries.find(j => j._id === jobId);
    if (!job) return;

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
        'dispatched': 'Logistics',
        'hold': 'Sales',
        'so_cancelled': 'Cancelled'
    };

    let detailsText = `JOB DETAILS - ${job.soNumber}\n\n`;
    detailsText += `Customer: ${job.customer}\n`;
    detailsText += `Item Code: ${job.itemCode}\n`;
    detailsText += `Particulars: ${job.particularsAndModels}\n`;
    detailsText += `Quantity: ${job.qty}\n`;
    detailsText += `Current Stage: ${formatJobStatus(job.status)}\n`;
    detailsText += `Current Department: ${departmentMap[job.status]}\n`;
    // detailsText += `Assigned To: ${job.assignedUsername || 'Not assigned'}\n\n`;
    // detailsText += `📝 Note: Job stages progress automatically when tasks are completed and approved by admin.`;

    if (job.status === 'hold') {
        detailsText += `Hold Date: ${job.holdDate ? new Date(job.holdDate).toLocaleString() : 'N/A'}\n`;
        detailsText += `Hold Reason: ${job.holdReason || 'No reason provided'}\n`;
        detailsText += `⚠️ This job is currently on hold. All related tasks have been cancelled.\n\n`;
        detailsText += `Assigned to: Sales Department (${job.assignedUsername || 'Not assigned'})\n`;
        detailsText += `\n⚠️ This job is currently on HOLD and assigned to the Sales department for resolution.\n`;
        detailsText += `Sales must resolve the hold issue and update the job status to resume processing.\n\n`;
    } else if (job.status === 'so_cancelled') {
        detailsText += `Cancellation Date: ${job.cancelDate ? new Date(job.cancelDate).toLocaleString() : 'N/A'}\n`;
        detailsText += `Cancellation Reason: ${job.cancelReason || 'No reason provided'}\n`;
        detailsText += `❌ This sales order has been cancelled. All work has been stopped.\n\n`;
    } else {
        detailsText += `Assigned To: ${job.assignedUsername || 'Not assigned'}\n\n`;
        detailsText += `📝 Note: Job stages progress automatically when tasks are completed and approved by admin.\n\n`;
    }

    alert(detailsText);
}

// 10. Load department statistics
async function loadDepartmentStats() {
    try {
        const stats = await apiCall('/admin/department-stats');

        // Update the job stats grid with department breakdown
        const statsGrid = document.getElementById('jobStatsGrid');
        if (statsGrid) {
            let departmentCards = '';
            Object.keys(stats).forEach(dept => {
                departmentCards += `
                            <div class="stat-card">
                                <i class="fas fa-building stat-icon"></i>
                                <div class="stat-number">${stats[dept]}</div>
                                <div class="stat-label">${dept} Dept</div>
                            </div>
                        `;
            });

            if (departmentCards) {
                statsGrid.innerHTML = departmentCards;
            }
        }
    } catch (error) {
        console.error('Error loading department stats:', error);
    }
}


// Auto-refresh for real-time updates
setInterval(() => {
    if (userType === 'admin') {
        loadStats();
    } else if (userType === 'user') {
        loadUserStats();
    }
}, 30000); // Refresh every 30 seconds