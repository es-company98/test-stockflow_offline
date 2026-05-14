// settings.js
import {
  db,
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp
} from "./firebase.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

const auth = getAuth();

/* =========================
   GLOBAL
========================= */

let currentUserId = null;
let currentUserRole = null;

const usersCollection = collection(db, "users");

/* =========================
   DOM
========================= */

const usersTableBody =
  document.querySelector("#usersTable tbody");

const loadingState =
  document.getElementById("loadingState");

const emptyState =
  document.getElementById("emptyState");

/* =========================
   UTILS
========================= */

function sanitizeText(value, max = 80) {

  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
}

function showLoading(show = true) {

  if (!loadingState) return;

  loadingState.style.display =
    show ? "flex" : "none";
}

function showEmpty(show = false) {

  if (!emptyState) return;

  emptyState.style.display =
    show ? "block" : "none";
}

function showMessage(message = "") {

  const existing =
    document.getElementById("debugMessage");

  if (existing) {
    existing.remove();
  }

  const div =
    document.createElement("div");

  div.id = "debugMessage";

  div.textContent = message;

  div.style.position = "fixed";
  div.style.left = "50%";
  div.style.bottom = "85px";
  div.style.transform = "translateX(-50%)";

  div.style.padding = "12px 16px";

  div.style.background = "#111";
  div.style.color = "#fff";

  div.style.borderRadius = "12px";

  div.style.fontSize = "13px";
  div.style.fontWeight = "600";

  div.style.zIndex = "999999";

  div.style.boxShadow =
    "0 4px 18px rgba(0,0,0,0.25)";

  div.style.opacity = "0";
  div.style.transition =
    "opacity .25s ease";

  document.body.appendChild(div);

  requestAnimationFrame(() => {
    div.style.opacity = "1";
  });

  setTimeout(() => {

    div.style.opacity = "0";

    setTimeout(() => {
      div.remove();
    }, 250);

  }, 2500);
}

function createButton(label, className) {

  const btn =
    document.createElement("button");

  btn.type = "button";

  btn.textContent = label;

  btn.className = className;

  return btn;
}

function createBadge(role) {

  const span =
    document.createElement("span");

  span.textContent = role;

  span.className = "role-badge";

  if (role === "admin") {
    span.classList.add("admin");
  } else {
    span.classList.add("seller");
  }

  return span;
}

/* =========================
   AUTH
========================= */

onAuthStateChanged(auth, async (user) => {

  if (!user) {

    window.location.href =
      "login.html";

    return;
  }

  currentUserId = user.uid;

  try {

    const userRef =
      doc(db, "users", currentUserId);

    const userSnap =
      await getDoc(userRef);

    if (!userSnap.exists()) {

      alert("Utilisateur introuvable");

      return;
    }

    const userData =
      userSnap.data();

    currentUserRole =
      userData.role;

    if (
      currentUserRole !== "admin"
    ) {

      document.body.replaceChildren();

      const denied =
        document.createElement("div");

      denied.style.minHeight = "100vh";

      denied.style.display = "flex";
      denied.style.justifyContent =
        "center";
      denied.style.alignItems =
        "center";

      denied.style.background = "#111";
      denied.style.color = "#fff";

      denied.style.fontSize = "20px";
      denied.style.fontWeight = "700";

      denied.textContent =
        "⛔ Accès refusé";

      document.body.appendChild(denied);

      return;
    }

    loadUsers();

  } catch (err) {

    console.error(err);

    alert(
      "Erreur chargement utilisateur"
    );
  }

});

/* =========================
   LOAD USERS
========================= */

async function loadUsers() {

  try {

    showLoading(true);

    usersTableBody.replaceChildren();

    const snapshot =
      await getDocs(usersCollection);

    if (snapshot.empty) {

      showEmpty(true);

      showLoading(false);

      return;
    }

    showEmpty(false);

    snapshot.forEach((docSnap) => {

      const data =
        docSnap.data();

      const userId =
        docSnap.id;

      const tr =
        document.createElement("tr");

      /* ---------- NAME ---------- */

      /* ---------- NAME ---------- */
const nameTd = document.createElement("td");
nameTd.textContent = sanitizeText(data.name || "-");

/* ---------- EMAIL ---------- */ // <-- manquait
const emailTd = document.createElement("td");
emailTd.textContent = sanitizeText(data.email || "-");

/* ---------- ROLE ---------- */
const roleTd = document.createElement("td");
roleTd.appendChild(createBadge(data.role || "seller"));

/* ---------- STATUS ---------- */
const statusTd = document.createElement("td");
const status = document.createElement("span");
status.className = "status-badge";

if (data.isActive === false) {
  status.textContent = "Désactivé";
  status.classList.add("inactive");
} else {
  status.textContent = "Actif";
  status.classList.add("active");
}
statusTd.appendChild(status);

/* ---------- ACTIONS ---------- */
const actionsTd = document.createElement("td");
actionsTd.className = "actions";

      /* ---------- ACTIONS ---------- */

      const actionsTd =
        document.createElement("td");

      actionsTd.className =
        "actions";

      /* ROLE BUTTON */

      const roleBtn =
        createButton(
          "Changer rôle",
          "btn-action"
        );

      roleBtn.addEventListener(
        "click",
        async () => {

          try {

            const nextRole =
              data.role === "admin"
                ? "seller"
                : "admin";

            await updateDoc(
              doc(
                db,
                "users",
                userId
              ),
              {
                role: nextRole,
                updatedAt:
                  serverTimestamp()
              }
            );

            showMessage(
              "Rôle mis à jour"
            );

            loadUsers();

          } catch (err) {

            console.error(err);

            alert(
              "Erreur modification rôle"
            );
          }

        }
      );

      /* STATUS BUTTON */

      const statusBtn =
        createButton(
          data.isActive === false
            ? "Activer"
            : "Désactiver",
          data.isActive === false
            ? "btn-success"
            : "btn-warning"
        );

      statusBtn.addEventListener(
        "click",
        async () => {

          try {

            await updateDoc(
              doc(
                db,
                "users",
                userId
              ),
              {
                isActive:
                  data.isActive === false,
                updatedAt:
                  serverTimestamp()
              }
            );

            showMessage(
              "Utilisateur mis à jour"
            );

            loadUsers();

          } catch (err) {

            console.error(err);

            alert(
              "Erreur statut utilisateur"
            );
          }

        }
      );

      /* DELETE BUTTON */

      const deleteBtn =
        createButton(
          "Supprimer",
          "btn-danger"
        );

      deleteBtn.addEventListener(
        "click",
        async () => {

          if (
            userId === currentUserId
          ) {

            alert(
              "Impossible de supprimer ton compte"
            );

            return;
          }

          const confirmDelete =
            confirm(
              "Supprimer cet utilisateur ?"
            );

          if (!confirmDelete) {
            return;
          }

          try {

            await deleteDoc(
              doc(
                db,
                "users",
                userId
              )
            );

            showMessage(
              "Utilisateur supprimé"
            );

            loadUsers();

          } catch (err) {

            console.error(err);

            alert(
              "Erreur suppression"
            );
          }

        }
      );

      /* ---------- APPEND ---------- */
      actionsTd.appendChild(roleBtn);
actionsTd.appendChild(statusBtn);
actionsTd.appendChild(deleteBtn);

/* ---------- APPEND ---------- */
tr.appendChild(nameTd);
tr.appendChild(emailTd);   // <-- ajoute ça
tr.appendChild(roleTd);
tr.appendChild(statusTd);  // <-- remet ça à la bonne place
tr.appendChild(actionsTd);

usersTableBody.appendChild(tr);


    });

  } catch (err) {

    console.error(err);

    alert(
      "Erreur chargement utilisateurs"
    );

  } finally {

    showLoading(false);
  }

}
