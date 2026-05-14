// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { 
  getFirestore, collection, addDoc, getDocs,setDoc, updateDoc, deleteDoc, doc,
  getDoc, query, where, orderBy, serverTimestamp, Timestamp, enableIndexedDbPersistence,
  runTransaction, limit, writeBatch, increment, arrayUnion
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAwY95NM8QKiRxNHvfxiGrjvhKG16Lpl5E",
    authDomain: "test-stockflow-offline.firebaseapp.com",
    projectId: "test-stockflow-offline",
    storageBucket: "test-stockflow-offline.firebasestorage.app",
    messagingSenderId: "721689942624",
    appId: "1:721689942624:web:a29d362e5fccd7e2ce4105",
    measurementId: "G-67C96ZB39P"
  };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { 
  db, collection, addDoc, getDocs, updateDoc, orderBy, deleteDoc, doc, getDoc,setDoc,
  query, where, serverTimestamp, Timestamp, enableIndexedDbPersistence,
  runTransaction, limit, writeBatch, increment, arrayUnion
};
