(function () {
  var deferredInstallPrompt = null;
  var installPrompt = document.getElementById("installPrompt");
  var installBtn = document.getElementById("installAppBtn");
  var dismissBtn = document.getElementById("dismissInstallBtn");
  var promptText = document.getElementById("installPromptText");

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function isPhoneLike() {
    return window.matchMedia("(max-width: 900px)").matches;
  }

  function showPrompt(message) {
    if (!installPrompt || isStandalone() || !isPhoneLike()) {
      return;
    }
    if (message && promptText) {
      promptText.textContent = message;
    }
    installPrompt.hidden = false;
  }

  function hidePrompt() {
    if (installPrompt) {
      installPrompt.hidden = true;
    }
  }

  if (dismissBtn) {
    dismissBtn.addEventListener("click", function () {
      hidePrompt();
      localStorage.setItem("ethanplanner-install-dismissed", String(Date.now()));
    });
  }

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    deferredInstallPrompt = event;
    showPrompt("Install EthanPlanner for a faster app-like experience.");
  });

  if (installBtn) {
    installBtn.addEventListener("click", async function () {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        var choice = await deferredInstallPrompt.userChoice;
        if (choice && choice.outcome === "accepted") {
          hidePrompt();
        }
        deferredInstallPrompt = null;
        return;
      }

      showPrompt("On iPhone: tap Share, then Add to Home Screen.");
    });
  }

  window.addEventListener("appinstalled", function () {
    hidePrompt();
    deferredInstallPrompt = null;
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./sw.js").catch(function (error) {
        console.warn("Service worker registration failed", error);
      });
    });
  }

  var dismissedAt = Number(localStorage.getItem("ethanplanner-install-dismissed") || 0);
  var oneDayMs = 24 * 60 * 60 * 1000;
  if (!dismissedAt || Date.now() - dismissedAt > oneDayMs) {
    var isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isiOS && !isStandalone() && isPhoneLike()) {
      showPrompt("Install EthanPlanner: tap Share, then Add to Home Screen.");
    }
  }
})();
