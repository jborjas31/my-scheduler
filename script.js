// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA0chYZcONeLq57IlskjBJMOx2zFSa8b4k",
  authDomain: "my-scheduler-8c394.firebaseapp.com",
  projectId: "my-scheduler-8c394",
  storageBucket: "my-scheduler-8c394.firebasestorage.app",
  messagingSenderId: "225852937709",
  appId: "1:225852937709:web:58ab245d40ddb19b3c03e4"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Global variables
let currentViewDate = new Date();
let isOnline = navigator.onLine;
let pendingTasks = JSON.parse(localStorage.getItem('pendingTasks') || '[]');
let retryQueue = [];

// Configuration for schedule hours
const SCHEDULE_START_HOUR = 0;  // 12 AM (midnight)
const SCHEDULE_END_HOUR = 23;   // 11 PM

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    const errorTextSpan = document.getElementById('error-text');
    if (errorDiv && errorTextSpan) {
        errorTextSpan.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    } else {
        alert('Error: ' + message);
    }
}

function showSuccess(message) {
    const existingSuccess = document.getElementById('success-message');
    if (existingSuccess) {
        existingSuccess.remove();
    }
    
    const successDiv = document.createElement('div');
    successDiv.id = 'success-message';
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #d4edda;
        color: #155724;
        padding: 12px 20px;
        border-radius: 4px;
        border: 1px solid #c3e6cb;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        z-index: 1000;
        max-width: 350px;
        font-weight: 500;
        font-size: 14px;
    `;
    successDiv.innerHTML = `<strong>✓</strong> ${message}`;
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.remove();
        }
    }, 4000);
}

function setLoadingState(isLoading) {
    const container = document.querySelector('.schedule-container');
    const loadingIndicator = document.getElementById('loading-indicator');
    
    if (container) {
        if (isLoading) {
            container.classList.add('loading');
            if (loadingIndicator) loadingIndicator.style.display = 'block';
        } else {
            container.classList.remove('loading');
            if (loadingIndicator) loadingIndicator.style.display = 'none';
        }
    }
}

function formatDateDisplay(date) {
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
}

function getDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatTimeFromMinutes(minutes) {
    const hour = Math.floor(minutes / 60);
    const min = minutes % 60;
    
    if (hour === 0 && min === 0) return '12:00 AM';
    if (hour < 12) {
        return `${hour === 0 ? 12 : hour}:${min.toString().padStart(2, '0')} AM`;
    } else if (hour === 12) {
        return `12:${min.toString().padStart(2, '0')} PM`;
    } else {
        return `${hour - 12}:${min.toString().padStart(2, '0')} PM`;
    }
}

function formatTimeRange(startMinutes, endMinutes) {
    const startTime = formatTimeFromMinutes(startMinutes);
    const endTime = formatTimeFromMinutes(endMinutes);
    
    if (endMinutes <= startMinutes) {
        return `${startTime} - ${endTime} (+1 day)`;
    } else {
        return `${startTime} - ${endTime}`;
    }
}

function formatHour(hour) {
    if (hour === 0) return '12:00 AM';
    if (hour < 12) return `${hour}:00 AM`;
    if (hour === 12) return '12:00 PM';
    return `${hour - 12}:00 PM`;
}

function parseManualTime(timeString) {
    if (!timeString || timeString.trim() === '') return null;
    
    const cleanTime = timeString.trim();
    
    // Handle 24-hour format
    const time24Match = cleanTime.match(/^(\d{1,2}):(\d{2})$/);
    if (time24Match) {
        const hour = parseInt(time24Match[1]);
        const minute = parseInt(time24Match[2]);
        
        if (hour < 0 || hour > 23) {
            showError(`Invalid hour: ${hour}. Use 0-23 for 24-hour format.`);
            return null;
        }
        if (minute < 0 || minute > 59) {
            showError(`Invalid minute: ${minute}. Use 0-59.`);
            return null;
        }
        
        return hour * 60 + minute;
    }
    
    // Handle 12-hour format
    const time12Match = cleanTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (time12Match) {
        let hour = parseInt(time12Match[1]);
        const minute = parseInt(time12Match[2]);
        const period = time12Match[3].toUpperCase();
        
        if (hour < 1 || hour > 12) {
            showError(`Invalid hour: ${hour}. Use 1-12 for AM/PM format.`);
            return null;
        }
        if (minute < 0 || minute > 59) {
            showError(`Invalid minute: ${minute}. Use 0-59.`);
            return null;
        }
        
        if (hour === 12) hour = 0;
        if (period === 'PM') hour += 12;
        
        return hour * 60 + minute;
    }
    
    showError(`Time format not recognized: "${cleanTime}". Use formats like "2:30 PM" or "14:30"`);
    return null;
}

function validateTaskTimes(startTime, endTime, taskDate) {
    const startMinutes = parseInt(startTime);
    const endMinutes = parseInt(endTime);
    
    let durationMinutes;
    let crossesMidnight = false;
    
    if (endMinutes <= startMinutes) {
        durationMinutes = (24 * 60 - startMinutes) + endMinutes;
        crossesMidnight = true;
    } else {
        durationMinutes = endMinutes - startMinutes;
    }
    
    if (durationMinutes > 18 * 60) {
        return {
            isValid: false,
            error: 'Tasks longer than 18 hours might be too ambitious. Consider breaking it down.',
            suggestion: `Current duration: ${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
        };
    }
    
    if (durationMinutes < 5) {
        return {
            isValid: false,
            error: 'Tasks shorter than 5 minutes might not be worth scheduling separately.',
            suggestion: 'Consider combining with another task or extending the time.'
        };
    }
    
    return {
        isValid: true,
        startMinutes,
        endMinutes,
        durationMinutes,
        crossesMidnight,
        durationText: `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
    };
}

// ============================================================================
// DATA FUNCTIONS
// ============================================================================

async function getTasksForDate(dateString) {
    try {
        const snapshot = await db.collection('tasks')
            .where('date', '==', dateString)
            .get();
        
        const tasks = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.startTime != null && data.endTime != null && data.name) {
                tasks.push({
                    id: doc.id,
                    ...data
                });
            } else {
                console.warn('Corrupted task data found:', doc.id, data);
            }
        });
        
        return tasks;
    } catch (error) {
        console.error('Error getting tasks:', error);
        return [];
    }
}

function checkForOverlaps(startTime, endTime, existingTasks, crossesMidnight) {
    return existingTasks.filter(task => {
        const taskStartTime = task.startTime;
        const taskEndTime = task.endTime;
        const taskCrossesMidnight = task.crossesMidnight || (taskEndTime <= taskStartTime);
        
        if (!crossesMidnight && !taskCrossesMidnight) {
            return (startTime < taskEndTime && endTime > taskStartTime);
        }
        
        if (crossesMidnight && !taskCrossesMidnight) {
            return (startTime <= taskEndTime || endTime >= taskStartTime);
        }
        
        if (!crossesMidnight && taskCrossesMidnight) {
            return (taskStartTime <= endTime || taskEndTime >= startTime);
        }
        
        if (crossesMidnight && taskCrossesMidnight) {
            return true;
        }
        
        return false;
    });
}

// ============================================================================
// DISPLAY FUNCTIONS
// ============================================================================

function updateDateDisplay() {
    const dateDisplay = document.getElementById('current-date-display');
    const datePicker = document.getElementById('date-picker');
    
    if (dateDisplay) {
        dateDisplay.textContent = formatDateDisplay(currentViewDate);
    }
    if (datePicker) {
        datePicker.value = getDateString(currentViewDate);
    }
}

function generateSchedule() {
    const scheduleGrid = document.querySelector('.schedule-grid');
    const startTimeSelect = document.getElementById('task-start-time');
    const endTimeSelect = document.getElementById('task-end-time');
    
    if (scheduleGrid) scheduleGrid.innerHTML = '';
    if (startTimeSelect) startTimeSelect.innerHTML = '';
    if (endTimeSelect) endTimeSelect.innerHTML = '';
    
    // Generate hourly time slots for display
    for (let hour = SCHEDULE_START_HOUR; hour <= SCHEDULE_END_HOUR; hour++) {
        if (scheduleGrid) {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'time-slot';
            timeSlot.setAttribute('data-hour', hour);
            
            const timeLabel = document.createElement('div');
            timeLabel.className = 'time-label';
            timeLabel.textContent = formatHour(hour);
            
            const taskArea = document.createElement('div');
            taskArea.className = 'task-area';
            taskArea.textContent = 'No tasks scheduled';
            
            timeSlot.appendChild(timeLabel);
            timeSlot.appendChild(taskArea);
            scheduleGrid.appendChild(timeSlot);
        }
    }
    
    // Generate 15-minute intervals for dropdowns
    if (startTimeSelect && endTimeSelect) {
        for (let hour = SCHEDULE_START_HOUR; hour <= SCHEDULE_END_HOUR; hour++) {
            for (let minute = 0; minute < 60; minute += 15) {
                const timeValue = hour * 60 + minute;
                const timeText = formatTimeFromMinutes(timeValue);
                
                const startOption = document.createElement('option');
                startOption.value = timeValue;
                startOption.textContent = timeText;
                startTimeSelect.appendChild(startOption);
                
                const endOption = document.createElement('option');
                endOption.value = timeValue;
                endOption.textContent = timeText;
                endTimeSelect.appendChild(endOption);
            }
        }
        
        if (endTimeSelect.children.length > 4) {
            endTimeSelect.selectedIndex = 4;
        }
    }
}

function highlightCurrentTimeSlot() {
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const viewingDate = new Date(currentViewDate);
    viewingDate.setHours(0, 0, 0, 0);
    
    const isToday = today.getTime() === viewingDate.getTime();
    
    const timeSlots = document.querySelectorAll('.time-slot');
    timeSlots.forEach(slot => {
        slot.classList.remove('current-time-slot');
    });
    
    if (isToday) {
        const currentHour = now.getHours();
        const currentSlot = document.querySelector(`[data-hour="${currentHour}"]`);
        if (currentSlot) {
            currentSlot.classList.add('current-time-slot');
        }
    }
}

function updateCurrentTime() {
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
    highlightCurrentTimeSlot();
}

function updateScheduleDisplay(tasks) {
    const now = new Date();
    const isToday = getDateString(currentViewDate) === getDateString(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    // Clear all task areas first
    const taskAreas = document.querySelectorAll('.task-area');
    taskAreas.forEach(area => {
        area.innerHTML = 'No tasks scheduled';
        area.style.color = '#666';
    });
    
    const timeSlots = document.querySelectorAll('.time-slot');
    timeSlots.forEach(slot => {
        slot.classList.remove('overdue-task');
    });
    
    // Group tasks by starting hour for display
    const tasksByHour = {};
    
    tasks.forEach(task => {
        const startHour = Math.floor(task.startTime / 60);
        if (!tasksByHour[startHour]) {
            tasksByHour[startHour] = [];
        }
        tasksByHour[startHour].push(task);
    });
    
    // Display tasks in their starting hour slots
    Object.keys(tasksByHour).forEach(hour => {
        const hourTasks = tasksByHour[hour];
        const timeSlot = document.querySelector(`[data-hour="${hour}"]`);
        
        if (timeSlot) {
            const taskArea = timeSlot.querySelector('.task-area');
            let taskHTML = '';
            
            hourTasks.forEach(task => {
                const priorityLabel = task.priority === 'fixed' ? '🔒' : '⏰';
                const completionStatus = task.completed ? '✅' : '⭕';
                
                const timeDisplay = formatTimeRange(task.startTime, task.endTime);
                const crossMidnightIndicator = (task.crossesMidnight || task.endTime <= task.startTime) ? ' 🌙' : '';
                
                let isOverdue = false;
                if (isToday && task.priority === 'fixed' && !task.completed) {
                    if (task.crossesMidnight || task.endTime <= task.startTime) {
                        isOverdue = currentMinutes > task.endTime && currentMinutes < 12 * 60;
                    } else {
                        isOverdue = currentMinutes > task.endTime;
                    }
                }
                
                let overdueLabel = '';
                if (isOverdue) {
                    overdueLabel = '<span class="overdue-label">OVERDUE</span>';
                    timeSlot.classList.add('overdue-task');
                }
                
                const escapedTaskName = task.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const jsEscapedName = task.name.replace(/'/g, "\\'").replace(/"/g, '\\"');
                
                taskHTML += `
                    <div style="margin-bottom: 8px; padding: 8px; border-left: 3px solid ${task.priority === 'fixed' ? '#d32f2f' : '#1976d2'}; background-color: ${task.completed ? '#f0f8f0' : '#f9f9f9'};">
                        <div>${priorityLabel} <strong>${escapedTaskName}</strong> ${completionStatus} ${crossMidnightIndicator} ${overdueLabel}</div>
                        <div style="font-size: 12px; color: #666; margin-top: 4px;">${timeDisplay}</div>
                        ${task.duration ? `<div style="font-size: 11px; color: #888; font-style: italic;">Duration: ${Math.floor(task.duration / 60)}h ${task.duration % 60}m</div>` : ''}
                        <div style="margin-top: 6px;">
                            <button onclick="toggleTaskCompletion('${task.id}')" style="padding: 2px 6px; font-size: 11px; margin-right: 4px; cursor: pointer;">
                                ${task.completed ? 'Undo' : 'Done'}
                            </button>
                            <button onclick="editTask('${task.id}', '${jsEscapedName}', ${task.startTime}, ${task.endTime}, '${task.priority}')" style="padding: 2px 6px; font-size: 11px; background-color: #17a2b8; margin-right: 4px; cursor: pointer;">
                                ✏️
                            </button>
                            <button onclick="deleteTask('${task.id}')" style="padding: 2px 6px; font-size: 11px; background-color: #dc3545; cursor: pointer;">
                                ×
                            </button>
                        </div>
                    </div>
                `;
            });
            
            if (taskHTML) {
                taskArea.innerHTML = taskHTML;
                taskArea.style.color = '#333';
            }
        }
    });
}

// ============================================================================
// TASK MANAGEMENT FUNCTIONS (Global scope for HTML onclick)
// ============================================================================

async function addTask(taskName, startTime, endTime, taskPriority) {
    if (!taskName || !taskName.trim()) {
        showError('Please enter a task name');
        return;
    }

    let cleanTaskName = taskName.trim();
    cleanTaskName = cleanTaskName.replace(/[\u200B-\u200D\uFEFF]/g, '');
    cleanTaskName = cleanTaskName.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    cleanTaskName = cleanTaskName.replace(/\s+/g, ' ');

    if (cleanTaskName.length === 0) {
        showError('Task name cannot be empty after cleaning');
        return;
    }

    if (cleanTaskName.length > 100) {
        showError(`Task name is too long (${cleanTaskName.length} characters). Please keep it under 100 characters.`);
        return;
    }

    if (!/[a-zA-Z0-9]/.test(cleanTaskName)) {
        showError('Task name must contain at least some letters or numbers');
        return;
    }
    
    if (!taskPriority) {
        showError('Please select a task priority');
        return;
    }
    
    const manualStart = document.getElementById('task-start-manual')?.value;
    const manualEnd = document.getElementById('task-end-manual')?.value;
    
    let finalStartTime = startTime;
    let finalEndTime = endTime;
    
    if (manualStart) {
        const parsedStart = parseManualTime(manualStart);
        if (parsedStart === null) return;
        finalStartTime = parsedStart;
    }
    
    if (manualEnd) {
        const parsedEnd = parseManualTime(manualEnd);
        if (parsedEnd === null) return;
        finalEndTime = parsedEnd;
    }
    
    const validation = validateTaskTimes(finalStartTime, finalEndTime, currentViewDate);
    if (!validation.isValid) {
        showError(validation.error + (validation.suggestion ? '\n\n' + validation.suggestion : ''));
        return;
    }
    
    if (validation.crossesMidnight) {
        const timeRange = formatTimeRange(validation.startMinutes, validation.endMinutes);
        if (!confirm(`This task crosses midnight: ${timeRange}\nDuration: ${validation.durationText}\n\nContinue?`)) {
            return;
        }
    }
    
    const existingTasks = await getTasksForDate(getDateString(currentViewDate));
    const overlaps = checkForOverlaps(validation.startMinutes, validation.endMinutes, existingTasks, validation.crossesMidnight);
    
    if (overlaps.length > 0 && !confirm(
        `This task may overlap with: ${overlaps.map(t => t.name).join(', ')}\n\nDo you want to create it anyway?`
    )) {
        return;
    }
    
    const newTask = {
        name: cleanTaskName,
        startTime: validation.startMinutes,
        endTime: validation.endMinutes,
        priority: taskPriority,
        completed: false,
        date: getDateString(currentViewDate),
        crossesMidnight: validation.crossesMidnight,
        duration: validation.durationMinutes,
        createdAt: new Date().toISOString(),
        version: 1
    };
    
    try {
        setLoadingState(true);
        await db.collection('tasks').add(newTask);
        
        const taskForm = document.getElementById('task-form');
        if (taskForm) taskForm.reset();
        
        const successMsg = validation.crossesMidnight 
            ? `Cross-midnight task "${cleanTaskName}" added! (${validation.durationText})`
            : `Task "${cleanTaskName}" added! (${validation.durationText})`;
        showSuccess(successMsg);
        
        loadTasks();
    } catch (error) {
        console.error('Error adding task:', error);
        
        if (error.code === 'permission-denied') {
            showError('Access denied. Please check your internet connection and try again.');
        } else if (error.code === 'quota-exceeded') {
            showError('Storage quota exceeded. Please delete some old tasks.');
        } else {
            showError('Failed to add task. Please check your internet connection and try again.');
        }
    } finally {
        setLoadingState(false);
    }
}

// Make functions globally accessible for HTML onclick
window.toggleTaskCompletion = async function(taskId) {
    try {
        setLoadingState(true);
        const taskRef = db.collection('tasks').doc(taskId);
        const doc = await taskRef.get();
        
        if (doc.exists) {
            const currentStatus = doc.data().completed;
            await taskRef.update({
                completed: !currentStatus
            });
            loadTasks();
        }
    } catch (error) {
        console.error('Error updating task:', error);
        showError('Failed to update task. Please try again.');
    } finally {
        setLoadingState(false);
    }
};

window.deleteTask = async function(taskId) {
    if (confirm('Are you sure you want to delete this task?')) {
        try {
            setLoadingState(true);
            await db.collection('tasks').doc(taskId).delete();
            loadTasks();
            showSuccess('Task deleted successfully');
        } catch (error) {
            console.error('Error deleting task:', error);
            showError('Failed to delete task. Please try again.');
        } finally {
            setLoadingState(false);
        }
    }
};

window.editTask = function(taskId, currentName, currentStartTime, currentEndTime, currentPriority) {
    const startHour = Math.floor(currentStartTime / 60);
    const timeSlot = document.querySelector(`[data-hour="${startHour}"]`);
    
    if (timeSlot) {
        const taskArea = timeSlot.querySelector('.task-area');
        
        let startTimeOptions = '';
        for (let hour = SCHEDULE_START_HOUR; hour <= SCHEDULE_END_HOUR; hour++) {
            for (let minute = 0; minute < 60; minute += 15) {
                const timeValue = hour * 60 + minute;
                const selected = timeValue === currentStartTime ? 'selected' : '';
                startTimeOptions += `<option value="${timeValue}" ${selected}>${formatTimeFromMinutes(timeValue)}</option>`;
            }
        }
        
        let endTimeOptions = '';
        for (let hour = SCHEDULE_START_HOUR; hour <= SCHEDULE_END_HOUR; hour++) {
            for (let minute = 0; minute < 60; minute += 15) {
                const timeValue = hour * 60 + minute;
                const selected = timeValue === currentEndTime ? 'selected' : '';
                endTimeOptions += `<option value="${timeValue}" ${selected}>${formatTimeFromMinutes(timeValue)}</option>`;
            }
        }
        
        const escapedName = currentName.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        
        taskArea.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 2px solid #007bff; border-radius: 8px; background-color: #f8f9ff;">
                <strong>Editing Task:</strong>
                <input type="text" id="edit-name-${taskId}" value="${escapedName}" style="padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
                
                <div style="display: flex; gap: 8px;">
                    <div style="flex: 1;">
                        <label style="font-size: 12px; font-weight: bold;">Start Time:</label>
                        <select id="edit-start-time-${taskId}" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px;">
                            ${startTimeOptions}
                        </select>
                    </div>
                    <div style="flex: 1;">
                        <label style="font-size: 12px; font-weight: bold;">End Time:</label>
                        <select id="edit-end-time-${taskId}" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px;">
                            ${endTimeOptions}
                        </select>
                    </div>
                </div>
                
                <div>
                    <label style="font-size: 12px; font-weight: bold;">Priority:</label>
                    <select id="edit-priority-${taskId}" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px;">
                        <option value="fixed" ${currentPriority === 'fixed' ? 'selected' : ''}>🔒 Cannot Skip (Fixed)</option>
                        <option value="flexible" ${currentPriority === 'flexible' ? 'selected' : ''}>⏰ Can Skip (Flexible)</option>
                    </select>
                </div>
                
                <div style="display: flex; gap: 8px;">
                    <button onclick="saveTaskEdit('${taskId}')" style="flex: 1; padding: 8px; font-size: 12px; background-color: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">Save Changes</button>
                    <button onclick="cancelTaskEdit()" style="flex: 1; padding: 8px; font-size: 12px; background-color: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
                </div>
            </div>
        `;
    }
};

window.saveTaskEdit = async function(taskId) {
    const nameInput = document.getElementById(`edit-name-${taskId}`);
    const startTimeSelect = document.getElementById(`edit-start-time-${taskId}`);
    const endTimeSelect = document.getElementById(`edit-end-time-${taskId}`);
    const prioritySelect = document.getElementById(`edit-priority-${taskId}`);
    
    if (!nameInput || !startTimeSelect || !endTimeSelect || !prioritySelect) {
        showError('Edit form elements not found');
        return;
    }
    
    const newName = nameInput.value.trim();
    const newStartTime = parseInt(startTimeSelect.value);
    const newEndTime = parseInt(endTimeSelect.value);
    const newPriority = prioritySelect.value;
    
    if (!newName) {
        showError('Task name cannot be empty');
        return;
    }
    
    const validation = validateTaskTimes(newStartTime, newEndTime, currentViewDate);
    if (!validation.isValid) {
        showError(validation.error);
        return;
    }
    
    try {
        setLoadingState(true);
        await db.collection('tasks').doc(taskId).update({
            name: newName,
            startTime: newStartTime,
            endTime: newEndTime,
            priority: newPriority,
            crossesMidnight: validation.crossesMidnight,
            duration: validation.durationMinutes
        });
        loadTasks();
        showSuccess('Task updated successfully');
    } catch (error) {
        console.error('Error updating task:', error);
        showError('Failed to update task. Please try again.');
    } finally {
        setLoadingState(false);
    }
};

window.cancelTaskEdit = function() {
    loadTasks();
};

// ============================================================================
// DATA LOADING AND NAVIGATION
// ============================================================================

async function loadTasks() {
    try {
        setLoadingState(true);
        const dateString = getDateString(currentViewDate);
        const snapshot = await db.collection('tasks')
            .where('date', '==', dateString)
            .get();
        
        const tasks = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.startTime != null && data.endTime != null && data.name) {
                const task = {
                    id: doc.id,
                    ...data
                };
                
                if (task.crossesMidnight === undefined) {
                    task.crossesMidnight = task.endTime <= task.startTime;
                }
                
                if (task.duration === undefined) {
                    if (task.crossesMidnight) {
                        task.duration = (24 * 60 - task.startTime) + task.endTime;
                    } else {
                        task.duration = task.endTime - task.startTime;
                    }
                }
                
                tasks.push(task);
            } else {
                console.warn('Corrupted task data found:', doc.id, data);
            }
        });
        
        updateScheduleDisplay(tasks);
    } catch (error) {
        console.error('Error loading tasks:', error);
        showError('Failed to load tasks. Please check your internet connection.');
    } finally {
        setLoadingState(false);
    }
}

function goToPreviousDay() {
    currentViewDate.setDate(currentViewDate.getDate() - 1);
    updateDateDisplay();
    loadTasks();
}

function goToNextDay() {
    currentViewDate.setDate(currentViewDate.getDate() + 1);
    updateDateDisplay();
    loadTasks();
}

function goToToday() {
    currentViewDate = new Date();
    updateDateDisplay();
    loadTasks();
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    if (typeof firebase === 'undefined') {
        showError('Firebase is not loaded. Please check your internet connection.');
        return;
    }
    
    generateSchedule();
    updateDateDisplay();
    loadTasks();
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    
    // Form event listener
    const taskForm = document.getElementById('task-form');
    if (taskForm) {
        taskForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const taskName = document.getElementById('task-name')?.value || '';
            const startTime = document.getElementById('task-start-time')?.value || '';
            const endTime = document.getElementById('task-end-time')?.value || '';
            const taskPriority = document.getElementById('task-priority')?.value || '';
            
            addTask(taskName, startTime, endTime, taskPriority);
        });
    }
    
    // Navigation event listeners
    const prevBtn = document.getElementById('prev-day-btn');
    const nextBtn = document.getElementById('next-day-btn');
    const todayBtn = document.getElementById('today-btn');
    const datePicker = document.getElementById('date-picker');
    const currentDateDisplay = document.getElementById('current-date-display');
    
    if (prevBtn) prevBtn.addEventListener('click', goToPreviousDay);
    if (nextBtn) nextBtn.addEventListener('click', goToNextDay);
    if (todayBtn) todayBtn.addEventListener('click', goToToday);
    
    if (datePicker) {
        datePicker.addEventListener('change', function(e) {
            try {
                const selectedValue = e.target.value;
                if (!selectedValue) {
                    showError('Please select a valid date');
                    return;
                }
                
                const selectedDate = new Date(selectedValue + 'T12:00:00');
                
                const today = new Date();
                const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
                const oneYearFromNow = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
                
                if (selectedDate < oneYearAgo) {
                    showError('Cannot schedule tasks more than 1 year in the past');
                    e.target.value = getDateString(currentViewDate);
                    return;
                }
                
                if (selectedDate > oneYearFromNow) {
                    showError('Cannot schedule tasks more than 1 year in the future');
                    e.target.value = getDateString(currentViewDate);
                    return;
                }
                
                currentViewDate = selectedDate;
                updateDateDisplay();
                loadTasks();
                
            } catch (error) {
                console.error('Date picker error:', error);
                showError('Invalid date selected');
                e.target.value = getDateString(currentViewDate);
            }
        });
    }
    
    if (currentDateDisplay) {
        currentDateDisplay.addEventListener('dblclick', goToToday);
    }
});