const cartDom = document.querySelector('.cart');
const toggleCartBtn = document.getElementById('toggleCart');

// cacher si clic ailleurs
document.addEventListener('click', (e) => {
  if (!cartDom.contains(e.target) && e.target !== toggleCartBtn) {
    cartDom.classList.add('hidden');
  }
});

// ouvrir si clic sur panier ou bouton
cartDom.addEventListener('click', () => {
  cartDom.classList.remove('hidden');
});

toggleCartBtn.addEventListener('click', () => {
  cartDom.classList.toggle('hidden');
});