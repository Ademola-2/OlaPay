document.addEventListener("DOMContentLoaded", () => {
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  const toast = document.getElementById("toastMessage");
  let toastTimer;
  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
  }

  const fundButton = document.getElementById("demoFundBtn");
  if (fundButton) {
    fundButton.addEventListener("click", () => {
      showToast("This is a design preview. Wallet funding will be connected after backend setup.");
    });
  }

  document.querySelectorAll('a[href="#account"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      showToast("Account registration and payments are coming in a later development stage.");
      const target = document.getElementById("account");
      if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  const navLinks = document.querySelectorAll(".nav-links .nav-link");
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const menu = document.getElementById("mainNav");
      if (menu && menu.classList.contains("show") && window.bootstrap) {
        window.bootstrap.Collapse.getOrCreateInstance(menu).hide();
      }
    });
  });
});