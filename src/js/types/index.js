// Type definitions using JSDoc comments for better IDE support and documentation

/**
 * @typedef {Object} Task
 * @property {string} id - Unique task identifier
 * @property {string} name - Task name
 * @property {number} startTime - Start time in minutes from midnight
 * @property {number} endTime - End time in minutes from midnight
 * @property {'fixed'|'flexible'} priority - Task priority type
 * @property {boolean} completed - Whether task is completed
 * @property {string} date - Date string in YYYY-MM-DD format
 * @property {boolean} crossesMidnight - Whether task crosses midnight
 * @property {number} duration - Task duration in minutes
 * @property {string} createdAt - ISO string of creation time
 * @property {number} version - Task version for future migrations
 */

/**
 * @typedef {Object} TaskValidationResult
 * @property {boolean} isValid - Whether validation passed
 * @property {string} [error] - Error message if validation failed
 * @property {string} [suggestion] - Suggestion for fixing the error
 * @property {number} [startMinutes] - Validated start time in minutes
 * @property {number} [endMinutes] - Validated end time in minutes
 * @property {number} [durationMinutes] - Task duration in minutes
 * @property {boolean} [crossesMidnight] - Whether task crosses midnight
 * @property {string} [durationText] - Human-readable duration text
 */

/**
 * @typedef {Object} TimeOption
 * @property {number} value - Time value in minutes from midnight
 * @property {string} text - Human-readable time text
 * @property {number} minutes - Same as value (for consistency)
 */

/**
 * @typedef {Object} TaskCategories
 * @property {Task[]} rightNow - Currently active tasks
 * @property {TaskWithTimeUntilStart[]} comingUp - Tasks starting soon
 * @property {Task[]} overdue - Overdue fixed tasks
 * @property {Task[]} completed - Completed tasks
 */

/**
 * @typedef {Task & {hoursUntilStart: number}} TaskWithTimeUntilStart
 * Task with additional property for dashboard display
 */

/**
 * @typedef {Object} FirebaseConfig
 * @property {string} apiKey - Firebase API key
 * @property {string} authDomain - Firebase auth domain
 * @property {string} projectId - Firebase project ID
 * @property {string} storageBucket - Firebase storage bucket
 * @property {string} messagingSenderId - Firebase messaging sender ID
 * @property {string} appId - Firebase app ID
 */

/**
 * @typedef {Object} ScheduleConfig
 * @property {number} START_HOUR - Schedule start hour (0-23)
 * @property {number} END_HOUR - Schedule end hour (0-23)
 * @property {number} PIXELS_PER_MINUTE - Pixels per minute for layout
 */

/**
 * @typedef {Object} TimePickerConfig
 * @property {number} INTERVAL_MINUTES - Time picker interval in minutes
 * @property {number} MAX_DROPDOWN_HEIGHT - Maximum dropdown height in pixels
 */

/**
 * @typedef {Object} TaskValidationConfig
 * @property {number} MAX_NAME_LENGTH - Maximum task name length
 * @property {number} MIN_DURATION_MINUTES - Minimum task duration in minutes
 * @property {number} MAX_DURATION_HOURS - Maximum task duration in hours
 * @property {number} MAX_UPCOMING_HOURS - Hours to look ahead for upcoming tasks
 */

/**
 * @typedef {Object} UIConfig
 * @property {number} ERROR_DISPLAY_DURATION - Error message display duration in ms
 * @property {number} SUCCESS_DISPLAY_DURATION - Success message display duration in ms
 * @property {number} SCROLL_THRESHOLD - Scroll threshold for scroll-to-top button
 * @property {number} FLOATING_BANNER_THRESHOLD - Scroll threshold for floating banner
 * @property {number} DATE_RANGE_YEARS - Allowed date range in years
 */

/**
 * @typedef {Object} TimePicker
 * @property {() => number|null} getValue - Get selected time value in minutes
 * @property {(minutes: number) => void} setValue - Set time value in minutes
 * @property {() => string} getValueAsString - Get selected time as string
 * @property {() => boolean} isValid - Check if current value is valid
 * @property {() => void} reset - Reset to default time
 */

/**
 * @typedef {Object} FloatingBannerController
 * @property {() => void} sync - Sync floating banner content with main content
 * @property {() => void} show - Force show floating banner
 * @property {() => void} hide - Force hide floating banner
 * @property {() => boolean} isFloatingBannerVisible - Check if banner is visible
 */

/**
 * @typedef {Object} ModalEventHandlers
 * @property {() => void} closeTaskModal - Close the task modal
 * @property {(taskId: string, currentStatus: boolean) => Promise<void>} toggleTaskFromModal - Toggle task completion from modal
 * @property {(taskId: string, currentName: string, currentStartTime: number, currentEndTime: number, currentPriority: string) => void} editTaskFromModal - Edit task from modal
 * @property {(taskId: string) => Promise<void>} deleteTaskFromModal - Delete task from modal
 */

// Export types for use in other modules (JSDoc style)
export const Types = {};

// Type guards for runtime type checking
/**
 * @param {any} obj
 * @returns {obj is Task}
 */
export function isTask(obj) {
    return obj && 
           typeof obj.id === 'string' &&
           typeof obj.name === 'string' &&
           typeof obj.startTime === 'number' &&
           typeof obj.endTime === 'number' &&
           (obj.priority === 'fixed' || obj.priority === 'flexible') &&
           typeof obj.completed === 'boolean' &&
           typeof obj.date === 'string';
}

/**
 * @param {any} obj
 * @returns {obj is TaskValidationResult}
 */
export function isTaskValidationResult(obj) {
    return obj && typeof obj.isValid === 'boolean';
}

/**
 * @param {any} obj
 * @returns {obj is TimeOption}
 */
export function isTimeOption(obj) {
    return obj &&
           typeof obj.value === 'number' &&
           typeof obj.text === 'string' &&
           typeof obj.minutes === 'number';
}