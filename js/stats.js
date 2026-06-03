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

  const previousPeriod = getPreviousPeriodData();

renderKPIs(
  sales,
  expenses,
  previousPeriod.sales,
  previousPeriod.expenses
);
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
  renderSellers(sales);
  renderAlerts();
  renderActivity();

  if(state.chartReady) {
  renderChart(); // sync chart.js
} 
}

/* ----------------  ---------------- */
function renderFinancialHealth(
  sales,
  expenses
){

  const expensesTotal =
    expenses.reduce(
      (s,e)=>s+n(e.amount),
      0
    );

  const lossesTotal =
    state.products.reduce(
      (s,p)=>
        s+n(p.loss_amount),
      0
    );

  const debtsTotal =
    state.expenses
      .filter(
        e=>
          e.genre==="debt"
      )
      .reduce(
        (s,e)=>
          s+n(
            e.amount_remaining
          ),
        0
      );

  const cashReceived =
    sales.reduce(
      (s,v)=>
        s+n(v.paid_amount),
      0
    );

  const purchaseTotal =
    state.purchases.reduce(
      (s,p)=>
        s+n(
          p.total_amount
        ),
      0
    );

  const grossProfit =
    sales.reduce(
      (s,v)=>
        s+n(v.total_profit),
      0
    );

  const netResult =
    grossProfit
    - expensesTotal
    - lossesTotal;

  $("expensesValue").textContent =
    formatMoney(expensesTotal);

  $("lossesValue").textContent =
    formatMoney(lossesTotal);

  $("debtsValue").textContent =
    formatMoney(debtsTotal);

  $("cashReceivedValue").textContent =
    formatMoney(cashReceived);

  $("purchaseValue").textContent =
    formatMoney(purchaseTotal);

  $("netResultValue").textContent =
    formatMoney(netResult);

}

/* ----------------  ---------------- */
function renderStockHealth(){

  const stockValue =
    state.products.reduce(
      (s,p)=>
        s+
        (
          n(
            p.stock_current
          ) *
          n(
            p.purchase_price
          )
        ),
      0
    );

  const blockedStock =
    state.products.filter(
      p =>
        n(
          p.stock_current
        ) > 0 &&
        !n(
          p.totalSold
        )
    ).length;

  const stockOut =
    state.products.filter(
      p =>
        n(
          p.stock_current
        ) <= 0
    ).length;

  const soldQty =
    state.saleItems.reduce(
      (s,i)=>
        s+n(i.quantity),
      0
    );

  const stockQty =
    state.products.reduce(
      (s,p)=>
        s+n(
          p.stock_current
        ),
      0
    );

  const rotation =
    stockQty
      ? (
          soldQty /
          stockQty
        ).toFixed(2)
      : 0;

  $("stockValue").textContent =
    formatMoney(stockValue);

  $("stockRotation").textContent =
    rotation;

  $("blockedStock").textContent =
    blockedStock;

  $("stockOutCount").textContent =
    stockOut;

}

/* ----------------  ---------------- */
function renderDebts(){

  clearNode(
    "topDebtorsList"
  );

  const box =
    $("topDebtorsList");

  if(!box) return;

  const debts =
    state.expenses
      .filter(
        e =>
          e.genre==="debt"
      )
      .sort(
        (a,b)=>
          n(
            b.amount_remaining
          ) -
          n(
            a.amount_remaining
          )
      )
      .slice(0,10);

  debts.forEach(d=>{

    const item =
      document.createElement(
        "div"
      );

    item.className =
      "list-item";

    const left =
      document.createElement(
        "div"
      );

    left.className =
      "list-left";

    const title =
      document.createElement(
        "div"
      );

    title.className =
      "list-title";

    title.textContent =
      d.customerName ||
      "Client";

    const sub =
      document.createElement(
        "div"
      );

    sub.className =
      "list-sub";

    sub.textContent =
      "Dette restante";

    const value =
      document.createElement(
        "div"
      );

    value.className =
      "list-value";

    value.textContent =
      formatMoney(
        d.amount_remaining
      );

    left.appendChild(
      title
    );

    left.appendChild(
      sub
    );

    item.appendChild(
      left
    );

    item.appendChild(
      value
    );

    box.appendChild(
      item
    );

  });

}

/* ----------------  ---------------- */
function renderPurchases(){

  clearNode(
    "purchaseList"
  );

  const box =
    $("purchaseList");

  if(!box) return;

  const list =
    [...state.purchases]
      .sort(
        (a,b)=>
          getDate(
            b.createdAt
          ) -
          getDate(
            a.createdAt
          )
      )
      .slice(0,10);

  list.forEach(p=>{

    const item =
      document.createElement(
        "div"
      );

    item.className =
      "activity-item";

    const left =
      document.createElement(
        "div"
      );

    left.className =
      "activity-left";

    const title =
      document.createElement(
        "div"
      );

    title.className =
      "activity-title";

    title.textContent =
      p.supplierName ||
      "Fournisseur";

    const meta =
      document.createElement(
        "div"
      );

    meta.className =
      "activity-meta";

    meta.textContent =
      getDate(
        p.createdAt
      )?.toLocaleString()
      || "";

    const value =
      document.createElement(
        "div"
      );

    value.className =
      "activity-price";

    value.textContent =
      formatMoney(
        p.total_amount
      );

    left.appendChild(
      title
    );

    left.appendChild(
      meta
    );

    item.appendChild(
      left
    );

    item.appendChild(
      value
    );

    box.appendChild(
      item
    );

  });

}

/* ----------------  ---------------- */


/* ---------------- V. PRÉCÉDENTE ---------------- */
function getPreviousPeriodData(){

  const range = $("statsRange")?.value || "30days";

  const now = new Date();

  let currentDays = 30;

  switch(range){

    case "today":
      currentDays = 1;
      break;

    case "yesterday":
      currentDays = 1;
      break;

    case "7days":
      currentDays = 7;
      break;

    case "30days":
      currentDays = 30;
      break;

    case "month":
      currentDays = 30;
      break;

    case "year":
      currentDays = 365;
      break;

    default:
      currentDays = 30;
  }

  const endPrevious =
    new Date(now.getTime() - currentDays * 86400000);

  const startPrevious =
    new Date(endPrevious.getTime() - currentDays * 86400000);

  const previousSales = state.sales.filter(s => {

    const d = getDate(s.createdAt);

    return d &&
      d >= startPrevious &&
      d < endPrevious;
  });

  const previousExpenses = state.expenses.filter(e => {

    const d = getDate(e.createdAt);

    return d &&
      d >= startPrevious &&
      d < endPrevious;
  });

  return {
    sales: previousSales,
    expenses: previousExpenses
  };
}

/* ---------------- KPI ---------------- */
function renderKPIs(
  sales,
  expenses,
  previousSales = [],
  previousExpenses = []
){

  const totalSales =
    sales.reduce(
      (sum,sale) =>
        sum + n(sale.total_amount),
      0
    );

  const grossProfit =
    sales.reduce(
      (sum,sale) =>
        sum + n(sale.total_profit),
      0
    );

  const totalExpenses =
    expenses.reduce(
      (sum,e) =>
        sum + n(e.amount),
      0
    );

  const realProfit =
    grossProfit - totalExpenses;

  const basket =
    sales.length
      ? totalSales / sales.length
      : 0;

  const marginRate =
    totalSales > 0
      ? (grossProfit / totalSales) * 100
      : 0;

  /* =========================
     PÉRIODE PRÉCÉDENTE
     ========================= */

  const prevSalesTotal =
    previousSales.reduce(
      (sum,sale) =>
        sum + n(sale.total_amount),
      0
    );

  const prevProfitTotal =
    previousSales.reduce(
      (sum,sale) =>
        sum + n(sale.total_profit),
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
      ? (
          previousSales.reduce(
            (sum,sale)=>
              sum+n(sale.total_profit),
            0
          ) /
          prevSalesTotal
        ) * 100
      : 0;

  const calcTrend = (current, previous) => {

    if(previous <= 0){
      return current > 0 ? 100 : 0;
    }

    return (
      (
        (current - previous)
        / previous
      ) * 100
    );
  };

  const salesTrendValue =
    calcTrend(
      totalSales,
      prevSalesTotal
    );

  const profitTrendValue =
    calcTrend(
      realProfit,
      prevProfitTotal
    );

  const basketTrendValue =
    calcTrend(
      basket,
      prevBasket
    );

  const marginTrendValue =
    calcTrend(
      marginRate,
      prevMargin
    );

  /* =========================
     AFFICHAGE
     ========================= */

  $("salesValue").textContent =
    formatMoney(totalSales);

  $("profitValue").textContent =
    formatMoney(realProfit);

  $("basketValue").textContent =
    formatMoney(basket);

  $("marginValue").textContent =
    `${marginRate.toFixed(1)}%`;

  const updateTrend = (
    id,
    value
  ) => {

    const el = $(id);

    if(!el) return;

    const positive = value >= 0;

    el.textContent =
      `${positive ? "+" : ""}${value.toFixed(1)}%`;

    el.className =
      positive
        ? "kpi-trend trend-up"
        : "kpi-trend trend-down";
  };

  updateTrend(
    "salesTrend",
    salesTrendValue
  );

  updateTrend(
    "profitTrend",
    profitTrendValue
  );

  updateTrend(
    "basketTrend",
    basketTrendValue
  );

  updateTrend(
    "marginTrend",
    marginTrendValue
  );
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

function buildPdfPayload(){

  const filterDate = getRangeFilter();

  const sales = state.sales.filter(
    s => filterDate(getDate(s.createdAt))
  );

  const expenses = state.expenses.filter(
    e => filterDate(getDate(e.createdAt))
  );

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
      shopName:
        state.config?.shopName ||
        "StockFlow",
      currency:
        state.currencySymbol,
      currencySymbol:
        state.currencySymbol,
        logoUrl:state.config?.logoUrl || "shopLogo.png"
      generatedAt:
        new Date().toISOString()
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
    bindEvents();

    initChart();

    await loadData();
  });
});

/* ---------------- PDF HOOK (future) ---------------- */
initPdfExport(buildPdfPayload);
