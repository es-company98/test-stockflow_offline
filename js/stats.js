import {
  db,
  collection,
  getDocs
} from "./firebase.js";

import { getAppConfig } from "./appConfig.js";
import { initChart, renderChart } from "./chart.js";
import { getPdfExportData } from "./download.js";

const $ = id => document.getElementById(id);
const n = v => Number(v) || 0;

const state = {
  sales: [],
  expenses: [],
  products: [],
  users: [],
  stockMovements: [],
  currency: "$",
  config: null,
  chartReady: false
};

function debug(msg){
  const box = $("debug");
  if(box) box.textContent = msg;
}

function getDate(v){
  if(!v) return null;
  if(typeof v?.toDate === "function") return v.toDate();
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
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
  return `${Math.round(n(v)).toLocaleString()}${state.currency}`;
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

    const [
      salesSnap,
      expensesSnap,
      productsSnap,
      usersSnap,
      stockSnap
    ] = await Promise.all([
      getDocs(collection(db,"sales")),
      getDocs(collection(db,"expenses")),
      getDocs(collection(db,"products")),
      getDocs(collection(db,"users")),
      getDocs(collection(db,"stock_movements"))
    ]);

    state.sales = salesSnap.docs.map(d => ({ id:d.id, ...d.data() }));
    state.expenses = expensesSnap.docs.map(d => ({ id:d.id, ...d.data() }));
    state.products = productsSnap.docs.map(d => ({ id:d.id, ...d.data() }));
    state.users = usersSnap.docs.map(d => ({ id:d.id, ...d.data() }));
    state.stockMovements = stockSnap.docs.map(d => ({ id:d.id, ...d.data() }));

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

  state.users.forEach(u => {

    const opt = document.createElement("option");
    opt.value = u.userId || u.id;
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

  renderChart(); // sync chart.js
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

  const top = [...state.products]
    .sort((a,b) => n(b.stock_current) - n(a.stock_current))
    .slice(0,5);

  const container = $("topProductsList");

  top.forEach(p => {

    const item = document.createElement("div");
    item.className = "list-item";

    const left = document.createElement("div");
    left.className = "list-left";

    const t = document.createElement("div");
    t.className = "list-title";
    t.textContent = p.name || "Product";

    const s = document.createElement("div");
    s.className = "list-sub";
    s.textContent = "Stock";

    const r = document.createElement("div");
    r.className = "list-value";
    r.textContent = String(n(p.stock_current));

    left.appendChild(t);
    left.appendChild(s);

    item.appendChild(left);
    item.appendChild(r);

    container.appendChild(item);

  });
}

/* ---------------- SELLERS ---------------- */

function renderSellers(sales){

  clearNode("leaderboardList");

  const map = {};

  sales.forEach(s => {

    const id = s.sellerId || "unknown";

    map[id] ??= { amount:0, count:0 };

    map[id].amount += n(s.total_amount);
    map[id].count++;
  });

  const sorted = Object.entries(map)
    .sort((a,b) => b[1].amount - a[1].amount);

  const box = $("leaderboardList");

  sorted.slice(0,5).forEach(([id,v]) => {

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

    box.appendChild(el);

  });
}

/* ---------------- ALERTS ---------------- */

function renderAlerts(){

  $("stockAlertText").textContent =
    state.products.filter(p => n(p.stock_current) <= 5).length
      ? "Stock critique détecté"
      : "OK";

}

/* ---------------- INIT ---------------- */

window.addEventListener("DOMContentLoaded", () => {

  initChart(); // chart module init
  loadData();

});

/* ---------------- PDF HOOK (future) ---------------- */

window.getStatsPdfData = () => {

  return getPdfExportData?.({
    sales: state.sales,
    expenses: state.expenses,
    products: state.products
  }) || null;

};