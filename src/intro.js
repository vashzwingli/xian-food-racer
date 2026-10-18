(() => {
  const screen = document.getElementById("loading"),
    status = document.getElementById("introStatus"),
    percent = document.getElementById("introPercent"),
    progress = document.getElementById("introProgress"),
    skip = document.getElementById("introSkip"),
    retry = document.getElementById("introRetry"),
    sound = document.getElementById("introSound");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let active = true,
    ready = false,
    skipped = false,
    value = 1,
    began = performance.now(),
    endTimer,
    closeTimer,
    hooks = {},
    resolveFinished,
    gestureSeen = false;
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
  function gesture() {
    gestureSeen = true;
    hooks.gesture?.();
  }
  function watchEntrance(previous = 0) {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (!active || screen.dataset.phase !== "opening") return;
      const shot = hooks.snapshot?.();
      if (shot?.playing && shot.progress > previous)
        watchEntrance(shot.progress);
      else {
        hooks.skip?.();
        settle();
      }
    }, 16000);
  }
  function tryFinish() {
    if (!active || !ready || screen.dataset.phase === "opening") return;
    const remaining =
      (skipped ? 0 : reduced.matches ? 180 : 2850) -
      (performance.now() - began);
    clearTimeout(endTimer);
    if (remaining > 0) {
      endTimer = setTimeout(tryFinish, remaining);
      return;
    }
    phase(100, "灯亮了，这就进城");
    screen.dataset.phase = "opening";
    document.body.dataset.intro = "opening";
    screen.classList.add("is-opening");
    skip.innerHTML = "跳过镜头 <kbd>空格</kbd>";
    if (skipped || reduced.matches) {
      closeTimer = setTimeout(
        () => {
          hooks.skip?.();
          settle();
        },
        reduced.matches ? 100 : 220,
      );
    } else {
      hooks.enter?.();
      // Allow a slow GPU to keep making visible progress; recover from a stall.
      watchEntrance();
    }
  }
  function markReady() {
    ready = true;
    retry.hidden = true;
    screen.dataset.phase = "ready";
    phase(100, "钟楼灯亮了，准备入城");
    hooks.ready?.();
    tryFinish();
  }
  function requestSkip() {
    if (!active || screen.dataset.phase === "failed") return;
    skipped = true;
    if (screen.dataset.phase === "opening") {
      hooks.skip?.();
      settle();
      return;
    }
    if (!ready) status.textContent = "收到，街巷准备好就进城…";
    tryFinish();
  }
  function fail() {
    if (!active || ready) return;
    screen.dataset.phase = "failed";
    status.textContent = "场景未能加载，请检查网络后重试";
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
    screen.removeAttribute("data-cinematic");
    document.body.dataset.intro = "loading";
    document.getElementById("menu").inert = true;
    skip.innerHTML = "跳过入场 <kbd>空格</kbd>";
    skip.disabled = false;
    skip.focus({ preventScroll: true });
    phase(100, "灯火未央，再看一眼长安");
    for (const animation of screen.getAnimations({ subtree: true }))
      if (animation instanceof CSSAnimation) {
        animation.currentTime = 0;
        animation.play();
      }
    tryFinish();
    return finished;
  }
  skip.onclick = requestSkip;
  sound.onclick = () => {
    gestureSeen = true;
    hooks.sound?.();
  };
  retry.onclick = () => location.reload();
  addEventListener(
    "pointerdown",
    (event) => {
      if (active && !event.target.closest?.("#introSound")) gesture();
    },
    { capture: true, passive: true },
  );
  addEventListener(
    "keydown",
    (e) => {
      if (!active || e.code === "Tab" || e.target === retry) return;
      if (e.code === "KeyM") {
        hooks.mute?.();
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (e.target === sound) return;
      gesture();
      if (["Escape", "Space", "Enter"].includes(e.code)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        requestSkip();
      } else e.stopImmediatePropagation();
    },
    true,
  );
  addEventListener("error", fail, true);
  addEventListener("unhandledrejection", fail);
  reduced.addEventListener("change", () => {
    if (reduced.matches && screen.dataset.phase === "opening") {
      hooks.skip?.();
      settle();
    } else tryFinish();
  });
  window.changanIntro = {
    phase,
    ready: markReady,
    fail,
    replay,
    complete: settle,
    attach(backend) {
      hooks = backend;
    },
    get active() {
      return active;
    },
    get finished() {
      return finished;
    },
    get hasGesture() {
      return gestureSeen;
    },
    get reduced() {
      return reduced.matches;
    },
    get cinematic() {
      return hooks.snapshot?.() ?? null;
    },
  };
})();
