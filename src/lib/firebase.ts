import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCPU7Ju3MA8f3KfNN3yx9qzFX3U9ZP2fVY",
  authDomain: "astute-city-490906-k6.firebaseapp.com",
  projectId: "astute-city-490906-k6",
  storageBucket: "astute-city-490906-k6.firebasestorage.app",
  messagingSenderId: "346842421426",
  appId: "1:346842421426:web:e0388fb4ed18fcfac9d1ab",
  measurementId: "G-SZ7EZDVJVN",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
