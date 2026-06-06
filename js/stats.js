// stats.js v2
import {
  db,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit
} from "./firebase.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js"; 

import { getAppConfig } from "./appConfig.js";
import { initChart, renderChart } from "./chart.js";
import { initPdfExport } from "./download.js";
import { initPdfExportButton } from "./download.js";

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

  $("applyFiltersBtn")
?.addEventListener(  "click", () => {
    render();
    if(
      typeof renderChart
      === "function"
    ){
      renderChart();
    }
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

  const seller = $("sellerFilter")?.value || "all";

  const { start,end } = buildDateRange();

  const constraints = [];

  if(start){
    constraints.push(where("createdAt",">=",start));
  }

  if(end){
    constraints.push(where("createdAt","<=",end));
  }

  if(seller !== "all"){
    constraints.push(where("sellerId","==",seller));
  }

  constraints.push(orderBy("createdAt","desc"));

  return query(
    collection(db,"sales"),
    ...constraints
  );
}

function buildDateRange(){

  const range = $("statsRange")?.value || "30days";
  const now = new Date();

  let start = null;
  let end = new Date();

  switch(range){

    case "today":
      start = new Date(now.getFullYear(),now.getMonth(),now.getDate());
      break;

    case "yesterday":
      start = new Date(now.getFullYear(),now.getMonth(),now.getDate()-1);
      end = new Date(now.getFullYear(),now.getMonth(),now.getDate()-1,23,59,59,999);
      break;

    case "7days":
      start = new Date(now.getTime() - 7 * 86400000);
      break;

    case "30days":
      start = new Date(now.getTime() - 30 * 86400000);
      break;

    case "month":
      start = new Date(now.getFullYear(),now.getMonth(),1);
      break;

    case "year":
      start = new Date(now.getFullYear(),0,1);
      break;

    case "custom":

      const from = $("dateFrom")?.value;
      const to = $("dateTo")?.value;

      if(from && to){
        start = new Date(from);
        end = new Date(to);
        end.setHours(23,59,59,999);
      }

      break;
  }

  return { start,end };
}

function buildCollectionQuery(collectionName){

  const { start,end } = buildDateRange();

  const constraints = [];

  if(start){
    constraints.push(where("createdAt",">=",start));
  }

  if(end){
    constraints.push(where("createdAt","<=",end));
  }

  constraints.push(orderBy("createdAt","desc"));

  return query(
    collection(db,collectionName),
    ...constraints
  );
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
    const select = $("sellerFilter");
const currentValue = select?.value || "all";

    state.config = await getAppConfig();
    state.currency = state.config?.currencySymbol || "$";

    const salesQuery = buildSalesQuery();

const expensesQuery =
  buildCollectionQuery("expenses");

const purchasesQuery =
  buildCollectionQuery("purchases");

const stockQuery =
  buildCollectionQuery("stock_movements");
  
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
  getDocs(expensesQuery),
  getDocs(collection(db,"products")),
  getDocs(collection(db,"users")),
  getDocs(stockQuery),
  getDocs(collection(db,"sale_items")),
  getDocs(purchasesQuery),
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
async function render(){

  const sales = state.sales;
  const expenses = state.expenses;

  state.chartReady = true;

  window.statsData = {
    sales,
    expenses,
    products: state.products,
    stockMovements: state.stockMovements,
    currency: state.currency
  };

  const previousPeriod = await loadPreviousPeriodData();

  renderKPIs(
    sales,
    expenses,
    previousPeriod.sales,
    previousPeriod.expenses
  );

  renderFinancialHealth(
    sales,
    expenses
  );

  renderStockHealth();
  renderDebts();
  renderPurchases();
  renderProducts();
  renderSellers(sales,state.saleItems);
  renderAlerts();
  renderActivity();

  if(state.chartReady){
    renderChart();
  }
}


/* ---------------- FINANCIAL HEALTH ---------------- */
function renderFinancialHealth(sales, expenses) {

  // 💸 dépenses réelles (expense + loss)
  const expensesTotal =
    expenses.reduce((s, e) => s + n(e.amount), 0);

  // 📦 pertes stock (doit venir des expenses genre loss)
  const lossesTotal =
    expenses
      .filter(e => e.genre === "loss")
      .reduce((s, e) => s + n(e.amount), 0);

  // 🧾 dettes clients (reste à payer)
  const debtsTotal =
    expenses
      .filter(e => e.genre === "debt")
      .reduce((s, e) => s + n(e.amount_remaining), 0);

  // 💵 cash réellement encaissé
  const cashReceived =
    sales.reduce((s, v) => s + n(v.amount_paid), 0);

  // 🚚 achats stock
  const purchaseTotal =
    state.purchases.reduce((s, p) => s + n(p.total_cost), 0);

  // 📈 profit brut (DOIT venir des items si dispo)
  const grossProfit =
    state.saleItems.reduce((s, i) => s + n(i.profit), 0);

  // 🏦 net result
  const netResult =
    grossProfit
    - expensesTotal
    - lossesTotal;

  $("expensesValue").textContent = formatMoney(expensesTotal);
  $("lossesValue").textContent = formatMoney(lossesTotal);
  $("debtsValue").textContent = formatMoney(debtsTotal);
  $("cashReceivedValue").textContent = formatMoney(cashReceived);
  $("purchaseValue").textContent = formatMoney(purchaseTotal);
  $("netResultValue").textContent = formatMoney(netResult);
}

/* ---------------- STOCK HEALTH ---------------- */
function renderStockHealth() {

  // 📦 valeur stock réelle (purchase_price OK fallback price_buy)
  const stockValue =
    state.products.reduce((s, p) => {
      const price = n(p.price_buy || p.purchase_price);
      return s + (n(p.stock_current) * price);
    }, 0);

  // ⚠ produits bloqués (offline + stock faible)
  const blockedStock =
    state.products.filter(p =>
      p.offlineBlocked === true ||
      n(p.stock_current) <= n(p.minOfflineStock || 0)
    ).length;

  // ❌ ruptures
  const stockOut =
    state.products.filter(p =>
      n(p.stock_current) <= 0
    ).length;

  // 📊 ventes qty
  const soldQty =
    state.saleItems.reduce((s, i) => s + n(i.quantity), 0);

  // 📦 stock qty
  const stockQty =
    state.products.reduce((s, p) => s + n(p.stock_current), 0);

  const rotation =
    stockQty > 0 ? (soldQty / stockQty).toFixed(2) : "0";

  $("stockValue").textContent = formatMoney(stockValue);
  $("stockRotation").textContent = rotation;
  $("blockedStock").textContent = blockedStock;
  $("stockOutCount").textContent = stockOut;
}

/* ---------------- DEBTS  ---------------- */
function renderDebts() {

  clearNode("topDebtorsList");

  const box = $("topDebtorsList");
  if (!box) return;

  const debts =
    state.expenses
      .filter(e => e.genre === "debt")
      .sort((a, b) =>
        n(b.amount_remaining) - n(a.amount_remaining)
      )
      .slice(0, 10);

  debts.forEach(d => {

    const item = document.createElement("div");
    item.className = "list-item";

    const left = document.createElement("div");
    left.className = "list-left";

    const title = document.createElement("div");
    title.className = "list-title";
    title.textContent = d.name || d.customerName || "Client";

    const sub = document.createElement("div");
    sub.className = "list-sub";
    sub.textContent = "Dette restante";

    const value = document.createElement("div");
    value.className = "list-value";
    value.textContent = formatMoney(d.amount_remaining);

    left.appendChild(title);
    left.appendChild(sub);

    item.appendChild(left);
    item.appendChild(value);

    box.appendChild(item);
  });
}

/* ---------------- PURCHASES ---------------- */
function renderPurchases() {

  clearNode("purchaseList");

  const box = $("purchaseList");
  if (!box) return;

  const list =
    [...state.purchases]
      .sort((a, b) =>
        getDate(b.createdAt) - getDate(a.createdAt)
      )
      .slice(0, 10);

  list.forEach(p => {

    const item = document.createElement("div");
    item.className = "activity-item";

    const left = document.createElement("div");
    left.className = "activity-left";

    const title = document.createElement("div");
    title.className = "activity-title";
    title.textContent = p.supplier || "Fournisseur";

    const meta = document.createElement("div");
    meta.className = "activity-meta";
    meta.textContent =
      getDate(p.createdAt)?.toLocaleString() || "";

    const value = document.createElement("div");
    value.className = "activity-price";
    value.textContent = formatMoney(p.total_cost);

    left.appendChild(title);
    left.appendChild(meta);

    item.appendChild(left);
    item.appendChild(value);

    box.appendChild(item);
  });
}

/* ---------------- précédente période ---------------- */
async function loadPreviousPeriodData(){

  const range = $("statsRange")?.value || "30days";

  const now = new Date();

  let start;
  let end;

  switch(range){

    case "today":
      start = new Date(now.getFullYear(),now.getMonth(),now.getDate()-1);
      end = new Date(now.getFullYear(),now.getMonth(),now.getDate()-1,23,59,59,999);
      break;

    case "yesterday":
      start = new Date(now.getFullYear(),now.getMonth(),now.getDate()-2);
      end = new Date(now.getFullYear(),now.getMonth(),now.getDate()-2,23,59,59,999);
      break;

    case "7days":
      end = new Date(now.getTime() - 7 * 86400000);
      start = new Date(end.getTime() - 7 * 86400000);
      break;

    case "30days":
      end = new Date(now.getTime() - 30 * 86400000);
      start = new Date(end.getTime() - 30 * 86400000);
      break;

    case "month":
      start = new Date(now.getFullYear(),now.getMonth()-1,1);
      end = new Date(now.getFullYear(),now.getMonth(),0,23,59,59,999);
      break;

    case "year":
      start = new Date(now.getFullYear()-1,0,1);
      end = new Date(now.getFullYear()-1,11,31,23,59,59,999);
      break;

    default:
      return { sales:[], expenses:[] };
  }

  const seller = $("sellerFilter")?.value || "all";

  const salesConstraints = [
    where("createdAt",">=",start),
    where("createdAt","<=",end)
  ];

  if(seller !== "all"){
    salesConstraints.push(
      where("sellerId","==",seller)
    );
  }

  salesConstraints.push(
    orderBy("createdAt","desc")
  );

  const salesSnap = await getDocs(
    query(
      collection(db,"sales"),
      ...salesConstraints
    )
  );

  const expensesSnap = await getDocs(
    query(
      collection(db,"expenses"),
      where("createdAt",">=",start),
      where("createdAt","<=",end),
      orderBy("createdAt","desc")
    )
  );

  return {
    sales: salesSnap.docs.map(d => ({ id:d.id,...d.data() })),
    expenses: expensesSnap.docs.map(d => ({ id:d.id,...d.data() }))
  };
}


/* ---------------- KPI ---------------- */
function renderKPIs(
  sales,
  expenses,
  previousSales = [],
  previousExpenses = []
) {
    
    const saleIds =
  new Set(
    sales.map(s => s.id)
  )

const filteredItems =
  state.saleItems.filter(
    i => saleIds.has(i.saleId)
  );
  
  const totalSales =
  filteredItems.reduce(
    (s,i)=>
      s +
      (
        n(i.price) *
        n(i.quantity)
      ),
    0
  )

const grossProfit =
  filteredItems.reduce(
    (s,i)=>
      s+n(i.profit),
    0
  );

  /* =========================
     🔥 CURRENT PERIOD
     ========================= */
  /// déjà calculé plus haut avec filteredItems

  // 💸 dépenses
  const totalExpenses =
    expenses.reduce((sum, e) =>
      sum + n(e.amount), 0
    );

  // 🏦 profit net
  const realProfit =
    grossProfit - totalExpenses;

  // 🛒 panier moyen (CA / nb sales)
  const basket =
    sales.length
      ? totalSales / sales.length
      : 0;

  // ⚡ marge
  const marginRate =
    totalSales > 0
      ? (grossProfit / totalSales) * 100
      : 0;

  /* =========================
     📉 PREVIOUS PERIOD
     ========================= */

  const prevSalesTotal =
  previousSales.reduce(
    (sum,s) =>
      sum + n(s.total_amount),
    0
  );

const previousSaleIds =
  new Set(
    previousSales.map(s => s.id)
  );

const previousItems =
  state.saleItems.filter(
    i => previousSaleIds.has(i.saleId)
  );

const prevProfitTotal =
  previousItems.reduce(
    (sum,i) =>
      sum + n(i.profit),
    0
  ) -
  previousExpenses.reduce(
    (sum,e) =>
      sum + n(e.amount),
    0
  );

const prevBasket =
  previousSales.length
    ? prevSalesTotal / previousSales.length
    : 0;

const prevMargin =
  prevSalesTotal > 0
    ? (prevProfitTotal / prevSalesTotal) * 100
    : 0;

  /* =========================
     📊 TREND CALC
     ========================= */

  const calcTrend = (current, previous) => {
    if (!previous || previous <= 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const salesTrendValue =
    calcTrend(totalSales, prevSalesTotal);

  const profitTrendValue =
    calcTrend(realProfit, prevProfitTotal);

  const basketTrendValue =
    calcTrend(basket, prevBasket);

  const marginTrendValue =
    calcTrend(marginRate, prevMargin);

  /* =========================
     📊 DISPLAY
     ========================= */

  $("salesValue").textContent = formatMoney(totalSales);
  $("profitValue").textContent = formatMoney(realProfit);
  $("basketValue").textContent = formatMoney(basket);
  $("marginValue").textContent = `${marginRate.toFixed(1)}%`;

  const updateTrend = (id, value) => {
    const el = $(id);
    if (!el) return;

    const v = n(value);
    const positive = v >= 0;

    el.textContent = `${positive ? "+" : ""}${v.toFixed(1)}%`;
    el.className = positive
      ? "kpi-trend trend-up"
      : "kpi-trend trend-down";
  };

  updateTrend("salesTrend", salesTrendValue);
  updateTrend("profitTrend", profitTrendValue);
  updateTrend("basketTrend", basketTrendValue);
  updateTrend("marginTrend", marginTrendValue);
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
function renderSellers(sales, saleItems){

  clearNode("leaderboardList");
  clearNode("weakSellerList");

  const boxTop = $("leaderboardList");
  const boxWeak = $("weakSellerList");
  if(!boxTop || !boxWeak) return;

  /* =========================
     MAP INIT (ALL USERS INCLUDED)
     ========================= */

  const map = {};

  state.users.forEach(u => {
    const id = u.userId || u.id;
    map[id] = { amount: 0, count: 0 };
  });

  /* fallback unknown seller */
  const UNKNOWN = "__unknown__";
    map[UNKNOWN] = { amount:0, count:0 };

  /* =========================
     GROUP ITEMS BY SALE
     ========================= */

  const itemsBySale = {};

  saleItems.forEach(i => {
    if(!itemsBySale[i.saleId]) itemsBySale[i.saleId] = [];
    itemsBySale[i.saleId].push(i);
  });

  /* =========================
     BUILD REAL SELLER STATS
     ========================= */

  sales.forEach(s => {

    const sellerId = s.sellerId || UNKNOWN;
    const saleKey =  s.saleId ||  s.id;

const items =  itemsBySale[saleKey] || [];

    let saleTotal = 0;

    let saleCount = 0;

    items.forEach(i => {
      saleTotal += n(i.price) * n(i.quantity);
      saleCount += n(i.quantity);
    });
    
    if(!map[sellerId]){
  map[sellerId] = {
    amount:0, count:0
  }
}

    map[sellerId].amount += saleTotal;
    map[sellerId].count += saleCount;
  });

  /* =========================
     ENTRIES FILTER (REMOVE EMPTY ONLY IF TOTAL SYSTEM EMPTY)
     ========================= */

  const entries = Object.entries(map);

  /* =========================
     SORT TOP / WEAK
     ========================= */

  const sortedTop =
    [...entries]
      .sort((a,b) => b[1].amount - a[1].amount)
      .slice(0,5);

  const sortedWeak =
    [...entries]
      .sort((a,b) => a[1].amount - b[1].amount)
      .slice(0,5);

  /* =========================
     RENDER FUNCTION CLEAN
     ========================= */

  const render = (box, data, badge = null) => {

    data.forEach(([id, v]) => {

      const user =
        state.users.find(u =>
          (u.userId || u.id) === id
        );

      const el = document.createElement("div");
      el.className = "list-item";

      const left = document.createElement("div");
      left.className = "list-left";

      const title = document.createElement("div");
      title.className = "list-title";
      title.textContent = user?.name || id;

      const sub = document.createElement("div");
      sub.className = "list-sub";

      sub.textContent =
        `${v.count} unités vendues`;

      const value = document.createElement("div");
      value.className = "list-value";

      value.textContent = formatMoney(v.amount);

      if(badge){
        const tag = document.createElement("div");
        tag.className = `badge ${badge}`;
        tag.textContent = badge === "badge-green" ? "TOP" : "LOW";
        left.appendChild(tag);
      }

      left.appendChild(title);
      left.appendChild(sub);

      el.appendChild(left);
      el.appendChild(value);

      box.appendChild(el);
    });
  };

  /* =========================
     PREVENT DUPLICATE LOGIC
     ========================= */

  render(boxTop, sortedTop, "badge-green");
  render(boxWeak, sortedWeak, "badge-orange");
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

  const movements = [...state.stockMovements]
    .sort((a,b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    )
    .slice(0,10);

  movements.forEach(m => {

    const el = document.createElement("div");
    el.className = "activity-item";

    const left = document.createElement("div");
    left.className = "activity-left";

    const title = document.createElement("div");
    title.className = "activity-title";
    
    const product = state.products.find(p => p.id === m.productId);

    const typeLabel =
      m.type === "IN" ? "📥 Entrée stock" :
      m.type === "OUT" ? "📤 Sortie stock" :
      "⚙ Mouvement stock";

    const reasonLabel =
      m.reason ? ` (${m.reason})` : "";
    
    title.textContent =
  `${typeLabel}${reasonLabel} - ${product?.name || "Produit"}`;

    const meta = document.createElement("div");
    meta.className = "activity-meta";

    const date =  getDate(m.createdAt)?.toLocaleString() || "";

    meta.textContent =
      `${date} • Qty: ${m.quantity || 0}`;

    const value = document.createElement("div");
    value.className = "activity-price";

    value.textContent =
      `${m.quantity || 0} pcs`;

    left.appendChild(title);
    left.appendChild(meta);

    el.appendChild(left);
    el.appendChild(value);

    box.appendChild(el);
  });
}

function buildPdfPayload(){

  const sales = state.sales;
  const expenses = state.expenses;

  const products = state.products || [];
  const stockMovements = state.stockMovements || [];
  const saleItems = state.saleItems || [];

  const productMap = {};

  products.forEach(product => {
    productMap[product.id] = product;
  });

  const debts = expenses.filter(expense => {

    return (
      expense.genre === "debt" &&
      expense.status !== "paid" &&
      n(expense.amount_remaining) > 0
    );

  });

  const losses = expenses.filter(expense => {

    return (
      expense.genre === "loss" &&
      expense.isSystemCorrection !== true
    );

  });

  const normalExpenses = expenses.filter(expense => {

    return expense.genre === "expense";

  });

  const totalSales = sales.reduce(
    (sum,sale) => sum + n(sale.total_amount),
    0
  );

  const totalProfit = sales.reduce(
    (sum,sale) => sum + n(sale.total_profit),
    0
  );

  const totalExpenses = normalExpenses.reduce(
    (sum,item) => sum + n(item.amount),
    0
  );

  const totalLosses = losses.reduce(
    (sum,item) => sum + n(item.amount),
    0
  );

  const totalDebtRemaining = debts.reduce(
    (sum,item) => sum + n(item.amount_remaining),
    0
  );

  const netProfit =
    totalProfit -
    totalExpenses -
    totalLosses;

  const salesWithProducts = sales.map(sale => {

    const items = saleItems
      .filter(item => {

        return (
          item.saleId === sale.id ||
          item.sale_id === sale.id
        );

      })
      .map(item => {

        const productId =
          item.productId ||
          item.product_id;

        const product =
          productMap[productId];

        return {
          productId,
          productName:
            product?.name ||
            "Produit inconnu",
          quantity:
            n(item.quantity),
          price:
            n(item.price),
          profit:
            n(item.profit)
        };
      });

    return {

      id: sale.id,
      sellerId:
        sale.sellerId,
      amount:
        n(sale.total_amount),
      profit:
        n(sale.total_profit),
      status:
        sale.status,
      payment_status:
        sale.payment_status,
      amount_paid:
        n(sale.amount_paid),
      amount_remaining:
        n(sale.amount_remaining),
      createdAt:
        sale.createdAt,
      items
    };
  });

  return {
    meta: {
  shopName: state.config?.shopName || "StockFlow",
  shopAddress: state.config?.shopAddress || "",
  shopPhone: state.config?.shopPhone || "",
  currency: state.currency,
  currencySymbol: state.config?.currencySymbol || state.currency || "$",
  logoUrl: state.config?.logoUrl || "shopLogo.png",
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

    sales: salesWithProducts,
    debts: debts.map(debt => ({
      id: debt.id,
      name:debt.name || "",
      phone:debt.phone || "",
      total:
        n(debt.amount_total),
      paid: n(debt.amount_paid),
      remaining:n(debt.amount_remaining),
      status: debt.status,
      relatedSaleId: debt.relatedSaleId
    })),

    losses: losses.map(loss => ({
      id: loss.id,
      amount: n(loss.amount),
      reason: loss.reason || "",
      category:  loss.category || ""
    })),

    products: products.map(product => ({
      id: product.id,
      name:  product.name || "",
      stock: n(product.stock_current),
      alert: n(product.stock_alert)
    })),

    stockMovements:
      stockMovements.slice(-300)
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
    initPdfExport(buildPdfPayload);
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
