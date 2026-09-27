/* ==========================================================================
   User Authentication & State Management
   Role-Based Auth (Donor, Requester, Admin) & Session Sync
   ========================================================================== */

import { auth, db, isRealFirebaseConfigured, localDb } from './firebase-config.js';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { doc, getDoc, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const provider = new GoogleAuthProvider();

let currentUser = null;
const authChangeListeners = [];

export function getCurrentUser() {
  return currentUser;
}

export function onAuthChanged(callback) {
  authChangeListeners.push(callback);
}

function notifyAuthSubscribers(user) {
  currentUser = user;
  authChangeListeners.forEach(cb => cb(user));
}

// Initial session check
import { onAuthStateChanged as firebaseOnAuthChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

export function initAuth() {
  if (isRealFirebaseConfigured) {
    firebaseOnAuthChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            setCurrentUserSession(userDoc.data());
          }
        } catch(e) {
          console.error("Auth state restore failed", e);
        }
      } else {
        localStorage.removeItem('lifepulse_active_session');
        currentUser = null;
        notifyAuthSubscribers(null);
      }
    });
  } else {
    const savedSession = localStorage.getItem('lifepulse_active_session');
    if (savedSession) {
      setCurrentUserSession(JSON.parse(savedSession));
    }
  }
}

export function setCurrentUserSession(user) {
  currentUser = user;
  localStorage.setItem('lifepulse_active_session', JSON.stringify(user));
  notifyAuthSubscribers(user);
}

export async function loginWithGoogle() {
  if (isRealFirebaseConfigured) {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);
      
      let userData;
      if (!userDoc.exists()) {
        // Show Onboarding Modal for New Users
        window.tempGoogleUser = user;
        const modal = document.getElementById('onboarding-modal');
        if (modal) modal.style.display = 'flex';
        return { success: true, pendingOnboarding: true, message: "Please complete registration" };
      } else {
        userData = userDoc.data();
      }
      
      setCurrentUserSession(userData);
      return { success: true, user: userData };
    } catch (err) {
      console.error(err);
      return { success: false, message: err.message };
    }
  } else {
    alert("Firebase is not configured yet.");
    return { success: false, message: "No Firebase configuration." };
  }
}

// Global handler for onboarding form submission
function setupOnboardingForm() {
  const onboardForm = document.getElementById('onboarding-form');
  if (onboardForm) {
    onboardForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const gUser = window.tempGoogleUser;
      if (!gUser) return;

      const isDonorOptin = document.getElementById('onboard-donor-optin')?.checked;
      const role = isDonorOptin ? "donor" : "requester";
      const bg = document.getElementById('onboard-blood').value;
      const phone = document.getElementById('onboard-phone').value;
      const state = document.getElementById('onboard-state')?.value || '';
      const district = document.getElementById('onboard-district')?.value || '';
      const area = document.getElementById('onboard-area')?.value || '';

      const userData = {
        uid: gUser.uid,
        name: gUser.displayName,
        email: gUser.email,
        role: role,
        bloodGroup: bg,
        phone: phone,
        state: state,
        city: district,
        address: area || district,
        isAvailable: isDonorOptin,
        status: "active",
        createdAt: new Date().toISOString()
      };

      try {
        const userRef = doc(db, "users", gUser.uid);
        await setDoc(userRef, userData);
        setCurrentUserSession(userData);
        
        document.getElementById('onboarding-modal').style.display = 'none';
        window.tempGoogleUser = null;
        
        if (typeof window.showToast === 'function') {
           window.showToast("Registration Complete", "Welcome to TheBloodApp!", "success");
        }
        document.querySelector('[data-target=view-dashboard]')?.click();
      } catch (err) {
        alert("Error saving profile: " + err.message);
      }
    });
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupOnboardingForm);
  } else {
    setupOnboardingForm();
  }
}

export async function loginUser(email, password) {
  if (isRealFirebaseConfigured) {
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, "users", userCred.user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setCurrentUserSession(userData);
        return { success: true, user: userData };
      }
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  // Fallback Local Auth check
  const users = localDb.getUsers();
  const matchedUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (matchedUser) {
    if (matchedUser.status === 'banned') {
      return { success: false, message: "Your account has been deactivated by administrator." };
    }
    setCurrentUserSession(matchedUser);
    return { success: true, user: matchedUser };
  } else {
    return { success: false, message: "Invalid email or user not found in database." };
  }
}

export async function registerUser(formData) {
  const newUser = {
    uid: 'usr_' + Date.now(),
    name: formData.name,
    email: formData.email,
    phone: formData.phone,
    role: formData.role, // "donor" | "requester"
    bloodGroup: formData.bloodGroup || "O+",
    age: parseInt(formData.age) || 25,
    gender: formData.gender || "Male",
    city: formData.city || "Madurai",
    address: formData.address || "Madurai Main Road",
    location: {
      latitude: formData.latitude || 9.9252,
      longitude: formData.longitude || 78.1198
    },
    isAvailable: formData.isAvailable ?? true,
    lastDonationDate: formData.lastDonationDate || "2026-05-15",
    isVerified: true,
    status: "active",
    createdAt: new Date().toISOString()
  };

  if (isRealFirebaseConfigured) {
    try {
      const userCred = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      newUser.uid = userCred.user.uid;
      await setDoc(doc(db, "users", newUser.uid), newUser);
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  const users = localDb.getUsers();
  users.push(newUser);
  localDb.saveUsers(users);
  setCurrentUserSession(newUser);
  return { success: true, user: newUser };
}

export async function updateUserProfile(updatedFields) {
  if (!currentUser) return { success: false, message: "No active user session" };

  const updatedUser = { ...currentUser, ...updatedFields };

  if (isRealFirebaseConfigured) {
    try {
      await updateDoc(doc(db, "users", currentUser.uid), updatedFields);
    } catch (err) {
      console.error("Firestore update error:", err);
    }
  }

  const users = localDb.getUsers();
  const index = users.findIndex(u => u.uid === currentUser.uid);
  if (index !== -1) {
    users[index] = updatedUser;
    localDb.saveUsers(users);
  }
  setCurrentUserSession(updatedUser);
  return { success: true, user: updatedUser };
}

export async function logoutUser() {
  if (isRealFirebaseConfigured) {
    await signOut(auth);
  }
  localStorage.removeItem('lifepulse_active_session');
  currentUser = null;
  notifyAuthSubscribers(null);
}
