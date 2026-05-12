// js/offline.js
// VERSION FINALE PRO SAFE + GENERIC + ANTI DOUBLE SYNC

import { db } from "./firebase.js";

/* =========================
   CONFIG
========================= */

export const QUEUE_KEY = "offline_queue_v1";
export const DEVICE_KEY = "offline_device_id";

let deferredPrompt = null;
let offlineBanner = null;
let isSyncing = false;

/* =========================
   DEVICE ID
========================= */

export function getDeviceId() {

  let id = localStorage.getItem(DEVICE_KEY);

  if (!id) {

    id = crypto.randomUUID();

    localStorage.setItem(DEVICE_KEY, id);

  }

  return id;

}

/* =========================
   FIREBASE OFFLINE
========================= */

export async function initOfflinePersistence(enableIndexedDbPersistence) {

  try {

    await enableIndexedDbPersistence(db);

    console.log("✅ Firestore offline actif");

  } catch (err) {

    console.warn("⚠️ Offline persistence fallback:", err?.code || err);

  }

}

/* =========================
   NETWORK
========================= */

export function isOffline() {
  return !navigator.onLine;
}

export function setupNetworkListeners(onBackOnline = null) {

  window.addEventListener("online", async () => {

    console.log("🌐 Internet restauré");

    updateNetworkBadge(true);

    hideOfflineWarning();

    if (typeof onBackOnline === "function") {

      try {

        await onBackOnline();

      } catch (err) {

        console.error("❌ Sync online erreur:", err);

      }

    }

  });

  window.addEventListener("offline", () => {

    console.warn("📴 Hors ligne");

    updateNetworkBadge(false);

    showOfflineWarning();

  });

  updateNetworkBadge(navigator.onLine);

}

/* =========================
   NETWORK UI
========================= */

export function updateNetworkBadge(isOnline) {

  const status = document.getElementById("status");

  if (!status) return;

  status.textContent = isOnline
    ? "● Online"
    : "● Offline";

  status.style.color = isOnline
    ? "green"
    : "red";

}

/* =========================
   OFFLINE WARNING
========================= */

export function showOfflineWarning() {

  if (offlineBanner) return;

  const div = document.createElement("div");

  div.setAttribute("id", "offline-banner");

   div.textContent =
  "⚠️ Mode hors ligne actif : vérifiez qu’aucune autre caisse n’effectue des ventes afin d’éviter des erreurs de stock lors de la synchronisation.";
  
  div.style.position = "sticky";

div.style.top = "70px";

div.style.margin = "10px";

div.style.padding = "12px 16px";

div.style.background =
  "rgba(243,156,18,0.12)";

div.style.border =
  "1px solid rgba(243,156,18,0.45)";

div.style.borderLeft =
  "4px solid #f39c12";

div.style.borderRadius = "14px";

div.style.backdropFilter =
  "blur(8px)";

div.style.color = "#f39c12";

div.style.fontSize = "13px";

div.style.fontWeight = "700";

div.style.lineHeight = "1.5";

div.style.textAlign = "left";

div.style.boxShadow =
  "0 4px 14px rgba(0,0,0,0.08)";

div.style.zIndex = "999";

div.style.pointerEvents = "none";

div.style.transition =
  "opacity 0.3s ease";

div.style.opacity = "1";

div.animate(
  [
    { opacity: 0.75 },
    { opacity: 1 },
    { opacity: 0.75 }
  ],
  {
    duration: 1800,
    iterations: Infinity
  }
);

  document.body.appendChild(div);

  offlineBanner = div;

}

export function hideOfflineWarning() {

  if (!offlineBanner) return;

  offlineBanner.remove();

  offlineBanner = null;

}

/* =========================
   OFFLINE PRODUCT SECURITY
========================= */

export function validateOfflineProduct(product) {

  if (!isOffline()) return true;

  const offlineBlocked = product?.offlineBlocked ?? false;

  const minOfflineStock = Number(
    product?.minOfflineStock ?? 5
  );

  const stock = Number(
    product?.stock_current ?? 0
  );

  if (offlineBlocked) {

    throw new Error(
      `Produit interdit offline (${product.name})`
    );

  }

  if (stock <= minOfflineStock) {

    throw new Error(
      `Stock faible offline (${product.name})`
    );

  }

  return true;

}

/* =========================
   LOCAL QUEUE
========================= */

export function getQueue() {

  try {

    const raw = localStorage.getItem(QUEUE_KEY);

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed
      : [];

  } catch (err) {

    console.error("❌ Queue corrompue:", err);

    return [];

  }

}

export function saveQueue(queue) {

  try {

    localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify(queue)
    );

  } catch (err) {

    console.error("❌ Save queue erreur:", err);

  }

}

export function clearQueue() {

  localStorage.removeItem(QUEUE_KEY);

}

/* =========================
   QUEUE ACTION
========================= */

export function addToQueue(action) {

  if (!action || typeof action !== "object") {
    throw new Error("Action invalide");
  }

  const queue = getQueue();

  const finalAction = {
    id: crypto.randomUUID(),
    deviceId: getDeviceId(),
    retryCount: 0,
    queuedAt: Date.now(),
    synced: false,
    ...action
  };

  queue.push(finalAction);

  saveQueue(queue);

  console.log("📦 Offline queue:", finalAction.type);

  return finalAction.id;

}

/* =========================
   OFFLINE SALE
========================= */

export function saveOfflineSale({
  cart,
  sellerId,
  payment,
  totalAmount,
  totalProfit = 0,
  saleDate = Date.now()
}) {

  return addToQueue({
    type: "SALE",
    data: {
      cart,
      sellerId,
      payment,
      totalAmount,
      totalProfit,
      saleDate,
      createdAt: Date.now()
    }
  });

}

/* =========================
   SYNC
========================= */

export async function syncQueue(processSaleOnline) {

  if (isOffline()) {
    console.warn("📴 Sync annulé offline");
    return;
  }

  if (isSyncing) {
    console.warn("⚠️ Sync déjà en cours");
    return;
  }

  isSyncing = true;

  try {

    const queue = getQueue();

    if (!queue.length) {

      console.log("✅ Queue vide");

      return;

    }

    console.log(`🔄 Sync ${queue.length} action(s)`);

    const remaining = [];

    for (const action of queue) {

      try {

        switch (action.type) {

          case "SALE": {

            const data = action.data || {};

            const totalAmount =
              data.totalAmount ??
              data.cart.reduce(
                (a, b) => a + (b.qty * b.price),
                0
              );

            const totalProfit =
              data.totalProfit ??
              data.cart.reduce(
                (a, b) =>
                  a + (
                    (b.price - b.price_buy) * b.qty
                  ),
                0
              );

            const payment = data.payment ?? {
              payment_status: "paid",
              amount_paid: totalAmount,
              amount_remaining: 0,
              hasDebt: false
            };

            await processSaleOnline({
              ...data,
              offlineActionId: action.id,
              deviceId: action.deviceId,
              totalAmount,
              totalProfit,
              payment,
              saleDate: data.saleDate || Date.now()
            });

            console.log("✅ Vente synchronisée");

            break;

          }

          default:

            console.warn(
              "⚠️ Action inconnue:",
              action.type
            );

        }

      } catch (err) {

        console.error("❌ Sync erreur:", err);

        remaining.push({
          ...action,
          retryCount: (action.retryCount || 0) + 1,
          lastRetryAt: Date.now(),
          lastError: err?.message || "Erreur inconnue"
        });

      }

    }

    saveQueue(remaining);

  } finally {

    isSyncing = false;

  }

}

/* =========================
   SERVICE WORKER
========================= */

export async function registerServiceWorker() {

  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {

    await navigator.serviceWorker.register(
      "/service-worker.js"
    );

    console.log("✅ Service Worker actif");

  } catch (err) {

    console.error("❌ SW erreur:", err);

  }

}

/* =========================
   INSTALL BUTTON
========================= */

export function setupInstallButton(
  buttonId = "installBtn"
) {

  const btn = document.getElementById(buttonId);

  if (!btn) return;

  window.addEventListener(
    "beforeinstallprompt",
    (e) => {

      e.preventDefault();

      deferredPrompt = e;

      btn.hidden = false;

    }
  );

  btn.addEventListener(
    "click",
    async () => {

      if (!deferredPrompt) return;

      deferredPrompt.prompt();

      const choice =
        await deferredPrompt.userChoice;

      if (choice?.outcome === "accepted") {

        btn.hidden = true;

      }

      deferredPrompt = null;

    }
  );

  window.addEventListener(
    "appinstalled",
    () => {

      btn.hidden = true;

    }
  );

}
