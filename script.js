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

// Add these functions to your script.js file (you can add them in the UTILITY FUNCTIONS section)

// ============================================================================
// CUSTOM TIME PICKER FUNCTIONS
// ============================================================================

function generateTimeOptions() {
    const options = [];
    for (let hour = 0; hour <= 23; hour++) {
        for (let minute = 0; minute < 60; minute += 15) {
            const minutes = hour * 60 + minute;
            const timeText = formatTimeFromMinutes(minutes);
            options.push({
                value: minutes,
                text: timeText,
                minutes: minutes
            });
        }
    }
    return options;
}

function getCurrentTimeMinutes() {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
}

function findClosestTimeOption(targetMinutes, timeOptions) {
    let closest = timeOptions[0];
    let minDiff = Math.abs(targetMinutes - closest.minutes);
    
    for (let option of timeOptions) {
        const diff = Math.abs(targetMinutes - option.minutes);
        if (diff < minDiff) {
            minDiff = diff;
            closest = option;
        }
    }
    return closest;
}

function initializeTimePicker(inputId, dropdownId, defaultOffsetMinutes = 0) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    
    if (!input || !dropdown) return;
    
    const timeOptions = generateTimeOptions();
    let selectedValue = null;
    let isDropdownOpen = false;
    
    // Set initial default time
    function setDefaultTime() {
        const currentTime = getCurrentTimeMinutes() + defaultOffsetMinutes;
        const closestOption = findClosestTimeOption(currentTime, timeOptions);
        selectedValue = closestOption.value;
        input.value = closestOption.text;
        return closestOption;
    }
    
    // Populate dropdown and center around current time
    function populateDropdown() {
        dropdown.innerHTML = '';
        
        const currentTime = getCurrentTimeMinutes() + defaultOffsetMinutes;
        const closestOption = findClosestTimeOption(currentTime, timeOptions);
        
        timeOptions.forEach((option) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'time-option';
            optionDiv.textContent = option.text;
            optionDiv.dataset.value = option.value;
            
            // REMOVE ALL CURRENT TIME HIGHLIGHTING
            // No more current-time class added - all options look the same
            
            // Mark selected option only
            if (selectedValue !== null && option.value === selectedValue) {
                optionDiv.classList.add('selected');
            }
            
            optionDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                selectTimeOption(option);
            });
            
            dropdown.appendChild(optionDiv);
        });
        
        // Scroll to selected or closest option without special highlighting
        setTimeout(() => {
            const selectedOption = dropdown.querySelector('.selected') ||
                                dropdown.querySelector(`[data-value="${closestOption.value}"]`);
            
            if (selectedOption) {
                // Calculate scroll position to center the option
                const dropdownHeight = dropdown.clientHeight;
                const optionHeight = selectedOption.offsetHeight;
                const optionTop = selectedOption.offsetTop;
                const centerPosition = optionTop - (dropdownHeight / 2) + (optionHeight / 2);
                
                dropdown.scrollTop = Math.max(0, centerPosition);
            }
        }, 10);
    }
    
    function selectTimeOption(option) {
        // Clear ALL previous selections and special classes
        dropdown.querySelectorAll('.time-option').forEach(opt => {
            opt.classList.remove('selected');
            opt.classList.remove('current-time'); // Remove any lingering current-time classes
        });
        
        // Select new option
        const optionDiv = dropdown.querySelector(`[data-value="${option.value}"]`);
        if (optionDiv) {
            optionDiv.classList.add('selected');
        }
        
        selectedValue = option.value;
        input.value = option.text;
        hideDropdown();
    }
    
    function showDropdown() {
        // Hide all other dropdowns first
        document.querySelectorAll('.time-dropdown').forEach(dd => {
            dd.classList.remove('show');
        });
        
        populateDropdown();
        dropdown.classList.add('show');
        isDropdownOpen = true;
    }
    
    function hideDropdown() {
        dropdown.classList.remove('show');
        isDropdownOpen = false;
    }
    
    function validateAndUpdateTime() {
        const inputValue = input.value.trim();
        if (inputValue) {
            const parsedTime = parseManualTime(inputValue);
            if (parsedTime !== null) {
                selectedValue = parsedTime;
                input.value = formatTimeFromMinutes(parsedTime);
                
                // Update selected option in dropdown if it's open
                if (isDropdownOpen) {
                    dropdown.querySelectorAll('.time-option').forEach(opt => {
                        opt.classList.remove('selected');
                    });
                    const matchingOption = dropdown.querySelector(`[data-value="${parsedTime}"]`);
                    if (matchingOption) {
                        matchingOption.classList.add('selected');
                    }
                }
            } else {
                // If parsing failed, revert to previous valid value or default
                if (selectedValue !== null) {
                    input.value = formatTimeFromMinutes(selectedValue);
                } else {
                    setDefaultTime();
                }
            }
        }
    }
    
    // Event listeners
    input.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isDropdownOpen) {
            showDropdown();
        }
    });
    
    input.addEventListener('focus', (e) => {
        // Select all text when focused for easy editing
        setTimeout(() => {
            e.target.select();
        }, 10);
    });
    
    input.addEventListener('input', (e) => {
        // Real-time validation as user types
        const inputValue = e.target.value;
        
        // Try to find matching option while typing
        const matchingOption = timeOptions.find(opt => 
            opt.text.toLowerCase().startsWith(inputValue.toLowerCase())
        );
        
        if (matchingOption && isDropdownOpen) {
            // Update dropdown selection
            dropdown.querySelectorAll('.time-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            const optionDiv = dropdown.querySelector(`[data-value="${matchingOption.value}"]`);
            if (optionDiv) {
                optionDiv.classList.add('selected');
                optionDiv.scrollIntoView({ block: 'nearest' });
            }
        }
    });
    
    input.addEventListener('blur', (e) => {
        // Validate and format the input when user finishes editing
        setTimeout(() => {
            validateAndUpdateTime();
            hideDropdown();
        }, 150); // Delay to allow dropdown clicks
    });
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            validateAndUpdateTime();
            hideDropdown();
            input.blur();
        } else if (e.key === 'Escape') {
            hideDropdown();
            input.blur();
        } else if (e.key === 'ArrowDown' && isDropdownOpen) {
            e.preventDefault();
            const selected = dropdown.querySelector('.selected');
            const next = selected ? selected.nextElementSibling : dropdown.firstElementChild;
            if (next && next.classList.contains('time-option')) {
                const option = timeOptions.find(opt => opt.value == next.dataset.value);
                if (option) selectTimeOption(option);
            }
        } else if (e.key === 'ArrowUp' && isDropdownOpen) {
            e.preventDefault();
            const selected = dropdown.querySelector('.selected');
            const prev = selected ? selected.previousElementSibling : dropdown.lastElementChild;
            if (prev && prev.classList.contains('time-option')) {
                const option = timeOptions.find(opt => opt.value == prev.dataset.value);
                if (option) selectTimeOption(option);
            }
        }
    });
    
    // Initialize with default time
    setDefaultTime();
    
    // Return getter/setter functions
    return {
        getValue: () => selectedValue,
        setValue: (minutes) => {
            const option = timeOptions.find(opt => opt.value === minutes);
            if (option) {
                selectedValue = option.value;
                input.value = option.text;
            }
        },
        getValueAsString: () => input.value,
        isValid: () => {
            if (selectedValue !== null) return true;
            return parseManualTime(input.value) !== null;
        }
    };
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-time-input')) {
        document.querySelectorAll('.time-dropdown').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
    }
});

// Global variables to store time picker instances
let startTimePicker, endTimePicker;

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
    
    // Sync floating banner
    if (floatingBannerController) {
        floatingBannerController.sync();
    }
}

function generateSchedule() {
    const scheduleGrid = document.querySelector('.schedule-grid');
    
    if (!scheduleGrid) return;
    
    // Clear existing content
    scheduleGrid.innerHTML = '';
    
    // Create time labels column
    const timeLabelsColumn = document.createElement('div');
    timeLabelsColumn.className = 'time-labels-column';
    
    // Generate hourly time labels
    for (let hour = SCHEDULE_START_HOUR; hour <= SCHEDULE_END_HOUR; hour++) {
        const timeLabel = document.createElement('div');
        timeLabel.className = 'time-label-item';
        timeLabel.setAttribute('data-hour', hour);
        timeLabel.textContent = formatHour(hour);
        timeLabelsColumn.appendChild(timeLabel);
    }
    
    // Create tasks canvas
    const tasksCanvas = document.createElement('div');
    tasksCanvas.className = 'tasks-canvas';
    
    // Add hour grid lines to canvas
    for (let hour = SCHEDULE_START_HOUR; hour <= SCHEDULE_END_HOUR; hour++) {
        const hourLine = document.createElement('div');
        hourLine.className = 'hour-line';
        hourLine.style.top = `${hour * 60}px`; // 1 pixel per minute
        hourLine.setAttribute('data-hour', hour);
        tasksCanvas.appendChild(hourLine);
    }
    
    // Add current time line if viewing today
    const today = new Date();
    const isToday = getDateString(currentViewDate) === getDateString(today);
    if (isToday) {
        const currentMinutes = today.getHours() * 60 + today.getMinutes();
        const currentTimeLine = document.createElement('div');
        currentTimeLine.className = 'current-time-line';
        currentTimeLine.id = 'current-time-line';
        currentTimeLine.style.top = `${currentMinutes}px`;
        tasksCanvas.appendChild(currentTimeLine);
    }
    
    // Append columns to schedule grid
    scheduleGrid.appendChild(timeLabelsColumn);
    scheduleGrid.appendChild(tasksCanvas);
    
    // Initialize custom time pickers
    initializeTimePickers();
}

function initializeTimePickers() {
    // Initialize start time picker (defaults to current time)
    startTimePicker = initializeTimePicker('task-start-time', 'start-time-dropdown', 0);
    
    // Initialize end time picker (defaults to 1 hour after current time)
    endTimePicker = initializeTimePicker('task-end-time', 'end-time-dropdown', 60);
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
    
    // Update current time line position
    updateCurrentTimeLine();
    
    // Sync floating banner time
    if (floatingBannerController) {
        floatingBannerController.sync();
    }
}

function updateScheduleDisplay(tasks) {
    const tasksCanvas = document.querySelector('.tasks-canvas');
    
    if (!tasksCanvas) return;
    
    // Remove existing task blocks (keep grid lines and current time line)
    const existingTasks = tasksCanvas.querySelectorAll('.task-block');
    existingTasks.forEach(task => task.remove());
    
    if (tasks.length === 0) return;
    
    // Update current time line if viewing today
    updateCurrentTimeLine();
    
    // Detect overlaps and group overlapping tasks
    const overlapGroups = detectTaskOverlaps(tasks);
    
    // Position and display each task
    overlapGroups.forEach(group => {
        positionTaskGroup(group, tasksCanvas);
    });
}

// Helper function to update current time line
function updateCurrentTimeLine() {
    const today = new Date();
    const isToday = getDateString(currentViewDate) === getDateString(today);
    const currentTimeLine = document.getElementById('current-time-line');
    
    if (isToday && currentTimeLine) {
        const currentMinutes = today.getHours() * 60 + today.getMinutes();
        currentTimeLine.style.top = `${currentMinutes}px`;
        currentTimeLine.style.display = 'block';
    } else if (currentTimeLine) {
        currentTimeLine.style.display = 'none';
    }
}

// Helper function to detect overlapping tasks
function detectTaskOverlaps(tasks) {
    const groups = [];
    const processed = new Set();
    
    tasks.forEach((task, index) => {
        if (processed.has(index)) return;
        
        const group = [task];
        processed.add(index);
        
        // Find all tasks that overlap with this one
        for (let i = index + 1; i < tasks.length; i++) {
            if (processed.has(i)) continue;
            
            const otherTask = tasks[i];
            if (tasksOverlap(task, otherTask)) {
                group.push(otherTask);
                processed.add(i);
            }
        }
        
        groups.push(group);
    });
    
    return groups;
}

// Helper function to check if two tasks overlap
function tasksOverlap(task1, task2) {
    const start1 = task1.startTime;
    const end1 = task1.endTime;
    const start2 = task2.startTime;
    const end2 = task2.endTime;
    
    const crosses1 = task1.crossesMidnight || (end1 <= start1);
    const crosses2 = task2.crossesMidnight || (end2 <= start2);
    
    if (!crosses1 && !crosses2) {
        // Neither task crosses midnight
        return (start1 < end2 && end1 > start2);
    }
    
    if (crosses1 && !crosses2) {
        // Only task1 crosses midnight
        return (start1 <= end2 || end1 >= start2);
    }
    
    if (!crosses1 && crosses2) {
        // Only task2 crosses midnight
        return (start2 <= end1 || end2 >= start1);
    }
    
    // Both tasks cross midnight - they always overlap
    return true;
}

// Helper function to position a group of overlapping tasks
function positionTaskGroup(taskGroup, container) {
    const groupSize = taskGroup.length;
    
    taskGroup.forEach((task, index) => {
        const taskBlock = createTaskBlock(task, groupSize, index);
        container.appendChild(taskBlock);
    });
}

// Helper function to create a task block element
function createTaskBlock(task, overlapCount, overlapIndex) {
    const taskBlock = document.createElement('div');
    taskBlock.className = 'task-block';
    taskBlock.setAttribute('data-task-id', task.id);
    
    // Add priority class
    taskBlock.classList.add(task.priority);
    
    // Add completion class
    if (task.completed) {
        taskBlock.classList.add('completed');
    }
    
    // Check if task is overdue
    const now = new Date();
    const isToday = getDateString(currentViewDate) === getDateString(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    if (isToday && task.priority === 'fixed' && !task.completed) {
        let isOverdue = false;
        if (task.crossesMidnight || task.endTime <= task.startTime) {
            isOverdue = currentMinutes > task.endTime && currentMinutes < 12 * 60;
        } else {
            isOverdue = currentMinutes > task.endTime;
        }
        
        if (isOverdue) {
            taskBlock.classList.add('overdue');
        }
    }
    
    // Position the task block
    const startTime = task.startTime;
    const duration = task.duration || (task.crossesMidnight ? 
        (24 * 60 - task.startTime) + task.endTime : 
        task.endTime - task.startTime);

    taskBlock.style.top = `${startTime}px`;
    // Tasks now show their ACTUAL duration - no minimum height
    taskBlock.style.height = `${Math.max(duration, 1)}px`; // Minimum 1px so it's visible

    // Add class based on task size for smart content display
    if (duration < 30) {
        taskBlock.classList.add('task-tiny'); // Less than 30 minutes
    } else if (duration < 60) {
        taskBlock.classList.add('task-short'); // 30-60 minutes
    } else if (duration < 120) {
        taskBlock.classList.add('task-medium'); // 1-2 hours
    } else {
        taskBlock.classList.add('task-long'); // 2+ hours
    }
    
    // Handle overlaps with new staggered system
    if (overlapCount > 1) {
        const maxOverlapGroups = 4; // Support up to 4 overlapping tasks
        const actualOverlapCount = Math.min(overlapCount, maxOverlapGroups);
        taskBlock.classList.add(`overlap-${actualOverlapCount}-${overlapIndex + 1}`);
    }
    
    // Create task content
    const priorityIcon = task.priority === 'fixed' ? '🔒' : '⏰';
    const completionIcon = task.completed ? '✅' : '⭕';
    const crossMidnightIcon = (task.crossesMidnight || task.endTime <= task.startTime) ? ' 🌙' : '';
    
    let overdueLabel = '';
    if (taskBlock.classList.contains('overdue')) {
        overdueLabel = '<span class="overdue-badge">OVERDUE</span>';
    }
    
    const timeDisplay = formatTimeRange(task.startTime, task.endTime);

    // Better duration formatting - always show duration
    let durationText = '';
    if (task.duration) {
        const hours = Math.floor(task.duration / 60);
        const minutes = task.duration % 60;
        
        if (hours === 0) {
            durationText = `${minutes}m`; // Just "45m" for under 1 hour
        } else if (minutes === 0) {
            durationText = `${hours}h`; // Just "2h" for exact hours
        } else {
            durationText = `${hours}h ${minutes}m`; // "1h 30m" for mixed
        }
    }
    
    const escapedTaskName = task.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const jsEscapedName = task.name.replace(/'/g, "\\'").replace(/"/g, '\\"');
    
    taskBlock.innerHTML = `
        <div class="task-content-simple">
            <div class="task-name">
                <span class="priority-icon">${priorityIcon}</span>
                ${escapedTaskName}
                ${completionIcon === '✅' ? '<span class="completion-icon">✓</span>' : ''}
                ${overdueLabel}
            </div>
            <div class="task-time">${timeDisplay}</div>
        </div>
    `;

    // Add click handler to open modal (we'll create this next)
    taskBlock.style.cursor = 'pointer';
    taskBlock.addEventListener('click', () => {
        openTaskModal(task);
    });
    
    return taskBlock;
}

function updateTaskDashboard(tasks) {
    const now = new Date();
    const isToday = getDateString(currentViewDate) === getDateString(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    // Initialize all sections
    const rightNowContent = document.getElementById('right-now-content');
    const comingUpContent = document.getElementById('coming-up-content');
    const overdueContent = document.getElementById('overdue-content');
    const completedContent = document.getElementById('completed-content');
    
    // Clear all sections to start fresh
    if (rightNowContent) rightNowContent.innerHTML = '<p class="no-tasks">No current tasks</p>';
    if (comingUpContent) comingUpContent.innerHTML = '<p class="no-tasks">No upcoming tasks</p>';
    if (overdueContent) overdueContent.innerHTML = '<p class="no-tasks">No overdue tasks</p>';
    if (completedContent) completedContent.innerHTML = '<p class="no-tasks">No completed tasks yet</p>';
    
    // Hide sections by default
    const overdueSection = document.getElementById('overdue-section');
    const completedSection = document.getElementById('completed-section');
    if (overdueSection) overdueSection.style.display = 'none';
    if (completedSection) completedSection.style.display = 'none';
    
    if (!isToday || tasks.length === 0) {
        return; // Don't show dashboard info for other days or when no tasks
    }
    
    // Categorize tasks
    const rightNowTasks = [];
    const comingUpTasks = [];
    const overdueTasks = [];
    const completedTasks = [];
    
    tasks.forEach(task => {
        if (task.completed) {
            completedTasks.push(task);
            return;
        }
        
        const taskStartTime = task.startTime;
        const taskEndTime = task.endTime;
        const taskCrossesMidnight = task.crossesMidnight || (taskEndTime <= taskStartTime);
        
        // Check if task is currently active (Right Now)
        let isCurrentlyActive = false;
        if (taskCrossesMidnight) {
            // For cross-midnight tasks, check if current time is after start OR before end
            isCurrentlyActive = (currentMinutes >= taskStartTime) || (currentMinutes <= taskEndTime);
        } else {
            // For regular tasks, check if current time is between start and end
            isCurrentlyActive = (currentMinutes >= taskStartTime && currentMinutes < taskEndTime);
        }
        
        if (isCurrentlyActive) {
            rightNowTasks.push(task);
            return;
        }
        
        // Check if task is overdue (only for fixed tasks)
        if (task.priority === 'fixed') {
            let isOverdue = false;
            if (taskCrossesMidnight) {
                // For cross-midnight tasks, overdue if current time is after end time and before start time
                isOverdue = (currentMinutes > taskEndTime && currentMinutes < taskStartTime);
            } else {
                // For regular tasks, overdue if current time is after end time
                isOverdue = (currentMinutes >= taskEndTime);
            }
            
            if (isOverdue) {
                overdueTasks.push(task);
                return;
            }
        }
        
        // Check if task is coming up (starts within next 3 hours)
        const hoursUntilStart = taskCrossesMidnight 
            ? (taskStartTime >= currentMinutes ? (taskStartTime - currentMinutes) : (24 * 60 - currentMinutes + taskStartTime))
            : (taskStartTime - currentMinutes);
        
        if (hoursUntilStart > 0 && hoursUntilStart <= 180) { // 3 hours = 180 minutes
            comingUpTasks.push({ ...task, hoursUntilStart });
        }
    });
    
    // Populate Right Now section
    if (rightNowTasks.length > 0 && rightNowContent) {
        rightNowContent.innerHTML = rightNowTasks.map(task => {
            const priorityIcon = task.priority === 'fixed' ? '🔒' : '⏰';
            const timeRange = formatTimeRange(task.startTime, task.endTime);
            const crossMidnightIndicator = (task.crossesMidnight || task.endTime <= task.startTime) ? ' 🌙' : '';
            
            return `
                <div class="dashboard-task current ${task.priority}">
                    <div class="task-name">
                        <span class="priority-badge">${priorityIcon}</span>
                        ${task.name}
                        ${crossMidnightIndicator}
                    </div>
                    <div class="task-time">${timeRange}</div>
                    <div class="task-status">⚡ Active now - Focus on this!</div>
                </div>
            `;
        }).join('');
    }
    
    // Populate Coming Up section
    if (comingUpTasks.length > 0 && comingUpContent) {
        // Sort by start time
        comingUpTasks.sort((a, b) => a.hoursUntilStart - b.hoursUntilStart);
        
        comingUpContent.innerHTML = comingUpTasks.slice(0, 3).map(task => { // Show max 3 upcoming tasks
            const priorityIcon = task.priority === 'fixed' ? '🔒' : '⏰';
            const timeRange = formatTimeRange(task.startTime, task.endTime);
            const crossMidnightIndicator = (task.crossesMidnight || task.endTime <= task.startTime) ? ' 🌙' : '';
            
            const hoursUntil = Math.floor(task.hoursUntilStart / 60);
            const minutesUntil = Math.floor(task.hoursUntilStart % 60);
            let timeUntilText = '';
            if (hoursUntil > 0) {
                timeUntilText = `in ${hoursUntil}h ${minutesUntil}m`;
            } else {
                timeUntilText = `in ${minutesUntil}m`;
            }
            
            return `
                <div class="dashboard-task ${task.priority}">
                    <div class="task-name">
                        <span class="priority-badge">${priorityIcon}</span>
                        ${task.name}
                        ${crossMidnightIndicator}
                    </div>
                    <div class="task-time">${timeRange}</div>
                    <div class="task-status">📅 Starts ${timeUntilText}</div>
                </div>
            `;
        }).join('');
    }
    
    // Populate Overdue section
    if (overdueTasks.length > 0 && overdueContent && overdueSection) {
        overdueSection.style.display = 'block';
        
        overdueContent.innerHTML = `
            <div class="overdue-warning">
                ⚠️ You have ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''} that cannot be skipped!
            </div>
        ` + overdueTasks.map(task => {
            const timeRange = formatTimeRange(task.startTime, task.endTime);
            const crossMidnightIndicator = (task.crossesMidnight || task.endTime <= task.startTime) ? ' 🌙' : '';
            
            // Calculate how long overdue
            const minutesOverdue = task.crossesMidnight 
                ? (currentMinutes > task.endTime ? currentMinutes - task.endTime : 0)
                : (currentMinutes - task.endTime);
            
            const hoursOverdue = Math.floor(minutesOverdue / 60);
            const minsOverdue = minutesOverdue % 60;
            let overdueText = '';
            if (hoursOverdue > 0) {
                overdueText = `${hoursOverdue}h ${minsOverdue}m overdue`;
            } else {
                overdueText = `${minsOverdue}m overdue`;
            }
            
            return `
                <div class="dashboard-task overdue fixed">
                    <div class="task-name">
                        <span class="priority-badge">🔒</span>
                        ${task.name}
                        ${crossMidnightIndicator}
                    </div>
                    <div class="task-time">${timeRange}</div>
                    <div class="task-status">⏰ ${overdueText}</div>
                </div>
            `;
        }).join('');
    }
    
    // Populate Completed section
    if (completedTasks.length > 0 && completedContent && completedSection) {
        completedSection.style.display = 'block';
        
        completedContent.innerHTML = completedTasks.map(task => {
            const priorityIcon = task.priority === 'fixed' ? '🔒' : '⏰';
            const timeRange = formatTimeRange(task.startTime, task.endTime);
            const crossMidnightIndicator = (task.crossesMidnight || task.endTime <= task.startTime) ? ' 🌙' : '';
            
            return `
                <div class="dashboard-task completed ${task.priority}">
                    <div class="task-name">
                        <span class="priority-badge">${priorityIcon}</span>
                        ${task.name}
                        <span class="completion-badge">✅</span>
                        ${crossMidnightIndicator}
                    </div>
                    <div class="task-time">${timeRange}</div>
                    <div class="task-status">🎉 Well done!</div>
                </div>
            `;
        }).join('');
    }
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
    
    // Get values from custom time pickers
    let finalStartTime = startTimePicker.getValue();
    let finalEndTime = endTimePicker.getValue();
    
    // Validate that both time pickers have valid values
    if (finalStartTime === null || finalEndTime === null) {
        showError('Please select valid start and end times');
        return;
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
        
        // Reset time pickers to default values
        initializeTimePickers();
        
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
    // Find the actual task block element
    const taskBlock = document.querySelector(`[data-task-id="${taskId}"]`);
    
    if (!taskBlock) {
        showError('Task not found');
        return;
    }
    
    // Store original content for canceling
    const originalContent = taskBlock.innerHTML;
    taskBlock.setAttribute('data-original-content', originalContent);
    
    // Generate time options for dropdowns
    let startTimeOptions = '';
    let endTimeOptions = '';
    
    for (let hour = SCHEDULE_START_HOUR; hour <= SCHEDULE_END_HOUR; hour++) {
        for (let minute = 0; minute < 60; minute += 15) {
            const timeValue = hour * 60 + minute;
            const timeText = formatTimeFromMinutes(timeValue);
            
            const startSelected = timeValue === currentStartTime ? 'selected' : '';
            const endSelected = timeValue === currentEndTime ? 'selected' : '';
            
            startTimeOptions += `<option value="${timeValue}" ${startSelected}>${timeText}</option>`;
            endTimeOptions += `<option value="${timeValue}" ${endSelected}>${timeText}</option>`;
        }
    }
    
    const escapedName = currentName.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    
    // Replace task content with edit form
    taskBlock.innerHTML = `
        <div class="task-edit-form">
            <div style="margin-bottom: 8px;">
                <strong style="color: #007bff;">✏️ Editing Task</strong>
            </div>
            
            <div style="margin-bottom: 8px;">
                <label style="display: block; font-size: 11px; font-weight: bold; margin-bottom: 2px;">Task Name:</label>
                <input type="text" id="edit-name-${taskId}" value="${escapedName}" 
                       style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px;">
            </div>
            
            <div style="display: flex; gap: 6px; margin-bottom: 8px;">
                <div style="flex: 1;">
                    <label style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 2px;">Start:</label>
                    <select id="edit-start-time-${taskId}" 
                            style="width: 100%; padding: 3px; border: 1px solid #ccc; border-radius: 3px; font-size: 10px;">
                        ${startTimeOptions}
                    </select>
                </div>
                <div style="flex: 1;">
                    <label style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 2px;">End:</label>
                    <select id="edit-end-time-${taskId}" 
                            style="width: 100%; padding: 3px; border: 1px solid #ccc; border-radius: 3px; font-size: 10px;">
                        ${endTimeOptions}
                    </select>
                </div>
            </div>
            
            <div style="margin-bottom: 8px;">
                <label style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 2px;">Priority:</label>
                <select id="edit-priority-${taskId}" 
                        style="width: 100%; padding: 3px; border: 1px solid #ccc; border-radius: 3px; font-size: 10px;">
                    <option value="fixed" ${currentPriority === 'fixed' ? 'selected' : ''}>🔒 Fixed</option>
                    <option value="flexible" ${currentPriority === 'flexible' ? 'selected' : ''}>⏰ Flexible</option>
                </select>
            </div>
            
            <div style="display: flex; gap: 4px;">
                <button onclick="saveTaskEdit('${taskId}')" 
                        style="flex: 1; padding: 6px; font-size: 10px; background-color: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer;">
                    💾 Save
                </button>
                <button onclick="cancelTaskEdit('${taskId}')" 
                        style="flex: 1; padding: 6px; font-size: 10px; background-color: #6c757d; color: white; border: none; border-radius: 3px; cursor: pointer;">
                    ❌ Cancel
                </button>
            </div>
        </div>
    `;
    
    // Add special styling to indicate editing mode
    taskBlock.style.backgroundColor = '#fff8e1';
    taskBlock.style.border = '2px solid #ffc107';
    taskBlock.style.zIndex = '100';
    
    // Focus on the name input
    setTimeout(() => {
        const nameInput = document.getElementById(`edit-name-${taskId}`);
        if (nameInput) {
            nameInput.focus();
            nameInput.select();
        }
    }, 100);
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

window.cancelTaskEdit = function(taskId) {
    const taskBlock = document.querySelector(`[data-task-id="${taskId}"]`);
    
    if (taskBlock) {
        const originalContent = taskBlock.getAttribute('data-original-content');
        if (originalContent) {
            taskBlock.innerHTML = originalContent;
            taskBlock.removeAttribute('data-original-content');
            
            // Remove edit styling
            taskBlock.style.backgroundColor = '';
            taskBlock.style.border = '';
            taskBlock.style.zIndex = '';
        }
    }
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
        updateTaskDashboard(tasks);
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
    
    // Scroll to current time after a short delay to ensure DOM is updated
    setTimeout(() => {
        scrollToCurrentTime();
    }, 300);
}

function scrollToCurrentTime() {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Find the time slot for the current hour
    const currentTimeSlot = document.querySelector(`[data-hour="${currentHour}"]`);
    
    if (currentTimeSlot) {
        // Smooth scroll to the current time slot and center it
        currentTimeSlot.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
        });
        
        // Add a subtle highlight effect to draw attention
        currentTimeSlot.style.transition = 'background-color 0.6s ease';
        const originalBackground = currentTimeSlot.style.backgroundColor;
        
        // Briefly highlight the current time slot
        currentTimeSlot.style.backgroundColor = '#e3f2fd';
        
        setTimeout(() => {
            currentTimeSlot.style.backgroundColor = originalBackground;
            // Remove the transition after the effect
            setTimeout(() => {
                currentTimeSlot.style.transition = '';
            }, 600);
        }, 1000);
    }
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
    
    // Initialize floating banner
    floatingBannerController = initializeFloatingBanner();
    
    // Form event listener
    const taskForm = document.getElementById('task-form');
    if (taskForm) {
        taskForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const taskName = document.getElementById('task-name')?.value || '';
            const taskPriority = document.getElementById('task-priority')?.value || '';
            
            // The time values are now handled by the time pickers
            addTask(taskName, null, null, taskPriority); // startTime and endTime parameters are now unused
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
                
                // Sync floating banner
                if (floatingBannerController) {
                    setTimeout(() => floatingBannerController.sync(), 100);
                }
                
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

    initializeScrollToTop();
});

// ============================================================================
// SCROLL TO TOP FUNCTIONALITY
// ============================================================================

function initializeScrollToTop() {
    const scrollToTopBtn = document.getElementById('scroll-to-top-btn');
    
    if (!scrollToTopBtn) return;
    
    // Show/hide button based on scroll position
    function toggleScrollButton() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > 300) {
            scrollToTopBtn.classList.add('show');
        } else {
            scrollToTopBtn.classList.remove('show');
        }
    }
    
    // Smooth scroll to top
    function scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }
    
    // Event listeners
    window.addEventListener('scroll', toggleScrollButton);
    scrollToTopBtn.addEventListener('click', scrollToTop);
    
    // Initial check
    toggleScrollButton();
}

// ============================================================================
// FLOATING BANNER FUNCTIONALITY
// ============================================================================

function initializeFloatingBanner() {
    const floatingBanner = document.getElementById('floating-banner');
    
    if (!floatingBanner) return;
    
    let isFloatingBannerVisible = false;
    let scrollTimeout;
    
    // Show/hide banner based on scroll position
    function toggleFloatingBanner() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const shouldShow = scrollTop > 200; // Show after scrolling 200px
        
        if (shouldShow && !isFloatingBannerVisible) {
            floatingBanner.classList.add('show');
            document.body.classList.add('floating-banner-visible');
            isFloatingBannerVisible = true;
            
            // Update floating banner content when it becomes visible
            updateFloatingBannerContent();
        } else if (!shouldShow && isFloatingBannerVisible) {
            floatingBanner.classList.remove('show');
            document.body.classList.remove('floating-banner-visible');
            isFloatingBannerVisible = false;
        }
    }
    
    // Throttled scroll handler for better performance
    function handleScroll() {
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
        
        scrollTimeout = setTimeout(toggleFloatingBanner, 10);
    }
    
    // Update floating banner content to match main navigation
    function updateFloatingBannerContent() {
        // Update date displays
        const mainDateDisplay = document.getElementById('current-date-display');
        const floatingDateDisplayDesktop = document.getElementById('floating-current-date-display');
        const floatingDateDisplayMobile = document.getElementById('floating-current-date-display-mobile');
        
        if (mainDateDisplay) {
            const dateText = mainDateDisplay.textContent;
            if (floatingDateDisplayDesktop) floatingDateDisplayDesktop.textContent = dateText;
            if (floatingDateDisplayMobile) floatingDateDisplayMobile.textContent = dateText;
        }
        
        // Update time displays
        const mainTimeDisplay = document.getElementById('current-time-display');
        const floatingTimeDisplayDesktop = document.getElementById('floating-current-time-display');
        const floatingTimeDisplayMobile = document.getElementById('floating-current-time-display-mobile');
        
        if (mainTimeDisplay) {
            const timeText = mainTimeDisplay.textContent;
            if (floatingTimeDisplayDesktop) floatingTimeDisplayDesktop.textContent = timeText;
            if (floatingTimeDisplayMobile) floatingTimeDisplayMobile.textContent = timeText;
        }
        
        // Update date pickers
        const mainDatePicker = document.getElementById('date-picker');
        const floatingDatePickerDesktop = document.getElementById('floating-date-picker');
        const floatingDatePickerMobile = document.getElementById('floating-date-picker-mobile');
        
        if (mainDatePicker) {
            const pickerValue = mainDatePicker.value;
            if (floatingDatePickerDesktop) floatingDatePickerDesktop.value = pickerValue;
            if (floatingDatePickerMobile) floatingDatePickerMobile.value = pickerValue;
        }
    }
    
    // Sync floating banner when main content updates
    function syncFloatingBanner() {
        if (isFloatingBannerVisible) {
            updateFloatingBannerContent();
        }
    }
    
    // Event listeners for floating banner buttons
    function setupFloatingBannerEvents() {
        // Desktop buttons
        const floatingPrevBtn = document.getElementById('floating-prev-day-btn');
        const floatingNextBtn = document.getElementById('floating-next-day-btn');
        const floatingTodayBtn = document.getElementById('floating-today-btn');
        const floatingDatePicker = document.getElementById('floating-date-picker');
        
        // Mobile buttons
        const floatingPrevBtnMobile = document.getElementById('floating-prev-day-btn-mobile');
        const floatingNextBtnMobile = document.getElementById('floating-next-day-btn-mobile');
        const floatingTodayBtnMobile = document.getElementById('floating-today-btn-mobile');
        const floatingDatePickerMobile = document.getElementById('floating-date-picker-mobile');
        
        // Desktop event listeners
        if (floatingPrevBtn) {
            floatingPrevBtn.addEventListener('click', () => {
                goToPreviousDay();
                setTimeout(syncFloatingBanner, 100);
            });
        }
        
        if (floatingNextBtn) {
            floatingNextBtn.addEventListener('click', () => {
                goToNextDay();
                setTimeout(syncFloatingBanner, 100);
            });
        }
        
        if (floatingTodayBtn) {
            floatingTodayBtn.addEventListener('click', () => {
                goToToday();
                setTimeout(syncFloatingBanner, 100);
            });
        }
        
        if (floatingDatePicker) {
            floatingDatePicker.addEventListener('change', (e) => {
                // Update main date picker and trigger its change event
                const mainDatePicker = document.getElementById('date-picker');
                if (mainDatePicker) {
                    mainDatePicker.value = e.target.value;
                    mainDatePicker.dispatchEvent(new Event('change'));
                }
                setTimeout(syncFloatingBanner, 100);
            });
        }
        
        // Mobile event listeners (same functionality)
        if (floatingPrevBtnMobile) {
            floatingPrevBtnMobile.addEventListener('click', () => {
                goToPreviousDay();
                setTimeout(syncFloatingBanner, 100);
            });
        }
        
        if (floatingNextBtnMobile) {
            floatingNextBtnMobile.addEventListener('click', () => {
                goToNextDay();
                setTimeout(syncFloatingBanner, 100);
            });
        }
        
        if (floatingTodayBtnMobile) {
            floatingTodayBtnMobile.addEventListener('click', () => {
                goToToday();
                setTimeout(syncFloatingBanner, 100);
            });
        }
        
        if (floatingDatePickerMobile) {
            floatingDatePickerMobile.addEventListener('change', (e) => {
                // Update main date picker and trigger its change event
                const mainDatePicker = document.getElementById('date-picker');
                if (mainDatePicker) {
                    mainDatePicker.value = e.target.value;
                    mainDatePicker.dispatchEvent(new Event('change'));
                }
                setTimeout(syncFloatingBanner, 100);
            });
        }
    }
    
    // Initialize everything
    window.addEventListener('scroll', handleScroll);
    setupFloatingBannerEvents();
    
    // Initial check
    toggleFloatingBanner();
    
    // Return sync function for use by other parts of the app
    return {
        sync: syncFloatingBanner,
        updateContent: updateFloatingBannerContent
    };
}

// Global floating banner controller
let floatingBannerController;

// ============================================================================
// TASK MODAL FUNCTIONS
// ============================================================================

function openTaskModal(task) {
    // Remove any existing modal
    const existingModal = document.getElementById('task-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'task-modal';
    modalOverlay.className = 'modal-overlay';
    
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
    const priorityText = task.priority === 'fixed' ? '🔒 Cannot Skip (Fixed)' : '⏰ Can Skip (Flexible)';
    const crossMidnightText = (task.crossesMidnight || task.endTime <= task.startTime) ? 
        '<div class="modal-info-item"><span class="modal-label">Special:</span> This task crosses midnight 🌙</div>' : '';
    
    // Check if task is overdue
    const now = new Date();
    const isToday = getDateString(currentViewDate) === getDateString(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    let overdueText = '';
    
    if (isToday && task.priority === 'fixed' && !task.completed) {
        let isOverdue = false;
        if (task.crossesMidnight || task.endTime <= task.startTime) {
            isOverdue = currentMinutes > task.endTime && currentMinutes < 12 * 60;
        } else {
            isOverdue = currentMinutes > task.endTime;
        }
        
        if (isOverdue) {
            const minutesOverdue = task.crossesMidnight 
                ? (currentMinutes > task.endTime ? currentMinutes - task.endTime : 0)
                : (currentMinutes - task.endTime);
            
            const hoursOverdue = Math.floor(minutesOverdue / 60);
            const minsOverdue = minutesOverdue % 60;
            let overdueTime = '';
            if (hoursOverdue > 0) {
                overdueTime = `${hoursOverdue}h ${minsOverdue}m`;
            } else {
                overdueTime = `${minsOverdue}m`;
            }
            
            overdueText = `<div class="modal-overdue-warning">⚠️ This task is ${overdueTime} overdue!</div>`;
        }
    }
    
    // Escape HTML in task name
    const escapedTaskName = task.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    modalOverlay.innerHTML = `
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
                    <button class="modal-btn modal-btn-secondary" onclick="editTaskFromModal('${task.id}', '${task.name.replace(/'/g, "\\'")}', ${task.startTime}, ${task.endTime}, '${task.priority}')">
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
    
    // Add modal to page
    document.body.appendChild(modalOverlay);
    
    // Add click outside to close
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeTaskModal();
        }
    });
    
    // Add escape key to close
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeTaskModal();
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

function closeTaskModal() {
    const modal = document.getElementById('task-modal');
    if (modal) {
        modal.classList.add('modal-closing');
        setTimeout(() => {
            modal.remove();
        }, 150);
    }
}

// Modal action functions
window.toggleTaskFromModal = async function(taskId, currentStatus) {
    closeTaskModal();
    await toggleTaskCompletion(taskId);
};

window.editTaskFromModal = function(taskId, currentName, currentStartTime, currentEndTime, currentPriority) {
    closeTaskModal();
    editTask(taskId, currentName, currentStartTime, currentEndTime, currentPriority);
};

window.deleteTaskFromModal = async function(taskId) {
    closeTaskModal();
    await deleteTask(taskId);
};