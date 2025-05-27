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
    document.getElementById('current-date-display').textContent = formatDateDisplay(currentViewDate);
    document.getElementById('date-picker').value = getDateString(currentViewDate);
}

// Function to generate time slots dynamically
function generateSchedule() {
    const scheduleGrid = document.querySelector('.schedule-grid');
    const timeSelect = document.getElementById('task-time');
    
    // Clear existing content
    scheduleGrid.innerHTML = '';
    timeSelect.innerHTML = '';
    
    // Generate time slots
    for (let hour = SCHEDULE_START_HOUR; hour <= SCHEDULE_END_HOUR; hour++) {
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
        
        // Add option to dropdown
        const option = document.createElement('option');
        option.value = hour;
        option.textContent = formatHour(hour);
        timeSelect.appendChild(option);
    }
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
    
    document.getElementById('current-time-display').textContent = timeString;
    highlightCurrentTimeSlot();
}

// Function to add a new task to Firebase
async function addTask(taskName, taskTime, taskPriority) {
    const newTask = {
        name: taskName,
        time: parseInt(taskTime),
        priority: taskPriority,
        completed: false,
        date: getDateString(currentViewDate)
    };
    
    try {
        await db.collection('tasks').add(newTask);
        loadTasks(); // Reload tasks from Firebase
    } catch (error) {
        console.error('Error adding task:', error);
    }
}

// Function to load tasks from Firebase
async function loadTasks() {
    try {
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
    generateSchedule();
    updateDateDisplay();
    loadTasks();
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    
    // Add form event listener
    const taskForm = document.getElementById('task-form');
    taskForm.addEventListener('submit', function(e) {
        e.preventDefault(); // Prevent page refresh
        
        const taskName = document.getElementById('task-name').value;
        const taskTime = document.getElementById('task-time').value;
        const taskPriority = document.getElementById('task-priority').value;
        
        addTask(taskName, taskTime, taskPriority);
        
        // Clear the form
        taskForm.reset();
    });
    
    // Add navigation event listeners
    document.getElementById('prev-day-btn').addEventListener('click', goToPreviousDay);
    document.getElementById('next-day-btn').addEventListener('click', goToNextDay);
    document.getElementById('today-btn').addEventListener('click', goToToday);
    
    // Add date picker event listener
    document.getElementById('date-picker').addEventListener('change', function(e) {
        const selectedDate = new Date(e.target.value);
        // Add one day to compensate for timezone offset
        selectedDate.setDate(selectedDate.getDate() + 1);
        currentViewDate = selectedDate;
        updateDateDisplay();
        loadTasks();
    });
    
    // Add double-click to go to today
    document.getElementById('current-date-display').addEventListener('dblclick', goToToday);
});

// Function to toggle task completion in Firebase
async function toggleTaskCompletion(taskId) {
    try {
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
    }
}

// Update the display function to show completion status and overdue tasks
function updateScheduleDisplay(tasks) {
    const now = new Date();
    const isToday = getDateString(currentViewDate) === getDateString(now);
    const currentHour = now.getHours();
    
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
    
    // Add tasks to their time slots
    tasks.forEach(task => {
        const timeSlot = document.querySelector(`[data-hour="${task.time}"]`);
        if (timeSlot) {
            const taskArea = timeSlot.querySelector('.task-area');
            const priorityLabel = task.priority === 'fixed' ? '🔒' : '⏰';
            const completionStatus = task.completed ? '✅' : '⭕';
            
            // Check if task is overdue (only for today, fixed tasks, not completed, past time)
            const isOverdue = isToday && 
                            task.priority === 'fixed' && 
                            !task.completed && 
                            currentHour > task.time;
            
            let overdueLabel = '';
            if (isOverdue) {
                overdueLabel = '<span class="overdue-label">OVERDUE</span>';
                timeSlot.classList.add('overdue-task');
            }
            
            taskArea.innerHTML = `
                ${priorityLabel} ${task.name} ${completionStatus} ${overdueLabel}
                <button onclick="toggleTaskCompletion('${task.id}')" style="margin-left: 10px; padding: 2px 6px; font-size: 12px;">
                    ${task.completed ? 'Undo' : 'Done'}
                </button>
            `;
            taskArea.style.color = task.priority === 'fixed' ? '#d32f2f' : '#1976d2';
        }
    });
}