// products.js - VERSION FINALE ULTIME PRO + search 
import { 
  db, collection, getDocs, addDoc, updateDoc, doc, getDoc, Timestamp
} from './firebase.js';
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

// --- OFFLINE ---
import {
  setupNetworkListeners,
  updateNetworkBadge
} from "./offline.js";

// --- DOM ---
const tableBody = document.getElementById('products-table');
const addBtn = document.querySelector('.add-product button');
const searchInput = document.getElementById('searchInput');
let allProducts = [];


// --- AUTH ---
const auth = getAuth();
let currentUserId = null;

// --- CHECK USER ---
async function checkUser(uid) {
  const userDoc = await getDoc(doc(db, "users", uid));
  if (!userDoc.exists()) throw new Error("Utilisateur inconnu");

  const data = userDoc.data();
  if (!data.isActive || (data.role !== "admin" && data.role !== "seller")) {
    throw new Error("Accès refusé");
  }
  return data;
}

let debugTimer;

function debug(msg) {
  const box = document.getElementById("debug");

  if (!box) return;

  box.textContent = msg;
  box.classList.add("show");
  clearTimeout(debugTimer);

  debugTimer = setTimeout(() => {
    box.classList.remove("show");
    box.textContent = "";
  }, 5000);
}

function sanitizeText(value, max = 120) {
  if (typeof value !== "string") return "";

  return value
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
}

// ------ render
function renderProducts(products) {
  tableBody.replaceChildren();
  
  if (!Array.isArray(products)) return;

  const fragment = document.createDocumentFragment();

  products.forEach(p => {
    const priceSell = Number(p.price_sell) || 0;
    const priceMin = Number(p.price_min) || priceSell;
    const stockCurrent = Number(p.stock_current) || 0;

    const tr = document.createElement("tr");
    if (!p.isActive) {
  tr.style.opacity = "0.5";
    }

    // IMAGE
    const tdImg = document.createElement("td");
    const imgDiv = document.createElement("div");

    imgDiv.className = "product-img";

    if (
      typeof p.imageUrl === "string" &&
      /^https?:\/\/[^"'()<>\s]+$/i.test(p.imageUrl)
    ) {
      imgDiv.style.backgroundImage = `url("${p.imageUrl}")`;
    }

    tdImg.appendChild(imgDiv);

    // NAME
    const tdName = document.createElement("td");
    tdName.textContent = p.name || "-";

    // VARIANT
    const tdVariant = document.createElement("td");
    tdVariant.textContent = p.variant || "-";

    // PRICE SELL
    const tdSell = document.createElement("td");
    tdSell.textContent = `${priceSell.toFixed(2)}FC`;

    // PRICE MIN
    const tdMin = document.createElement("td");
    tdMin.textContent = `${priceMin.toFixed(2)}FC`;

    // STOCK
    const tdStock = document.createElement("td");
    tdStock.textContent = String(stockCurrent);

    tdStock.className =
      stockCurrent > (p.stock_alert || 0)
        ? "stock-ok"
        : "stock-low";
        
        const tdState = document.createElement("td");

tdState.textContent =
  `${p.isActive ? "Actif" : "Désactivé"} | ${
    p.offlineBlocked
      ? "Offline bloqué"
      : `Offline ≥ ${p.minOfflineStock}`
  }`;

tdState.className = p.isActive
  ? "stock-ok"
  : "stock-low";
  

    // ACTIONS
    const tdActions = document.createElement("td");

    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-edit";
    editBtn.textContent = "Modifier";
    
    const activateBtn = document.createElement("button");
    
    if (p.isActive) {
  activateBtn.className = "btn btn-add";
  activateBtn.textContent = "Désactiver";
} else {
  activateBtn.className = "btn btn-add";
  activateBtn.textContent = "Réactiver";
}

    editBtn.addEventListener("click", () => {
      editProduct(p.id, p);
    });

    activateBtn.addEventListener("click", () => {
  toggleProductStatus(p.id, p.name, p.isActive);
});

    tdActions.append(editBtn, activateBtn);

    tr.append(
      tdImg,
      tdName,
      tdVariant,
      tdSell,
      tdMin,
      tdStock,
      tdState,
      tdActions
    );

    fragment.appendChild(tr);
  });

  tableBody.appendChild(fragment);
}

// search box 
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    const value = e.target.value.toLowerCase().trim();

    const filtered = allProducts.filter(p => {
      const name = (p.name || "").toLowerCase();
      const variant = (p.variant || "").toLowerCase();

      return name.includes(value) || variant.includes(value);
    });

    renderProducts(filtered);
  });
}

// --- LOAD PRODUCTS ---
async function loadProducts() {
  const prodSnap = await getDocs(
  collection(db, "products")
);

if (prodSnap.metadata.fromCache) {
  debug("Produits chargés depuis cache offline");
} else {
  debug("Produits synchronisés");
}

  allProducts = prodSnap.docs
    .map(d => ({
      id: d.id,
      ...d.data()
    }));

  if (searchInput) searchInput.value = "";

  renderProducts(allProducts);
}

// --- ADD PRODUCT ---
addBtn.addEventListener('click', async () => {
  const name = sanitizeText(prompt("Nom produit?"));
  const variant = sanitizeText(prompt("Variante ? (ex: petit, rouge...)"));
  const imageUrl = sanitizeText(prompt("URL image ?"),500);
  const price_buy = parseFloat(prompt("Prix achat?"));
  const price_sell = parseFloat(prompt("Prix vente?"));
  const price_min = parseFloat(prompt("Prix minimum autorisé?"));
  const stock = parseInt(prompt("Stock initial?"),10);
  

  const blocage = sanitizeText(
  prompt("Autoriser les ventes hors connexion ? (OUI ou NON)"
  )).toUpperCase();
  
  let offlineBlocked = false;
let minOfflineStock = stock;

if (blocage === "OUI") {
  offlineBlocked = false;

  const offlineValue = parseInt(
    prompt("Valeur minimale autorisée hors connexion ?"),
    10
  );

  if (
  !isNaN(offlineValue) &&
  offlineValue >= 0 &&
  offlineValue <= stock
) {
    minOfflineStock = offlineValue;
  }
} else {
  offlineBlocked = true;
}

  if (!name || !variant || isNaN(price_buy) || isNaN(price_sell) || isNaN(stock) || isNaN(price_min)) {
    return alert("Valeurs invalides");
  }
  if (
  imageUrl &&
  !/^https?:\/\//i.test(imageUrl)
) {
  return alert("URL image invalide");
}
  if (price_min <= price_buy) return alert("Prix minimum doit être supérieur au prix d'achat !");
  if (price_sell < price_min) return alert("Prix vente < prix minimum !");

  const now = Timestamp.now();

  const prodRef = await addDoc(collection(db, "products"), {
    name,
    variant,
    imageUrl: imageUrl || "",
    category: "default",
    price_buy,
    price_sell,
    price_min,
    stock_current: stock,
    offlineBlocked,
    minOfflineStock,
    stock_alert: 10,
    isActive: true,
    createdAt: now,
    updatedAt: now
  });

  // --- STOCK MOVEMENT ---
  await addDoc(collection(db, "stock_movements"), {
    productId: prodRef.id,
    type: "IN",
    quantity: stock,
    reason: "initial",
    referenceId: prodRef.id,
    createdBy: currentUserId,
    createdAt: now
  });
    
   debug("✅ Produits Enregistrés");
   await loadProducts();
});

// --- EDIT PRODUCT ---
async function editProduct(id, data) {
    if (!navigator.onLine) {
  debug("Modification impossible hors ligne");
  return;
}
  const name = sanitizeText(prompt("Nom produit?", data.name));
  const variant = sanitizeText(prompt("Variante ?", data.variant || ""));
  const imageUrl = sanitizeText(
  prompt("URL image ?", data.imageUrl || ""),
  500
);
  const price_buy = parseFloat(prompt("Prix achat?", data.price_buy));
  const price_sell = parseFloat(prompt("Prix vente?", data.price_sell));
  const price_min = parseFloat(prompt("Prix minimum autorisé?", data.price_min || data.price_sell));
  
  const defaultOfflineAnswer = data.offlineBlocked ? "NON" : "OUI";

const blocage = sanitizeText(
  prompt(
    "Autoriser les ventes hors connexion ? (OUI ou NON)",
    defaultOfflineAnswer
  )
).toUpperCase();
  
  let offlineBlocked = false;
  let minOfflineStock = Number(data.minOfflineStock) || 0;

if (blocage === "OUI") {
  offlineBlocked = false;

  const offlineValue = parseInt(
    prompt("Valeur min hors ligne", data.minOfflineStock),
    10
  );

  if (!isNaN(offlineValue) && offlineValue >= 1 &&  offlineValue <= data.stock_current) {
    minOfflineStock = offlineValue;
  }
} else {
  offlineBlocked = true;
}

  if (!name || !variant || isNaN(price_buy) || isNaN(price_sell) || isNaN(price_min)) {
    return alert("Valeurs invalides");
  }
  if (
  imageUrl &&
  !/^https?:\/\//i.test(imageUrl)
) {
  return alert("URL image invalide");
}
  if (price_min <= price_buy) return alert("Prix minimum doit être supérieur au prix d'achat !");
  if (price_sell < price_min) return alert("Prix vente < prix minimum !");

  const now = Timestamp.now();

  await updateDoc(doc(db, "products", id), {
    name,
    variant,
    imageUrl,
    price_buy,
    offlineBlocked,
    minOfflineStock,
    price_sell,
    price_min,
    updatedAt: now
  });
  
  debug("✔️ Produits synchronisés");
  await loadProducts();
}

// --- DEACTIVATE PRODUCT ---
async function toggleProductStatus(id, name, currentState) {
    if (!navigator.onLine) {
  debug("Modification impossible hors ligne");
  return;
}

  const actionText = currentState
    ? "désactiver"
    : "réactiver";

  if (
    !confirm(
      `Confirmer ${actionText} ${sanitizeText(name)} ?`
    )
  ) {
    return;
  }

  const now = Timestamp.now();

  await updateDoc(doc(db, "products", id), {
    isActive: !currentState,
    updatedAt: now
  });

  debug(
    currentState
      ? "Produit désactivé"
      : "Produit réactivé"
  );

  await loadProducts();
}

// --- INIT ---
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("Utilisateur non connecté !");
    window.location.replace("login.html");
    return;
  }

  try {
    currentUserId = user.uid;
    await checkUser(currentUserId);
    
    setupNetworkListeners();
    updateNetworkBadge(navigator.onLine);

    await loadProducts();
  } catch (e) {
    alert(e.message);
    console.error(e);
  }
});
