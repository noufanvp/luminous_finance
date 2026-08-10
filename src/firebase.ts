import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  User,
} from 'firebase/auth';

import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import firebaseConfigJson from '../firebase-applet-config.json';
import { BudgetConfig, BankAccount, Transaction, FixedBill, CategoryTemplate } from './types';

// Initialize Firebase App
const app = initializeApp({
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId: firebaseConfigJson.appId,
});

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Database instance (using custom firestoreDatabaseId if provided)
export const db = firebaseConfigJson.firestoreDatabaseId
  ? getFirestore(app, firebaseConfigJson.firestoreDatabaseId)
  : getFirestore(app);

// Auth helper functions with Stay Signed In persistence option
export const loginWithGoogle = async (rememberMe: boolean = true) => {
  try {
    const persistenceType = rememberMe ? browserLocalPersistence : browserSessionPersistence;
    await setPersistence(auth, persistenceType);
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Error logging in with Google:', error);
    throw error;
  }
};

export const logoutGoogle = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error logging out:', error);
    throw error;
  }
};

export const listenToAuth = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export interface UserAppData {
  config: BudgetConfig;
  accounts: BankAccount[];
  transactions: Transaction[];
  fixedBills: FixedBill[];
  categories: CategoryTemplate[];
}

// Subscribe to real-time updates for a logged-in user
export const subscribeToUserAppData = (
  userId: string,
  onUpdate: (data: Partial<UserAppData>) => void
) => {
  const userDocRef = doc(db, 'users', userId);

  return onSnapshot(
    userDocRef,
    (snapshot) => {
      // Ignore local pending writes to prevent feedback loops
      if (snapshot.metadata.hasPendingWrites) {
        return;
      }
      if (snapshot.exists()) {
        const data = snapshot.data();
        onUpdate({
          config: data.config,
          accounts: data.accounts,
          transactions: data.transactions,
          fixedBills: data.fixedBills,
          categories: data.categories,
        });
      }
    },
    (error) => {
      console.warn('Firestore snapshot notice:', error?.message || error);
    }
  );
};

// Save or sync user app data to Firestore
export const saveUserAppData = async (userId: string, data: Partial<UserAppData>) => {
  try {
    const userDocRef = doc(db, 'users', userId);
    // Sanitize data to remove any undefined fields that Firestore setDoc rejects
    const sanitizedData = JSON.parse(JSON.stringify(data));
    await setDoc(userDocRef, { ...sanitizedData, updatedAt: new Date().toISOString() }, { merge: true });
    return { success: true };
  } catch (error: any) {
    if (error?.code === 'resource-exhausted' || error?.message?.includes('quota') || error?.message?.includes('Quota')) {
      console.warn('Firestore daily write quota reached. Local changes continue to be saved locally.');
      return {
        success: false,
        reason: 'quota',
        message: 'Firebase daily free write quota reached. Data is safely saved on this device and will resume cloud syncing once quota resets tomorrow.',
      };
    } else {
      console.error('Error saving user data to Firestore:', error);
      return { success: false, reason: 'error', message: error?.message || 'Failed to sync to cloud.' };
    }
  }
};

export const updateUserProfileName = async (newName: string) => {
  if (auth.currentUser) {
    try {
      await updateProfile(auth.currentUser, { displayName: newName });
    } catch (error) {
      console.error('Error updating Firebase user profile name:', error);
    }
  }
};
