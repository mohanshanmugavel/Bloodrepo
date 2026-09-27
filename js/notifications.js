/* ==========================================================================
   Real-Time Notifications System
   Toast Popups & In-App Bell Notifications
   ========================================================================== */

import { localDb, isRealFirebaseConfigured, db } from './firebase-config.js';
import { getCurrentUser } from './auth.js';
import { collection, addDoc, onSnapshot, query, where, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export async function createNotification(notifData) {
  const newNotif = {
    notificationId: 'notif_' + Date.now(),
    recipientUid: notifData.recipientUid,
    title: notifData.title,
    message: notifData.message,
    type: notifData.type, // "EMERGENCY_REQUEST" | "NEW_REQUEST" | "ACCEPTED" | "COMPLETED"
    requestId: notifData.requestId,
    isRead: false,
    createdAt: new Date().toISOString()
  };

  if (isRealFirebaseConfigured) {
    try {
      await addDoc(collection(db, "notifications"), newNotif);
    } catch (err) {
      console.error(err);
    }
  }

  const notifs = localDb.getNotifs();
  notifs.push(newNotif);
  localDb.saveNotifs(notifs);
  
  return newNotif;
}

export function subscribeToNotifications(callback) {
  const user = getCurrentUser();
  if (!user) return;

  if (isRealFirebaseConfigured) {
    const q = query(
      collection(db, "notifications"), 
      where("recipientUid", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    
    return onSnapshot(q, (snapshot) => {
      const notifs = [];
      snapshot.forEach(doc => {
        notifs.push({ id: doc.id, ...doc.data() });
      });
      callback(notifs);
    });
  } else {
    // Local fallback listener
    const updateLocalNotifs = () => {
      const allNotifs = localDb.getNotifs();
      const userNotifs = allNotifs
        .filter(n => n.recipientUid === user.uid)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      callback(userNotifs);
    };
    
    localDb.subscribe(updateLocalNotifs);
    updateLocalNotifs();
    
    return () => {}; // Return empty unsubscribe function
  }
}

export function showToast(title, message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'danger' || type === 'emergency') icon = '🚨';

  toast.innerHTML = `
    <div style="font-size: 1.5rem;">${icon}</div>
    <div>
      <div style="font-weight: 700; margin-bottom: 2px;">${title}</div>
      <div style="font-size: 0.85rem; opacity: 0.9;">${message}</div>
    </div>
  `;

  container.appendChild(toast);

  // Play sound for emergency
  if (type === 'emergency') {
    playEmergencySound();
  }

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => {
      if (container.contains(toast)) {
        container.removeChild(toast);
      }
    }, 300);
  }, 5000);
}

export function playEmergencySound() {
  try {
    // A simple synthesized beep for demo purposes if no audio file is present
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
    oscillator.frequency.setValueAtTime(0, audioCtx.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.3);
  } catch(e) {
    console.log("Audio play blocked or not supported");
  }
}

export async function markNotificationRead(notifId) {
    const notifs = localDb.getNotifs();
    const index = notifs.findIndex(n => n.notificationId === notifId);
    if (index > -1) {
        notifs[index].isRead = true;
        localDb.saveNotifs(notifs);
    }
}
