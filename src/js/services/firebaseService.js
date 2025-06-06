// Firebase service for data operations
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc } from 'firebase/firestore';
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
            showError('Application configuration error. Please contact support.');
            return false;
        }

        try {
            // Initialize Firebase
            const app = initializeApp(FIREBASE_CONFIG);
            this.db = getFirestore(app);
            this.isInitialized = true;
            return true;
        } catch (error) {
            showError('Failed to initialize database connection.');
            return false;
        }
    }

    async getTasksForDate(dateString) {
        if (!this.isInitialized) {
            throw new Error('Firebase not initialized');
        }

        return await retryOperation(async () => {
            const q = query(collection(this.db, 'tasks'), where('date', '==', dateString));
            const snapshot = await getDocs(q);
            
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
            const docRef = await addDoc(collection(this.db, 'tasks'), {
                ...taskData,
                createdAt: new Date().toISOString(),
                version: 1
            });
            return docRef.id;
        } catch (error) {
            this.handleFirebaseError(error);
            throw error;
        }
    }

    async updateTask(taskId, updates) {
        if (!this.isInitialized) {
            throw new Error('Firebase not initialized');
        }

        try {
            const taskRef = doc(this.db, 'tasks', taskId);
            await updateDoc(taskRef, updates);
            return true;
        } catch (error) {
            this.handleFirebaseError(error);
            throw error;
        }
    }

    async deleteTask(taskId) {
        if (!this.isInitialized) {
            throw new Error('Firebase not initialized');
        }

        try {
            const taskRef = doc(this.db, 'tasks', taskId);
            await deleteDoc(taskRef);
            return true;
        } catch (error) {
            this.handleFirebaseError(error);
            throw error;
        }
    }

    async toggleTaskCompletion(taskId) {
        if (!this.isInitialized) {
            throw new Error('Firebase not initialized');
        }

        try {
            const taskRef = doc(this.db, 'tasks', taskId);
            const docSnap = await getDoc(taskRef);
            
            if (docSnap.exists()) {
                const currentStatus = docSnap.data().completed;
                await updateDoc(taskRef, {
                    completed: !currentStatus
                });
                return !currentStatus;
            }
            throw new Error('Task not found');
        } catch (error) {
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