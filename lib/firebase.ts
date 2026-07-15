import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCKNKL-9tDaw1HxyGJZVRvZJDpBImDkaJA",
  authDomain: "nuall-263ea.firebaseapp.com",
  databaseURL: "https://nuall-263ea-default-rtdb.firebaseio.com",
  projectId: "nuall-263ea",
  storageBucket: "nuall-263ea.firebasestorage.app",
  messagingSenderId: "702609174051",
  appId: "1:702609174051:web:c468e18387a911bc9c0b96",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const dbRealtime = getDatabase(app);