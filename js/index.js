//v1 index.js FINAL ULTRA PRO + ANTI DOUBLE VENTE + debts logique + manual Stock + muti seller + OFFLINE ( OK )
import { 
  db, collection, addDoc, getDoc, doc, updateDoc, Timestamp, getDocs, query, where, enableIndexedDbPersistence, runTransaction, serverTimestamp
} from './firebase.js';

import {
  registerServiceWorker,
  setupInstallButton,
  setupNetworkListeners,
  syncQueue,
  saveOfflineSale,
  initOfflinePersistence,
  validateOfflineProduct,
  isOffline,
  showOfflineWarning
} from "./offline.js";

import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { generateReceipt } from "./receipt.js";


// --- OFFLINE ---
await initOfflinePersistence(enableIndexedDbPersistence);

// --- DOM ---
const paymentType = document.getElementById('paymentType');
const amountPaidInput = document.getElementById('amountPaid');
const clientNameInput = document.getElementById('clientName');

const stats = document.getElementById("stats");

const productsContainer = document.getElementById('productsContainer');
const cartDom = document.querySelector('.cart');
const cartTotalDom = cartDom.querySelector('.total');
const sellBtn = cartDom.querySelector('.sell-btn');
const manualDateCheckbox = document.getElementById('manualDate');
const saleDateInput = document.getElementById('saleDate');
const searchInput = document.getElementById('searchInput');

//limit sales date
const today = new Date().toISOString().split("T")[0];
saleDateInput.max = today;
const now = new Date();
saleDateInput.max = now.toISOString().split("T")[0];
saleDateInput.min = "2026-04-31";
// sécurité date
saleDateInput.addEventListener("input", () => {
  const selected = new Date(saleDateInput.value).getTime();

  if (selected > Date.now()) {
    saleDateInput.value = "";
    alert("Date future interdite");
  }
});

// ---- open debts input 
function togglePaymentInput() {
  const isPartial = paymentType?.value === "partial";

  amountPaidInput.style.display = isPartial ? "block" : "none";

  if (!isPartial) {
    amountPaidInput.value = "";
  }
}

// INIT
document.addEventListener("DOMContentLoaded", () => {
  togglePaymentInput();
});

// EVENTS
paymentType.addEventListener('change', togglePaymentInput);

// 🔥 IMPORTANT : sync initial state au chargement
togglePaymentInput();

// --- STATE ---
let cart = [];
let allProducts = [];
let isProcessingSale = false;   // 🔒 LOCK PRINCIPAL
let lastSaleTime = 0;           // 🔒 ANTI SPAM

// --- AUTH ---
const auth = getAuth();
let currentUserId = null;


// --- date format---
function getSaleDate() {

  const now = Date.now();

  if (manualDateCheckbox?.checked && saleDateInput?.value) {
    const selected = new Date(saleDateInput.value).getTime();

    // 🚫 future strict
    if (selected > now) {
      throw new Error("Date invalide (future)");
    }

    // 🚫 too old (option sécurité business)
    const maxPast = now - (365 * 24 * 60 * 60 * 1000);
    if (selected < maxPast) {
      throw new Error("Date trop ancienne");
    }
    return selected;
  }
  return now;
}

// --- SECURITY ---
async function checkUser(uid) {
  const userDoc = await getDoc(doc(db, "users", uid));
  if (!userDoc.exists()) throw new Error("Utilisateur inconnu");

  const data = userDoc.data();
  if (!data.isActive || !["admin","seller"].includes(data.role)) {
    throw new Error("Accès refusé");
  }

  return data;
}

// --- LOAD PRODUCTS ---
async function loadProducts() {
  const snap = await getDocs(collection(db, "products"));
  allProducts = [];

  snap.forEach(docSnap => {
    const p = docSnap.data();
    if (!p?.isActive) return;

    const price_min = p.price_min ?? p.price_sell ?? p.price_buy ?? 0;

    allProducts.push({
      id: docSnap.id,
      ...p,
      price_min
    });
  });

  renderProducts(allProducts);
}

// --- RENDER ---
function renderProducts(list) {
  productsContainer.replaceChildren();

  list.forEach(p => {
    const div = document.createElement('div');
    div.className = 'product fade-in';

    const img = p.imageUrl || "default.png";
    div.style.backgroundImage = `url(${img})`;
    div.style.backgroundSize = "cover";
    div.style.backgroundPosition = "center";

    const content = document.createElement("div");
    content.className = "product-content";

    const title = document.createElement("h4");
    title.textContent = p.name;

    if (p.variant) {
      const variant = document.createElement("div");
      variant.textContent = p.variant;
      content.appendChild(variant);
    }

    const stock = document.createElement("p");
    stock.textContent = `Stock: ${p.stock_current ?? 0}`;

    const price = document.createElement("p");
    price.textContent = `${(p.price_sell || 0).toFixed(2)}FC`;

    // 👉 INPUT QTY
    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.min = "1";
    qtyInput.placeholder = "Qté";

    // 👉 BTN OK (manual add)
    const okBtn = document.createElement("button");
    okBtn.textContent = "OK";

    okBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // 🔒 empêche click card

      const val = Number(qtyInput.value);

      if (isNaN(val) || val <= 0) {
        alert("Quantité invalide");
        return;
      }

      if (val > (p.stock_current || 0)) {
        qtyInput.value = p.stock_current || 0;
        alert(`Stock max: ${p.stock_current || 0}`);
        return;
      }

      addToCartManual(p, val);
      qtyInput.value = ""; // UX clean
    });

    // 👉 CLICK CARD = add rapide
    div.addEventListener("click", (e) => {
      // ignore si interaction avec input/button
      if (e.target.closest("input") || e.target.closest("button")) return;

      addToCart(p);
    });

    content.appendChild(title);
    content.appendChild(stock);
    content.appendChild(price);
    content.appendChild(qtyInput);
    content.appendChild(okBtn);

    div.appendChild(content);
    productsContainer.appendChild(div);

    setTimeout(() => div.classList.add('visible'), 50);
  });
}

// --- SEARCH ---
searchInput.addEventListener('input', () => {
  const v = searchInput.value.toLowerCase();
  renderProducts(
    allProducts.filter(p =>
      p.name.toLowerCase().includes(v) ||
      (p.variant || "").toLowerCase().includes(v)
    )
  );
});


// --- CART ---
function addToCart(p) {

  if (p.stock_current <= 0) {
    alert("Stock épuisé");
    return;
  }

  try {

    validateOfflineProduct(p);

  } catch (err) {

    alert(err.message);
    return;

  }

  const exist = cart.find(i => i.productId === p.id);

  if (exist) {

    if (exist.qty >= p.stock_current) {
      alert("Stock max atteint");
      return;
    }

    exist.qty++;

  } else {

    cart.push({
      productId: p.id,
      name: p.name,
      variant: p.variant || "",
      price: p.price_sell,
      price_min: p.price_min,
      price_buy: p.price_buy || 0,
      qty: 1
    });

  }

  updateCartUI();

}

function addToCartManual(p, qty) {

  if (p.stock_current <= 0) {
    alert("Stock épuisé");
    return;
  }

  try {

    validateOfflineProduct(p);

  } catch (err) {

    alert(err.message);
    return;

  }

  const exist = cart.find(i => i.productId === p.id);

  if (exist) {

    const newQty = exist.qty + qty;

    if (newQty > p.stock_current) {

      exist.qty = p.stock_current;
      alert("Stock max atteint");

    } else {

      exist.qty = newQty;

    }

  } else {

    cart.push({
      productId: p.id,
      name: p.name,
      variant: p.variant || "",
      price: p.price_sell,
      price_min: p.price_min,
      price_buy: p.price_buy || 0,
      qty: Math.min(qty, p.stock_current)
    });

  }

  updateCartUI();

}


function removeFromCart(id) {
  const i = cart.findIndex(x => x.productId === id);
  if (i !== -1) {
    cart[i].qty--;
    if (cart[i].qty <= 0) cart.splice(i,1);
  }
  updateCartUI();
}

// --- CART UI ---
function updateCartUI() {

  cartDom
    .querySelectorAll('.cart-item')
    .forEach(e => e.remove());

  let total = 0;

  cart.forEach(item => {

    total += item.price * item.qty;

    const div = document.createElement('div');
    div.className = 'cart-item';

    const name = document.createElement('span');
    name.textContent = `${item.name} x${item.qty}`;

    const controls = document.createElement('span');

    const input = document.createElement('input');
    input.type = "number";
    input.value = item.price;
    input.min = item.price_min;

    input.style.setProperty(
      "width",
      "60px",
      "important"
    );

    input.classList.add("cart-price-input");

    const ok = document.createElement('button');
    ok.textContent = "OK";

    ok.addEventListener("click", () => {

      const val = parseFloat(input.value);

      if (isNaN(val)) {
        alert("Prix invalide");
        return;
      }

      if (val < item.price_min) {
        alert(`Minimum: ${item.price_min}`);
        return;
      }

      item.price = val;

      updateCartUI();

    });

    const del = document.createElement('button');
    del.textContent = "x";

    del.addEventListener("click", () => {

      removeFromCart(item.productId);

    });

    controls.appendChild(input);
    controls.appendChild(ok);
    controls.appendChild(del);

    div.appendChild(name);
    div.appendChild(controls);

    cartDom.insertBefore(div, cartTotalDom);

  });

  cartTotalDom.textContent =
    `Total: ${total.toFixed(2)} FC`;

}


// calculator pour dettes 
function computePayment(totalAmount, paymentMode, inputAmount) {

  let amount_paid = totalAmount;

  if (paymentMode === "partial") {

    if (inputAmount === "" || inputAmount === null || inputAmount === undefined) {
      throw new Error("Montant requis");
    }

    const val = Number(inputAmount);

    if (isNaN(val)) throw new Error("Montant invalide");
    if (val <= 0 || val >= totalAmount) {
      throw new Error("Montant partiel incorrect");
    }

    amount_paid = val;
  }

  const amount_remaining = totalAmount - amount_paid;

  return {
    payment_status: amount_remaining === 0 ? "paid" : "partial",
    amount_paid,
    amount_remaining,
    hasDebt: amount_remaining > 0
  };
}
// --- onLine ---
async function processSaleOnline(data) {

  const {
  cart,
  userId,
  sellerId,
  payment,
  saleDate,
  totalAmount,
  totalProfit,
  offlineActionId,
  deviceId
} = data;

const finalSellerId = sellerId || userId;

  const saleRef = doc(collection(db,"sales"));
  
  if (offlineActionId) {

  const q = query(
    collection(db, "sales"),
    where("offlineActionId", "==", offlineActionId)
  );

  const existing = await getDocs(q);

  if (!existing.empty) {

    alert("⚠️ Vente déjà synchronisée");

    return;

  }

}

  await runTransaction(db, async (tx) => {

    // 1. STOCK UPDATE
    for (const item of cart) {

      const ref = doc(db, "products", item.productId);
      const snap = await tx.get(ref);

      if (!snap.exists()) throw new Error("Produit supprimé");

      const stock = snap.data().stock_current || 0;

      if (stock < item.qty) {
        throw new Error("Stock insuffisant");
      }

      tx.update(ref, {
        stock_current: stock - item.qty
      });
    }

    // 2. SALE
    tx.set(saleRef, {
      sellerId: finalSellerId,
      total_amount: totalAmount,
      total_profit: totalProfit,
      offlineActionId: offlineActionId || null,
deviceId: deviceId || null,
syncSource: offlineActionId ? "offline-sync" : "online",
      status: "active",
      ...payment,
      createdAt: Timestamp.fromMillis(saleDate)
    });

    // 3. ITEMS
    for (const item of cart) {

      const itemRef = doc(collection(db, "sale_items"));

tx.set(itemRef, {
  saleId: saleRef.id,
  productId: item.productId,
  quantity: item.qty,
  price: item.price,
  price_min: item.price_min,
  profit: (item.price - item.price_buy) * item.qty,
  createdAt: Timestamp.fromMillis(saleDate)
});

const movementRef = doc(collection(db, "stock_movements"));

tx.set(movementRef, {
  productId: item.productId,
  type: "OUT",
  quantity: item.qty,
  reason: "sale",
  referenceId: saleRef.id,
  createdBy: userId,
  createdAt: Timestamp.fromMillis(saleDate)
});
}

    // 4. DEBT
    if (payment.payment_status === "partial") {

      const debtRef = doc(collection(db,"expensess"));

      tx.set(debtRef, {
        genre: "debt",
        category: "debt",
        amount: payment.amount_remaining,
        amount_total: totalAmount,
        amount_paid: payment.amount_paid,
        amount_remaining: payment.amount_remaining,
        status: "partial",
        relatedSaleId: saleRef.id,
        createdAt: serverTimestamp()
    });
  }


// --- SELL (ANTI DOUBLE) ---
sellBtn.addEventListener('click', async () => {

  if (isProcessingSale) return;

  const nowTime = Date.now();
  if (nowTime - lastSaleTime < 1500) return;
  lastSaleTime = nowTime;

  if (!cart.length) return;

  isProcessingSale = true;
  sellBtn.disabled = true;

  try {

    await checkUser(currentUserId);

    // 🔥 CALCULS AVANT TOUT
    const totalAmount = cart.reduce((a,b)=>a+b.qty*b.price,0);
const totalProfit = cart.reduce((a,b)=>a+(b.price-b.price_buy)*b.qty,0);

const paymentMode = paymentType.value;

const payment = computePayment(
  totalAmount,
  paymentMode,
  amountPaidInput.value
);

let saleDate;

try {
  saleDate = getSaleDate();
} catch (e) {
  alert(e.message);
  return;
}

const payload = {
  cart: structuredClone(cart),
  sellerId: currentUserId,
  payment,
  saleDate,
  totalAmount,
  totalProfit
};

    // 🧠 OFFLINE FIRST
    if (isOffline()) {

      saveOfflineSale(payload);
      showOfflineWarning();

      cart = [];
      updateCartUI();

      return;
    }

    // 🧠 ONLINE
    
    await processSaleOnline(payload);

    await syncQueue(processSaleOnline);

    alert("Vente OK");
    
    cart = [];
    updateCartUI();

  } catch (e) {
    alert(e.message);
  } finally {
    isProcessingSale = false;
    sellBtn.disabled = false;
  }
});

// --- INIT ---
onAuthStateChanged(auth, async (user) => {
  if (!user) return location.replace("login.html");

  currentUserId = user.uid;

  try {
      await checkUser(currentUserId);
      await loadProducts();
      await syncQueue(processSaleOnline);
  } catch(e){
  alert(e.message);
    }
});
setupNetworkListeners(async () => {

  await syncQueue(processSaleOnline);

});

registerServiceWorker();

setupInstallButton();
function resetPaymentUI() {
  amountPaidInput.value = "";
  amountPaidInput.style.display = "none";
  }
