 // NAV
  document.querySelectorAll('nav .nav-item').forEach(item => {
    if (item.dataset.page === location.pathname.split('/').pop()) {
      item.classList.add('active');
    }
    item.addEventListener('click', () => location.href = item.dataset.page);
  });

  // DATE TOGGLE
  const manualDateCheckbox = document.getElementById('manualDate');
  const saleDateInput = document.getElementById('saleDate');

  manualDateCheckbox.addEventListener('change', () => {
    saleDateInput.disabled = !manualDateCheckbox.checked;
  });