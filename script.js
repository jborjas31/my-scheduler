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

// Configuration for schedule hours
const SCHEDULE_START_HOUR = 0;  // 12 AM (midnight)
const SCHEDULE_END_HOUR = 23;   // 11 PM

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

// Function to get today's date as string (YYYY-MM-DD)
function getTodayString() {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

// Function to highlight current time slot
function highlightCurrentTimeSlot() {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Remove existing highlights
    const timeSlots = document.querySelectorAll('.time-slot');
    timeSlots.forEach(slot => {
        slot.classList.remove('current-time-slot');
    });
    
    // Add highlight to current time slot
    const currentSlot = document.querySelector(`[data-hour="${currentHour}"]`);
    if (currentSlot) {
        currentSlot.classList.add('current-time-slot');
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
        date: getTodayString() // We'll add this function next
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
        const todayString = getTodayString();
        const snapshot = await db.collection('tasks')
            .where('date', '==', todayString)
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

// Handle form submission
document.addEventListener('DOMContentLoaded', function() {
    generateSchedule();
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

// Update the display function to show completion status
function updateScheduleDisplay(tasks) {
    // Clear all task areas first
    const taskAreas = document.querySelectorAll('.task-area');
    taskAreas.forEach(area => {
        area.innerHTML = 'No tasks scheduled';
        area.style.color = '#666';
    });
    
    // Add tasks to their time slots
    tasks.forEach(task => {
        const timeSlot = document.querySelector(`[data-hour="${task.time}"] .task-area`);
        if (timeSlot) {
            const priorityLabel = task.priority === 'fixed' ? '🔒' : '⏰';
            const completionStatus = task.completed ? '✅' : '⭕';
            
            timeSlot.innerHTML = `
                ${priorityLabel} ${task.name} ${completionStatus}
                <button onclick="toggleTaskCompletion('${task.id}')" style="margin-left: 10px; padding: 2px 6px; font-size: 12px;">
                    ${task.completed ? 'Undo' : 'Done'}
                </button>
            `;
            timeSlot.style.color = task.priority === 'fixed' ? '#d32f2f' : '#1976d2';
        }
    });
}