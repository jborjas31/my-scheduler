// Task management module
import { firebaseService } from '../services/firebaseService.js';
import { validateTaskName, validateTaskTimes, validatePriority, checkForOverlaps } from '../utils/taskValidation.js';
import { showError, showSuccess, setLoadingState } from '../utils/domUtils.js';
import { getDateString, formatTimeRange, getCurrentTimeMinutes, isToday } from '../utils/dateUtils.js';
import { TASK_VALIDATION, PRIORITY_TYPES, TASK_DURATION_THRESHOLDS } from '../constants.js';

/**
 * @typedef {import('../types/index.js').Task} Task
 * @typedef {import('../types/index.js').TaskCategories} TaskCategories
 */

/**
 * Manages task data and business logic
 * Handles CRUD operations, validation, and task categorization
 */
class TaskManager {
    constructor() {
        /** @type {Date} */
        this.currentViewDate = new Date();
        /** @type {Task[]} */
        this.currentTasks = [];
    }

    getCurrentViewDate() {
        return this.currentViewDate;
    }

    setCurrentViewDate(date) {
        this.currentViewDate = new Date(date);
    }

    async loadTasks() {
        try {
            setLoadingState(true);
            const dateString = getDateString(this.currentViewDate);
            this.currentTasks = await firebaseService.getTasksForDate(dateString);
            return this.currentTasks;
        } catch (error) {
            console.error('Error loading tasks:', error);
            showError('Failed to load tasks. Please check your internet connection.');
            return [];
        } finally {
            setLoadingState(false);
        }
    }

    async addTask(taskName, startTime, endTime, priority) {
        try {
            // Validate inputs
            const cleanTaskName = validateTaskName(taskName);
            const validPriority = validatePriority(priority);
            
            if (startTime === null || endTime === null) {
                throw new Error('Please select valid start and end times');
            }
            
            const validation = validateTaskTimes(startTime, endTime, this.currentViewDate);
            if (!validation.isValid) {
                throw new Error(validation.error + (validation.suggestion ? '\n\n' + validation.suggestion : ''));
            }
            
            // Check for cross-midnight confirmation
            if (validation.crossesMidnight) {
                const timeRange = formatTimeRange(validation.startMinutes, validation.endMinutes);
                if (!confirm(`This task crosses midnight: ${timeRange}\nDuration: ${validation.durationText}\n\nContinue?`)) {
                    return false;
                }
            }
            
            // Check for overlaps
            const existingTasks = await firebaseService.getTasksForDate(getDateString(this.currentViewDate));
            const overlaps = checkForOverlaps(validation.startMinutes, validation.endMinutes, existingTasks, validation.crossesMidnight);
            
            if (overlaps.length > 0 && !confirm(
                `This task may overlap with: ${overlaps.map(t => t.name).join(', ')}\n\nDo you want to create it anyway?`
            )) {
                return false;
            }
            
            // Create task
            const newTask = {
                name: cleanTaskName,
                startTime: validation.startMinutes,
                endTime: validation.endMinutes,
                priority: validPriority,
                completed: false,
                date: getDateString(this.currentViewDate),
                crossesMidnight: validation.crossesMidnight,
                duration: validation.durationMinutes
            };
            
            setLoadingState(true);
            await firebaseService.addTask(newTask);
            
            const successMsg = validation.crossesMidnight 
                ? `Cross-midnight task "${cleanTaskName}" added! (${validation.durationText})`
                : `Task "${cleanTaskName}" added! (${validation.durationText})`;
            showSuccess(successMsg);
            
            // Reload tasks
            await this.loadTasks();
            return true;
            
        } catch (error) {
            console.error('Error adding task:', error);
            showError(error.message || 'Failed to add task. Please try again.');
            return false;
        } finally {
            setLoadingState(false);
        }
    }

    async updateTask(taskId, updates) {
        try {
            setLoadingState(true);
            await firebaseService.updateTask(taskId, updates);
            await this.loadTasks();
            showSuccess('Task updated successfully');
            return true;
        } catch (error) {
            console.error('Error updating task:', error);
            showError('Failed to update task. Please try again.');
            return false;
        } finally {
            setLoadingState(false);
        }
    }

    async deleteTask(taskId) {
        if (!confirm('Are you sure you want to delete this task?')) {
            return false;
        }

        try {
            setLoadingState(true);
            await firebaseService.deleteTask(taskId);
            await this.loadTasks();
            showSuccess('Task deleted successfully');
            return true;
        } catch (error) {
            console.error('Error deleting task:', error);
            showError('Failed to delete task. Please try again.');
            return false;
        } finally {
            setLoadingState(false);
        }
    }

    async toggleTaskCompletion(taskId) {
        try {
            setLoadingState(true);
            await firebaseService.toggleTaskCompletion(taskId);
            await this.loadTasks();
            return true;
        } catch (error) {
            console.error('Error updating task:', error);
            showError('Failed to update task. Please try again.');
            return false;
        } finally {
            setLoadingState(false);
        }
    }

    categorizeTasksForDashboard() {
        if (!isToday(this.currentViewDate)) {
            return {
                rightNow: [],
                comingUp: [],
                overdue: [],
                completed: []
            };
        }

        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        
        const categories = {
            rightNow: [],
            comingUp: [],
            overdue: [],
            completed: []
        };

        this.currentTasks.forEach(task => {
            if (task.completed) {
                categories.completed.push(task);
                return;
            }
            
            const taskStartTime = task.startTime;
            const taskEndTime = task.endTime;
            const taskCrossesMidnight = task.crossesMidnight || (taskEndTime <= taskStartTime);
            
            // Check if task is currently active (Right Now)
            let isCurrentlyActive = false;
            if (taskCrossesMidnight) {
                isCurrentlyActive = (currentMinutes >= taskStartTime) || (currentMinutes <= taskEndTime);
            } else {
                isCurrentlyActive = (currentMinutes >= taskStartTime && currentMinutes < taskEndTime);
            }
            
            if (isCurrentlyActive) {
                categories.rightNow.push(task);
                return;
            }
            
            // Check if task is overdue (only for fixed tasks)
            if (task.priority === PRIORITY_TYPES.FIXED) {
                let isOverdue = false;
                if (taskCrossesMidnight) {
                    isOverdue = (currentMinutes > taskEndTime && currentMinutes < taskStartTime);
                } else {
                    isOverdue = (currentMinutes >= taskEndTime);
                }
                
                if (isOverdue) {
                    categories.overdue.push(task);
                    return;
                }
            }
            
            // Check if task is coming up (starts within next 3 hours)
            const hoursUntilStart = taskCrossesMidnight 
                ? (taskStartTime >= currentMinutes ? (taskStartTime - currentMinutes) : (24 * 60 - currentMinutes + taskStartTime))
                : (taskStartTime - currentMinutes);
            
            if (hoursUntilStart > 0 && hoursUntilStart <= TASK_VALIDATION.MAX_UPCOMING_HOURS * 60) {
                categories.comingUp.push({ ...task, hoursUntilStart });
            }
        });

        // Sort coming up tasks by start time
        categories.comingUp.sort((a, b) => a.hoursUntilStart - b.hoursUntilStart);

        return categories;
    }

    detectTaskOverlaps(tasks) {
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
                if (this.tasksOverlap(task, otherTask)) {
                    group.push(otherTask);
                    processed.add(i);
                }
            }
            
            groups.push(group);
        });
        
        return groups;
    }

    tasksOverlap(task1, task2) {
        const start1 = task1.startTime;
        const end1 = task1.endTime;
        const start2 = task2.startTime;
        const end2 = task2.endTime;
        
        const crosses1 = task1.crossesMidnight || (end1 <= start1);
        const crosses2 = task2.crossesMidnight || (end2 <= start2);
        
        if (!crosses1 && !crosses2) {
            return (start1 < end2 && end1 > start2);
        }
        
        if (crosses1 && !crosses2) {
            return (start1 <= end2 || end1 >= start2);
        }
        
        if (!crosses1 && crosses2) {
            return (start2 <= end1 || end2 >= start1);
        }
        
        return true; // Both cross midnight - they always overlap
    }

    getTaskSizeClass(duration) {
        if (duration < TASK_DURATION_THRESHOLDS.TINY) {
            return 'task-tiny';
        } else if (duration < TASK_DURATION_THRESHOLDS.SHORT) {
            return 'task-short';
        } else if (duration < TASK_DURATION_THRESHOLDS.MEDIUM) {
            return 'task-medium';
        } else {
            return 'task-long';
        }
    }

    isTaskOverdue(task) {
        if (!isToday(this.currentViewDate) || task.priority !== PRIORITY_TYPES.FIXED || task.completed) {
            return false;
        }

        const currentMinutes = getCurrentTimeMinutes();
        
        if (task.crossesMidnight || task.endTime <= task.startTime) {
            return currentMinutes > task.endTime && currentMinutes < 12 * 60;
        } else {
            return currentMinutes > task.endTime;
        }
    }

    getCurrentTasks() {
        return this.currentTasks;
    }
}

// Export singleton instance
export const taskManager = new TaskManager();