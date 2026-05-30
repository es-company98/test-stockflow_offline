import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function formatMoney(value, currency = "$") {
  return `${Math.round(n(value)).toLocaleString()}${currency}`;
}

function getStats() {
  return window.statsData || null;
}

function safeArray(arr) {
  return Array.isArray(arr) ? arr : [];
}

function buildPdfData() {

  const data = getStats();
  if (!data) return null;

  const sales = safeArray(data.sales);
  const expenses = safeArray(data.expenses);

  const totalSales = sales.reduce(
    (s, x) => s + n(x.total_amount || x.amount_paid),
    0
  );

  const totalProfit = sales.reduce(
    (s, x) => s + n(x.total_profit),
    0
  );

  const totalExpenses = expenses.reduce(
    (s, x) => s + n(x.amount || x.amount_remaining),
    0
  );

  const netProfit = totalProfit - totalExpenses;

  const avgBasket = sales.length
    ? totalSales / sales.length
    : 0;

  const margin = totalSales
    ? (netProfit / totalSales) * 100
    : 0;

  return {
    currency: data.currency || "$",
    salesCount: sales.length,
    totalSales,
    totalProfit,
    totalExpenses,
    netProfit,
    avgBasket,
    margin
  };

}

function addLine(doc, label, value, y) {
  doc.text(`${label}: ${value}`, 15, y);
  return y + 8;
}

function addSection(doc, title, y) {
  doc.setFontSize(13);
  doc.text(title, 15, y);
  return y + 6;
}

export function exportStatsPdf() {

  const data = buildPdfData();
  if (!data) return;

  const doc = new jsPDF();

  let y = 15;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("StockFlow - Rapport Statistiques", 15, y);

  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  // SECTION 1
  y = addSection(doc, "Résumé global", y);
  y = addLine(doc, "Ventes", data.salesCount, y);
  y = addLine(doc, "Chiffre d'affaires", formatMoney(data.totalSales, data.currency), y);
  y = addLine(doc, "Profit brut", formatMoney(data.totalProfit, data.currency), y);
  y = addLine(doc, "Dépenses", formatMoney(data.totalExpenses, data.currency), y);
  y = addLine(doc, "Profit net", formatMoney(data.netProfit, data.currency), y);

  y += 5;

  // SECTION 2
  y = addSection(doc, "Indicateurs", y);
  y = addLine(doc, "Panier moyen", formatMoney(data.avgBasket, data.currency), y);
  y = addLine(doc, "Marge", `${data.margin.toFixed(1)}%`, y);

  y += 10;

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    "Généré automatiquement par StockFlow",
    15,
    285
  );

  doc.save("stockflow-stats.pdf");

}

export function initPdfExport() {

  const btn = document.getElementById("pdfBtn");
  if (!btn) return;

  btn.addEventListener("click", exportStatsPdf);

}