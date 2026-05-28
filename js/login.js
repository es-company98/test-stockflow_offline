// login.js
import { db, doc, getDoc, setDoc, addDoc, collection, Timestamp } from './firebase.js';

import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  getAuth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

const auth = getAuth();

const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const rememberMeCheckbox = document.getElementById('rememberMe');
const googleLoginBtn = document.getElementById('googleLoginBtn');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    alert("Remplis tous les champs");
    return;
  }

  try {
    // 🔐 Persistence
    await setPersistence(
      auth,
      rememberMeCheckbox.checked ? browserLocalPersistence : browserSessionPersistence
    );

    // 🔐 AUTH LOGIN
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    // 🧠 FIRESTORE CHECK (ID = UID)
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      alert("Utilisateur non configuré");
      return;
    }

    const userData = userSnap.data();

    if (!userData.isActive) {
      alert("Compte désactivé");
      return;
    }

    if (!["admin", "seller", "user"].includes(userData.role)) {
      alert("Accès refusé");
      return;
    }

    // 💾 STOCK LOCAL (ton app dépend de ça)
    localStorage.setItem("userId", uid);
    localStorage.setItem("userRole", userData.role);

    // 📜 LOG (optionnel mais propre)
    await addDoc(collection(db, "logs"), {
      userId: uid,
      action: "login",
      role: userData.role,
      createdAt: Timestamp.now()
    });

    // 🚀 REDIRECTION PROPRE
    window.location.replace("index.html");

  } catch (err) {

  console.error(err);

  switch (err.code) {

    case "auth/invalid-email":
      alert("Email invalide");
      break;

    case "auth/invalid-credential":
      alert("Email ou mot de passe incorrect");
      break;

    case "auth/user-disabled":
      alert("Compte désactivé");
      break;

    case "auth/network-request-failed":
      alert("Pas de connexion internet");
      break;

    case "auth/too-many-requests":
      alert("Trop de tentatives. Réessayez plus tard");
      break;

    default:
      alert("Erreur de connexion");
      break;
  }
}
});

const googleProvider =
  new GoogleAuthProvider();

googleLoginBtn.addEventListener("click", async () => {

  try {

    await setPersistence(
      auth,
      browserLocalPersistence
    );

    const result =
      await signInWithPopup(
        auth,
        googleProvider
      );

    const user = result.user;

    const uid = user.uid;

    const userRef =
      doc(db, "users", uid);

    const userSnap =
      await getDoc(userRef);

    /* =========================
       FIRST LOGIN AUTO CREATE
    ========================= */

    if (!userSnap.exists()) {

  await auth.signOut();

  alert(
    "Compte non autorisé"
  );

  return;
}

    const finalSnap =
      await getDoc(userRef);

    const userData =
      finalSnap.data();

    if (!userData.isActive) {
      alert("Compte désactivé");
      return;
    }

    localStorage.setItem(
      "userId",
      uid
    );

    localStorage.setItem(
      "userRole",
      userData.role
    );

    await addDoc(
      collection(db, "logs"),
      {
        userId: uid,
        action: "google_login",
        role: userData.role,
        createdAt: Timestamp.now()
      }
    );

    window.location.replace(
      "index.html"
    );

  } catch (err) {

    console.error(err);

    if (
      err.code ===
      "auth/popup-closed-by-user"
    ) {

      alert("Popup fermée");

    } else {

      alert(
        "Erreur connexion Google"
      );
    }
  }
});