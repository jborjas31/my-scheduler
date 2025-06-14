// UI Controller module for display logic
import { taskManager } from './taskManager.js';
import { formatDateDisplay, formatTimeRange, formatHour, getCurrentTimeMinutes, getDateString, isToday, formatTimeFromMinutes } from '../utils/dateUtils.js';
import { createTimePicker } from './timePicker.js';
import { escapeHtml, escapeJsString, createElement } from '../utils/domUtils.js';
import { SCHEDULE_CONFIG, CSS_CLASSES, ICONS, PRIORITY_TYPES, UI_CONFIG } from '../constants.js';

class UIController {
    constructor() {
        this.floatingBannerController = null;
    }

    initialize() {
        // Set up event delegation for dashboard task clicks
        this.setupDashboardTaskEventListeners();
        this.setupTaskBlockEventListeners();
        // Note: Schedule grid click listeners are set up in generateSchedule()
    }

    setupDashboardTaskEventListeners() {
        // Use event delegation on the dashboard container
        const taskDashboard = document.querySelector('.task-dashboard');
        if (taskDashboard) {
            taskDashboard.addEventListener('click', (event) => {
                // Find the clicked dashboard task
                const dashboardTask = event.target.closest('.dashboard-task-clickable');
                if (dashboardTask) {
                    const taskId = dashboardTask.getAttribute('data-task-id');
                    if (taskId) {
                        this.handleDashboardTaskClick(taskId);
                    }
                }
            });
        }
    }
    
    setupTaskBlockEventListeners() {
        // Use event delegation for task blocks in schedule
        document.addEventListener('click', (event) => {
            const taskBlock = event.target.closest('.task-clickable');
            if (taskBlock) {
                const taskId = taskBlock.dataset.taskId;
                if (taskId) {
                    this.handleTaskBlockClick(taskId);
                }
            }
        });
    }
    
    async handleTaskBlockClick(taskId) {
        try {
            const task = await taskManager.getTaskById(taskId);
            if (task) {
                this.openTaskModal(task);
            }
        } catch (error) {
            console.error('Error loading task for modal:', error);
        }
    }

    async handleDashboardTaskClick(taskId) {
        try {
            // Get the task data from the task manager
            const task = await taskManager.getTaskById(taskId);
            if (task) {
                this.openTaskModal(task);
            } else {
                console.error('Task not found:', taskId);
            }
        } catch (error) {
            console.error('Error loading task for modal:', error);
        }
    }

    setupScheduleGridClickListeners() {
        // Use event delegation on the tasks canvas
        const tasksCanvas = document.querySelector('.tasks-canvas');
        console.log('Setting up schedule grid listeners, tasksCanvas found:', !!tasksCanvas);
        
        if (tasksCanvas) {
            // Add hover effects for better UX
            tasksCanvas.addEventListener('mousemove', (event) => {
                this.handleScheduleGridHover(event);
            });
            
            tasksCanvas.addEventListener('mouseleave', () => {
                this.clearScheduleGridHover();
            });
            
            // Handle clicks to add tasks
            tasksCanvas.addEventListener('click', (event) => {
                console.log('Schedule grid clicked!', event.target);
                this.handleScheduleGridClick(event);
            });
            
            console.log('Schedule grid click listeners attached successfully');
        } else {
            console.error('Tasks canvas not found when setting up click listeners');
        }
    }

    handleScheduleGridHover(event) {
        // Throttle hover events for performance
        if (this.hoverThrottleTimer) return;
        this.hoverThrottleTimer = setTimeout(() => {
            this.hoverThrottleTimer = null;
        }, 16); // ~60fps
        
        const tasksCanvas = event.currentTarget;
        
        // Don't show hover if clicking on an existing task
        if (event.target.closest('.task-block')) {
            this.clearScheduleGridHover();
            return;
        }
        
        // Calculate time from click position
        const rect = tasksCanvas.getBoundingClientRect();
        const relativeY = event.clientY - rect.top + tasksCanvas.scrollTop;
        const timeInMinutes = this.pixelsToMinutes(relativeY);
        const roundedTime = this.roundToNearestInterval(timeInMinutes, 15);
        
        // Show hover effect
        this.showScheduleGridHover(roundedTime);
    }

    handleScheduleGridClick(event) {
        console.log('handleScheduleGridClick called', {
            target: event.target,
            targetClass: event.target.className,
            closestTaskBlock: event.target.closest('.task-block')
        });
        
        // Don't handle clicks on existing tasks - let them handle their own clicks
        if (event.target.closest('.task-block')) {
            console.log('Click on task block, ignoring');
            return;
        }
        
        const tasksCanvas = event.currentTarget;
        
        // Calculate time from click position
        const rect = tasksCanvas.getBoundingClientRect();
        const relativeY = event.clientY - rect.top + tasksCanvas.scrollTop;
        const timeInMinutes = this.pixelsToMinutes(relativeY);
        const roundedStartTime = this.roundToNearestInterval(timeInMinutes, 15);
        const defaultEndTime = roundedStartTime + 60; // Default 1-hour task
        
        console.log('Opening quick add modal for time:', {
            clickY: event.clientY,
            relativeY,
            timeInMinutes,
            roundedStartTime,
            defaultEndTime
        });
        
        // Clear any hover effects
        this.clearScheduleGridHover();
        
        // Open quick add modal
        this.openQuickAddTaskModal(roundedStartTime, defaultEndTime);
    }

    pixelsToMinutes(pixels) {
        // Each minute = 1 pixel in our layout
        return Math.round(pixels);
    }

    roundToNearestInterval(minutes, intervalMinutes) {
        return Math.round(minutes / intervalMinutes) * intervalMinutes;
    }

    showScheduleGridHover(timeInMinutes) {
        // Remove any existing hover indicator
        this.clearScheduleGridHover();
        
        const tasksCanvas = document.querySelector('.tasks-canvas');
        if (!tasksCanvas) return;
        
        // Create hover indicator
        const hoverIndicator = createElement('div', 'schedule-hover-indicator');
        hoverIndicator.style.top = `${timeInMinutes}px`;
        hoverIndicator.style.height = '60px'; // Default 1-hour height
        
        // Add time label
        const timeLabel = createElement('div', 'hover-time-label');
        timeLabel.textContent = `Click to add task at ${formatTimeFromMinutes(timeInMinutes)}`;
        hoverIndicator.appendChild(timeLabel);
        
        tasksCanvas.appendChild(hoverIndicator);
    }

    clearScheduleGridHover() {
        const existingHover = document.querySelector('.schedule-hover-indicator');
        if (existingHover) {
            existingHover.remove();
        }
    }

    updateDateDisplay() {
        const dateDisplay = document.getElementById('current-date-display');
        const datePicker = document.getElementById('date-picker');
        const currentDate = taskManager.getCurrentViewDate();
        
        if (dateDisplay) {
            dateDisplay.textContent = formatDateDisplay(currentDate);
        }
        if (datePicker) {
            datePicker.value = getDateString(currentDate);
        }
        
        // Sync floating banner
        if (this.floatingBannerController) {
            this.floatingBannerController.sync();
        }
    }

    generateSchedule() {
        const scheduleGrid = document.querySelector('.schedule-grid');
        
        if (!scheduleGrid) return;
        
        // Clear existing content
        scheduleGrid.innerHTML = '';
        
        // Create time labels column
        const timeLabelsColumn = createElement('div', 'time-labels-column');
        
        // Generate hourly time labels
        for (let hour = SCHEDULE_CONFIG.START_HOUR; hour <= SCHEDULE_CONFIG.END_HOUR; hour++) {
            const timeLabel = createElement('div', 'time-label-item');
            timeLabel.setAttribute('data-hour', hour);
            timeLabel.textContent = formatHour(hour);
            timeLabelsColumn.appendChild(timeLabel);
        }
        
        // Create tasks canvas
        const tasksCanvas = createElement('div', 'tasks-canvas');
        
        // Add hour grid lines to canvas
        for (let hour = SCHEDULE_CONFIG.START_HOUR; hour <= SCHEDULE_CONFIG.END_HOUR; hour++) {
            const hourLine = createElement('div', 'hour-line');
            hourLine.style.top = `${hour * 60}px`;
            hourLine.setAttribute('data-hour', hour);
            tasksCanvas.appendChild(hourLine);
        }
        
        // Add current time line if viewing today
        const currentDate = taskManager.getCurrentViewDate();
        if (isToday(currentDate)) {
            const currentMinutes = getCurrentTimeMinutes();
            const currentTimeLine = createElement('div', 'current-time-line');
            currentTimeLine.id = 'current-time-line';
            currentTimeLine.style.top = `${currentMinutes}px`;
            tasksCanvas.appendChild(currentTimeLine);
        }
        
        // Append columns to schedule grid
        scheduleGrid.appendChild(timeLabelsColumn);
        scheduleGrid.appendChild(tasksCanvas);
        
        // Set up click-to-add functionality now that the canvas exists
        this.setupScheduleGridClickListeners();
    }

    updateScheduleDisplay(tasks) {
        const tasksCanvas = document.querySelector('.tasks-canvas');
        
        if (!tasksCanvas) return;
        
        // Remove existing task blocks (keep grid lines and current time line)
        const existingTasks = tasksCanvas.querySelectorAll('.task-block');
        existingTasks.forEach(task => task.remove());
        
        if (tasks.length === 0) return;
        
        // Update current time line if viewing today
        this.updateCurrentTimeLine();
        
        // Detect overlaps and group overlapping tasks
        const overlapGroups = taskManager.detectTaskOverlaps(tasks);
        
        // Position and display each task
        overlapGroups.forEach(group => {
            this.positionTaskGroup(group, tasksCanvas);
        });
    }

    updateCurrentTimeLine() {
        const currentDate = taskManager.getCurrentViewDate();
        const currentTimeLine = document.getElementById('current-time-line');
        
        if (isToday(currentDate) && currentTimeLine) {
            const currentMinutes = getCurrentTimeMinutes();
            currentTimeLine.style.top = `${currentMinutes}px`;
            currentTimeLine.style.display = 'block';
        } else if (currentTimeLine) {
            currentTimeLine.style.display = 'none';
        }
    }

    positionTaskGroup(taskGroup, container) {
        const groupSize = taskGroup.length;
        
        taskGroup.forEach((task, index) => {
            const taskBlock = this.createTaskBlock(task, groupSize, index);
            container.appendChild(taskBlock);
        });
    }

    createTaskBlock(task, overlapCount, overlapIndex) {
        const taskBlock = createElement('div', CSS_CLASSES.TASK_BLOCK);
        taskBlock.setAttribute('data-task-id', task.id);
        
        // Add priority class
        taskBlock.classList.add(task.priority);
        
        // Add completion class
        if (task.completed) {
            taskBlock.classList.add(CSS_CLASSES.COMPLETED);
        }
        
        // Check if task is overdue
        if (taskManager.isTaskOverdue(task)) {
            taskBlock.classList.add(CSS_CLASSES.OVERDUE);
        }
        
        // Position the task block
        const startTime = task.startTime;
        const duration = task.duration || (task.crossesMidnight ? 
            (24 * 60 - task.startTime) + task.endTime : 
            task.endTime - task.startTime);

        taskBlock.style.top = `${startTime}px`;
        taskBlock.style.height = `${Math.max(duration, 1)}px`;

        // Add size class based on duration
        const sizeClass = taskManager.getTaskSizeClass(duration);
        taskBlock.classList.add(sizeClass);
        
        // Handle overlaps
        if (overlapCount > 1) {
            const maxOverlapGroups = 4;
            const actualOverlapCount = Math.min(overlapCount, maxOverlapGroups);
            taskBlock.classList.add(`overlap-${actualOverlapCount}-${overlapIndex + 1}`);
        }
        
        // Create task content
        this.populateTaskContent(taskBlock, task);
        
        // Add click handler to open modal (use event delegation for better performance)
        taskBlock.style.cursor = 'pointer';
        taskBlock.dataset.taskId = task.id;
        taskBlock.classList.add('task-clickable');
        
        return taskBlock;
    }

    populateTaskContent(taskBlock, task) {
        const priorityIcon = task.priority === PRIORITY_TYPES.FIXED ? ICONS.PRIORITY_FIXED : ICONS.PRIORITY_FLEXIBLE;
        const completionIcon = task.completed ? ICONS.COMPLETED : ICONS.NOT_COMPLETED;
        const crossMidnightIcon = (task.crossesMidnight || task.endTime <= task.startTime) ? ` ${ICONS.CROSS_MIDNIGHT}` : '';
        
        let overdueLabel = '';
        if (taskBlock.classList.contains(CSS_CLASSES.OVERDUE)) {
            overdueLabel = '<span class="overdue-badge">OVERDUE</span>';
        }
        
        const timeDisplay = formatTimeRange(task.startTime, task.endTime);
        const escapedTaskName = escapeHtml(task.name);
        
        taskBlock.innerHTML = `
            <div class="task-content-simple">
                <div class="task-name">
                    <span class="priority-icon">${priorityIcon}</span>
                    ${escapedTaskName}
                    ${task.completed ? '<span class="completion-icon">✓</span>' : ''}
                    ${overdueLabel}
                </div>
                <div class="task-time">${timeDisplay}</div>
            </div>
        `;
    }

    updateTaskDashboard(tasks) {
        const categories = taskManager.categorizeTasksForDashboard();
        
        // Update dashboard sections
        this.updateDashboardSection('right-now-content', categories.rightNow, 'current');
        this.updateDashboardSection('coming-up-content', categories.comingUp, 'upcoming');
        this.updateDashboardSection('overdue-content', categories.overdue, 'overdue');
        this.updateDashboardSection('completed-content', categories.completed, 'completed');
        
        // Show/hide sections based on content
        this.toggleDashboardSection('overdue-section', categories.overdue.length > 0);
        this.toggleDashboardSection('completed-section', categories.completed.length > 0);
    }

    updateDashboardSection(contentId, tasks, type) {
        const content = document.getElementById(contentId);
        if (!content) return;
        
        if (tasks.length === 0) {
            const noTasksMessages = {
                current: 'No current tasks',
                upcoming: 'No upcoming tasks',
                overdue: 'No overdue tasks',
                completed: 'No completed tasks yet'
            };
            content.innerHTML = `<p class="no-tasks">${noTasksMessages[type]}</p>`;
            return;
        }
        
        if (type === 'overdue') {
            content.innerHTML = `
                <div class="overdue-warning">
                    ⚠️ You have ${tasks.length} overdue task${tasks.length > 1 ? 's' : ''} that cannot be skipped!
                </div>
                ${tasks.map(task => this.createDashboardTaskHTML(task, type)).join('')}
            `;
        } else {
            content.innerHTML = tasks.slice(0, 3).map(task => this.createDashboardTaskHTML(task, type)).join('');
        }
    }

    createDashboardTaskHTML(task, type) {
        const priorityIcon = task.priority === PRIORITY_TYPES.FIXED ? ICONS.PRIORITY_FIXED : ICONS.PRIORITY_FLEXIBLE;
        const timeRange = formatTimeRange(task.startTime, task.endTime);
        const crossMidnightIndicator = (task.crossesMidnight || task.endTime <= task.startTime) ? ` ${ICONS.CROSS_MIDNIGHT}` : '';
        
        let statusText = '';
        let extraClasses = task.priority;
        
        if (type === 'current') {
            statusText = '⚡ Active now - Focus on this!';
            extraClasses += ' current';
        } else if (type === 'upcoming') {
            const hoursUntil = Math.floor(task.hoursUntilStart / 60);
            const minutesUntil = Math.floor(task.hoursUntilStart % 60);
            const timeUntilText = hoursUntil > 0 ? `in ${hoursUntil}h ${minutesUntil}m` : `in ${minutesUntil}m`;
            statusText = `📅 Starts ${timeUntilText}`;
        } else if (type === 'overdue') {
            const currentMinutes = getCurrentTimeMinutes();
            const minutesOverdue = task.crossesMidnight 
                ? (currentMinutes > task.endTime ? currentMinutes - task.endTime : 0)
                : (currentMinutes - task.endTime);
            
            const hoursOverdue = Math.floor(minutesOverdue / 60);
            const minsOverdue = minutesOverdue % 60;
            const overdueTime = hoursOverdue > 0 ? `${hoursOverdue}h ${minsOverdue}m` : `${minsOverdue}m`;
            statusText = `⏰ ${overdueTime} overdue`;
            extraClasses += ' overdue';
        } else if (type === 'completed') {
            statusText = '🎉 Well done!';
            extraClasses += ' completed';
        }
        
        // Escape task data for safe HTML attributes
        const escapedTaskId = escapeHtml(task.id);
        const escapedTaskName = escapeHtml(task.name);
        
        return `
            <div class="dashboard-task ${extraClasses} dashboard-task-clickable" 
                 data-task-id="${escapedTaskId}"
                 style="cursor: pointer;"
                 title="Click to view task details">
                <div class="task-name">
                    <span class="priority-badge">${priorityIcon}</span>
                    ${escapedTaskName}
                    ${type === 'completed' ? '<span class="completion-badge">✅</span>' : ''}
                    ${crossMidnightIndicator}
                </div>
                <div class="task-time">${timeRange}</div>
                <div class="task-status">${statusText}</div>
            </div>
        `;
    }

    toggleDashboardSection(sectionId, show) {
        const section = document.getElementById(sectionId);
        if (section) {
            section.style.display = show ? 'block' : 'none';
        }
    }

    updateCurrentTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        
        const currentTimeDisplay = document.getElementById('current-time-display');
        if (currentTimeDisplay) {
            currentTimeDisplay.textContent = timeString;
        }
        
        this.highlightCurrentTimeSlot();
        this.updateCurrentTimeLine();
        
        // Sync floating banner time
        if (this.floatingBannerController) {
            this.floatingBannerController.sync();
        }
    }

    highlightCurrentTimeSlot() {
        const now = new Date();
        const currentDate = taskManager.getCurrentViewDate();
        const viewingToday = isToday(currentDate);
        
        const timeSlots = document.querySelectorAll('.time-slot');
        timeSlots.forEach(slot => {
            slot.classList.remove('current-time-slot');
        });
        
        if (viewingToday) {
            const currentHour = now.getHours();
            const currentSlot = document.querySelector(`[data-hour="${currentHour}"]`);
            if (currentSlot) {
                currentSlot.classList.add('current-time-slot');
            }
        }
    }

    openTaskModal(task) {
        // Remove any existing modal
        const existingModal = document.getElementById('task-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create modal content
        const modalHTML = this.createTaskModalHTML(task);
        
        // Create modal overlay
        const modalOverlay = createElement('div', 'modal-overlay');
        modalOverlay.id = 'task-modal';
        modalOverlay.innerHTML = modalHTML;
        
        // Add modal to page
        document.body.appendChild(modalOverlay);
        
        // Setup modal event handlers
        this.setupModalEventHandlers(modalOverlay, task);
    }

    createTaskModalHTML(task) {
        // Calculate task duration display
        let durationText = '';
        if (task.duration) {
            const hours = Math.floor(task.duration / 60);
            const minutes = task.duration % 60;
            
            if (hours === 0) {
                durationText = `${minutes} minutes`;
            } else if (minutes === 0) {
                durationText = `${hours} hour${hours > 1 ? 's' : ''}`;
            } else {
                durationText = `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minutes`;
            }
        }
        
        const timeRange = formatTimeRange(task.startTime, task.endTime);
        const priorityText = task.priority === PRIORITY_TYPES.FIXED ? '🔒 Cannot Skip (Fixed)' : '⏰ Can Skip (Flexible)';
        const crossMidnightText = (task.crossesMidnight || task.endTime <= task.startTime) ? 
            '<div class="modal-info-item"><span class="modal-label">Special:</span> This task crosses midnight 🌙</div>' : '';
        
        // Check if task is overdue
        let overdueText = '';
        if (taskManager.isTaskOverdue(task)) {
            const currentMinutes = getCurrentTimeMinutes();
            const minutesOverdue = task.crossesMidnight 
                ? (currentMinutes > task.endTime ? currentMinutes - task.endTime : 0)
                : (currentMinutes - task.endTime);
            
            const hoursOverdue = Math.floor(minutesOverdue / 60);
            const minsOverdue = minutesOverdue % 60;
            const overdueTime = hoursOverdue > 0 ? `${hoursOverdue}h ${minsOverdue}m` : `${minsOverdue}m`;
            
            overdueText = `<div class="modal-overdue-warning">⚠️ This task is ${overdueTime} overdue!</div>`;
        }
        
        const escapedTaskName = escapeHtml(task.name);
        const jsEscapedName = escapeJsString(task.name);
        
        return `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">${escapedTaskName}</h3>
                    <button class="modal-close" onclick="closeTaskModal()" aria-label="Close modal">&times;</button>
                </div>
                
                <div class="modal-body">
                    ${overdueText}
                    
                    <div class="modal-info">
                        <div class="modal-info-item">
                            <span class="modal-label">Time:</span> ${timeRange}
                        </div>
                        <div class="modal-info-item">
                            <span class="modal-label">Duration:</span> ${durationText}
                        </div>
                        <div class="modal-info-item">
                            <span class="modal-label">Priority:</span> ${priorityText}
                        </div>
                        <div class="modal-info-item">
                            <span class="modal-label">Status:</span> ${task.completed ? '✅ Completed' : '⭕ Not completed'}
                        </div>
                        ${crossMidnightText}
                    </div>
                </div>
                
                <div class="modal-footer">
                    <div class="modal-actions">
                        <button class="modal-btn modal-btn-primary" onclick="toggleTaskFromModal('${task.id}', ${task.completed})">
                            ${task.completed ? '↩️ Mark Incomplete' : '✅ Mark Complete'}
                        </button>
                        <button class="modal-btn modal-btn-secondary" onclick="editTaskFromModal('${task.id}', '${jsEscapedName}', ${task.startTime}, ${task.endTime}, '${task.priority}')">
                            ✏️ Edit Task
                        </button>
                        <button class="modal-btn modal-btn-danger" onclick="deleteTaskFromModal('${task.id}')">
                            🗑️ Delete Task
                        </button>
                    </div>
                    <button class="modal-btn modal-btn-cancel" onclick="closeTaskModal()">
                        Cancel
                    </button>
                </div>
            </div>
        `;
    }

    setupModalEventHandlers(modalOverlay, task) {
        // Add click outside to close
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                this.closeTaskModal();
            }
        });
        
        // Add escape key to close
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.closeTaskModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
        
        // Focus trap for accessibility
        const modal = modalOverlay.querySelector('.modal-content');
        const focusableElements = modal.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        if (firstElement) {
            firstElement.focus();
        }
        
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        });
    }

    closeTaskModal() {
        const modal = document.getElementById('task-modal');
        if (modal) {
            modal.classList.add('modal-closing');
            setTimeout(() => {
                modal.remove();
            }, 150);
        }
    }

    editTask(taskId, currentName, currentStartTime, currentEndTime, currentPriority) {
        // Create edit form HTML
        const editFormHtml = `
            <div class="edit-task-form">
                <h3>Edit Task</h3>
                <form id="edit-task-form-${taskId}">
                    <div class="form-group">
                        <label for="edit-task-name-${taskId}">Task Name:</label>
                        <input type="text" id="edit-task-name-${taskId}" value="${escapeHtml(currentName)}" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-start-time-${taskId}">Start Time:</label>
                        <div class="custom-time-input">
                            <input type="text" id="edit-start-time-${taskId}" class="time-picker-input" value="${this.formatTimeForInput(currentStartTime)}" placeholder="Select or type time" required autocomplete="off">
                            <div class="time-dropdown" id="edit-start-time-dropdown-${taskId}">
                                <!-- Options will be generated by JavaScript -->
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="edit-end-time-${taskId}">End Time:</label>
                        <div class="custom-time-input">
                            <input type="text" id="edit-end-time-${taskId}" class="time-picker-input" value="${this.formatTimeForInput(currentEndTime)}" placeholder="Select or type time" required autocomplete="off">
                            <div class="time-dropdown" id="edit-end-time-dropdown-${taskId}">
                                <!-- Options will be generated by JavaScript -->
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="edit-priority-${taskId}">Priority:</label>
                        <select id="edit-priority-${taskId}" required>
                            <option value="fixed" ${currentPriority === 'fixed' ? 'selected' : ''}>🔒 Cannot Skip (Fixed)</option>
                            <option value="flexible" ${currentPriority === 'flexible' ? 'selected' : ''}>⏰ Can Skip (Flexible)</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Save Changes</button>
                        <button type="button" class="btn btn-secondary" onclick="cancelTaskEdit('${taskId}')">Cancel</button>
                    </div>
                </form>
            </div>
        `;

        // Create modal overlay
        const modalOverlay = createElement('div', 'modal-overlay');
        modalOverlay.innerHTML = editFormHtml;
        modalOverlay.id = 'edit-task-modal';
        document.body.appendChild(modalOverlay);

        // Initialize time pickers for edit modal
        const editStartTimePicker = createTimePicker(
            `edit-start-time-${taskId}`, 
            `edit-start-time-dropdown-${taskId}`, 
            0, // No default offset since we're editing existing time
            (selectedMinutes, selectedText) => {
                // When start time is selected, auto-open end time picker centered 1 hour later
                const endTimeTarget = selectedMinutes + 60; // Add 1 hour (60 minutes)
                
                // Small delay to let the start dropdown close smoothly
                setTimeout(() => {
                    editEndTimePicker.showDropdownCenteredAt(endTimeTarget);
                }, 100);
            }
        );
        
        const editEndTimePicker = createTimePicker(
            `edit-end-time-${taskId}`, 
            `edit-end-time-dropdown-${taskId}`, 
            0 // No default offset since we're editing existing time
        );

        // Add form submission handler
        const form = document.getElementById(`edit-task-form-${taskId}`);
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveTaskEdit(taskId, editStartTimePicker, editEndTimePicker);
        });

        // Show modal
        requestAnimationFrame(() => {
            modalOverlay.classList.add('show');
        });

        // Close on overlay click
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                this.cancelTaskEdit(taskId);
            }
        });

        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.cancelTaskEdit(taskId);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    async saveTaskEdit(taskId, editStartTimePicker, editEndTimePicker) {
        const nameInput = document.getElementById(`edit-task-name-${taskId}`);
        const priorityInput = document.getElementById(`edit-priority-${taskId}`);

        if (!nameInput || !priorityInput || !editStartTimePicker || !editEndTimePicker) {
            return;
        }

        const updates = {
            name: nameInput.value.trim(),
            startTime: editStartTimePicker.getValue(),
            endTime: editEndTimePicker.getValue(),
            priority: priorityInput.value
        };

        try {
            const success = await taskManager.updateTask(taskId, updates);
            if (success) {
                this.cancelTaskEdit(taskId);
                // Reload tasks and update UI
                const tasks = await taskManager.loadTasks();
                this.updateScheduleDisplay(tasks);
                this.updateTaskDashboard(tasks);
            }
        } catch (error) {
            // Error handling is done in taskManager
        }
    }

    cancelTaskEdit(taskId) {
        const modal = document.getElementById('edit-task-modal');
        if (modal) {
            modal.classList.add('modal-closing');
            setTimeout(() => {
                modal.remove();
            }, 150);
        }
    }

    formatTimeForInput(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }

    openQuickAddTaskModal(startTimeMinutes, endTimeMinutes) {
        // Remove any existing modal
        const existingModal = document.getElementById('quick-add-task-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create quick add modal
        const modalHTML = this.createQuickAddModalHTML(startTimeMinutes, endTimeMinutes);
        
        const modalOverlay = createElement('div', 'modal-overlay');
        modalOverlay.id = 'quick-add-task-modal';
        modalOverlay.innerHTML = modalHTML;
        
        // Add modal to page
        document.body.appendChild(modalOverlay);
        
        // Setup event handlers
        this.setupQuickAddModalEventHandlers(modalOverlay, startTimeMinutes, endTimeMinutes);
        
        // Initialize time pickers
        this.initializeQuickAddTimePickers(startTimeMinutes, endTimeMinutes);
        
        // Focus on task name input
        setTimeout(() => {
            const nameInput = document.getElementById('quick-task-name');
            if (nameInput) {
                nameInput.focus();
            }
        }, 100);
    }

    createQuickAddModalHTML(startTimeMinutes, endTimeMinutes) {
        const startTimeText = formatTimeFromMinutes(startTimeMinutes);
        const endTimeText = formatTimeFromMinutes(endTimeMinutes);
        const startTimeValue = this.formatTimeForInput(startTimeMinutes);
        const endTimeValue = this.formatTimeForInput(endTimeMinutes);
        
        return `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">Quick Add Task</h3>
                    <button class="modal-close" id="quick-add-close-btn" aria-label="Close modal">&times;</button>
                </div>
                
                <div class="modal-body">
                    <form id="quick-add-form">
                        <div class="form-row">
                            <label for="quick-task-name">Task Name:</label>
                            <input type="text" id="quick-task-name" placeholder="Enter task name..." required>
                        </div>
                        
                        <div class="form-row">
                            <label>Start Time:</label>
                            <div class="time-input-container">
                                <input type="text" id="quick-start-time" class="time-input" value="${startTimeText}" readonly>
                                <div id="quick-start-time-dropdown" class="time-dropdown"></div>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <label>End Time:</label>
                            <div class="time-input-container">
                                <input type="text" id="quick-end-time" class="time-input" value="${endTimeText}" readonly>
                                <div id="quick-end-time-dropdown" class="time-dropdown"></div>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <label for="quick-task-priority">Priority:</label>
                            <select id="quick-task-priority" required>
                                <option value="flexible">⏰ Flexible (can be skipped)</option>
                                <option value="fixed">🔒 Fixed (cannot be skipped)</option>
                            </select>
                        </div>
                    </form>
                </div>
                
                <div class="modal-footer">
                    <div class="modal-actions">
                        <button class="modal-btn modal-btn-primary" id="quick-add-save-btn" type="submit" form="quick-add-form">
                            ✅ Add Task
                        </button>
                        <button class="modal-btn modal-btn-cancel" id="quick-add-cancel-btn" type="button">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    setupQuickAddModalEventHandlers(modalOverlay, originalStartTime, originalEndTime) {
        // Close on overlay click
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                this.closeQuickAddModal();
            }
        });
        
        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.closeQuickAddModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
        
        // Add button event listeners
        const closeBtn = document.getElementById('quick-add-close-btn');
        const cancelBtn = document.getElementById('quick-add-cancel-btn');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeQuickAddModal());
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeQuickAddModal());
        }
        
        // Handle form submission
        const form = document.getElementById('quick-add-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveQuickAddTask();
            });
        }
    }

    async saveQuickAddTask() {
        const nameInput = document.getElementById('quick-task-name');
        const priorityInput = document.getElementById('quick-task-priority');
        
        if (!nameInput || !priorityInput || !this.quickAddStartTimePicker || !this.quickAddEndTimePicker) {
            return;
        }
        
        const taskName = nameInput.value.trim();
        const startTime = this.quickAddStartTimePicker.getValue();
        const endTime = this.quickAddEndTimePicker.getValue();
        const priority = priorityInput.value;
        
        if (!taskName) {
            nameInput.focus();
            return;
        }
        
        try {
            // Use the existing task manager to add the task
            await taskManager.addTask(taskName, startTime, endTime, priority);
            this.closeQuickAddModal();
            
            // Refresh the schedule display
            const tasks = await taskManager.loadTasks();
            this.updateScheduleDisplay(tasks);
            this.updateTaskDashboard(tasks);
        } catch (error) {
            console.error('Error adding quick task:', error);
            // Error will be handled by taskManager.addTask
        }
    }

    closeQuickAddModal() {
        const modal = document.getElementById('quick-add-task-modal');
        if (modal) {
            modal.classList.add('modal-closing');
            setTimeout(() => {
                modal.remove();
                // Clean up time pickers
                this.quickAddStartTimePicker = null;
                this.quickAddEndTimePicker = null;
            }, 150);
        }
    }

    initializeQuickAddTimePickers(startTimeMinutes, endTimeMinutes) {
        // Create time pickers for the quick add modal
        this.quickAddStartTimePicker = createTimePicker(
            'quick-start-time',
            'quick-start-time-dropdown',
            0, // No default offset for start time
            (selectedTime) => {
                // Update end time to maintain 1-hour duration if needed
                const currentEndTime = this.quickAddEndTimePicker?.getValue();
                if (currentEndTime && selectedTime >= currentEndTime) {
                    const newEndTime = selectedTime + 60; // Add 1 hour
                    this.quickAddEndTimePicker.setValue(newEndTime);
                }
            }
        );
        
        this.quickAddEndTimePicker = createTimePicker(
            'quick-end-time',
            'quick-end-time-dropdown',
            60, // Default 1 hour after start time
            null
        );
        
        // Set initial values
        this.quickAddStartTimePicker.setValue(startTimeMinutes);
        this.quickAddEndTimePicker.setValue(endTimeMinutes);
    }

    parseTimeInput(timeString) {
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
    }

    setFloatingBannerController(controller) {
        this.floatingBannerController = controller;
    }
}

// Export singleton instance
export const uiController = new UIController();