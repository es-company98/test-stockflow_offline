// stats.js v2
import {
  db,
  collection,
  getDocs,
  query,
  where
} from "./firebase.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js"; 

import { getAppConfig } from "./appConfig.js";
import { initChart, renderChart } from "./chart.js";
import { initPdfExport } from "./download.js";

const $ = id => document.getElementById(id);
const n = v => Number(v) || 0;

const state = {
    saleItems: [],
    purchases: [],
    purchaseItems: [],
  sales: [],
  expenses: [],
  products: [],
  users: [],
  stockMovements: [],
  currency: "$",
  config: null,
  chartReady: false
};
const filters = {
  sellerId: "all",
  dateFrom: null,
  dateTo: null,
  range: "30days"
};
const auth = getAuth();


let debugTimeout = null;
const dateFrom = document.getElementById("dateFrom");
const dateTo = document.getElementById("dateTo");

function updateDateLimits(){

  if(!dateFrom || !dateTo) return;

  const today = new Date().toISOString().split("T")[0];

  dateFrom.max = today;

  dateTo.max = today;

  if(dateFrom.value){
    dateTo.min = dateFrom.value;
  }else{
    dateTo.removeAttribute("min");
  }

  if(
    dateFrom.value &&
    dateTo.value &&
    dateTo.value < dateFrom.value
  ){
    dateTo.value = dateFrom.value;
  }

}

dateFrom?.addEventListener("change", updateDateLimits);
dateTo?.addEventListener("change", updateDateLimits);

updateDateLimits();

function debug(msg){
  const box = $("debug");
  if(!box) return;

  box.textContent = msg;

  clearTimeout(debugTimeout);
  debugTimeout = setTimeout(() => {
    box.textContent = "";
  }, 5000);
}

function bindEvents(){

  $("statsRange")?.addEventListener("change", () => {

  const custom =
    $("statsRange").value === "custom";

  $("dateFrom").disabled = !custom;
  $("dateTo").disabled = !custom;

});

  $("applyFiltersBtn")?.addEventListener("click", () => {
    loadData(); // refetch Firebase avec filtre vendeur
  });

  $("refreshBtn")?.addEventListener("click", loadData);
}

function getDate(v){
  if(!v) return null;

  if(typeof v?.toDate === "function") return v.toDate();

  if(v?.seconds) return new Date(v.seconds * 1000);

  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function buildSalesQuery(){

  let ref = collection(db,"sales");

  const seller = $("sellerFilter")?.value || "all";

  if(seller !== "all"){
    ref = query(ref, where("sellerId", "==", seller));
  }

  return ref;
}

function getRangeFilter(){

  const range = $("statsRange")?.value || "30days";
  const now = new Date();

  return (date) => {

    if(!date) return false;

    const d = new Date(date);

    switch(range){

      case "today":
        return d.toDateString() === now.toDateString();

      case "yesterday":
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        return d.toDateString() === y.toDateString();

      case "7days":
        return (now - d) <= 7 * 86400000;

      case "30days":
        return (now - d) <= 30 * 86400000;

      case "month":
        return d.getMonth() === now.getMonth()
          && d.getFullYear() === now.getFullYear();

      case "year":
        return d.getFullYear() === now.getFullYear();
        case "custom":

  const from = $("dateFrom")?.value;
  const to = $("dateTo")?.value;

  if(!from || !to){
    return true;
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);

  toDate.setHours(23,59,59,999);

  return d >= fromDate &&
         d <= toDate;

      default:
        return true;
    }
  };
}

function formatMoney(v){
  return `${Math.round(n(v)).toLocaleString()} ${state.currency}`;
}

function clearNode(id){
  const el = $(id);
  if(el) el.replaceChildren();
}

/* ---------------- DATA LOAD ---------------- */

async function loadData(){

  debug("Chargement...");

  try{

    state.config = await getAppConfig();
    state.currency = state.config?.currencySymbol || "$";

    const salesQuery = buildSalesQuery();

    const select = $("sellerFilter");
    const currentValue = select?.value || "all";

    const [
      salesSnap,
      expensesSnap,
      productsSnap,
      usersSnap,
      stockSnap,
      saleItemsSnap,
      purchasesSnap,
      purchaseItemsSnap
    ] = await Promise.all([
      getDocs(salesQuery),
      getDocs(collection(db,"expenses")),
      getDocs(collection(db,"products")),
      getDocs(collection(db,"users")),
      getDocs(collection(db,"stock_movements")),
      getDocs(collection(db,"sale_items")),
      getDocs(collection(db,"purchases")),
      getDocs(collection(db,"purchase_items"))
    ]);

    state.sales = salesSnap.docs.map(d => ({ id:d.id, ...d.data() }));
    state.expenses = expensesSnap.docs.map(d => ({ id:d.id, ...d.data() }));
    state.products = productsSnap.docs.map(d => ({ id:d.id, ...d.data() }));
    state.users = usersSnap.docs.map(d => ({ id:d.id, ...d.data() }));
    state.stockMovements = stockSnap.docs.map(d => ({ id:d.id, ...d.data() }));

    state.saleItems = saleItemsSnap.docs.map(d => ({ id:d.id, ...d.data() }));
    state.purchases = purchasesSnap.docs.map(d => ({ id:d.id, ...d.data() }));
    state.purchaseItems = purchaseItemsSnap.docs.map(d => ({ id:d.id, ...d.data() }));

    populateSellerFilter();

    if(select){
      select.value = currentValue;
    }

    render();

    debug("OK");

  }catch(e){
    console.error(e);
    debug(e.message);
  }
}

/* ---------------- SELLERS ---------------- */

function populateSellerFilter(){

  const select = $("sellerFilter");
  if(!select) return;
  const currentValue = select.value || "all";

  while(select.children.length > 1){
    select.removeChild(select.lastChild);
  }

  const sellers = state.users.filter(u => {
    const role = String(u.role || "")
      .trim()
      .toLowerCase();

    return role === "seller";
  });

  sellers.forEach(u => {
    const opt = document.createElement("option");

    opt.value = u.userId || u.uid || u.id;
    opt.textContent = u.name || "Vendeur";

    select.appendChild(opt);
  });

  const exists = sellers.some(
    u => (u.userId || u.uid || u.id) === currentValue
  );
  select.value = exists
    ? currentValue
    : "all";
}

/* ---------------- RENDER ---------------- */

function render(){

  const filterDate = getRangeFilter();
  const seller = $("sellerFilter")?.value || "all";
  

  let sales = state.sales.filter(s => filterDate(getDate(s.createdAt)));

  if(seller !== "all"){
    sales = sales.filter(s => s.sellerId === seller);
  }

  const expenses = state.expenses.filter(e =>
    filterDate(getDate(e.createdAt))
  );

  state.chartReady = true;

  window.statsData = {
    sales,
    expenses,
    products: state.products,
    stockMovements: state.stockMovements,
    currency: state.currency
  };

  renderKPIs(sales, expenses);
  renderProducts();
  renderSellers(sales);
  renderAlerts();
  renderActivity();

  if(state.chartReady) {
  renderChart(); // sync chart.js
} 
}

/* ---------------- KPI ---------------- */

function renderKPIs(sales, expenses){

  const totalSales = sales.reduce((a,b) =>
    a + n(b.total_amount), 0
  );

  const profit = sales.reduce((a,b) =>
    a + n(b.total_profit), 0
  );

  const expenseTotal = expenses.reduce((a,b) =>
    a + n(b.amount || 0), 0
  );

  const realProfit = profit - expenseTotal;

  const basket = sales.length ? totalSales / sales.length : 0;
  const marginRate =
  totalSales > 0
    ? ((profit / totalSales) * 100)
    : 0;

const marginEl = $("marginTrend");

if(marginEl){
  marginEl.textContent =
    `${marginRate.toFixed(1)}%`;
}

  $("salesValue").textContent = formatMoney(totalSales);
  $("profitValue").textContent = formatMoney(realProfit);
  $("basketValue").textContent = formatMoney(basket);
}

/* ---------------- PRODUCTS ---------------- */
function renderProducts(){

  clearNode("topProductsList");
  clearNode("deadProductsList");
  clearNode("criticalStockList");

  const topBox = $("topProductsList");
  const deadBox = $("deadProductsList");
  const criticalBox = $("criticalStockList");

  if(!topBox || !deadBox || !criticalBox){
    return;
  }

  const salesMap = {};

  state.saleItems.forEach(item => {

    const productId =
      item.productId ||
      item.product_id;

    if(!productId){
      return;
    }

    salesMap[productId] ??= 0;

    salesMap[productId] += n(
      item.quantity ||
      item.qty ||
      item.stock_out
    );
  });

  const productsWithSales = state.products.map(product => ({

    ...product,

    soldQty:
      salesMap[product.id] || 0

  }));

  /* ---------------- TOP PRODUITS VENDUS ---------------- */

  const topProducts = [...productsWithSales]
    .filter(p => p.soldQty > 0)
    .sort((a,b) => b.soldQty - a.soldQty)
    .slice(0,5);

  topProducts.forEach(product => {

    const item = document.createElement("div");
    item.className = "list-item";

    const left = document.createElement("div");
    left.className = "list-left";

    const title = document.createElement("div");
    title.className = "list-title";
    title.textContent = product.name || "Produit";

    const sub = document.createElement("div");
    sub.className = "list-sub";
    sub.textContent = "Quantité vendue";

    const value = document.createElement("div");
    value.className = "list-value";
    value.textContent = String(product.soldQty);

    left.appendChild(title);
    left.appendChild(sub);

    item.appendChild(left);
    item.appendChild(value);

    topBox.appendChild(item);
  });

  /* ---------------- PRODUITS DORMANTS ---------------- */

  const deadProducts = [...productsWithSales]
    .filter(p => p.soldQty <= 0)
    .sort((a,b) => n(b.stock_current) - n(a.stock_current))
    .slice(0,5);

  deadProducts.forEach(product => {

    const item = document.createElement("div");
    item.className = "list-item";

    const left = document.createElement("div");
    left.className = "list-left";

    const title = document.createElement("div");
    title.className = "list-title";
    title.textContent = product.name || "Produit";

    const sub = document.createElement("div");
    sub.className = "list-sub";
    sub.textContent = "Aucune vente";

    const value = document.createElement("div");
    value.className = "list-value";
    value.textContent = String(
      n(product.stock_current)
    );

    left.appendChild(title);
    left.appendChild(sub);

    item.appendChild(left);
    item.appendChild(value);

    deadBox.appendChild(item);
  });

  /* ---------------- STOCK CRITIQUE ---------------- */

  const criticalProducts = state.products
    .filter(product => {

      const alertLevel =
        n(product.stock_alert) || 5;

      return (
        n(product.stock_current) <= alertLevel
      );

    })
    .sort(
      (a,b) =>
        n(a.stock_current) -
        n(b.stock_current)
    )
    .slice(0,5);

  criticalProducts.forEach(product => {

    const item = document.createElement("div");
    item.className = "list-item";

    const left = document.createElement("div");
    left.className = "list-left";

    const title = document.createElement("div");
    title.className = "list-title";
    title.textContent = product.name || "Produit";

    const sub = document.createElement("div");
    sub.className = "list-sub";
    sub.textContent = "Stock critique";

    const value = document.createElement("div");
    value.className = "list-value";
    value.textContent = String(
      n(product.stock_current)
    );

    left.appendChild(title);
    left.appendChild(sub);

    item.appendChild(left);
    item.appendChild(value);

    criticalBox.appendChild(item);
  });
}


/* ---------------- SELLERS ---------------- */
function renderSellers(sales){

  clearNode("leaderboardList");
  clearNode("weakSellerList");

  const boxTop = $("leaderboardList");
  const boxWeak = $("weakSellerList");
  if(!boxTop || !boxWeak) return;

  const map = {};

  sales.forEach(s => {

    const id = s.sellerId || "unknown";

    if(!map[id]) map[id] = { amount:0, count:0 };

    map[id].amount += n(s.total_amount);
    map[id].count++;
  });

  const entries = Object.entries(map);

  const sortedTop = [...entries]
    .sort((a,b) => b[1].amount - a[1].amount)
    .slice(0,5);

  const sortedWeak = [...entries]
    .sort((a,b) => a[1].amount - b[1].amount)
    .slice(0,5);

  /* TOP */
  sortedTop.forEach(([id,v]) => {

    const user = state.users.find(u => (u.userId||u.id) === id);

    const el = document.createElement("div");
    el.className = "list-item";

    const left = document.createElement("div");
    left.className = "list-left";

    const t = document.createElement("div");
    t.className = "list-title";
    t.textContent = user?.name || id;

    const s = document.createElement("div");
    s.className = "list-sub";
    s.textContent = `${v.count} ventes`;

    const r = document.createElement("div");
    r.className = "list-value";
    r.textContent = formatMoney(v.amount);

    left.appendChild(t);
    left.appendChild(s);

    el.appendChild(left);
    el.appendChild(r);

    boxTop.appendChild(el);
  });

  /* WEAK */
  sortedWeak.forEach(([id,v]) => {

    const user = state.users.find(u => (u.userId||u.id) === id);

    const el = document.createElement("div");
    el.className = "list-item";

    const left = document.createElement("div");
    left.className = "list-left";

    const t = document.createElement("div");
    t.className = "list-title";
    t.textContent = user?.name || id;

    const s = document.createElement("div");
    s.className = "list-sub";
    s.textContent = `${v.count} ventes`;

    const r = document.createElement("div");
    r.className = "list-value";
    r.textContent = formatMoney(v.amount);

    left.appendChild(t);
    left.appendChild(s);

    el.appendChild(left);
    el.appendChild(r);

    boxWeak.appendChild(el);
  });
}

/* ---------------- ALERTS ---------------- */

function renderAlerts(){

  /* ---------- Dépenses ---------- */

  const expenseEl = $("expenseAlertText");

  if(expenseEl){

    const expenses = state.expenses.filter(
      e => e.genre === "expense"
    );

    const totalExpenses = expenses.reduce(
      (sum,e) => sum + n(e.amount),
      0
    );

    const avgExpense = expenses.length
      ? totalExpenses / expenses.length
      : 0;

    const abnormalExpenses = expenses.filter(
      e => n(e.amount) > (avgExpense * 2)
    );

    expenseEl.textContent = abnormalExpenses.length
      ? `${abnormalExpenses.length} dépense(s) supérieure(s) à la moyenne détectée(s)`
      : "Aucune dépense anormale détectée";
  }

  /* ---------- Opportunités business ---------- */

  const businessEl = $("businessAlertText");

  if(businessEl){

    const lowStockCount = state.products.filter(
      p => n(p.stock_current) <= 5
    ).length;

    const outOfStockCount = state.products.filter(
      p => n(p.stock_current) <= 0
    ).length;

    const debtCount = state.expenses.filter(
      e =>
        e.genre === "debt" &&
        n(e.amount_remaining) > 0
    ).length;

    const messages = [];

    if(outOfStockCount > 0){
      messages.push(
        `${outOfStockCount} produit(s) en rupture`
      );
    }

    if(lowStockCount > 0){
      messages.push(
        `${lowStockCount} produit(s) à réapprovisionner`
      );
    }

    if(debtCount > 0){
      messages.push(
        `${debtCount} dette(s) à recouvrer`
      );
    }

    businessEl.textContent = messages.length
      ? messages.join(" • ")
      : "Aucune opportunité particulière détectée";
  }
}

/* ---------- Activités ---------- */

function renderActivity(){

  const box = $("recentActivityList");
  if(!box) return;

  clearNode("recentActivityList");

  const lastSales = [...state.sales]
    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0,5);

  lastSales.forEach(s => {

    const el = document.createElement("div");
    el.className = "activity-item";

    const left = document.createElement("div");
    left.className = "activity-left";

    const t = document.createElement("div");
    t.className = "activity-title";
    t.textContent = "Vente #" + (s.id || "");

    const m = document.createElement("div");
    m.className = "activity-meta";
    m.textContent = new Date(s.createdAt).toLocaleString();

    const p = document.createElement("div");
    p.className = "activity-price";
    p.textContent = formatMoney(s.total_amount);

    left.appendChild(t);
    left.appendChild(m);

    el.appendChild(left);
    el.appendChild(p);

    box.appendChild(el);
  });
}

function buildPdfPayload() {

  const filterDate = getRangeFilter();

  const sales = state.sales.filter(s => filterDate(getDate(s.createdAt)));
  const expenses = state.expenses.filter(e => filterDate(getDate(e.createdAt)));
  const products = state.products;
  const stockMovements = state.stockMovements;

  const debts = expenses.filter(e => e.genre === "debt");
  const losses = expenses.filter(e => e.genre === "loss");
  const normalExpenses = expenses.filter(e => e.genre === "expense");

  const totalSales = sales.reduce((a,b)=>a+n(b.total_amount),0);
  const totalProfit = sales.reduce((a,b)=>a+n(b.total_profit),0);

  const totalExpenses = normalExpenses.reduce((a,b)=>a+n(b.amount),0);
  const totalLosses = losses.reduce((a,b)=>a+n(b.amount),0);

  const totalDebtRemaining = debts.reduce((a,b)=>a+n(b.amount_remaining),0);

  const netProfit =
    totalProfit - totalExpenses - totalLosses;

  return {
    meta: {
      shopName: state.config?.shopName || "StockFlow",
      currency: state.currency,
      generatedAt: new Date().toISOString()
    },

    kpis: {
      totalSales,
      totalProfit,
      totalExpenses,
      totalLosses,
      totalDebtRemaining,
      netProfit
    },

    sales: sales.map(s => ({
      id: s.id,
      sellerId: s.sellerId,
      amount: s.total_amount,
      profit: s.total_profit,
      status: s.status,
      payment_status: s.payment_status,
      amount_paid: s.amount_paid,
      amount_remaining: s.amount_remaining,
      createdAt: s.createdAt
    })),

    debts: debts.map(d => ({
      id: d.id,
      name: d.name,
      phone: d.phone,
      total: d.amount_total,
      paid: d.amount_paid,
      remaining: d.amount_remaining,
      status: d.status,
      relatedSaleId: d.relatedSaleId
    })),

    losses: losses.map(l => ({
      id: l.id,
      amount: l.amount,
      reason: l.reason,
      category: l.category
    })),

    products: products.map(p => ({
      id: p.id,
      name: p.name,
      stock: p.stock_current,
      alert: p.stock_alert
    })),

    stockMovements: stockMovements.slice(-300)
  };
}

/* ---------------- INIT ---------------- */


let initialized = false;

async function initializeStats(){

  if(initialized){
    return;
  }

  initialized = true;

  try{

    const usersSnap = await getDocs(
      collection(db,"users")
    );

    const currentUser = usersSnap.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .find(userDoc =>
        userDoc.uid === auth.currentUser.uid ||
        userDoc.userId === auth.currentUser.uid
      );

    if(!currentUser){
      location.replace("404.html");
      return;
    }

    if(currentUser.role === "seller"){
      location.replace("index.html");
      return;
    }

    if(currentUser.role !== "admin"){
      location.replace("404.html");
      return;
    }

    state.chartReady = false;
    initChart();

    bindEvents();
    $("dateFrom").disabled = true;
    $("dateTo").disabled = true;

    await loadData();

  }catch(error){

    console.error(error);

    location.replace("404.html");

  }

}

document.addEventListener("DOMContentLoaded", () => {

  onAuthStateChanged(auth, user => {

    if(!user){

      location.replace("404.html");

      return;
    }

    initializeStats();

  });

});

/* ---------------- PDF HOOK (future) ---------------- */
initPdfExport(buildPdfPayload);
