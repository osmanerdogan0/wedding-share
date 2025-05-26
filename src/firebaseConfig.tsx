import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyA_St5u9xK4SFK5Jn5KuObnZmo07zKjGms",
    authDomain: "wedding-share-7df7f.firebaseapp.com",
    projectId: "wedding-share-7df7f",
    storageBucket: "wedding-share-7df7f.firebasestorage.app",
    messagingSenderId: "1093186245705",
    appId: "1:1093186245705:web:53eb031ae56fb1fbc1db98"
  };
  

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

// anonim login
signInAnonymously(auth).catch(console.error);

export { db, storage };
