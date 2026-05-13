// js/ranking.js

import {
  db,
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  limit
} from "./firebase.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

/* =========================
   DOM
========================= */

const topContainer =
  document.getElementById("topProducts");

const lowContainer =
  document.getElementById("lowProducts");

/* =========================
   AUTH
========================= */

const auth = getAuth();

/* =========================
   SECURITY
========================= */

async function checkUser(uid) {

  const userRef =
    doc(db, "users", uid);

  const userSnap =
    await getDoc(userRef);

  if (!userSnap.exists()) {
    throw new Error(
      "Utilisateur introuvable"
    );
  }

  const userData =
    userSnap.data();

  if (!userData.isActive) {
    throw new Error(
      "Compte désactivé"
    );
  }

  if (
    userData.role !== "admin" &&
    userData.role !== "seller"
  ) {
    throw new Error(
      "Accès refusé"
    );
  }

  return userData;

}

/* =========================
   HELPERS
========================= */

function sanitizeText(
  value,
  max = 80
) {

  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);

}

function clearContainer(container) {

  if (!container) return;

  container.replaceChildren();

}

function showEmpty(container, text) {

  clearContainer(container);

  const div =
    document.createElement("div");

  div.className = "empty";

  div.textContent = text;

  container.appendChild(div);

}

function createProgressBar(
  percent,
  type
) {

  const progress =
    document.createElement("div");

  progress.className = "progress";

  const fill =
    document.createElement("div");

  fill.className =
    `progress-fill ${type}`;

  fill.style.width =
    `${Math.min(percent, 100)}%`;

  progress.appendChild(fill);

  return progress;

}

/* =========================
   CREATE CARD
========================= */

function createCard(
  item,
  type = "gold",
  position = 1
) {

  const card =
    document.createElement("div");

  card.className =
    `rank-card ${
      type === "gold"
        ? "gold"
        : "low"
    }`;

  const top =
    document.createElement("div");

  top.className = "card-top";

  const name =
    document.createElement("div");

  name.className =
    "product-name";

  name.textContent =
    sanitizeText(item.name);

  const badge =
    document.createElement("div");

  badge.className =
    `rank-badge ${
      type === "gold"
        ? "best"
        : "low"
    }`;

  badge.textContent =
    `#${position}`;

  top.append(
    name,
    badge
  );

  const stats =
    document.createElement("div");

  stats.className =
    "card-stats";

  const soldLine =
    document.createElement("div");

  soldLine.className =
    "stat-line";

  const soldLabel =
    document.createElement("span");

  soldLabel.textContent =
    "Ventes";

  const soldValue =
    document.createElement("strong");

  soldValue.textContent =
    `${item.quantity}`;

  soldLine.append(
    soldLabel,
    soldValue
  );

  const percentLine =
    document.createElement("div");

  percentLine.className =
    "stat-line";

  const percentLabel =
    document.createElement("span");

  percentLabel.textContent =
    "Part des ventes";

  const percentValue =
    document.createElement("strong");

  percentValue.textContent =
    `${item.percent}%`;

  percentLine.append(
    percentLabel,
    percentValue
  );

  const scoreLine =
    document.createElement("div");

  scoreLine.className =
    "stat-line";

  const scoreLabel =
    document.createElement("span");

  scoreLabel.textContent =
    "Cote";

  const scoreValue =
    document.createElement("strong");

  scoreValue.textContent =
    `${item.score}/10`;

  scoreLine.append(
    scoreLabel,
    scoreValue
  );

  stats.append(
    soldLine,
    percentLine,
    scoreLine
  );

  const progress =
    createProgressBar(
      item.percent,
      type
    );

  card.append(
    top,
    stats,
    progress
  );

  return card;

}

/* =========================
   LOAD RANKING
========================= */

async function loadRanking() {

  clearContainer(topContainer);
  clearContainer(lowContainer);

  const saleItemsSnap =
    await getDocs(
      query(
        collection(
          db,
          "sale_items"
        ),
        limit(5000)
      )
    );

  if (saleItemsSnap.empty) {

    showEmpty(
      topContainer,
      "Aucune vente enregistrée"
    );

    showEmpty(
      lowContainer,
      "Aucune donnée disponible"
    );

    return;

  }

  const map =
    new Map();

  let totalSold = 0;

  saleItemsSnap.forEach(docSnap => {

    const data =
      docSnap.data();

    const productId =
      data.productId;

    const quantity =
      Number(
        data.quantity || 0
      );

    totalSold += quantity;

    if (!map.has(productId)) {

      map.set(productId, {
        productId,
        quantity: 0
      });

    }

    const current =
      map.get(productId);

    current.quantity += quantity;

  });

  const productsSnap =
    await getDocs(
      collection(db, "products")
    );

  const productsMap =
    new Map();

  productsSnap.forEach(docSnap => {

    productsMap.set(
      docSnap.id,
      docSnap.data()
    );

  });

  const ranking =
    Array.from(map.values())
      .map(item => {

        const product =
          productsMap.get(
            item.productId
          ) || {};

        const percent =
          totalSold > 0
            ? (
              item.quantity
              / totalSold
            ) * 100
            : 0;

        const score =
          Math.min(
            10,
            (
              percent / 10
            ) * 10
          );

        return {
          productId:
            item.productId,

          name:
            sanitizeText(
              product.name ||
              "Produit inconnu"
            ),

          quantity:
            item.quantity,

          percent:
            Number(
              percent.toFixed(1)
            ),

          score:
            Number(
              score.toFixed(1)
            )
        };

      })
      .sort(
        (a, b) =>
          b.quantity -
          a.quantity
      );

  const topFive =
    ranking.slice(0, 5);

  const lowFive =
    [...ranking]
      .reverse()
      .slice(0, 5);

  if (!topFive.length) {

    showEmpty(
      topContainer,
      "Top indisponible"
    );

  } else {

    topFive.forEach(
      (item, index) => {

        const card =
          createCard(
            item,
            "gold",
            index + 1
          );

        topContainer.appendChild(
          card
        );

      }
    );

  }

  if (!lowFive.length) {

    showEmpty(
      lowContainer,
      "Classement faible indisponible"
    );

  } else {

    lowFive.forEach(
      (item, index) => {

        const card =
          createCard(
            item,
            "red",
            index + 1
          );

        lowContainer.appendChild(
          card
        );

      }
    );

  }

}

/* =========================
   INIT
========================= */

onAuthStateChanged(
  auth,
  async user => {

    if (!user) {

      alert(
        "Connexion requise"
      );

      window.location.replace(
        "login.html"
      );

      return;

    }

    try {

      await checkUser(
        user.uid
      );

      await loadRanking();

    } catch (err) {

      console.error(err);

      alert(
        err.message ||
        "Erreur"
      );

    }

  }
);
