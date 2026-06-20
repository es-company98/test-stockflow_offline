// stats.js v2 ok sans pdf
import {
  db,
  doc,
  collection,
  getDoc,
  getDocs,
  query,
  where,
} from "./firebase.js";
import { getAuth, onAuthStateChanged } from "./auth.js"; 

import { getAppConfig } from "./appConfig.js";
import { initChart, renderChart } from "./chart.js";
import { initPdfExport, initPdfExportButton } from "./download.js";

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


function debug(msg){
  const box = $("debug");
  if(box) box.textContent = msg;
}

function bindEvents(){

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

  while(select.children.length > 1){
    select.removeChild(select.lastChild);
  }

  state.users
    .filter(u => u.role === "seller")
    .forEach(u => {

      const opt = document.createElement("option");

      opt.value = u.userId || u.uid || u.id; // FIX SAFE MATCH FIREBASE AUTH
      opt.textContent = u.name || "User";

      select.appendChild(opt);
    });
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

  if(!topBox || !deadBox || !criticalBox) return;

  const products = [...state.products];

  /* ---------------- TOP PRODUITS (logique réelle = stock + dispo) ---------------- */
  const top = products
    .filter(p => n(p.stock_current) > 0)
    .sort((a,b) => n(b.stock_current) - n(a.stock_current))
    .slice(0,5);

  top.forEach(p => {
    const el = document.createElement("div");
    el.className = "list-item";

    const left = document.createElement("div");
    left.className = "list-left";

    const title = document.createElement("div");
    title.className = "list-title";
    title.textContent = p.name || "Produit";

    const sub = document.createElement("div");
    sub.className = "list-sub";
    sub.textContent = "Stock disponible";

    const value = document.createElement("div");
    value.className = "list-value";
    value.textContent = String(n(p.stock_current));

    left.appendChild(title);
    left.appendChild(sub);

    el.appendChild(left);
    el.appendChild(value);

    topBox.appendChild(el);
  });

  /* ---------------- PRODUITS DORMANTS (pas de mouvement + stock > 0) ---------------- */
  const dead = products
    .filter(p => n(p.stock_current) > 0)
    .filter(p => {
      const moved = state.stockMovements.some(m => m.productId === p.id);
      return !moved;
    })
    .slice(0,5);

  dead.forEach(p => {
    const el = document.createElement("div");
    el.className = "list-item";

    const left = document.createElement("div");
    left.className = "list-left";

    const title = document.createElement("div");
    title.className = "list-title";
    title.textContent = p.name || "Produit";

    const sub = document.createElement("div");
    sub.className = "list-sub";
    sub.textContent = "Aucun mouvement";

    const value = document.createElement("div");
    value.className = "list-value";
    value.textContent = String(n(p.stock_current));

    left.appendChild(title);
    left.appendChild(sub);

    el.appendChild(left);
    el.appendChild(value);

    deadBox.appendChild(el);
  });

  /* ---------------- STOCK CRITIQUE ---------------- */
  const critical = products
    .filter(p => n(p.stock_current) <= (p.stock_alert ?? 5))
    .slice(0,5);

  critical.forEach(p => {
    const el = document.createElement("div");
    el.className = "list-item";

    const left = document.createElement("div");
    left.className = "list-left";

    const title = document.createElement("div");
    title.className = "list-title";
    title.textContent = p.name || "Produit";

    const sub = document.createElement("div");
    sub.className = "list-sub";
    sub.textContent = "Stock critique";

    const value = document.createElement("div");
    value.className = "list-value";
    value.textContent = String(n(p.stock_current));

    left.appendChild(title);
    left.appendChild(sub);

    el.appendChild(left);
    el.appendChild(value);

    criticalBox.appendChild(el);
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

    const userSnap = await getDoc(
      doc(db, "users", auth.currentUser.uid)
    );

    if(!userSnap.exists()){
      location.replace("404.html");
      return;
    }

    const currentUser = { id: userSnap.id, ...userSnap.data() };

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
    initPdfExportButton();

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
