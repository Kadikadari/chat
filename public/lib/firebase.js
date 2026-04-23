// lib/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDs9_q1Pzwu8jJsSPp_VMAAXVa900peef8",
  authDomain: "my-chat-app-e35fc.firebaseapp.com",
  projectId: "my-chat-app-e35fc",
  storageBucket: "my-chat-app-e35fc.firebasestorage.app",
  messagingSenderId: "39848909483",
  appId: "1:39848909483:web:5297287ee1c7f2d159b5ee"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);