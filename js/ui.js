const cartDom = document.querySelector('.cart');
const toggleCartBtn = document.getElementById('toggleCart');

function isInsideCart(target) {
  return cartDom && cartDom.contains(target);
}

document.addEventListener("click", (e) => {

  if (!cartDom || !toggleCartBtn) {
    return;
  }

  const target = e.target;

  const clickedInsideCart =
    target.closest(".cart");

  const clickedToggleBtn =
    target.closest("#toggleCart");

  if (
    !clickedInsideCart &&
    !clickedToggleBtn
  ) {
    cartDom.classList.add("hidden");
  }

});

// toggle bouton
toggleCartBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  cartDom?.classList.toggle('hidden');
});

// IMPORTANT:
// on laisse les interactions internes normales (inputs, boutons)
// MAIS on bloque seulement le "click global", pas les interactions internes
cartDom?.addEventListener('click', (e) => {
  // rien ici → on supprime stopPropagation inutile
});
