// UI Controller module for display logic
import { taskManager } from './taskManager.js';
import { formatDateDisplay, formatTimeRange, formatHour, getCurrentTimeMinutes, getDateString, isToday } from '../utils/dateUtils.js';
import { escapeHtml, escapeJsString, createElement } from '../utils/domUtils.js';
import { SCHEDULE_CONFIG, CSS_CLASSES, ICONS, PRIORITY_TYPES, UI_CONFIG } from '../constants.js';

class UIController {
    constructor() {
        this.floatingBannerController = null;
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
        
        // Add click handler to open modal
        taskBlock.style.cursor = 'pointer';
        taskBlock.addEventListener('click', () => {
            this.openTaskModal(task);
        });
        
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
        
        return `
            <div class="dashboard-task ${extraClasses}">
                <div class="task-name">
                    <span class="priority-badge">${priorityIcon}</span>
                    ${task.name}
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
                        <input type="time" id="edit-start-time-${taskId}" value="${this.formatTimeForInput(currentStartTime)}" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-end-time-${taskId}">End Time:</label>
                        <input type="time" id="edit-end-time-${taskId}" value="${this.formatTimeForInput(currentEndTime)}" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-priority-${taskId}">Priority:</label>
                        <select id="edit-priority-${taskId}">
                            <option value="low" ${currentPriority === 'low' ? 'selected' : ''}>Low</option>
                            <option value="medium" ${currentPriority === 'medium' ? 'selected' : ''}>Medium</option>
                            <option value="high" ${currentPriority === 'high' ? 'selected' : ''}>High</option>
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
        const modalOverlay = createElement('div', 'modal-overlay', '', editFormHtml);
        modalOverlay.id = 'edit-task-modal';
        document.body.appendChild(modalOverlay);

        // Add form submission handler
        const form = document.getElementById(`edit-task-form-${taskId}`);
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveTaskEdit(taskId);
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

    async saveTaskEdit(taskId) {
        const nameInput = document.getElementById(`edit-task-name-${taskId}`);
        const startTimeInput = document.getElementById(`edit-start-time-${taskId}`);
        const endTimeInput = document.getElementById(`edit-end-time-${taskId}`);
        const priorityInput = document.getElementById(`edit-priority-${taskId}`);

        if (!nameInput || !startTimeInput || !endTimeInput || !priorityInput) {
            return;
        }

        const updates = {
            name: nameInput.value.trim(),
            startTime: this.parseTimeInput(startTimeInput.value),
            endTime: this.parseTimeInput(endTimeInput.value),
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