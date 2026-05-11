if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js');
}

let deferredPrompt = null;

const installBtn = document.getElementById("installBtn");

// capture event install PWA
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); // bloque prompt auto
  deferredPrompt = e;

  installBtn.hidden = false;
});

// click install
installBtn.addEventListener("click", async () => {
  if (!deferredPrompt) return;

  deferredPrompt.prompt();

  const choice = await deferredPrompt.userChoice;

  if (choice.outcome === "accepted") {
    installBtn.hidden = true;
  }

  deferredPrompt = null;
});

// cacher si déjà installé
window.addEventListener("appinstalled", () => {
  installBtn.hidden = true;
});