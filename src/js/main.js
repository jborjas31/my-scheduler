// Main application entry point
import '../css/style.css';

// Import modules
import { firebaseService } from './services/firebaseService.js';
import { taskManager } from './modules/taskManager.js';
import { uiController } from './modules/uiController.js';
import { initializeDefaultTimePickers } from './modules/timePicker.js';
import { initializeFloatingBanner } from './modules/floatingBanner.js';
import { getDateString, isDateInRange } from './utils/dateUtils.js';
import { showError } from './utils/domUtils.js';

// Global state
let startTimePicker, endTimePicker;
let floatingBannerController;

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Firebase
    if (!firebaseService.initialize()) {
        return;
    }
    
    // Initialize UI
    uiController.generateSchedule();
    uiController.updateDateDisplay();
    
    // Load initial tasks
    loadTasks();
    
    // Start time updates
    uiController.updateCurrentTime();
    setInterval(() => uiController.updateCurrentTime(), 1000);
    
    // Initialize floating banner
    floatingBannerController = initializeFloatingBanner();
    uiController.setFloatingBannerController(floatingBannerController);
    
    // Initialize time pickers
    const timePickers = initializeDefaultTimePickers();
    startTimePicker = timePickers.startTimePicker;
    endTimePicker = timePickers.endTimePicker;
    
    // Initialize event listeners
    initializeEventListeners();
    initializeScrollToTop();
});

// Load tasks and update UI
async function loadTasks() {
    const tasks = await taskManager.loadTasks();
    uiController.updateScheduleDisplay(tasks);
    uiController.updateTaskDashboard(tasks);
}

// Initialize all event listeners
function initializeEventListeners() {
    // Form event listener
    const taskForm = document.getElementById('task-form');
    if (taskForm) {
        taskForm.addEventListener('submit', handleTaskFormSubmit);
    }
    
    // Navigation event listeners
    setupNavigationEventListeners();
    
    // Date picker event listener
    setupDatePickerEventListener();
    
    // Double-click on date to go to today
    const currentDateDisplay = document.getElementById('current-date-display');
    if (currentDateDisplay) {
        currentDateDisplay.addEventListener('dblclick', goToToday);
    }
}

async function handleTaskFormSubmit(e) {
    e.preventDefault();
    
    const taskName = document.getElementById('task-name')?.value || '';
    const taskPriority = document.getElementById('task-priority')?.value || '';
    
    // Get time values from time pickers
    const startTime = startTimePicker?.getValue();
    const endTime = endTimePicker?.getValue();
    
    const success = await taskManager.addTask(taskName, startTime, endTime, taskPriority);
    
    if (success) {
        // Reset form
        const taskForm = document.getElementById('task-form');
        if (taskForm) taskForm.reset();
        
        // Reset time pickers to default values
        if (startTimePicker) startTimePicker.reset();
        if (endTimePicker) endTimePicker.reset();
        
        // Reload tasks
        await loadTasks();
    }
}

function setupNavigationEventListeners() {
    const prevBtn = document.getElementById('prev-day-btn');
    const nextBtn = document.getElementById('next-day-btn');
    const todayBtn = document.getElementById('today-btn');
    
    if (prevBtn) prevBtn.addEventListener('click', goToPreviousDay);
    if (nextBtn) nextBtn.addEventListener('click', goToNextDay);
    if (todayBtn) todayBtn.addEventListener('click', goToToday);
}

function setupDatePickerEventListener() {
    const datePicker = document.getElementById('date-picker');
    if (!datePicker) return;
    
    datePicker.addEventListener('change', function(e) {
        try {
            const selectedValue = e.target.value;
            if (!selectedValue) {
                showError('Please select a valid date');
                return;
            }
            
            const selectedDate = new Date(selectedValue + 'T12:00:00');
            
            if (!isDateInRange(selectedDate)) {
                showError('Cannot schedule tasks more than 1 year in the past or future');
                e.target.value = getDateString(taskManager.getCurrentViewDate());
                return;
            }
            
            taskManager.setCurrentViewDate(selectedDate);
            uiController.updateDateDisplay();
            loadTasks();
            
            // Sync floating banner
            if (floatingBannerController) {
                setTimeout(() => floatingBannerController.sync(), 100);
            }
            
        } catch (error) {
            showError('Invalid date selected');
            e.target.value = getDateString(taskManager.getCurrentViewDate());
        }
    });
}

// Navigation functions
async function goToPreviousDay() {
    const currentDate = taskManager.getCurrentViewDate();
    currentDate.setDate(currentDate.getDate() - 1);
    taskManager.setCurrentViewDate(currentDate);
    uiController.updateDateDisplay();
    await loadTasks();
}

async function goToNextDay() {
    const currentDate = taskManager.getCurrentViewDate();
    currentDate.setDate(currentDate.getDate() + 1);
    taskManager.setCurrentViewDate(currentDate);
    uiController.updateDateDisplay();
    await loadTasks();
}

async function goToToday() {
    const today = new Date();
    const currentViewDate = taskManager.getCurrentViewDate();
    const wasAlreadyToday = getDateString(currentViewDate) === getDateString(today);
    
    taskManager.setCurrentViewDate(today);
    uiController.updateDateDisplay();
    
    if (!wasAlreadyToday) {
        await loadTasks();
        setTimeout(() => {
            scrollToCurrentTime();
        }, 500);
    } else {
        setTimeout(() => {
            scrollToCurrentTime();
        }, 100);
    }
}

function scrollToCurrentTime() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentViewDate = taskManager.getCurrentViewDate();
    
    // First, try to use the current time line if it exists (more precise)
    const currentTimeLine = document.getElementById('current-time-line');
    const isToday = getDateString(currentViewDate) === getDateString(now);
    
    if (isToday && currentTimeLine) {
        // Use the current time line for precise scrolling
        const rect = currentTimeLine.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetPosition = rect.top + scrollTop;
        
        // Calculate offset to center the line on screen
        const windowHeight = window.innerHeight;
        const offsetPosition = Math.max(0, targetPosition - (windowHeight / 2));
        
        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
        
        // Add a visual pulse effect to the current time line
        currentTimeLine.style.transition = 'all 0.6s ease';
        currentTimeLine.style.transform = 'scaleY(2)';
        currentTimeLine.style.boxShadow = '0 0 10px rgba(234, 67, 53, 0.6)';
        
        setTimeout(() => {
            currentTimeLine.style.transform = 'scaleY(1)';
            currentTimeLine.style.boxShadow = '0 1px 3px rgba(234, 67, 53, 0.3)';
            setTimeout(() => {
                currentTimeLine.style.transition = '';
            }, 600);
        }, 300);
        
    } else {
        // Fallback: Find the hour line in the tasks canvas
        const tasksCanvas = document.querySelector('.tasks-canvas');
        const hourLine = tasksCanvas ? tasksCanvas.querySelector(`[data-hour="${currentHour}"]`) : null;
        
        if (hourLine) {
            const rect = hourLine.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const targetPosition = rect.top + scrollTop;
            
            const windowHeight = window.innerHeight;
            const offsetPosition = Math.max(0, targetPosition - (windowHeight / 2));
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
            
            // Add a subtle highlight effect
            hourLine.style.transition = 'all 0.6s ease';
            const originalBackground = hourLine.style.backgroundColor;
            const originalHeight = hourLine.style.height;
            
            hourLine.style.backgroundColor = '#ffc107';
            hourLine.style.height = '4px';
            hourLine.style.boxShadow = '0 0 8px rgba(255, 193, 7, 0.5)';
            
            setTimeout(() => {
                hourLine.style.backgroundColor = originalBackground;
                hourLine.style.height = originalHeight;
                hourLine.style.boxShadow = '';
                setTimeout(() => {
                    hourLine.style.transition = '';
                }, 600);
            }, 1000);
        }
    }
}

// Scroll to top functionality
function initializeScrollToTop() {
    const scrollToTopBtn = document.getElementById('scroll-to-top-btn');
    
    if (!scrollToTopBtn) return;
    
    function toggleScrollButton() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > 300) {
            scrollToTopBtn.classList.add('show');
        } else {
            scrollToTopBtn.classList.remove('show');
        }
    }
    
    function scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }
    
    window.addEventListener('scroll', toggleScrollButton);
    scrollToTopBtn.addEventListener('click', scrollToTop);
    
    toggleScrollButton(); // Initial check
}

// Global functions for HTML onclick handlers (backward compatibility)
window.toggleTaskCompletion = async function(taskId) {
    await taskManager.toggleTaskCompletion(taskId);
    await loadTasks();
};

window.deleteTask = async function(taskId) {
    await taskManager.deleteTask(taskId);
    await loadTasks();
};

window.editTask = function(taskId, currentName, currentStartTime, currentEndTime, currentPriority) {
    uiController.editTask(taskId, currentName, currentStartTime, currentEndTime, currentPriority);
};

window.saveTaskEdit = async function(taskId) {
    await uiController.saveTaskEdit(taskId);
};

window.cancelTaskEdit = function(taskId) {
    uiController.cancelTaskEdit(taskId);
};

// Modal functions
window.closeTaskModal = function() {
    uiController.closeTaskModal();
};

window.toggleTaskFromModal = async function(taskId, currentStatus) {
    uiController.closeTaskModal();
    await toggleTaskCompletion(taskId);
};

window.editTaskFromModal = function(taskId, currentName, currentStartTime, currentEndTime, currentPriority) {
    uiController.closeTaskModal();
    editTask(taskId, currentName, currentStartTime, currentEndTime, currentPriority);
};

window.deleteTaskFromModal = async function(taskId) {
    uiController.closeTaskModal();
    await deleteTask(taskId);
};