self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting()); // Activate immediately
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
    if (event.data.type === 'UPDATE_POSITION') {
        self.lastPosition = { lat: event.data.lat, lon: event.data.lon };
        if (!self.backgroundTaskInterval) {
            self.backgroundTaskInterval = setInterval(checkBackgroundTasks, 30000);
        }
    } else if (event.data.type === 'STOP_TRACKING') {
        self.lastPosition = null;
        clearInterval(self.backgroundTaskInterval);
        self.backgroundTaskInterval = null;
    }
});

self.addEventListener('fetch', (event) => {
    // Optional: Cache assets for offline support
});

// Simulated checkpoints
const checkpoints = [
    { lat: 37.7749, lon: -122.4194, name: "Store" },
    { lat: 37.7750, lon: -122.4180, name: "Security Booth" }
];

// Background task to check location and network
function checkBackgroundTasks() {
    if (!self.lastPosition) return;

    // Check network status
    fetch('/').then(() => {
        // Network is online
    }).catch(() => {
        showNotification('No internet connection! Please reconnect.');
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: 'NETWORK_ALERT',
                    message: 'No internet connection! Please reconnect.'
                });
            });
        });
    });

    // Check checkpoints
    checkpoints.forEach(checkpoint => {
        const distance = getDistance(self.lastPosition.lat, self.lastPosition.lon, checkpoint.lat, checkpoint.lon);
        if (distance < 0.1) { // ~100 meters
            showNotification(`You are near ${checkpoint.name}!`);
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'CHECKPOINT_NOTIFICATION',
                        message: `Near ${checkpoint.name}!`
                    });
                });
            });
        }
    });
}

// Calculate distance (in km)
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Show notification
function showNotification(message) {
    if (Notification.permission === 'granted') {
        self.registration.showNotification('SafeWalk Alert', {
            body: message,
            icon: '/icon.png' // Optional: Add an icon in production
        });
    }
}