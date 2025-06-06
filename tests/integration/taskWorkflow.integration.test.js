// Integration tests for complete task workflows
import { TaskManager } from '../../src/js/modules/taskManager.js';
import { firebaseService } from '../../src/js/services/firebaseService.js';
import { uiController } from '../../src/js/modules/uiController.js';
import { cacheService } from '../../src/js/services/cacheService.js';

// Mock Firebase service
jest.mock('../../src/js/services/firebaseService.js', () => ({
    firebaseService: {
        isInitialized: true,
        getTasksForDate: jest.fn(),
        addTask: jest.fn(),
        updateTask: jest.fn(),
        deleteTask: jest.fn(),
        toggleTaskCompletion: jest.fn()
    }
}));

// Mock UI controller
jest.mock('../../src/js/modules/uiController.js', () => ({
    uiController: {
        updateScheduleDisplay: jest.fn(),
        updateTaskDashboard: jest.fn(),
        updateDateDisplay: jest.fn()
    }
}));

// Mock DOM utilities
jest.mock('../../src/js/utils/domUtils.js', () => ({
    showError: jest.fn(),
    showSuccess: jest.fn(),
    setLoadingState: jest.fn()
}));

describe('Task Workflow Integration Tests', () => {
    let taskManager;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();
        
        // Clear cache before each test
        cacheService.clear();
        
        // Create fresh task manager instance
        taskManager = new TaskManager();
        taskManager.currentViewDate = new Date('2024-01-15');
        taskManager.currentTasks = [];
    });

    afterEach(() => {
        // Clean up cache service
        cacheService.clear();
    });

    describe('Task Creation Workflow', () => {
        test('should create task successfully with valid data', async () => {
            // Arrange
            const taskData = {
                name: 'Test Task',
                startTime: 540, // 9:00 AM
                endTime: 600,   // 10:00 AM
                priority: 'medium'
            };

            firebaseService.addTask.mockResolvedValue('task-123');
            firebaseService.getTasksForDate.mockResolvedValue([
                {
                    id: 'task-123',
                    ...taskData,
                    date: '2024-01-15',
                    completed: false,
                    duration: 60,
                    crossesMidnight: false
                }
            ]);

            // Act
            const result = await taskManager.addTask(
                taskData.name,
                taskData.startTime,
                taskData.endTime,
                taskData.priority
            );

            // Assert
            expect(result).toBe(true);
            expect(firebaseService.addTask).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: taskData.name,
                    startTime: taskData.startTime,
                    endTime: taskData.endTime,
                    priority: taskData.priority,
                    date: '2024-01-15',
                    completed: false,
                    duration: 60,
                    crossesMidnight: false
                })
            );
        });

        test('should handle task creation with time validation errors', async () => {
            // Arrange
            const invalidTaskData = {
                name: 'Invalid Task',
                startTime: 600,  // 10:00 AM
                endTime: 540,    // 9:00 AM (before start time)
                priority: 'high'
            };

            // Act
            const result = await taskManager.addTask(
                invalidTaskData.name,
                invalidTaskData.startTime,
                invalidTaskData.endTime,
                invalidTaskData.priority
            );

            // Assert
            expect(result).toBe(false);
            expect(firebaseService.addTask).not.toHaveBeenCalled();
        });

        test('should handle cross-midnight tasks correctly', async () => {
            // Arrange
            const crossMidnightTask = {
                name: 'Night Task',
                startTime: 1380, // 11:00 PM
                endTime: 60,     // 1:00 AM next day
                priority: 'high'
            };

            firebaseService.addTask.mockResolvedValue('task-456');

            // Act
            const result = await taskManager.addTask(
                crossMidnightTask.name,
                crossMidnightTask.startTime,
                crossMidnightTask.endTime,
                crossMidnightTask.priority
            );

            // Assert
            expect(result).toBe(true);
            expect(firebaseService.addTask).toHaveBeenCalledWith(
                expect.objectContaining({
                    crossesMidnight: true,
                    duration: 120 // 1 hour until midnight + 1 hour after midnight
                })
            );
        });
    });

    describe('Task Loading and Caching Workflow', () => {
        test('should load tasks from Firebase and cache them', async () => {
            // Arrange
            const mockTasks = [
                {
                    id: 'task-1',
                    name: 'Task 1',
                    startTime: 540,
                    endTime: 600,
                    date: '2024-01-15',
                    priority: 'high',
                    completed: false
                },
                {
                    id: 'task-2',
                    name: 'Task 2',
                    startTime: 660,
                    endTime: 720,
                    date: '2024-01-15',
                    priority: 'medium',
                    completed: true
                }
            ];

            firebaseService.getTasksForDate.mockResolvedValue(mockTasks);

            // Act - First call
            const result1 = await taskManager.loadTasks();
            
            // Act - Second call (should use cache)
            const result2 = await taskManager.loadTasks();

            // Assert
            expect(result1).toEqual(mockTasks);
            expect(result2).toEqual(mockTasks);
            expect(firebaseService.getTasksForDate).toHaveBeenCalledTimes(1);
            expect(taskManager.currentTasks).toEqual(mockTasks);
        });

        test('should invalidate cache when task is added', async () => {
            // Arrange
            const initialTasks = [
                { id: 'task-1', name: 'Task 1', startTime: 540, endTime: 600 }
            ];
            const updatedTasks = [
                ...initialTasks,
                { id: 'task-2', name: 'Task 2', startTime: 660, endTime: 720 }
            ];

            firebaseService.getTasksForDate
                .mockResolvedValueOnce(initialTasks)
                .mockResolvedValueOnce(updatedTasks);
            firebaseService.addTask.mockResolvedValue('task-2');

            // Act
            await taskManager.loadTasks(); // Load initial tasks
            await taskManager.addTask('Task 2', 660, 720, 'medium'); // Add new task

            // Assert
            expect(firebaseService.getTasksForDate).toHaveBeenCalledTimes(2);
        });
    });

    describe('Task Update Workflow', () => {
        test('should update task and refresh UI', async () => {
            // Arrange
            const taskId = 'task-123';
            const updates = {
                name: 'Updated Task Name',
                startTime: 600,
                endTime: 660,
                priority: 'high'
            };

            firebaseService.updateTask.mockResolvedValue(true);
            firebaseService.getTasksForDate.mockResolvedValue([
                {
                    id: taskId,
                    ...updates,
                    date: '2024-01-15',
                    completed: false
                }
            ]);

            // Act
            const result = await taskManager.updateTask(taskId, updates);

            // Assert
            expect(result).toBe(true);
            expect(firebaseService.updateTask).toHaveBeenCalledWith(taskId, updates);
            expect(uiController.updateScheduleDisplay).toHaveBeenCalled();
            expect(uiController.updateTaskDashboard).toHaveBeenCalled();
        });
    });

    describe('Task Deletion Workflow', () => {
        test('should delete task and refresh UI', async () => {
            // Arrange
            const taskId = 'task-123';
            
            // Mock window.confirm
            global.confirm = jest.fn(() => true);
            
            firebaseService.deleteTask.mockResolvedValue(true);
            firebaseService.getTasksForDate.mockResolvedValue([]);

            // Act
            const result = await taskManager.deleteTask(taskId);

            // Assert
            expect(result).toBe(true);
            expect(global.confirm).toHaveBeenCalledWith('Are you sure you want to delete this task?');
            expect(firebaseService.deleteTask).toHaveBeenCalledWith(taskId);
            expect(uiController.updateScheduleDisplay).toHaveBeenCalled();
            expect(uiController.updateTaskDashboard).toHaveBeenCalled();
        });

        test('should not delete task if user cancels confirmation', async () => {
            // Arrange
            const taskId = 'task-123';
            
            // Mock window.confirm to return false
            global.confirm = jest.fn(() => false);

            // Act
            const result = await taskManager.deleteTask(taskId);

            // Assert
            expect(result).toBe(false);
            expect(firebaseService.deleteTask).not.toHaveBeenCalled();
        });
    });

    describe('Task Completion Toggle Workflow', () => {
        test('should toggle task completion status', async () => {
            // Arrange
            const taskId = 'task-123';
            
            firebaseService.toggleTaskCompletion.mockResolvedValue(true);
            firebaseService.getTasksForDate.mockResolvedValue([
                {
                    id: taskId,
                    name: 'Test Task',
                    completed: true
                }
            ]);

            // Act
            const result = await taskManager.toggleTaskCompletion(taskId);

            // Assert
            expect(result).toBe(true);
            expect(firebaseService.toggleTaskCompletion).toHaveBeenCalledWith(taskId);
        });
    });

    describe('Task Categorization Workflow', () => {
        test('should categorize tasks correctly for dashboard', () => {
            // Arrange
            const now = new Date('2024-01-15T14:30:00'); // 2:30 PM
            const currentTimeMinutes = 14 * 60 + 30; // 870 minutes
            
            // Mock getCurrentTimeMinutes to return current time
            jest.doMock('../../src/js/utils/dateUtils.js', () => ({
                ...jest.requireActual('../../src/js/utils/dateUtils.js'),
                getCurrentTimeMinutes: () => currentTimeMinutes,
                isToday: () => true
            }));

            const tasks = [
                // Currently happening task
                {
                    id: 'task-1',
                    name: 'Current Task',
                    startTime: 840, // 2:00 PM
                    endTime: 900,   // 3:00 PM
                    completed: false
                },
                // Upcoming task
                {
                    id: 'task-2',
                    name: 'Upcoming Task',
                    startTime: 960, // 4:00 PM
                    endTime: 1020,  // 5:00 PM
                    completed: false
                },
                // Completed task
                {
                    id: 'task-3',
                    name: 'Completed Task',
                    startTime: 600, // 10:00 AM
                    endTime: 660,   // 11:00 AM
                    completed: true
                },
                // Overdue task
                {
                    id: 'task-4',
                    name: 'Overdue Task',
                    startTime: 720, // 12:00 PM
                    endTime: 780,   // 1:00 PM
                    completed: false
                }
            ];

            taskManager.currentTasks = tasks;

            // Act
            const categories = taskManager.categorizeTasksForDashboard();

            // Assert
            expect(categories.rightNow).toHaveLength(1);
            expect(categories.rightNow[0].name).toBe('Current Task');
            
            expect(categories.upcoming).toHaveLength(1);
            expect(categories.upcoming[0].name).toBe('Upcoming Task');
            
            expect(categories.completed).toHaveLength(1);
            expect(categories.completed[0].name).toBe('Completed Task');
            
            expect(categories.overdue).toHaveLength(1);
            expect(categories.overdue[0].name).toBe('Overdue Task');
        });
    });

    describe('Error Handling Workflow', () => {
        test('should handle Firebase errors gracefully', async () => {
            // Arrange
            const error = new Error('Firebase connection failed');
            firebaseService.getTasksForDate.mockRejectedValue(error);

            // Act
            const result = await taskManager.loadTasks();

            // Assert
            expect(result).toEqual([]);
            expect(require('../../src/js/utils/domUtils.js').showError)
                .toHaveBeenCalledWith('Failed to load tasks. Please check your internet connection.');
        });
    });
});