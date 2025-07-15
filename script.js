// State variables
let safeMode = false;
let watchId = null;
let lastPosition = null;
let emergencyContact = "";
let map = null;
let marker = null;

// DOM elements
const statusEl = document.getElementById("status");
const safeModeBtn = document.getElementById("safeModeBtn");
const safeBtn = document.getElementById("safeBtn");
const helpBtn = document.getElementById("helpBtn");
const shareBtn = document.getElementById("shareBtn");
const contactInput = document.getElementById("contactInput");
const checkpointStatusEl = document.getElementById("checkpointStatus");

// Simulated checkpoints
const checkpoints = [
  { lat: 37.7749, lon: -122.4194, name: "Store" },
  { lat: 37.775, lon: -122.418, name: "Security Booth" },
];

// Initialize map
function initMap() {
  map = L.map("map").setView([0, 0], 2); // Default view
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
}

// Update status display
function updateStatus(message, color = "bg-blue-100") {
  statusEl.textContent = message;
  statusEl.className = `mb-4 p-4 ${color} rounded shadow text-center`;
}

// Check network status
function checkNetwork() {
  if (!navigator.onLine) {
    updateStatus("No internet connection! Please reconnect.", "bg-red-100");
  } else {
    updateStatus(
      safeMode ? "Safe Mode Active - Tracking Location" : "Safe Mode Inactive",
      "bg-blue-100"
    );
  }
}

// Geolocation handling
function startTracking() {
  if (!navigator.geolocation) {
    updateStatus("Geolocation not supported by your browser.", "bg-red-100");
    return;
  }
  if (!map) initMap();
  watchId = navigator.geolocation.watchPosition(
    (position) => {
      lastPosition = position;
      updateMap(position.coords.latitude, position.coords.longitude);
      checkCheckpoints(position.coords.latitude, position.coords.longitude);
      updateStatus("Safe Mode Active - Tracking Location", "bg-green-100");
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "UPDATE_POSITION",
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      }
    },
    (error) => {
      updateStatus(`Geolocation error: ${error.message}`, "bg-red-100");
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// Stop tracking
function stopTracking() {
  if (watchId) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    updateStatus("Safe Mode Inactive", "bg-blue-100");
    if (marker) {
      map.removeLayer(marker);
      marker = null;
    }
    map.setView([0, 0], 2);
    checkpointStatusEl.textContent = "";
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "STOP_TRACKING" });
    }
  }
}

// Update map with Leaflet
function updateMap(lat, lon) {
  if (!map) initMap();
  map.setView([lat, lon], 15);
  if (marker) {
    marker.setLatLng([lat, lon]);
  } else {
    marker = L.marker([lat, lon]).addTo(map);
  }
}

// Checkpoint detection
function checkCheckpoints(lat, lon) {
  checkpoints.forEach((checkpoint) => {
    const distance = getDistance(lat, lon, checkpoint.lat, checkpoint.lon);
    if (distance < 0.1) {
      // ~100 meters
      checkpointStatusEl.textContent = `Near ${checkpoint.name}!`;
      checkpointStatusEl.className =
        "mt-4 p-4 bg-green-100 rounded shadow text-center";
    }
  });
}

// Calculate distance (in km)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Send message (simulated)
function sendMessage(type) {
  if (!emergencyContact) {
    updateStatus("Please enter an emergency contact email.", "bg-red-100");
    return;
  }
  const message =
    type === "safe"
      ? "I am safe!"
      : "Help me! My location is: " +
        (lastPosition
          ? `${lastPosition.coords.latitude}, ${lastPosition.coords.longitude}`
          : "unknown");
  console.log(`Sending to ${emergencyContact}: ${message}`);
  updateStatus(`Message sent: ${message}`, "bg-green-100");
}

// Generate shareable location link
function generateShareLink() {
  if (lastPosition) {
    const link = `https://maps.google.com/?q=${lastPosition.coords.latitude},${lastPosition.coords.longitude}`;
    navigator.clipboard.writeText(link);
    updateStatus("Location link copied to clipboard!", "bg-green-100");
  } else {
    updateStatus("No location available to share.", "bg-red-100");
  }
}

// Toggle Safe Mode
safeModeBtn.addEventListener("click", () => {
  safeMode = !safeMode;
  if (safeMode) {
    startTracking();
    safeBtn.disabled = false;
    helpBtn.disabled = false;
    shareBtn.disabled = false;
    safeModeBtn.textContent = "Deactivate Safe Mode";
  } else {
    stopTracking();
    safeBtn.disabled = true;
    helpBtn.disabled = true;
    shareBtn.disabled = true;
    safeModeBtn.textContent = "Activate Safe Mode";
  }
  checkNetwork();
});

// Button event listeners
safeBtn.addEventListener("click", () => sendMessage("safe"));
helpBtn.addEventListener("click", () => sendMessage("help"));
shareBtn.addEventListener("click", generateShareLink);
contactInput.addEventListener("input", (e) => {
  emergencyContact = e.target.value;
});

// Network status listener
window.addEventListener("online", checkNetwork);
window.addEventListener("offline", checkNetwork);

// Service Worker registration
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then((registration) => {
      updateStatus(
        safeMode
          ? "Safe Mode Active - Tracking Location"
          : "Safe Mode Inactive",
        "bg-blue-100"
      );
      Notification.requestPermission().then((permission) => {
        if (permission !== "granted") {
          updateStatus(
            "Notifications disabled. Enable them for alerts.",
            "bg-yellow-100"
          );
        }
      });
    })
    .catch((err) => {
      updateStatus(
        "Failed to initialize background tasks. Try refreshing.",
        "bg-red-100"
      );
      console.error("Service Worker registration failed:", err);
    });

  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data.type === "CHECKPOINT_NOTIFICATION") {
      checkpointStatusEl.textContent = event.data.message;
      checkpointStatusEl.className =
        "mt-4 p-4 bg-green-100 rounded shadow text-center";
    } else if (event.data.type === "NETWORK_ALERT") {
      updateStatus(event.data.message, "bg-red-100");
    }
  });
} else {
  updateStatus("Background tasks not supported by your browser.", "bg-red-100");
}

// Initial network check
checkNetwork();
