/* ==========================================================================
   Leaflet Interactive Map Integration
   Rendering donors, hospitals, and emergency requests geographically
   ========================================================================== */

import { db, isRealFirebaseConfigured, localDb } from './firebase-config.js';
import { getCurrentUser } from './auth.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let map = null;
let markers = [];
let userRadiusCircle = null;

export function initMap(containerId = 'map-container', defaultLat = 9.9252, defaultLng = 78.1198) {
  if (!window.L || !document.getElementById(containerId)) return null;
  
  if (map) {
      map.remove();
      map = null;
  }
  
  map = L.map(containerId).setView([defaultLat, defaultLng], 12);
  
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map);

  setTimeout(() => {
    if (map) map.invalidateSize();
  }, 250);

  return map;
}

function clearMarkers() {
  markers.forEach(m => map.removeLayer(m));
  markers = [];
}

export async function renderMapData() {
  if (!map) return;
  clearMarkers();

  const user = getCurrentUser();
  // Always load local data
  allUsers = localDb.getUsers();
  activeRequests = localDb.getRequests().filter(r => r.status === 'OPEN');

  if (isRealFirebaseConfigured) {
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      usersSnap.forEach(doc => {
        if (!allUsers.find(u => u.uid === doc.id)) {
            allUsers.push(doc.data());
        }
      });
      
      const reqsSnap = await getDocs(collection(db, "requests"));
      reqsSnap.forEach(doc => {
        const data = doc.data();
        if (data.status === 'OPEN' && !activeRequests.find(r => r.requestId === data.requestId)) {
            activeRequests.push(data);
        }
      });
    } catch(e) {
      console.error("Map fetch error:", e);
    }
  }

  // Custom Icons using divIcon
  const createIcon = (type) => {
    let className = 'custom-pin ';
    if (type === 'donor') className += 'pin-donor';
    else if (type === 'emergency') className += 'pin-request';
    else if (type === 'hospital') className += 'pin-hospital';

    return L.divIcon({
      className: className,
      html: type === 'donor' ? '🩸' : (type === 'emergency' ? '🚨' : '🏥'),
      iconSize: [38, 38],
      iconAnchor: [19, 38],
      popupAnchor: [0, -38]
    });
  };

  // Add Donors
  allUsers.forEach(u => {
    if (u.role === 'donor' && u.isAvailable && u.status === 'active' && u.location) {
      const marker = L.marker([u.location.latitude, u.location.longitude], { icon: createIcon('donor') }).addTo(map);
      marker.bindPopup(`
        <div class="popup-card">
          <div class="popup-title">🩸 ${u.bloodGroup} Donor</div>
          <div class="popup-sub">${u.name} (Available)</div>
          ${user && user.role === 'requester' ? `<button class="btn btn-sm btn-primary" onclick="alert('Contacting donor...')">Request Blood</button>` : ''}
        </div>
      `);
      markers.push(marker);
    }
  });

  // Add Requests
  activeRequests.forEach(req => {
    if (req.location) {
      const isEmergency = req.emergencyLevel === 'CRITICAL';
      const marker = L.marker([req.location.latitude, req.location.longitude], { icon: createIcon(isEmergency ? 'emergency' : 'hospital') }).addTo(map);
      marker.bindPopup(`
        <div class="popup-card">
          <div class="popup-title">${isEmergency ? '🚨 EMERGENCY' : '🏥'} ${req.bloodGroup} Needed</div>
          <div class="popup-sub">${req.unitsRequired} Units at ${req.hospitalName}</div>
          <div style="font-size: 0.8rem; margin-bottom: 8px;">Patient: ${req.patientName}</div>
          ${user && user.role === 'donor' ? `<button class="btn btn-sm btn-success w-100" onclick="window.acceptRequestFromMap('${req.requestId}')">Accept Request</button>` : ''}
        </div>
      `);
      markers.push(marker);
    }
  });
  
  // Center map on user if logged in and has location
  if (user && user.location && user.location.latitude && user.location.longitude) {
      map.setView([user.location.latitude, user.location.longitude], 12);
      
      // Draw a 5km radius circle
      if (userRadiusCircle) map.removeLayer(userRadiusCircle);
      userRadiusCircle = L.circle([user.location.latitude, user.location.longitude], {
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 0.05,
          radius: 5000 // 5km
      }).addTo(map);
  } else {
      // Default to Madurai/India center if no specific location
      map.setView([9.9252, 78.1198], 10);
  }
}
