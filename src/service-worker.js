// Service Worker for offline functionality
const CACHE_NAME = 'daily-scheduler-v1';
const urlsToCache = [
    './',
    './index.html',
    './css/style.css',
    './js/script.js',
    './manifest.json'
];

// Don't cache Firebase URLs - let them pass through
const FIREBASE_URLS = [
    'firestore.googleapis.com',
    'www.gstatic.com/firebasejs',
    'firebase.googleapis.com',
    'identitytoolkit.googleapis.com'
];

// Helper function to check if URL should bypass cache
function shouldBypassCache(url) {
    return FIREBASE_URLS.some(firebaseUrl => url.includes(firebaseUrl));
}

// Install event - cache resources
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching files');
                return cache.addAll(urlsToCache);
            })
            .catch((error) => {
                console.log('Service Worker: Cache installation failed:', error);
            })
    );
    // Skip waiting to activate immediately
    self.skipWaiting();
});

// Fetch event - serve from cache when offline, but bypass Firebase
self.addEventListener('fetch', (event) => {
    const requestUrl = event.request.url;
    
    // Always let Firebase requests pass through without caching
    if (shouldBypassCache(requestUrl)) {
        return; // Let the request go through normally
    }
    
    // For non-Firebase requests, use cache-first strategy
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached version if available
                if (response) {
                    return response;
                }
                
                // Otherwise fetch from network
                return fetch(event.request).then(
                    (response) => {
                        // Check if we received a valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // Clone the response because it's a stream
                        const responseToCache = response.clone();
                        
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    }
                ).catch(() => {
                    // Return offline page for document requests
                    if (event.request.destination === 'document') {
                        return caches.match('./index.html');
                    }
                });
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Take control of all pages immediately
    self.clients.claim();
});

// Background sync for when connection is restored
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        console.log('Service Worker: Background sync event triggered');
        // Could implement background task syncing here
    }
});

// Push notifications (for future reminder feature)
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: './manifest.json',
            badge: './manifest.json',
            vibrate: [100, 50, 100],
            actions: [
                {
                    action: 'view',
                    title: 'View Schedule'
                },
                {
                    action: 'dismiss',
                    title: 'Dismiss'
                }
            ]
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'view') {
        event.waitUntil(
            clients.openWindow('./')
        );
    }
});