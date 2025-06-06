// Firebase service for data operations
import { FIREBASE_CONFIG } from '../constants.js';
import { showError } from '../utils/domUtils.js';
import { withErrorHandling, retryOperation, createUserFriendlyError, ERROR_TYPES } from '../utils/errorHandler.js';

class FirebaseService {
    constructor() {
        this.db = null;
        this.isInitialized = false;
    }

    initialize() {
        // Validate configuration
        if (!FIREBASE_CONFIG.apiKey || !FIREBASE_CONFIG.projectId) {
            console.error('Firebase configuration is missing.');
            showError('Application configuration error. Please contact support.');
            return false;
        }

        try {
            // Initialize Firebase
            firebase.initializeApp(FIREBASE_CONFIG);
            this.db = firebase.firestore();
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('Firebase initialization failed:', error);
            showError('Failed to initialize database connection.');
            return false;
        }
    }

    async getTasksForDate(dateString) {
        if (!this.isInitialized) {
            throw new Error('Firebase not initialized');
        }

        return await retryOperation(async () => {
            const snapshot = await this.db.collection('tasks')
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
                    
                    // Ensure crossesMidnight is defined
                    if (task.crossesMidnight === undefined) {
                        task.crossesMidnight = task.endTime <= task.startTime;
                    }
                    
                    // Calculate duration if missing
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
            
            return tasks;
        }, 2, 500);
    }

    async addTask(taskData) {
        if (!this.isInitialized) {
            throw new Error('Firebase not initialized');
        }

        try {
            const docRef = await this.db.collection('tasks').add({
                ...taskData,
                createdAt: new Date().toISOString(),
                version: 1
            });
            return docRef.id;
        } catch (error) {
            console.error('Error adding task:', error);
            this.handleFirebaseError(error);
            throw error;
        }
    }

    async updateTask(taskId, updates) {
        if (!this.isInitialized) {
            throw new Error('Firebase not initialized');
        }

        try {
            const taskRef = this.db.collection('tasks').doc(taskId);
            await taskRef.update(updates);
            return true;
        } catch (error) {
            console.error('Error updating task:', error);
            this.handleFirebaseError(error);
            throw error;
        }
    }

    async deleteTask(taskId) {
        if (!this.isInitialized) {
            throw new Error('Firebase not initialized');
        }

        try {
            await this.db.collection('tasks').doc(taskId).delete();
            return true;
        } catch (error) {
            console.error('Error deleting task:', error);
            this.handleFirebaseError(error);
            throw error;
        }
    }

    async toggleTaskCompletion(taskId) {
        if (!this.isInitialized) {
            throw new Error('Firebase not initialized');
        }

        try {
            const taskRef = this.db.collection('tasks').doc(taskId);
            const doc = await taskRef.get();
            
            if (doc.exists) {
                const currentStatus = doc.data().completed;
                await taskRef.update({
                    completed: !currentStatus
                });
                return !currentStatus;
            }
            throw new Error('Task not found');
        } catch (error) {
            console.error('Error toggling task completion:', error);
            this.handleFirebaseError(error);
            throw error;
        }
    }

    handleFirebaseError(error) {
        if (error.code === 'permission-denied') {
            showError('Access denied. Please check your internet connection and try again.');
        } else if (error.code === 'quota-exceeded') {
            showError('Storage quota exceeded. Please delete some old tasks.');
        } else if (error.code === 'unavailable') {
            showError('Service temporarily unavailable. Please try again later.');
        } else {
            showError('Database operation failed. Please check your internet connection and try again.');
        }
    }
}

// Export a singleton instance
export const firebaseService = new FirebaseService();