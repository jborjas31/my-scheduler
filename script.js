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

// Current viewing date
let currentViewDate = new Date();

// Configuration for schedule hours
const SCHEDULE_START_HOUR = 0;  // 12 AM (midnight)
const SCHEDULE_END_HOUR = 23;   // 11 PM

// Utility function to show error messages
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    const errorTextSpan = document.getElementById('error-text');
    if (errorDiv && errorTextSpan) {
        errorTextSpan.textContent = message;
        errorDiv.style.display = 'block';
        // Hide error after 5 seconds
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    } else {
        // Fallback to alert if error div doesn't exist
        alert('Error: ' + message);
    }
}

// Utility function to show loading state
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

// Function to format date for display
function formatDateDisplay(date) {
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
}

// Function to get date string for database queries
function getDateString(date) {
    return date.toISOString().split('T')[0];
}

// Function to update date display
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

// Function to generate time slots dynamically
function generateSchedule() {
    const scheduleGrid = document.querySelector('.schedule-grid');
    const startTimeSelect = document.getElementById('task-start-time');
    const endTimeSelect = document.getElementById('task-end-time');
    
    // Clear existing content
    if (scheduleGrid) scheduleGrid.innerHTML = '';
    if (startTimeSelect) startTimeSelect.innerHTML = '';
    if (endTimeSelect) endTimeSelect.innerHTML = '';
    
    // Generate hourly time slots for display
    for (let hour = SCHEDULE_START_HOUR; hour <= SCHEDULE_END_HOUR; hour++) {
        if (scheduleGrid) {
            // Create time slot HTML
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
                const timeValue = hour * 60 + minute; // Store as minutes from midnight
                const timeText = formatTimeFromMinutes(timeValue);
                
                // Add to start time dropdown
                const startOption = document.createElement('option');
                startOption.value = timeValue;
                startOption.textContent = timeText;
                startTimeSelect.appendChild(startOption);
                
                // Add to end time dropdown (skip the very last option to avoid next day)
                if (!(hour === SCHEDULE_END_HOUR && minute === 45)) {
                    const endOption = document.createElement('option');
                    endOption.value = timeValue + 15; // Default to 15 minutes later
                    endOption.textContent = formatTimeFromMinutes(timeValue + 15);
                    endTimeSelect.appendChild(endOption);
                }
            }
        }
    }
}

// Function to format minutes from midnight to readable time
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

// Function to parse manual time input (like "15:43" or "3:43 PM")
function parseManualTime(timeString) {
    if (!timeString) return null;
    
    // Handle 24-hour format (15:43)
    const time24Match = timeString.match(/^(\d{1,2}):(\d{2})$/);
    if (time24Match) {
        const hour = parseInt(time24Match[1]);
        const minute = parseInt(time24Match[2]);
        if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
            return hour * 60 + minute;
        }
    }
    
    // Handle 12-hour format (3:43 PM)
    const time12Match = timeString.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (time12Match) {
        let hour = parseInt(time12Match[1]);
        const minute = parseInt(time12Match[2]);
        const period = time12Match[3].toUpperCase();
        
        if (hour === 12) hour = 0;
        if (period === 'PM') hour += 12;
        
        if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
            return hour * 60 + minute;
        }
    }
    
    return null;
}

// Function to format hour (24-hour to 12-hour with AM/PM)
function formatHour(hour) {
    if (hour === 0) return '12:00 AM';
    if (hour < 12) return `${hour}:00 AM`;
    if (hour === 12) return '12:00 PM';
    return `${hour - 12}:00 PM`;
}

// Function to highlight current time slot (only for today)
function highlightCurrentTimeSlot() {
    const now = new Date();
    const isToday = getDateString(currentViewDate) === getDateString(now);
    
    // Remove existing highlights
    const timeSlots = document.querySelectorAll('.time-slot');
    timeSlots.forEach(slot => {
        slot.classList.remove('current-time-slot');
    });
    
    // Only highlight if viewing today
    if (isToday) {
        const currentHour = now.getHours();
        const currentSlot = document.querySelector(`[data-hour="${currentHour}"]`);
        if (currentSlot) {
            currentSlot.classList.add('current-time-slot');
        }
    }
}

// Function to update the current time display
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

// Function to add a new task to Firebase
async function addTask(taskName, startTime, endTime, taskPriority) {
    if (!taskName || !taskName.trim()) {
        showError('Please enter a task name');
        return;
    }
    
    if (!taskPriority) {
        showError('Please select a task priority');
        return;
    }
    
    // Get manual time inputs if dropdowns are empty or manual inputs are used
    const manualStart = document.getElementById('task-start-manual')?.value;
    const manualEnd = document.getElementById('task-end-manual')?.value;
    
    let finalStartTime = startTime;
    let finalEndTime = endTime;
    
    // Use manual input if provided
    if (manualStart) {
        const parsedStart = parseManualTime(manualStart);
        if (parsedStart !== null) finalStartTime = parsedStart;
    }
    
    if (manualEnd) {
        const parsedEnd = parseManualTime(manualEnd);
        if (parsedEnd !== null) finalEndTime = parsedEnd;
    }
    
    // Validation
    if (finalStartTime >= finalEndTime) {
        showError('End time must be after start time');
        return;
    }
    
    const newTask = {
        name: taskName.trim(),
        startTime: parseInt(finalStartTime),
        endTime: parseInt(finalEndTime),
        priority: taskPriority,
        completed: false,
        date: getDateString(currentViewDate)
    };
    
    try {
        setLoadingState(true);
        await db.collection('tasks').add(newTask);
        loadTasks(); // Reload tasks from Firebase
    } catch (error) {
        console.error('Error adding task:', error);
        showError('Failed to add task. Please check your internet connection.');
    } finally {
        setLoadingState(false);
    }
}

// Function to load tasks from Firebase
async function loadTasks() {
    try {
        setLoadingState(true);
        const dateString = getDateString(currentViewDate);
        const snapshot = await db.collection('tasks')
            .where('date', '==', dateString)
            .get();
        
        const tasks = [];
        snapshot.forEach(doc => {
            tasks.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        updateScheduleDisplay(tasks);
    } catch (error) {
        console.error('Error loading tasks:', error);
        showError('Failed to load tasks. Please check your internet connection.');
    } finally {
        setLoadingState(false);
    }
}

// Navigation functions
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

// Handle form submission
document.addEventListener('DOMContentLoaded', function() {
    // Check if Firebase is available
    if (typeof firebase === 'undefined') {
        showError('Firebase is not loaded. Please check your internet connection.');
        return;
    }
    
    generateSchedule();
    updateDateDisplay();
    loadTasks();
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    
    // Add form event listener
    const taskForm = document.getElementById('task-form');
    if (taskForm) {
        taskForm.addEventListener('submit', function(e) {
            e.preventDefault(); // Prevent page refresh
            
            const taskName = document.getElementById('task-name')?.value || '';
            const startTime = document.getElementById('task-start-time')?.value || '';
            const endTime = document.getElementById('task-end-time')?.value || '';
            const taskPriority = document.getElementById('task-priority')?.value || '';
            
            addTask(taskName, startTime, endTime, taskPriority);
            
            // Clear the form
            taskForm.reset();
        });
    }
    
    // Add navigation event listeners
    const prevBtn = document.getElementById('prev-day-btn');
    const nextBtn = document.getElementById('next-day-btn');
    const todayBtn = document.getElementById('today-btn');
    const datePicker = document.getElementById('date-picker');
    const currentDateDisplay = document.getElementById('current-date-display');
    
    if (prevBtn) prevBtn.addEventListener('click', goToPreviousDay);
    if (nextBtn) nextBtn.addEventListener('click', goToNextDay);
    if (todayBtn) todayBtn.addEventListener('click', goToToday);
    
    // Add date picker event listener
    if (datePicker) {
        datePicker.addEventListener('change', function(e) {
            const selectedDate = new Date(e.target.value);
            // Add one day to compensate for timezone offset
            selectedDate.setDate(selectedDate.getDate() + 1);
            currentViewDate = selectedDate;
            updateDateDisplay();
            loadTasks();
        });
    }
    
    // Add double-click to go to today
    if (currentDateDisplay) {
        currentDateDisplay.addEventListener('dblclick', goToToday);
    }
});

// Function to toggle task completion in Firebase
async function toggleTaskCompletion(taskId) {
    try {
        setLoadingState(true);
        const taskRef = db.collection('tasks').doc(taskId);
        const doc = await taskRef.get();
        
        if (doc.exists) {
            const currentStatus = doc.data().completed;
            await taskRef.update({
                completed: !currentStatus
            });
            loadTasks(); // Reload tasks
        }
    } catch (error) {
        console.error('Error updating task:', error);
        showError('Failed to update task. Please try again.');
    } finally {
        setLoadingState(false);
    }
}

// Function to delete task from Firebase
async function deleteTask(taskId) {
    if (confirm('Are you sure you want to delete this task?')) {
        try {
            setLoadingState(true);
            await db.collection('tasks').doc(taskId).delete();
            loadTasks(); // Reload tasks
        } catch (error) {
            console.error('Error deleting task:', error);
            showError('Failed to delete task. Please try again.');
        } finally {
            setLoadingState(false);
        }
    }
}

// Function to edit task - replace display with form
function editTask(taskId, currentName, currentStartTime, currentEndTime, currentPriority) {
    // Find the time slot where this task is displayed (based on start hour)
    const startHour = Math.floor(currentStartTime / 60);
    const timeSlot = document.querySelector(`[data-hour="${startHour}"]`);
    
    if (timeSlot) {
        const taskArea = timeSlot.querySelector('.task-area');
        
        // Create start time options for select
        let startTimeOptions = '';
        for (let hour = SCHEDULE_START_HOUR; hour <= SCHEDULE_END_HOUR; hour++) {
            for (let minute = 0; minute < 60; minute += 15) {
                const timeValue = hour * 60 + minute;
                const selected = timeValue === currentStartTime ? 'selected' : '';
                startTimeOptions += `<option value="${timeValue}" ${selected}>${formatTimeFromMinutes(timeValue)}</option>`;
            }
        }
        
        // Create end time options for select
        let endTimeOptions = '';
        for (let hour = SCHEDULE_START_HOUR; hour <= SCHEDULE_END_HOUR; hour++) {
            for (let minute = 0; minute < 60; minute += 15) {
                const timeValue = hour * 60 + minute;
                if (timeValue > currentStartTime) { // End time must be after start time
                    const selected = timeValue === currentEndTime ? 'selected' : '';
                    endTimeOptions += `<option value="${timeValue}" ${selected}>${formatTimeFromMinutes(timeValue)}</option>`;
                }
            }
        }
        
        // Escape quotes in task name for HTML attribute
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
}

// Function to save edited task
async function saveTaskEdit(taskId) {
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
    
    if (newStartTime >= newEndTime) {
        showError('End time must be after start time');
        return;
    }
    
    try {
        setLoadingState(true);
        await db.collection('tasks').doc(taskId).update({
            name: newName,
            startTime: newStartTime,
            endTime: newEndTime,
            priority: newPriority
        });
        loadTasks(); // Reload tasks
    } catch (error) {
        console.error('Error updating task:', error);
        showError('Failed to update task. Please try again.');
    } finally {
        setLoadingState(false);
    }
}

// Function to cancel task editing
function cancelTaskEdit() {
    loadTasks(); // Just reload to restore original display
}

// Update the display function to show time-range tasks
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
    
    // Remove overdue styling from all time slots
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
                const startTime = formatTimeFromMinutes(task.startTime);
                const endTime = formatTimeFromMinutes(task.endTime);
                
                // Check if task is overdue (only for today, fixed tasks, not completed, past end time)
                const isOverdue = isToday && 
                                task.priority === 'fixed' && 
                                !task.completed && 
                                currentMinutes > task.endTime;
                
                let overdueLabel = '';
                if (isOverdue) {
                    overdueLabel = '<span class="overdue-label">OVERDUE</span>';
                    timeSlot.classList.add('overdue-task');
                }
                
                // Escape HTML in task name
                const escapedTaskName = task.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                // Escape quotes for JavaScript function call
                const jsEscapedName = task.name.replace(/'/g, "\\'").replace(/"/g, '\\"');
                
                taskHTML += `
                    <div style="margin-bottom: 8px; padding: 8px; border-left: 3px solid ${task.priority === 'fixed' ? '#d32f2f' : '#1976d2'}; background-color: ${task.completed ? '#f0f8f0' : '#f9f9f9'};">
                        <div>${priorityLabel} <strong>${escapedTaskName}</strong> ${completionStatus} ${overdueLabel}</div>
                        <div style="font-size: 12px; color: #666; margin-top: 4px;">${startTime} - ${endTime}</div>
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