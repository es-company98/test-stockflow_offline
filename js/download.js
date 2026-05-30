import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

let provider = null;

/* ================= PROVIDER ================= */

export function initPdfExport(providerFn) {
  provider = providerFn;
}

function getData() {
  return provider?.() || null;
}

/* ================= UTILS ================= */

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function money(v, c = "$") {
  return `${Math.round(n(v)).toLocaleString()} ${c}`;
}

function safeArr(a) {
  return Array.isArray(a) ? a : [];
}

function line(doc, label, value, y) {
  doc.text(`${label}: ${value}`, 15, y);
  return y + 7;
}

function section(doc, title, y) {
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(title, 15, y);
  return y + 6;
}

/* ================= BUILD REPORT ================= */

function build() {

  const data = getData();
  if (!data) return null;

  const sales = safeArr(data.sales);
  const expenses = safeArr(data.expenses);
  const debts = safeArr(data.debts);
  const losses = safeArr(data.losses);
  const products = safeArr(data.products);

  const totalSales = sales.reduce((a, b) => a + n(b.amount), 0);
  const totalProfit = sales.reduce((a, b) => a + n(b.profit), 0);

  const totalExpenses = expenses.reduce((a, b) => a + n(b.amount), 0);
  const totalLosses = losses.reduce((a, b) => a + n(b.amount), 0);

  const totalDebtRemaining = debts.reduce((a, b) => a + n(b.remaining), 0);

  const netProfit = totalProfit - totalExpenses - totalLosses;

  const stockValue = products.reduce((a, b) => a + n(b.stock), 0);

  return {
    meta: data.meta,
    kpis: {
      totalSales,
      totalProfit,
      totalExpenses,
      totalLosses,
      totalDebtRemaining,
      netProfit,
      stockValue
    },
    sales,
    debts,
    losses,
    products
  };
}

/* ================= EXPORT PDF ================= */

export function exportStatsPdf() {

  const data = build();
  if (!data) return;

  const doc = new jsPDF();
  let y = 15;

  /* HEADER */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("StockFlow - Rapport ERP Business", 15, y);

  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  /* ================= META ================= */
  y = section(doc, "Informations système", y);

  y = line(doc, "Boutique", data.meta.shopName || "StockFlow", y);
  y = line(doc, "Devise", data.meta.currency || "$", y);
  y = line(doc, "Généré le", new Date(data.meta.generatedAt).toLocaleString(), y);

  y += 6;

  /* ================= KPI ================= */
  y = section(doc, "Indicateurs financiers", y);

  y = line(doc, "Chiffre d'affaires", money(data.kpis.totalSales, data.meta.currency), y);
  y = line(doc, "Profit brut", money(data.kpis.totalProfit, data.meta.currency), y);
  y = line(doc, "Dépenses", money(data.kpis.totalExpenses, data.meta.currency), y);
  y = line(doc, "Pertes", money(data.kpis.totalLosses, data.meta.currency), y);
  y = line(doc, "Dettes restantes", money(data.kpis.totalDebtRemaining, data.meta.currency), y);

  y = line(doc, "Profit net réel", money(data.kpis.netProfit, data.meta.currency), y);

  y += 6;

  /* ================= DECISION SECTION ================= */
  y = section(doc, "Analyse décisionnelle", y);

  const margin = data.kpis.totalSales
    ? ((data.kpis.netProfit / data.kpis.totalSales) * 100).toFixed(1)
    : "0";

  y = line(doc, "Marge réelle", `${margin}%`, y);
  y = line(doc, "Valeur stock", money(data.kpis.stockValue, data.meta.currency), y);

  y += 6;

  /* ================= SALES ================= */
  y = section(doc, "Dernières ventes (échantillon)", y);

  data.sales.slice(0, 6).forEach(s => {
    y = line(
      doc,
      s.id || "sale",
      `${money(s.amount, data.meta.currency)} | profit ${money(s.profit, data.meta.currency)}`,
      y
    );
  });

  y += 6;

  /* ================= DEBTS ================= */
  y = section(doc, "Dettes clients (risque)", y);

  data.debts.slice(0, 6).forEach(d => {
    y = line(
      doc,
      d.name || "client",
      `reste: ${money(d.remaining, data.meta.currency)}`,
      y
    );
  });

  y += 6;

  /* ================= LOSSES ================= */
  y = section(doc, "Pertes système", y);

  data.losses.slice(0, 6).forEach(l => {
    y = line(
      doc,
      l.reason || "loss",
      money(l.amount, data.meta.currency),
      y
    );
  });

  y += 6;

  /* ================= PRODUCTS ================= */
  y = section(doc, "Stock critique", y);

  data.products
    .filter(p => n(p.stock) <= (p.alert || 5))
    .slice(0, 8)
    .forEach(p => {
      y = line(doc, p.name, `stock: ${p.stock}`, y);
    });

  /* FOOTER */
  doc.setFontSize(9);
  doc.text("StockFlow ERP - rapport décisionnel automatique", 15, 285);

  doc.save("stockflow-erp-report.pdf");
}

/* ================= INIT BUTTON ================= */

export function initPdfExportButton() {
  const btn = document.getElementById("pdfBtn");
  if (!btn) return;

  btn.addEventListener("click", exportStatsPdf);
}