import {
  db,
  collection,
  getDocs,
  query,
  where,
  orderBy
} from "./firebase.js";

import {
  auth,
  getAuth,
  onAuthStateChanged
} from "./auth.js";

const $ = id => document.getElementById(id);

const state = {
  sales: [],
  saleItems: [],
  products: [],
  users: [],
  expenses: [],
  rows: [],
  currency: "$"
};

const salesSnap =
  await getDocs(
    buildSalesQuery()
  );
  
$("searchBtn").addEventListener(
  "click",
  loadData
);

async function checkAccess(uid){

  const usersSnap = await getDocs(
    collection(db,"users")
  );

  const currentUser = usersSnap.docs
    .map(doc => ({
      id:doc.id,
      ...doc.data()
    }))
    .find(u =>
      u.userId === uid ||
      u.uid === uid
    );

  if(!currentUser){
    location.replace("404.html");
    return;
  }

  if(
    currentUser.role !== "admin" &&
    currentUser.role !== "seller"
  ){
    location.replace("404.html");
    return;
  }

  loadData();
}

function n(v){
  return Number(v) || 0;
}

function getDate(v){

  if(!v) return null;

  if(typeof v?.toDate === "function"){
    return v.toDate();
  }

  if(v?.seconds){
    return new Date(v.seconds * 1000);
  }

  const d = new Date(v);

  return isNaN(d.getTime())
    ? null
    : d;
}

function buildSalesQuery(){

  const constraints = [];

  constraints.push(
    orderBy("createdAt","desc")
  );

  const sellerId =
    $("sellerFilter")?.value;

  if(sellerId){

    constraints.push(
      where(
        "sellerId",
        "==",
        sellerId
      )
    );
  }

  const paymentStatus =
    $("paymentFilter")?.value;

  if(paymentStatus){

    constraints.push(
      where(
        "payment_status",
        "==",
        paymentStatus
      )
    );
  }

  const status =
    $("statusFilter")?.value;

  if(status){

    constraints.push(
      where(
        "status",
        "==",
        status
      )
    );
  }

  return query(
    collection(db,"sales"),
    ...constraints
  );
}

async function loadData(){

  const [
    salesSnap,
    saleItemsSnap,
    productsSnap,
    usersSnap,
    expensesSnap
  ] = await Promise.all([
    getDocs(collection(db,"sales")),
    getDocs(collection(db,"sale_items")),
    getDocs(collection(db,"products")),
    getDocs(collection(db,"users")),
    getDocs(collection(db,"expensess"))
  ]);

  state.sales = salesSnap.docs.map(d => ({
    id:d.id,
    ...d.data()
  }));

  state.saleItems = saleItemsSnap.docs.map(d => ({
    id:d.id,
    ...d.data()
  }));

  state.products = productsSnap.docs.map(d => ({
    id:d.id,
    ...d.data()
  }));

  state.users = usersSnap.docs.map(d => ({
    id:d.id,
    ...d.data()
  }));

  state.expenses = expensesSnap.docs.map(d => ({
    id:d.id,
    ...d.data()
  }));

  buildRows();

  populateFilters();

  render();
}

function buildRows(){

  state.rows = [];

  state.saleItems.forEach(item => {

    const sale = state.sales.find(
      s => s.id === item.saleId
    );

    if(!sale){
      return;
    }

    const product = state.products.find(
      p => p.id === item.productId
    );

    const seller = state.users.find(
      u =>
        u.userId === sale.sellerId ||
        u.id === sale.sellerId
    );

    const debt = state.expenses.find(
      e =>
        e.genre === "debt" &&
        e.relatedSaleId === sale.id
    );

    state.rows.push({

      saleId: sale.id,

      productId: item.productId,

      productName:
        product?.name || "Produit",

      sellerId:
        sale.sellerId || "",

      sellerName:
        seller?.name || "Vendeur",

      quantity:
        n(item.quantity),

      price:
        n(item.price),

      total:
        n(item.quantity) *
        n(item.price),

      clientName:
        debt?.name || "",

      paymentStatus:
        sale.payment_status || "paid",

      saleStatus:
        sale.status || "active",

      amountRemaining:
        debt?.amount_remaining || 0,

      createdAt:
        getDate(sale.createdAt)
    });
  });
}

function populateFilters(){

  const productFilter = $("productFilter");

  if(productFilter){

    productFilter.replaceChildren();

    const first =
      document.createElement("option");

    first.value = "";
    first.textContent = "Tous les produits";

    productFilter.appendChild(first);

    state.products.forEach(product => {

      const option =
        document.createElement("option");

      option.value = product.id;

      option.textContent =
        product.name || "Produit";

      productFilter.appendChild(option);
    });
  }

  const sellerFilter = $("sellerFilter");

  if(sellerFilter){

    sellerFilter.replaceChildren();

    const first =
      document.createElement("option");

    first.value = "";

    first.textContent =
      "Tous les vendeurs";

    sellerFilter.appendChild(first);

    state.users.forEach(user => {

      const option =
        document.createElement("option");

      option.value =
        user.userId || user.id;

      option.textContent =
        user.name || "Vendeur";

      sellerFilter.appendChild(option);
    });
  }
}

function getFilteredRows(){

  let rows = [...state.rows];

  const search =
    $("searchInput")?.value
      ?.trim()
      ?.toLowerCase() || "";

  const productId =
    $("productFilter")?.value || "";

  const sellerId =
    $("sellerFilter")?.value || "";

  const payment =
    $("paymentFilter")?.value || "";

  const status =
    $("statusFilter")?.value || "";

  const dateFrom =
    $("dateFrom")?.value || "";

  const dateTo =
    $("dateTo")?.value || "";

  if(search){

    rows = rows.filter(row =>
      row.productName.toLowerCase().includes(search) ||
      row.clientName.toLowerCase().includes(search)
    );
  }

  if(productId){

    rows = rows.filter(
      row => row.productId === productId
    );
  }

  if(sellerId){

    rows = rows.filter(
      row => row.sellerId === sellerId
    );
  }

  if(payment){

    rows = rows.filter(
      row => row.paymentStatus === payment
    );
  }

  if(status){

    rows = rows.filter(
      row => row.saleStatus === status
    );
  }

  if(dateFrom){

    const from =
      new Date(dateFrom);

    rows = rows.filter(
      row => row.createdAt >= from
    );
  }

  if(dateTo){

    const to =
      new Date(dateTo);

    to.setHours(
      23,
      59,
      59,
      999
    );

    rows = rows.filter(
      row => row.createdAt <= to
    );
  }

  return rows;
}

function renderKpis(rows){

  const soldCount =
    rows.reduce(
      (sum,row) =>
        sum + row.quantity,
      0
    );

  const salesTotal =
    rows.reduce(
      (sum,row) =>
        sum + row.total,
      0
    );

  const clients =
    new Set(
      rows
        .map(r => r.clientName)
        .filter(Boolean)
    );

  const debtTotal =
    rows.reduce(
      (sum,row) =>
        sum + n(row.amountRemaining),
      0
    );

  $("soldCount").textContent =
    soldCount;

  $("salesTotal").textContent =
    salesTotal.toLocaleString();

  $("clientsCount").textContent =
    clients.size;

  $("debtTotal").textContent =
    debtTotal.toLocaleString();
}

function renderRows(){

  const rows =
    getFilteredRows();

  renderKpis(rows);

  const container =
    $("salesList");

  if(!container){
    return;
  }

  container.replaceChildren();

  const fragment =
    document.createDocumentFragment();

  rows.forEach(row => {

    const card =
      document.createElement("div");

    card.className =
      "sale-card";

    const badge =
      row.paymentStatus === "partial"
        ? "Dette"
        : "Payé";

    card.innerHTML = `
      <div class="sale-top">
        <div class="sale-product">${row.productName}</div>
        <div class="sale-price">${row.total}</div>
      </div>
      <div class="sale-meta">Client : ${row.clientName || "-"}</div>
      <div class="sale-meta">Vendeur : ${row.sellerName}</div>
      <div class="sale-meta">Qté : ${row.quantity}</div>
      <div class="sale-meta">${row.createdAt?.toLocaleDateString() || ""}</div>
      <div class="sale-meta">${badge}</div>
    `;

    fragment.appendChild(card);
  });

  container.appendChild(fragment);
}

function render(){
  renderRows();
}

function bindEvents(){

  [
    "searchInput",
    "productFilter",
    "sellerFilter",
    "paymentFilter",
    "statusFilter",
    "dateFrom",
    "dateTo"
  ].forEach(id => {

    const element = $(id);

    if(!element){
      return;
    }

    element.addEventListener(
      "input",
      renderRows
    );

    element.addEventListener(
      "change",
      renderRows
    );
  });
}

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    bindEvents();

    await loadData();
  }
);

onAuthStateChanged(auth, async user => {

  if(!user){
    location.replace("404.html");
    return;
  }

  await checkAccess(user.uid);

});
