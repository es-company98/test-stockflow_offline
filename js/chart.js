// chart.js
import { Chart } from "https://cdn.jsdelivr.net/npm/chart.js/+esm";

let statsChart = null;

const chartColors = {
  sales: "#0B3D2E",
  profit: "#16A34A",
  debts: "#D92D20"
};

function getDate(value) {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function formatDay(date) {
  const d = getDate(date);
  if (!d) return "";

  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit"
  });
}

function buildSalesDataset(sales = []) {
  const map = {};

  sales.forEach(sale => {
    const d = getDate(sale.createdAt);
    if (!d) return;

    const key = d.toISOString().slice(0, 10);
    map[key] ??= 0;
    map[key] += Number(sale.total_amount || 0);
  });

  const labels = Object.keys(map).sort();

  return {
    labels,
    values: labels.map(k => map[k])
  };
}

function buildProfitDataset(sales = []) {
  const map = {};

  sales.forEach(sale => {
    const d = getDate(sale.createdAt);
    if (!d) return;

    const key = d.toISOString().slice(0, 10);
    map[key] ??= 0;
    map[key] += Number(sale.total_profit || 0);
  });

  const labels = Object.keys(map).sort();

  return {
    labels,
    values: labels.map(k => map[k])
  };
}

function buildDebtDataset(expenses = []) {
  const map = {};

  expenses
    .filter(e => e.genre === "debt")
    .forEach(item => {
      const d = getDate(item.createdAt);
      if (!d) return;

      const key = d.toISOString().slice(0, 10);
      map[key] ??= 0;
      map[key] += Number(item.amount_remaining || 0);
    });

  const labels = Object.keys(map).sort();

  return {
    labels,
    values: labels.map(k => map[k])
  };
}

function destroyChart() {
  if (statsChart) {
    statsChart.destroy();
    statsChart = null;
  }
}

export function renderChart() {
  if (!window.statsData) return;

  const canvas = document.getElementById("statsChart");
  if (!canvas) return;

  const chartType =
    document.getElementById("chartType")?.value || "sales";

  let dataset;

  if (chartType === "profit") {
    dataset = buildProfitDataset(window.statsData.sales);
  } else if (chartType === "debts") {
    dataset = buildDebtDataset(window.statsData.expenses);
  } else {
    dataset = buildSalesDataset(window.statsData.sales);
  }

  destroyChart();

  statsChart = new Chart(canvas, {
    type: "line",
    data: {
      labels: dataset.labels.map(formatDay),
      datasets: [
        {
          label:
            chartType === "sales"
              ? "Chiffre d'affaires"
              : chartType === "profit"
              ? "Profit"
              : "Dettes",

          data: dataset.values,
          borderColor: chartColors[chartType],
          backgroundColor: chartColors[chartType],
          borderWidth: 3,
          tension: 0.35,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: "index"
      },
      plugins: {
        legend: { display: true }
      },
      scales: {
        x: { display: true },
        y: { beginAtZero: true }
      }
    }
  });
}

function waitStatsData() {
  const timer = setInterval(() => {
    if (window.statsData) {
      clearInterval(timer);
      renderChart();
    }
  }, 200);
}

export function initChart() {
  document
    .getElementById("chartType")
    ?.addEventListener("change", renderChart);

  window.addEventListener("stats-updated", renderChart);

  waitStatsData();
}

/* compat externe */
window.renderStatsChart = renderChart;
