(() => {
  const screen = document.getElementById("loading");
  const status = document.getElementById("introStatus");
  const percent = document.getElementById("introPercent");
  const progress = document.getElementById("introProgress");
  const skip = document.getElementById("introSkip");
  const retry = document.getElementById("introRetry");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let active = true,
    ready = false,
    skipped = false,
    value = 1;
  let began = performance.now(),
    endTimer,
    closeTimer,
    resolveFinished;
  let finished = new Promise((resolve) => {
    resolveFinished = resolve;
  });
  function phase(next, message) {
    value = Math.max(value, Math.min(ready ? 100 : 99, next));
    screen.style.setProperty("--intro-progress", value / 100);
    progress.setAttribute("aria-valuenow", String(value));
    percent.textContent = value + "%";
    if (message) status.textContent = message;
  }
  function settle() {
    if (!active || !ready) return;
    active = false;
    clearTimeout(closeTimer);
    clearTimeout(endTimer);
    screen.hidden = true;
    screen.setAttribute("aria-hidden", "true");
    document.body.dataset.intro = "finished";
    const menu = document.getElementById("menu");
    if (menu) menu.inert = false;
    document.getElementById("start")?.focus({ preventScroll: true });
    resolveFinished();
  }
  function tryFinish() {
    if (!active || !ready || screen.dataset.phase === "opening") return;
    const remaining =
      (skipped ? 0 : reduced.matches ? 250 : 2850) -
      (performance.now() - began);
    clearTimeout(endTimer);
    if (remaining > 0) {
      endTimer = setTimeout(tryFinish, remaining);
      return;
    }
    phase(100, "城门开了，咥一圈！");
    screen.dataset.phase = "opening";
    document.body.dataset.intro = "opening";
    screen.classList.add("is-opening");
    skip.disabled = true;
    closeTimer = setTimeout(settle, reduced.matches ? 150 : 800);
  }
  function markReady() {
    ready = true;
    retry.hidden = true;
    screen.dataset.phase = "ready";
    phase(100, skipped ? "夜色已亮，这就进城" : "长安夜色已亮，准备进城");
    tryFinish();
  }
  function requestSkip() {
    if (!active) return;
    skipped = true;
    if (!ready) status.textContent = "收到，准备好就进城…";
    tryFinish();
  }
  function fail() {
    if (!active || ready) return;
    screen.dataset.phase = "failed";
    status.textContent = "夜色没能点亮，请重试一次";
    retry.hidden = false;
  }
  function replay() {
    if (active || !ready) return finished;
    active = true;
    skipped = false;
    began = performance.now();
    finished = new Promise((resolve) => {
      resolveFinished = resolve;
    });
    screen.hidden = false;
    screen.removeAttribute("aria-hidden");
    screen.classList.remove("is-opening");
    screen.dataset.phase = "ready";
    document.body.dataset.intro = "loading";
    document.getElementById("menu").inert = true;
    skip.disabled = false;
    skip.focus({ preventScroll: true });
    phase(100, "街巷都备好了，再看一眼长安");
    // Restart only the decoration; the already-loaded city and its progress stay intact.
    for (const animation of screen.getAnimations({ subtree: true })) {
      if (animation instanceof CSSAnimation) {
        animation.currentTime = 0;
        animation.play();
      }
    }
    tryFinish();
    return finished;
  }
  skip.onclick = requestSkip;
  retry.onclick = () => location.reload();
  addEventListener(
    "keydown",
    (e) => {
      if (!active) return;
      if (e.target === retry) return;
      if (["Escape", "Space", "Enter"].includes(e.code)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        requestSkip();
      } else if (e.code !== "Tab") {
        e.stopImmediatePropagation();
      }
    },
    true,
  );
  screen.addEventListener("transitionend", (e) => {
    if (
      e.target === screen &&
      e.propertyName === "opacity" &&
      screen.classList.contains("is-opening")
    )
      settle();
  });
  addEventListener("error", fail, true);
  addEventListener("unhandledrejection", fail);
  reduced.addEventListener("change", tryFinish);
  window.changanIntro = {
    phase,
    ready: markReady,
    fail,
    replay,
    get active() {
      return active;
    },
    get finished() {
      return finished;
    },
  };
})();
