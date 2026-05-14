// expenses v1
import {
  db,
  auth,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy,
  Timestamp,
  runTransaction
} from "./firebase.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

let currentUserId = null;
let allData = [];
let allProducts = [];

const ITEMS_PER_PAGE = 10;
let currentPage = 1;

// ================= DOM =================
const list = document.getElementById("expensesList");
const searchInput = document.getElementById("searchInput");
const filterCategory = document.getElementById("filterCategory");
const startDate = document.getElementById("startDate");
const endDate = document.getElementById("endDate");


const btnExpense = document.getElementById("addExpenseBtn");
const btnDebt = document.getElementById("addDebtBtn");
const btnProductLoss = document.getElementById("submitProductLoss");
const btnMoneyLoss = document.getElementById("submitMoneyLoss");

function debug(msg) {
  const box = document.getElementById("debug");
  if (!box) return;

  box.textContent = msg;

  setTimeout(() => box.textContent = "", 5000);
}

function setLoading(state) {
  list.replaceChildren();

  if (state) {
    const div = document.createElement("div");
    div.textContent = "⏳ Chargement...";
    list.appendChild(div);
  }
}

// ================= PRODUCTS =================
async function loadProducts() {
  const snap = await getDocs(collection(db, "products"));

  allProducts = [];
  const select = document.getElementById("productSelect");

  select.replaceChildren();

  snap.forEach(d => {
    const p = { id: d.id, ...d.data() };
    allProducts.push(p);

    const option = document.createElement("option");
    option.value = p.id;

    option.textContent = `${p.name} (${p.variant || "standard"}) — stock:${p.stock_current}`;

    select.appendChild(option);
  });
}

// ================= DATA =================
async function loadData() {
  try {
    setLoading(true);

    const q = query(collection(db, "expensess"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    allData = [];

    snap.forEach(d => {
      allData.push({ id: d.id, ...d.data() });
    });

    render();

  } catch (e) {
    console.error("FULL ERROR:", e);
    debug("❌ loadData: " + (e?.message || e));

  } finally {
    setLoading(false);
  }
}

// ================= FILTER =================
function getFiltered() {
  return allData.filter(e => {
    const search = (searchInput?.value || "").toLowerCase();

    const matchSearch =
      !search ||
      (e.reason || "").toLowerCase().includes(search) ||
      (e.category || "").toLowerCase().includes(search);

    const matchCategory =
      filterCategory.value === "all" ||
      e.category === filterCategory.value;

    const date = e.createdAt?.toDate ? e.createdAt.toDate() : null;
      
      const matchDate =
  (!startDate.value || (date && date >= new Date(startDate.value))) &&
  (!endDate.value || (date && date <= new Date(endDate.value)));

    return matchSearch && matchCategory && matchDate;
  });
}

function resetInputs(ids){
  ids.forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;

    if(el.tagName === "SELECT"){
      el.selectedIndex = 0;
    } else {
      el.value = "";
    }
  });
}


// ================= RENDER =================
function render(page = 1) {
  currentPage = page;

  const data = getFiltered()
  .filter(e => e.status !== "cancelled");
  const start = (page - 1) * ITEMS_PER_PAGE;
  const pageData = data.slice(start, start + ITEMS_PER_PAGE);

  list.replaceChildren();

  pageData.forEach(item => {
    const div = document.createElement("div");
    div.classList.add("expense-item");

    const left = document.createElement("div");

    const title = document.createElement("strong");
    title.textContent = item.reason || "—";

    // ===== BADGES =====
    const badge = document.createElement("span");
    badge.classList.add("badge");

    if(item.genre === "expense"){
      badge.classList.add("badge-expense");
      badge.textContent = "EXPENSE";
      title.appendChild(badge);
    }
    else if(item.genre === "debt"){
      // 👉 badge TYPE
      const badgeType = document.createElement("span");
      badgeType.classList.add("badge", "badge-debt");
      badgeType.textContent = "DEBT";

      // 👉 badge STATUS
      const badgeStatus = document.createElement("span");
      badgeStatus.classList.add("badge");

      if(item.status === "paid"){
        badgeStatus.classList.add("badge-paid");
        badgeStatus.textContent = "PAID";
      } else {
        badgeStatus.classList.add("badge-partial");
        badgeStatus.textContent = "PARTIAL";
      }

      title.appendChild(badgeType);
      title.appendChild(badgeStatus);
    }
    else if(item.genre === "loss"){
      badge.classList.add("badge-loss");
      badge.textContent = "LOSS";
      title.appendChild(badge);
    }

    // ===== SUB =====
    const sub = document.createElement("small");

    let displayAmount = 0;

    if (item.genre === "debt") {
      sub.textContent = item.name || "unknown";
      displayAmount = item.amount_remaining || 0;

      if (item.DueDate && item.DueDate.toDate) {
        const due = item.DueDate.toDate();
        const now = new Date();
        const days = Math.ceil((due - now) / (1000 * 60 * 60 * 24));

        const dueText = document.createElement("div");
        dueText.textContent = `⏳ ${days} jours`;
        dueText.style.color = "red";
        dueText.style.fontSize = "12px";

        left.appendChild(dueText);
      }

    } else {
      sub.textContent = item.category || "—";
      displayAmount = item.amount || 0;
    }

    left.appendChild(title);
    left.appendChild(sub);

    const amount = document.createElement("div");
    amount.textContent = `${displayAmount || 0} FC`;
    amount.style.fontWeight = "bold";

    const btn = document.createElement("button");
    btn.textContent = "Modifier";
    btn.addEventListener("click", () => modifyFunc(item.id));

    div.appendChild(left);
    div.appendChild(amount);
    div.appendChild(btn);

    list.appendChild(div);
  });

  renderPagination(data.length);
}

// ================= STOCK MOVEMENT =================
async function addStockMovement({ productId, type, quantity, reason, referenceId = null }) {
  if (!productId || !type || !quantity) return;

  await addDoc(collection(db, "stock_movements"), {
    productId,
    type,
    quantity,
    reason: reason || "unknown",
    referenceId,
    createdBy: currentUserId,
    createdAt: Timestamp.now()
  });
}


// ================= PAGINATION =================
function renderPagination(total) {
  const old = document.getElementById("pagination");
  if (old) old.remove();

  const pages = Math.ceil(total / ITEMS_PER_PAGE);

  const container = document.createElement("div");
  container.id = "pagination";
  container.style.display = "flex";
  container.style.gap = "6px";
  container.style.justifyContent = "center";
  container.style.marginTop = "10px";

  for (let i = 1; i <= pages; i++) {
    const btn = document.createElement("button");

    btn.textContent = i;

    btn.style.padding = "6px 10px";
    btn.style.border = "none";
    btn.style.borderRadius = "6px";
    btn.style.cursor = "pointer";

    if (i === currentPage) {
      btn.style.background = "#0B5FFF";
      btn.style.color = "white";
    }

    btn.addEventListener("click", () => {
      render(i);
  });

    container.appendChild(btn);
  }

  list.after(container);
}

// ================= EXPENSE =================
btnExpense.addEventListener("click", async () => {
  const label = document.getElementById("label").value;
  const category = document.getElementById("category").value;
  const amount = Number(document.getElementById("amount").value);
  const type = document.getElementById("type").value;
  const relatedTo = document.getElementById("relatedTo").value;
  const note = document.getElementById("note").value;

  if (!label || isNaN(amount) || amount <= 0) {
    return alert("Montant invalide");
  }

  await addDoc(collection(db, "expensess"), {
    genre: "expense",
    reason: label,
    category,
    amount,
    type,
    relatedTo: relatedTo || null,
    note: note || "",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    createdBy: currentUserId
  });

  debug("dépense enregistrée");
  resetInputs([
  "label",
  "category",
  "amount",
  "type",
  "relatedTo",
  "note"
]);
  loadData();
});

// ================= DEBT =================
btnDebt.addEventListener("click", async () => {
  const type = document.getElementById("debtType").value;
  const name = document.getElementById("debtName").value;
  const total = Number(document.getElementById("debtAmount").value);
  const paid = Number(document.getElementById("debtPayed").value);
  const note = document.getElementById("debtNote").value;
  
  const phone = document.getElementById("debtPhone").value;
  
  const dueDateInput = document.getElementById("debtDueDate").value;

let dueTimestamp = null;
if (dueDateInput) {
  dueTimestamp = Timestamp.fromDate(new Date(dueDateInput));
}

  if (!name || isNaN(total) || total <= 0) {
    return alert("Champs obligatoires");
  }

  const safePaid = isNaN(paid) ? 0 : paid;
  const remaining = total - safePaid;

  await addDoc(collection(db, "expensess"), {
    genre: "debt",
    reason: `${type} debt`,
    name: name,
    category: type,
    
    phone: phone || "",
    DueDate: dueTimestamp,
    amount_total: total,
    amount_paid: safePaid,
    amount_remaining: remaining,
    status: remaining > 0 ? "partial" : "paid",

    relatedTo: name,
    note: note || "",

    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    createdBy: currentUserId
  });

  debug("dette enregistrée");
  
  resetInputs([
  "debtType",
  "debtName",
  "debtAmount",
  "debtPayed",
  "debtPhone",
  "debtDueDate",
  "debtNote"
]);

  loadData();
});

// ================= LOSS PRODUCT =================
btnProductLoss.addEventListener("click", async () => {
  try {

    const productId = document.getElementById("productSelect").value;
    const qtyLost = Number(document.getElementById("productQuantityLost").value);
    const reason = document.getElementById("productLossReason").value;

    if (!productId || qtyLost <= 0) return alert("Produit invalide");

    const product = allProducts.find(p => p.id === productId);
    if (!product) return alert("Produit introuvable");

    const currentStock = Number(product.stock_current || 0);
    const newStock = Math.max(0, currentStock - qtyLost);

    const priceBuy = Number(product.price_buy || 0);

const ref = await addDoc(collection(db, "expensess"), {
  genre: "loss",
  reason,
  category: "product_loss",
  amount: qtyLost * priceBuy,
  relatedTo: productId,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  createdBy: currentUserId
});

await addStockMovement({
  productId,
  type: "OUT",
  quantity: qtyLost,
  reason: "loss",
  referenceId: ref.id
});

    await updateDoc(doc(db, "products", productId), {
      stock_current: newStock
    });

    loadProducts();
    loadData();
    
    debug(`OK LOSS: ${productId} | -${qtyLost} | stock=${newStock}`);
    console.log("OK LOSS:", { productId, qtyLost, newStock });
    
    resetInputs([
  "productQuantityLost",
  "productLossReason"
]);

  } catch (err) {
    console.error("LOSS ERROR:", err);
    debug(`LOSS ERROR: ${err.message || err}`);
    alert("Erreur perte produit");
  }
});

// ================= LOSS MONEY =================
btnMoneyLoss.addEventListener("click", async () => {
  const amount = Number(document.getElementById("moneyLostAmount").value);
  const reason = document.getElementById("moneyLossReason").value;

  if (isNaN(amount) || amount <= 0) {
    return alert("Montant invalide");
  }

  await addDoc(collection(db, "expensess"), {
    genre: "loss",
    reason,
    category: "money_loss",
    amount,
    type: "fixed",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    createdBy: currentUserId
  });

  debug("perte argent enregistrée");
  
  resetInputs([
  "moneyLostAmount",
  "moneyLossReason"
]);

  loadData();
});

// =============== MODIFICATION ===============
async function modifyFunc(id){
  if(!currentUserId){
    alert("Non autorisé");
    return;
  }

  const item = allData.find(e => e.id === id);
  if (!item) return;

  // ================= LOSS =================
  if(item.genre === "loss"){
    // ❌ BLOQUER CORRECTION D’UNE CORRECTION
  if (item.isSystemCorrection === true) {
  alert("Impossible de corriger une correction");
  return;
    }
   
    const qty = Number(prompt("Quantité à corriger (+ uniquement)"));

    if(isNaN(qty) || qty <= 0) return;

    const productId = item.relatedTo;
    const product = allProducts.find(p => p.id === productId);
    if (!product) return alert("Produit introuvable");
    
    const priceBuy = Number(product.price_buy || 0);

    // mouvement inverse
    await addDoc(collection(db, "stock_movements"), {
      productId,
      type: "IN",
      quantity: qty,
      reason: "correction_loss",
      referenceId: id,
      createdBy: currentUserId,
      createdAt: Timestamp.now()
    });

    // update stock cache
    await updateDoc(doc(db, "products", productId), {
      stock_current: Number(product.stock_current || 0) + qty
    });
    
    // correction de perte
    await addDoc(collection(db, "expensess"), {
  genre: "loss",
  reason: "correction",
  category: "product_loss_correction",
  isSystemCorrection: true,
  amount: qty * priceBuy,
  relatedTo: productId,
  relatedExpenseId: id,
  createdAt: Timestamp.now(),
  createdBy: currentUserId
});
    await updateDoc(doc(db, "expensess", id), {
  status: "cancelled",
  updatedAt: Timestamp.now()
});

    debug("Correction perte OK");

    await loadProducts();
    await loadData();
  }

  // ================= EXPENSE =================
  else if(item.genre === "expense"){
    const newAmount = Number(prompt("Nouveau montant"));

    if(isNaN(newAmount) || newAmount <= 0) return;

    await updateDoc(doc(db, "expensess", id), {
      amount: newAmount,
      updatedAt: Timestamp.now()
    });

    debug("Dépense modifiée");

    await loadData();
  }

  // ================= DEBT =================

else if(item.genre === "debt"){
  const pay = Number(prompt("Montant payé"));

  if(isNaN(pay) || pay <= 0) return;

  const debtRef = doc(db, "expensess", id);

  await runTransaction(db, async (tx) => {

    const debtSnap = await tx.get(debtRef);
    if (!debtSnap.exists()) throw new Error("Dette introuvable");

    const d = debtSnap.data();

    const currentPaid = Number(d.amount_paid || 0);
    const total = Number(d.amount_total || 0);

    const newPaid = currentPaid + pay;

    if(newPaid > total){
      throw new Error("Paiement dépasse la dette");
    }

    const remaining = total - newPaid;
    const status = remaining > 0 ? "partial" : "paid";

    // ✅ UPDATE DETTE
    tx.update(debtRef, {
      amount_paid: newPaid,
      amount_remaining: remaining,
      status,
      updatedAt: Timestamp.now()
    });

    // ✅ UPDATE SALE SI LIÉE
    if(d.relatedSaleId){
      const saleRef = doc(db, "sales", d.relatedSaleId);
      const saleSnap = await tx.get(saleRef);

      if(saleSnap.exists()){
        const s = saleSnap.data();

        const salePaid = Number(s.amount_paid || 0) + pay;
        const saleTotal = Number(s.total_amount || 0);

        const saleRemaining = saleTotal - salePaid;
        const saleStatus = saleRemaining > 0 ? "partial" : "paid";

        tx.update(saleRef, {
          amount_paid: salePaid,
          amount_remaining: saleRemaining,
          payment_status: saleStatus,
          hasDebt: saleRemaining > 0,
          updatedAt: Timestamp.now()
        });
      }
    }
  });

  debug("Paiement ajouté (sync OK)");
  await loadData();
}
}

// ================= EVENTS =================
searchInput.addEventListener("input", () => render(1));
filterCategory.addEventListener("change", () => render(1));
startDate.addEventListener("change", () => render(1));
endDate.addEventListener("change", () => render(1));

// ================= AUTH =================
onAuthStateChanged(auth, async (user) => {
  if (!user) return (location.href = "login.html");

  currentUserId = user.uid;

  try {
    setLoading(true);
    await loadProducts();
    await loadData();
    setLoading(false);
  } catch (e) {
    console.error(e);
    debug("❌ ERROR LOAD: " + (e.message || e));
  }
});
