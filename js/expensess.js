// expenses v1 + futre pro
import {
  db,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  runTransaction
} from "./firebase.js";

import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { FILTERS, injectOptions } from "./filter.js";

const auth = getAuth();

let currentUserId = null;
let allData = [];
let allProducts = [];

const ITEMS_PER_PAGE = 10;
let currentPage = 1;

// ================= DOM =================
const list = document.getElementById("expensesList");


const searchInput = document.getElementById("searchInput");
const startDate = document.getElementById("startDate");
const endDate = document.getElementById("endDate");
const filterGenre = document.getElementById("filterGenre");
const filterStatus = document.getElementById("filterStatus");
const filterCategory = document.getElementById("filterCategory");

injectOptions("filterGenre", FILTERS.genre);
injectOptions("filterStatus", FILTERS.status);

// 🟢 dynamique depuis firebase réel
const dynamicCategories = buildDynamicCategories(allData);
injectOptions("filterCategory", dynamicCategories);


const today = new Date().toISOString().split("T")[0];

startDate.max = today;
endDate.max = today;

function validateDates() {

  if (
    startDate.value &&
    startDate.value > today
  ) {
    startDate.value = today;
  }
  if (
    endDate.value &&
    endDate.value > today
  ) {
    endDate.value = today;
  }
  if (
    startDate.value &&
    endDate.value &&
    endDate.value < startDate.value
  ) {
    endDate.value =
      startDate.value;
  }
  return true;
}

startDate.addEventListener("change", validateDates);
endDate.addEventListener("change", validateDates);

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

document.getElementById("applyFirebaseFilter")
.addEventListener("click", loadDataFirebaseFiltered);


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
async function loadDataFirebaseFiltered() {

  const genre = document.getElementById("filterGenre").value;
  const status = document.getElementById("filterStatus").value;
  const category = document.getElementById("filterCategory").value;

  const start = startDate.value;
  const end = endDate.value;

  if (start && end && new Date(end) < new Date(start)) {
    alert("❌ endDate doit être >= startDate");
    return;
  }

  const constraints = [];

  if (genre !== "all") {
    constraints.push(where("genre", "==", genre));
  }

  if (status !== "all") {
  constraints.push(
    where("status", "==", status)
  );
}
  

  if (category !== "all") {
    constraints.push(where("category", "==", category));
  }

  if (start) {
    constraints.push(where("createdAt", ">=", Timestamp.fromDate(new Date(start))));
  }

  if (end) {
  const endDateObj = new Date(end);
  endDateObj.setHours(23,59,59,999); constraints.push(where("createdAt","<=",Timestamp.fromDate(endDateObj)
    )
  );
}

  const q = query(
    collection(db, "expensess"),
    ...constraints,
    orderBy("createdAt", "desc")
  );

  const snap = await getDocs(q);

  allData = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  render();
}

// ================= loadData =================
async function loadData() {

  try {
    setLoading(true);
    const q = query(
      collection(db, "expensess"),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);

    allData = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    refreshFilters();
    
    const firebaseBtn =
  document.getElementById(
    "applyFirebaseFilter"
  );

firebaseBtn.style.display =
  allData.length > 100
    ? "block"
    : "none";
 
    // 🔥 AUTO MODE
    if (allData.length > 500) {

      await loadDataFirebaseFiltered();

    } else {
      render(1);
    }
  } catch (e) {

    console.error("FULL ERROR:", e);
    debug("❌ loadData: " +(e?.message || e));
  } finally {
    setLoading(false);
  }
}

// ================= FILTER =================
function getFiltered() {

  const search = (searchInput.value || "").toLowerCase();

  return allData.filter(item => {

    if (item.isSystemCorrection) return false;

    const matchSearch =
      !search ||
      (item.reason || "").toLowerCase().includes(search) ||
      (item.category || "").toLowerCase().includes(search) ||
      (item.name || "").toLowerCase().includes(search) ||
      (item.relatedTo || "").toLowerCase().includes(search);

    return matchSearch;
  });
}


function buildDynamicCategories(data) {
  const set = new Set();

  data.forEach(item => {
    if (item.category) set.add(item.category);
    if (item.reason) set.add(item.reason);
  });

  return [
    { value: "all", label: "Tout" },
    ...Array.from(set).map(v => ({ value: v, label: v }))
  ];
}

function refreshFilters() {

  injectOptions(
    "filterGenre",
    FILTERS.genre
  );

  injectOptions(
    "filterStatus",
    FILTERS.status
  );

  const dynamicCategories =
    buildDynamicCategories(allData);

  injectOptions(
    "filterCategory",
    dynamicCategories
  );
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

  const start =
    (page - 1) * ITEMS_PER_PAGE;

  const pageData =
    data.slice(start, start + ITEMS_PER_PAGE);

  list.replaceChildren();

  if (pageData.length === 0) {

    const empty = document.createElement("div");

    empty.style.padding = "20px";
    empty.style.textAlign = "center";
    empty.style.color = "#777";

    empty.textContent =
      "Aucune donnée trouvée";

    list.appendChild(empty);

    renderPagination(0);

    return;
  }

  pageData.forEach(item => {

    const card = document.createElement("div");
    card.classList.add("expense-item");

    // ================= LEFT =================
    const left = document.createElement("div");

    left.style.display = "flex";
    left.style.flexDirection = "column";
    left.style.gap = "4px";
    left.style.flex = "1";

    // ================= TITLE =================
    const titleRow = document.createElement("div");

    titleRow.style.display = "flex";
    titleRow.style.alignItems = "center";
    titleRow.style.flexWrap = "wrap";
    titleRow.style.gap = "6px";

    const title = document.createElement("strong");

    title.textContent =
      item.reason || "Sans titre";

    title.style.fontSize = "14px";
    title.style.color = "#111";

    titleRow.appendChild(title);

    // ================= GENRE BADGES =================
    if (item.genre === "expense") {

      const badge = document.createElement("span");

      badge.classList.add(
        "badge",
        "badge-expense"
      );

      badge.textContent = "EXPENSE";

      titleRow.appendChild(badge);

    }

    else if (item.genre === "debt") {

      const badgeDebt =
        document.createElement("span");

      badgeDebt.classList.add(
        "badge",
        "badge-debt"
      );

      badgeDebt.textContent = "DEBT";

      titleRow.appendChild(badgeDebt);

      const badgeStatus =
        document.createElement("span");

      badgeStatus.classList.add("badge");

      if (item.status === "paid") {

        badgeStatus.classList.add(
          "badge-paid"
        );

        badgeStatus.textContent = "PAID";

      } else {

        badgeStatus.classList.add(
          "badge-partial"
        );

        badgeStatus.textContent = "PARTIAL";
      }

      titleRow.appendChild(badgeStatus);
    }

    else if (item.genre === "loss") {

      const badge = document.createElement("span");

      badge.classList.add(
        "badge",
        "badge-loss"
      );

      badge.textContent = "LOSS";

      titleRow.appendChild(badge);
    }

    left.appendChild(titleRow);

    // ================= SUB =================
    const sub =
      document.createElement("small");

    sub.style.color = "#666";
    sub.style.fontSize = "12px";

    // ================= DATE =================
    let formattedDate = "";

    if (item.createdAt?.toDate) {

      const d = item.createdAt.toDate();

      formattedDate =
        d.toLocaleDateString("fr-FR") +
        " • " +
        d.toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit"
        });
    }

    // ================= DEBT =================
    if (item.genre === "debt") {

      const debtName =
        item.name || "Unknown";

      const debtType =
        item.category || "debt";

      sub.textContent =
        `${debtName} • ${debtType}`;

      // 🔥 due date uniquement si NON payé
      if (
        item.status !== "paid" &&
        item.DueDate?.toDate
      ) {

        const due =
          item.DueDate.toDate();

        const now =
          new Date();

        const days =
          Math.ceil(
            (due - now) /
            (1000 * 60 * 60 * 24)
          );

        const dueText =
          document.createElement("small");

        dueText.style.fontSize = "11px";
        dueText.style.fontWeight = "600";

        if (days < 0) {

          dueText.style.color = "#e74c3c";

          dueText.textContent =
            `⚠️ Retard ${Math.abs(days)} jours`;

        }

        else if (days === 0) {

          dueText.style.color = "#f39c12";

          dueText.textContent =
            "⏳ Échéance aujourd’hui";

        }

        else {

          dueText.style.color = "#888";

          dueText.textContent =
            `⏳ ${days} jours restants`;
        }

        left.appendChild(dueText);
      }

    }

    // ================= OTHERS =================
    else {

      sub.textContent =
        item.category || "Sans catégorie";
    }

    left.appendChild(sub);

    // ================= DATE UI =================
    if (formattedDate) {

      const dateEl =
        document.createElement("small");

      dateEl.style.fontSize = "11px";
      dateEl.style.color = "#999";

      dateEl.textContent =
        formattedDate;

      left.appendChild(dateEl);
    }

    // ================= RIGHT =================
    const right =
      document.createElement("div");

    right.style.display = "flex";
    right.style.flexDirection = "column";
    right.style.alignItems = "flex-end";
    right.style.gap = "8px";

    const amount =
      document.createElement("div");

    amount.style.fontWeight = "700";
    amount.style.fontSize = "15px";
    amount.style.color = "#111";

    let displayAmount = 0;

    if (item.genre === "debt") {

      displayAmount =
        item.amount_remaining || 0;

    } else {

      displayAmount =
        item.amount || 0;
    }

    amount.textContent =
      `${Number(displayAmount || 0).toLocaleString()} FC`;

    right.appendChild(amount);

    // ================= BTN =================
    const btn =
      document.createElement("button");

    btn.textContent = "Modifier";

    btn.addEventListener(
      "click",
      () => modifyFunc(item.id)
    );

    right.appendChild(btn);

    // ================= FINAL =================
    card.appendChild(left);
    card.appendChild(right);

    list.appendChild(card);

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
  refreshFilters();
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
  refreshFilters();
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
    refreshFilters();
    
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
  refreshFilters();
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
    refreshFilters();
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
    refreshFilters();
  }

  // ================= DEBT =================
else if(item.genre === "debt"){

  // 🔒 dette déjà payée
  if (
    item.status === "paid" ||
    Number(item.amount_remaining || 0) <= 0
  ) {
    alert("Dette déjà payée");
    return;
  }

  const pay =
    Number(prompt("Montant payé"));

  if (isNaN(pay) || pay <= 0) {
    return;
  }

  const debtRef =
    doc(db, "expensess", id);

  await runTransaction(db, async (tx) => {

    const debtSnap =
      await tx.get(debtRef);

    if (!debtSnap.exists()) {
      throw new Error("Dette introuvable");
    }

    const d = debtSnap.data();

    // 🔒 sécurité transaction
    if (
      d.status === "paid" ||
      Number(d.amount_remaining || 0) <= 0
    ) {
      throw new Error("Dette déjà payée");
    }

    const currentPaid =
      Number(d.amount_paid || 0);

    const total =
      Number(d.amount_total || 0);

    const newPaid =
      currentPaid + pay;

    if (newPaid > total) {
      throw new Error("Paiement dépasse la dette");
    }

    const remaining =
      total - newPaid;

    const status =
      remaining > 0
        ? "partial"
        : "paid";

    tx.update(debtRef, {
      amount_paid: newPaid,
      amount_remaining: remaining,
      status,
      updatedAt: Timestamp.now()
    });

    // 🔄 sync sales venant index.js
    if (d.relatedSaleId) {

      const saleRef =
        doc(db, "sales", d.relatedSaleId);

      tx.update(saleRef, {
        amount_paid: newPaid,
        amount_remaining: remaining,
        payment_status: status,
        hasDebt: remaining > 0,
        updatedAt: Timestamp.now()
      });

    }

  });

  debug("Paiement ajouté (sync OK)");

  await loadData();
  refreshFilters();
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
    refreshFilters();
    setLoading(false);
  } catch (e) {
    console.error(e);
    debug("❌ ERROR LOAD: " + (e.message || e));
  }
});
