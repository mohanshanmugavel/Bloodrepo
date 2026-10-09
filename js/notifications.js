/* ==========================================================================
   Real-Time Notifications System
   Toast Popups, Sound Alerts, Browser Push, In-App Notifications & Management
   ========================================================================== */

import { localDb, isRealFirebaseConfigured, db } from './firebase-config.js';
import { getCurrentUser } from './auth.js';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  getDocs, 
  onSnapshot, 
  query, 
  where 
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let knownNotificationIds = new Set();
let isInitialSubscriptionLoad = true;
let currentListeners = [];

/**
 * Creates and delivers a notification in Firestore and local storage
 */
export async function createNotification(notifData) {
  if (!notifData || !notifData.recipientUid) return null;

  const notificationId = 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const newNotif = {
    notificationId: notificationId,
    id: notificationId,
    recipientUid: notifData.recipientUid,
    title: notifData.title || 'Notification',
    message: notifData.message || '',
    type: notifData.type || 'INFO', // "EMERGENCY_REQUEST" | "NEW_REQUEST" | "DIRECT_REQUEST" | "ACCEPTED" | "COMPLETED" | "REJECTED" | "INFO"
    requestId: notifData.requestId || null,
    isRead: false,
    createdAt: new Date().toISOString()
  };

  // 1. Live Firestore persistence
  if (isRealFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, "notifications", newNotif.notificationId), newNotif);
    } catch (err) {
      console.warn("Firestore notification create error:", err);
    }
  }

  // 2. Reactive local storage update
  const notifs = localDb.getNotifs();
  const existingIdx = notifs.findIndex(n => n.notificationId === newNotif.notificationId);
  if (existingIdx === -1) {
    notifs.unshift(newNotif);
  } else {
    notifs[existingIdx] = newNotif;
  }
  localDb.saveNotifs(notifs);

  // 3. Notify in-memory listeners
  currentListeners.filter(l => l.userId === newNotif.recipientUid).forEach(l => {
    l.addOne(newNotif);
  });

  return newNotif;
}

/**
 * Subscribes to real-time notifications for the currently logged-in user
 */
export function subscribeToNotifications(callback) {
  const user = getCurrentUser();
  if (!user || !user.uid) return () => {};

  isInitialSubscriptionLoad = true;
  knownNotificationIds.clear();

  let cachedNotifs = [];

  const processIncomingNotifications = (notifsList) => {
    // Deduplicate by notificationId or id
    const map = new Map();
    notifsList.forEach(n => {
      const id = n.notificationId || n.id;
      if (id && !map.has(id)) {
        map.set(id, { ...n, notificationId: id, id: id });
      }
    });

    const uniqueList = Array.from(map.values());
    uniqueList.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    cachedNotifs = uniqueList;

    // Trigger toast & audio for newly arrived unread notifications
    if (!isInitialSubscriptionLoad) {
      uniqueList.forEach(n => {
        const id = n.notificationId || n.id;
        if (id && !knownNotificationIds.has(id) && !n.isRead) {
          const toastType = (n.type === 'EMERGENCY_REQUEST' || n.type === 'DIRECT_REQUEST') ? 'emergency'
            : (n.type === 'ACCEPTED' || n.type === 'COMPLETED') ? 'success'
            : (n.type === 'REJECTED') ? 'danger' : 'info';
          
          showToast(n.title, n.message, toastType);
          showBrowserNotification(n.title, n.message);
        }
      });
    }

    knownNotificationIds.clear();
    uniqueList.forEach(n => {
      const id = n.notificationId || n.id;
      if (id) knownNotificationIds.add(id);
    });

    isInitialSubscriptionLoad = false;
    callback(uniqueList);
  };

  const listenerObj = {
    userId: user.uid,
    callback,
    process: processIncomingNotifications,
    addOne: (notif) => {
      cachedNotifs.unshift(notif);
      processIncomingNotifications(cachedNotifs);
    },
    removeOne: (notifId) => {
      cachedNotifs = cachedNotifs.filter(n => n.notificationId !== notifId && n.id !== notifId);
      knownNotificationIds.delete(notifId);
      callback(cachedNotifs);
    },
    removeAll: () => {
      cachedNotifs = [];
      knownNotificationIds.clear();
      callback([]);
    }
  };
  currentListeners.push(listenerObj);

  let firestoreUnsubscribe = null;

  if (isRealFirebaseConfigured && db) {
    try {
      const q = query(
        collection(db, "notifications"), 
        where("recipientUid", "==", user.uid)
      );
      
      firestoreUnsubscribe = onSnapshot(q, (snapshot) => {
        const notifs = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          const docId = data.notificationId || docSnap.id;
          notifs.push({ ...data, notificationId: docId, id: docId });
        });
        processIncomingNotifications(notifs);
      }, (err) => {
        console.warn("Firestore notifications subscription error, using local fallback:", err);
        const allNotifs = localDb.getNotifs();
        const userNotifs = allNotifs.filter(n => n.recipientUid === user.uid);
        processIncomingNotifications(userNotifs);
      });
    } catch(e) {
      console.warn("Notifications subscription exception:", e);
    }
  }

  // Immediate load from local storage
  const allNotifs = localDb.getNotifs();
  const userNotifs = allNotifs.filter(n => n.recipientUid === user.uid);
  processIncomingNotifications(userNotifs);
  
  return () => {
    if (typeof firestoreUnsubscribe === 'function') {
      firestoreUnsubscribe();
    }
    currentListeners = currentListeners.filter(l => l !== listenerObj);
  };
}

/**
 * Marks a single notification as read
 */
export async function markNotificationRead(notifId) {
  if (!notifId) return;

  // Local storage update
  const notifs = localDb.getNotifs();
  const index = notifs.findIndex(n => n.notificationId === notifId || n.id === notifId);
  if (index > -1) {
    notifs[index].isRead = true;
    localDb.saveNotifs(notifs);
  }

  // Firestore update
  if (isRealFirebaseConfigured && db) {
    try {
      await updateDoc(doc(db, "notifications", notifId), { isRead: true });
    } catch (err) {
      console.warn("Error marking notification read in Firestore:", err);
    }
  }
}

/**
 * Marks all notifications as read for a given user
 */
export async function markAllNotificationsRead(userUid) {
  if (!userUid) return;

  // Local storage update
  const notifs = localDb.getNotifs();
  let modified = false;
  notifs.forEach(n => {
    if (n.recipientUid === userUid && !n.isRead) {
      n.isRead = true;
      modified = true;
    }
  });
  if (modified) {
    localDb.saveNotifs(notifs);
  }

  // Firestore update
  if (isRealFirebaseConfigured && db) {
    try {
      const q = query(
        collection(db, "notifications"), 
        where("recipientUid", "==", userUid),
        where("isRead", "==", false)
      );
      const snap = await getDocs(q);
      const updates = [];
      snap.forEach(d => {
        updates.push(updateDoc(doc(db, "notifications", d.id), { isRead: true }));
      });
      await Promise.all(updates);
    } catch (err) {
      console.warn("Error marking all notifications read in Firestore:", err);
    }
  }
}

/**
 * Deletes a single notification from Firestore and local storage
 */
export async function deleteNotification(notifId) {
  if (!notifId) return;

  // 1. Immediately update active in-memory listeners
  currentListeners.forEach(l => l.removeOne(notifId));

  // 2. Local storage removal
  const notifs = localDb.getNotifs();
  const filtered = notifs.filter(n => n.notificationId !== notifId && n.id !== notifId);
  localDb.saveNotifs(filtered);
  knownNotificationIds.delete(notifId);

  // 3. Firestore removal
  if (isRealFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, "notifications", notifId));
    } catch (err) {
      console.warn("Error direct deleting notification in Firestore:", err);
    }
    try {
      const q = query(collection(db, "notifications"), where("notificationId", "==", notifId));
      const snap = await getDocs(q);
      snap.forEach(async (d) => {
        try {
          await deleteDoc(doc(db, "notifications", d.id));
        } catch(e) {}
      });
    } catch(err) {}
  }
}

/**
 * Clears/Deletes all notifications for a given user
 */
export async function clearAllNotifications(userUid) {
  if (!userUid) return;

  // 1. Immediately update active in-memory listeners
  currentListeners.filter(l => l.userId === userUid).forEach(l => l.removeAll());

  // 2. Local storage removal
  const notifs = localDb.getNotifs();
  const filtered = notifs.filter(n => n.recipientUid !== userUid);
  localDb.saveNotifs(filtered);
  knownNotificationIds.clear();

  // 3. Firestore removal
  if (isRealFirebaseConfigured && db) {
    try {
      const q = query(
        collection(db, "notifications"), 
        where("recipientUid", "==", userUid)
      );
      const snap = await getDocs(q);
      const deletes = [];
      snap.forEach(d => {
        deletes.push(deleteDoc(doc(db, "notifications", d.id)));
      });
      await Promise.all(deletes);
    } catch (err) {
      console.warn("Error clearing notifications in Firestore:", err);
    }
  }
}

/**
 * Displays a toast notification with styling and optional sound
 */
export function showToast(title, message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'danger') icon = '⚠️';
  if (type === 'emergency') icon = '🚨';

  toast.innerHTML = `
    <div style="font-size: 1.3rem; line-height: 1; flex-shrink: 0;">${icon}</div>
    <div style="flex: 1; min-width: 0;">
      <div style="font-weight: 700; font-size: 0.88rem; margin-bottom: 2px; color: inherit;">${title}</div>
      <div style="font-size: 0.82rem; opacity: 0.92; line-height: 1.35; word-break: break-word;">${message}</div>
    </div>
    <button class="toast-close-btn" aria-label="Close" style="background:none;border:none;cursor:pointer;color:inherit;opacity:0.7;font-size:1.1rem;padding:0 4px;margin-left:4px;">&times;</button>
  `;

  const closeBtn = toast.querySelector('.toast-close-btn');
  const dismiss = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => {
      if (container.contains(toast)) {
        container.removeChild(toast);
      }
    }, 300);
  };

  if (closeBtn) {
    closeBtn.addEventListener('click', dismiss);
  }

  container.appendChild(toast);

  // Play appropriate audio feedback
  playNotificationSound(type);

  // Auto dismiss after 6 seconds
  setTimeout(dismiss, 6000);
}

/**
 * Synthesizes audio feedback using Web Audio API
 */
export function playNotificationSound(type = 'info') {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    
    const audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    if (type === 'emergency' || type === 'EMERGENCY_REQUEST' || type === 'DIRECT_REQUEST') {
      // Urgent double beep
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      osc.frequency.setValueAtTime(0.001, audioCtx.currentTime + 0.12);
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.2); // Second beep
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } else if (type === 'success' || type === 'ACCEPTED' || type === 'COMPLETED') {
      // Uplifting chime
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.38);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.38);
    } else {
      // Soft ping for standard notification
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    }
  } catch(e) {
    // Audio context may be restricted before user gesture
  }
}

export const playEmergencySound = () => playNotificationSound('emergency');

/**
 * Requests browser push notification permission
 */
export async function requestBrowserNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch(e) {}
  }
}

/**
 * Triggers native browser desktop/mobile push notification
 */
export function showBrowserNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: body,
        icon: 'https://cdn-icons-png.flaticon.com/512/503/503058.png',
        badge: 'https://cdn-icons-png.flaticon.com/512/503/503058.png'
      });
    } catch (e) {
      console.log("Browser notification error:", e);
    }
  }
}
