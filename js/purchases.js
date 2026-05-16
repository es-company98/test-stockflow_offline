// purchases.js - VERSION FINALE PRO  (+ filtre côté client bon à <300 produits) + vrai OFFLINE

import { 
  db, collection, addDoc, getDocs, doc, updateDoc, query, where, serverTimestamp, getDoc, runTransaction 
} from './firebase.js';
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import {
  isOffline,
  addToQueue,
  setupNetworkListeners,
  updateNetworkBadge,
  showSyncToast,
  syncQueue
} from "./offline.js";

// --- AUTH ---
const auth = getAuth();
let currentUserId = null;

// --- DOM ---
const purchaseForm = document.getElementById('purchaseForm');
const stockTableBody = document.querySelector('#stockTable tbody');
const productSelect = document.getElementById('productSelect');
const productNameInput = document.getElementById('productName');
const variantInput = document.getElementById('variant');
const imageUrlInput = document.getElementById('imageUrl');

const stockSearch = document.getElementById('stockSearch');
const stockFilter = document.getElementById('stockFilter');

let allProducts = [];

const DEFAULT_MARGIN = 1.3;

const toggleBtn = document.querySelector('.commande button');

if (toggleBtn) {

  toggleBtn.addEventListener('click', () => {
  const f = purchaseForm;
  f.style.display = (getComputedStyle(f).display === "none") ? "flex" : "none";
});
}

// --- COLLECTIONS ---
const purchasesCol = collection(db, 'purchases');
const purchaseItemsCol = collection(db, 'purchase_items');
const productsCol = collection(db, 'products');
const stockMovementsCol = collection(db, 'stock_movements');
const logsCol = collection(db, 'logs');

//----- recherche et filtre------
if (stockSearch) stockSearch.addEventListener('input', applyFilters);
if (stockFilter) stockFilter.addEventListener('change', applyFilters);

function applyFilters() {
  let list = [...allProducts];

  const searchValue = stockSearch.value.toLowerCase();
  const filterValue = stockFilter.value;

  if (searchValue) {
    list = list.filter(p =>
      p.name.toLowerCase().includes(searchValue) ||
      (p.variant || "").toLowerCase().includes(searchValue)
    );
  }

  if (filterValue === "low") {
    list = list.filter(p => p.stock_current <= 10);
  }

  renderStock(list);
}

// --- CONFIG ---
const STOCK_ALERT_THRESHOLD = 10;

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

/* ---   DEBUG  --- */
let debugTimer;

function debug(msg) {

  const box =
    document.getElementById("debug");

  if (!box) return;

  box.textContent = msg;

  box.classList.add("show");

  clearTimeout(debugTimer);

  debugTimer = setTimeout(() => {

    box.classList.remove("show");

    box.textContent = "";

  }, 5000);

}

/* =========================
   PROCESS PURCHASE ONLINE
========================= */

async function processPurchaseOnline(data) {

  const {
    supplier,
    productId,
    quantity,
    unitPrice,
    createdBy
  } = data;

  await checkUser(createdBy);

  const now = serverTimestamp;

  const totalCost =
    unitPrice !== null
      ? quantity * unitPrice
      : 0;

  const purchaseRef =
    await addDoc(purchasesCol, {

      supplier,

      total_cost: totalCost,

      createdBy,

      createdAt: now()

    });

  await addDoc(purchaseItemsCol, {

    purchaseId: purchaseRef.id,

    productId,

    quantity,

    price: unitPrice,

    createdAt: now()

  });

  let diffExpense = 0;

  await runTransaction(db, async (tx) => {

    const productRef =
      doc(db, "products", productId);

    const productSnap =
      await tx.get(productRef);

    if (!productSnap.exists()) {

      throw new Error(
        "Produit supprimé"
      );

    }

    const productData =
      productSnap.data();

    const currentStock =
      Number(
        productData?.stock_current || 0
      );

    const oldBuyPrice =
      Number(
        productData?.price_buy || 0
      );

    const updateData = {

      stock_current:
        currentStock + quantity,

      updatedAt: now()

    };

    if (
      unitPrice !== null &&
      unitPrice > 0
    ) {

      updateData.price_buy =
        unitPrice;

      if (unitPrice > oldBuyPrice) {

        diffExpense =
          (unitPrice - oldBuyPrice)
          * quantity;

      }

    }

    tx.update(
      productRef,
      updateData
    );

    const moveRef =
      doc(stockMovementsCol);

    tx.set(moveRef, {

      productId,

      type: "IN",

      quantity,

      reason: "purchase",

      referenceId:
        purchaseRef.id,

      createdBy,

      createdAt: now()

    });

  });

  if (diffExpense > 0) {

    await addDoc(
      collection(db, "expenses"),
      {

        type: "purchase_diff",

        amount: diffExpense,

        relatedPurchaseId:
          purchaseRef.id,

        createdBy,

        createdAt: now()

      }
    );

  }

}

// --- AJOUT ACHAT ---
if (purchaseForm) {
  purchaseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUserId) {
      alert("Utilisateur non connecté");
      debug("Utilisateur non connecté");
      return;
    }

    const supplier =
      document.getElementById('supplierName')
      ?.value
      .trim();

    const selectedProductId =
      productSelect?.value || "";

    const quantity =
      parseInt(
        document.getElementById('quantity')?.value
      );

    const unitPriceRaw =
      document.getElementById('unitPrice')
      ?.value
      ?.trim();

    const unitPrice =
      unitPriceRaw === ""
        ? null
        : Number(unitPriceRaw);

    // --- VALIDATION ---
    if (!supplier) {
      alert("Fournisseur requis");
      debug("Fournisseur manquant");
      return;
    }

    if (
      !selectedProductId ||
      selectedProductId === "new"
    ) {
      alert("Produit invalide");
      debug("Produit invalide");
      return;
    }

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      alert("Quantité invalide");
      debug("Quantité invalide");
      return;
    }

    if (
      unitPrice !== null &&
      (
        !Number.isFinite(unitPrice) ||
        unitPrice <= 0
      )
    ) {
      alert("Prix invalide");
      debug("Prix achat invalide");
      return;
    }

    try {

      const productExists =
        allProducts.some(
          p => p.id === selectedProductId
        );

      if (!productExists) {
        throw new Error(
          "Produit introuvable"
        );
      }

      /* =========================
         OFFLINE PURCHASE
      ========================= */

      if (isOffline()) {

        addToQueue({
          type: "PURCHASE",
          data: {
            supplier,
            productId: selectedProductId,
            quantity,
            unitPrice,
            createdBy: currentUserId,
            createdAt: Date.now()
          }
        });

        debug(
          "📦 Achat sauvegardé offline"
        );

        showSyncToast(
          "📦 Achat sauvegardé hors ligne",
          "warning"
        );

        purchaseForm.reset();

        return;

      }

      /* =========================
         ONLINE PURCHASE
      ========================= */

      await processPurchaseOnline({
        supplier,
        productId: selectedProductId,
        quantity,
        unitPrice,
        createdBy: currentUserId
      });

      debug("✅ Achat enregistré");

      purchaseForm.reset();

      await loadStock();

    } catch (err) {

      console.error(err);
      debug(
        err?.message ||
        "Erreur achat"
      );
      alert(
        err?.message ||
        "Erreur lors de l'achat"
      );
    }
  });
}

// --- LOAD STOCK ---
async function loadStock() {
  stockTableBody.replaceChildren();
  const prodSnap = await getDocs(productsCol);
  if (isOffline()) 
  {
  debug("📴 Stock affiché depuis cache local" );
  showSyncToast(
  "📴 Stock affiché depuis cache local",
  "warning"
);
   }

  allProducts = [];
  
  productSelect.replaceChildren();

const defaultOption = document.createElement("option");

defaultOption.value = "";
defaultOption.textContent = "-- Sélectionner --";

productSelect.appendChild(defaultOption);

  prodSnap.forEach(docSnap => {
    const p = docSnap.data();
    if (!p.isActive) return;

    allProducts.push({
      id: docSnap.id,
      ...p
    });
    // AJOUT DIRECT AU SELECT
const opt = document.createElement('option');
opt.value = docSnap.id;
opt.textContent = `${p.name} ${p.variant ? "(" + p.variant + ")" : ""}`;
productSelect.appendChild(opt);
  });

  renderStock(allProducts);
}

// --------- render ----------
function renderStock(list) {

  stockTableBody.replaceChildren();

  const fragment = document.createDocumentFragment();

  list.forEach(p => {

    const tr = document.createElement('tr');

    // --- NAME ---
    const nameTd = document.createElement('td');

    const variantText = p.variant
      ? ` (${p.variant})`
      : "";

    nameTd.textContent =
      `${p.name}${variantText}`;

    // --- STOCK ---
    const stockTd = document.createElement('td');
    stockTd.textContent =
      String(p.stock_current || 0);

    // --- BUY PRICE ---
    const buyTd = document.createElement('td');

    buyTd.textContent =
      `${Number(p.price_buy || 0).toFixed(2)} FC`;

    // --- STOCK VALUE ---
    const valueTd = document.createElement('td');

    const totalValue =
      (Number(p.stock_current || 0) *
      Number(p.price_buy || 0));

    valueTd.textContent =
      `${totalValue.toFixed(2)} FC`;

    // --- ACTION ---
    const actionTd = document.createElement('td');

    const btn = document.createElement('button');

    btn.type = "button";
    btn.textContent = "Modifier";

    btn.addEventListener("click", () => {

      manualUpdate(p.id);

    });

    actionTd.appendChild(btn);

    tr.appendChild(nameTd);
    tr.appendChild(stockTd);
    tr.appendChild(buyTd);
    tr.appendChild(valueTd);
    tr.appendChild(actionTd);

    fragment.appendChild(tr);

  });

  stockTableBody.appendChild(fragment);

}

// --- MANUAL UPDATE ---
async function manualUpdate(productId) {
    if (isOffline()) {

  alert(
    "Correction stock impossible offline"
  );
  return;
}
  if (!currentUserId) return alert("Non connecté");
  const newQty = parseInt(prompt("Nouvelle quantité :"));
  
  // on fait runTransaction()
  if (isNaN(newQty) || newQty < 0) return;

  try {

  await checkUser(currentUserId);

  const prodRef =
    doc(db, "products", productId);

  await runTransaction(db, async (tx) => {

    const prodSnap =
      await tx.get(prodRef);

    if (!prodSnap.exists()) {
      throw new Error("Produit introuvable");
    }

    const currentStock =
      Number(
        prodSnap.data().stock_current || 0
      );

    const diff =
      newQty - currentStock;

    if (diff === 0) {
      throw new Error("Aucune modification");
    }

    tx.update(prodRef, {
      stock_current: newQty,
      updatedAt: serverTimestamp()
    });

    const moveRef =
      doc(stockMovementsCol);

    tx.set(moveRef, {
      productId,
      type: diff > 0 ? "IN" : "OUT",
      quantity: Math.abs(diff),
      reason: "manual_correction",
      referenceId: productId,
      createdBy: currentUserId,
      createdAt: serverTimestamp()
    });

    const logRef =
      doc(logsCol);

    tx.set(logRef, {
      userId: currentUserId,
      action: "manual_stock_update",
      targetId: productId,
      details: {
        oldQty: currentStock,
        newQty
      },
      createdAt: serverTimestamp()
    });

  });

  debug("Stock modifié");

  await loadStock();

}  catch (e) {
  console.error(e);
  debug(
    e?.message ||
    "Erreur modification stock"
  );
  alert(   e?.message ||  "Erreur modification stock" );
}}

/* ---   NETWORK INIT    --- */
let isSyncing = false;
updateNetworkBadge(
  navigator.onLine
);

setupNetworkListeners(async () => {
  try {
   if (isSyncing) return;
isSyncing = true;

try {
  await syncQueue({
    PURCHASE:processPurchaseOnline
  });
} finally {
  isSyncing = false;
}
    await loadStock();
    debug("🔄 Synchronisation terminée");
  } catch(err) {

    console.error(err);
    debug(
      err?.message ||
      "Erreur synchronisation"
    );
  }
});


// --- INIT ---
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("Utilisateur non connecté !");
    window.location.replace("login.html");
    return;
  }
  currentUserId = user.uid;
  try {
    await checkUser(currentUserId);
    if (isSyncing) return;

isSyncing = true;
try {
  await syncQueue({
    PURCHASE:processPurchaseOnline
  });
} finally {
  isSyncing = false;
}
    await loadStock();
  } catch (e) {
    alert(e.message);
  }
});
