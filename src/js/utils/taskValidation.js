// Task validation utilities
import { TASK_VALIDATION } from '../constants.js';

export function validateTaskName(taskName) {
    if (!taskName || !taskName.trim()) {
        throw new Error('Please enter a task name');
    }

    let cleanTaskName = taskName.trim();
    cleanTaskName = cleanTaskName.replace(/[\u200B-\u200D\uFEFF]/g, '');
    cleanTaskName = cleanTaskName.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    cleanTaskName = cleanTaskName.replace(/\s+/g, ' ');

    if (cleanTaskName.length === 0) {
        throw new Error('Task name cannot be empty after cleaning');
    }

    if (cleanTaskName.length > TASK_VALIDATION.MAX_NAME_LENGTH) {
        throw new Error(`Task name is too long (${cleanTaskName.length} characters). Please keep it under ${TASK_VALIDATION.MAX_NAME_LENGTH} characters.`);
    }

    if (!/[a-zA-Z0-9]/.test(cleanTaskName)) {
        throw new Error('Task name must contain at least some letters or numbers');
    }

    return cleanTaskName;
}

export function validateTaskTimes(startTime, endTime, taskDate) {
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
    
    if (durationMinutes > TASK_VALIDATION.MAX_DURATION_HOURS * 60) {
        return {
            isValid: false,
            error: `Tasks longer than ${TASK_VALIDATION.MAX_DURATION_HOURS} hours might be too ambitious. Consider breaking it down.`,
            suggestion: `Current duration: ${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
        };
    }
    
    if (durationMinutes < TASK_VALIDATION.MIN_DURATION_MINUTES) {
        return {
            isValid: false,
            error: `Tasks shorter than ${TASK_VALIDATION.MIN_DURATION_MINUTES} minutes might not be worth scheduling separately.`,
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

export function checkForOverlaps(startTime, endTime, existingTasks, crossesMidnight) {
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

export function validatePriority(priority) {
    const validPriorities = ['fixed', 'flexible'];
    if (!priority || !validPriorities.includes(priority)) {
        throw new Error('Please select a valid task priority');
    }
    return priority;
}