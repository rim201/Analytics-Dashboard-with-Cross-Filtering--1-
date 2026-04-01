import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import type { Analytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA_eR6iDmnjFCmvkvgmpoAu0C-bCmIgsak",
  authDomain: "analytics-dashboard-569c9.firebaseapp.com",
  projectId: "analytics-dashboard-569c9",
  storageBucket: "analytics-dashboard-569c9.firebasestorage.app",
  messagingSenderId: "657494502026",
  appId: "1:657494502026:web:99f19b7e07aa05ec571b73",
  measurementId: "G-DEGMTJXDPQ",
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);

export const auth = getAuth(app);

/** Auth dédiée à la création de comptes : évite de remplacer la session admin après `createUserWithEmailAndPassword`. */
const USER_CREATION_APP_NAME = "userCreationSecondary";
export const userCreationApp =
  getApps().find((a) => a.name === USER_CREATION_APP_NAME) ?? initializeApp(firebaseConfig, USER_CREATION_APP_NAME);
export const userCreationAuth = getAuth(userCreationApp);

export const analytics: Analytics | null =
  typeof window !== "undefined" ? getAnalytics(app) : null;
