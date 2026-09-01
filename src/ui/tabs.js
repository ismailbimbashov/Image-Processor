export function initTabs({ onModeChange } = {}) {
  const tabsRoot = document.getElementById("modeTabs");
  const resizePanel = document.getElementById("resizeControls");
  const convertPanel = document.getElementById("convertControls");

  if (!tabsRoot) {
    console.warn("[tabs] #modeTabs not found; tabs disabled.");
    return { getMode: () => "convert" };
  }

  const tabButtons = Array.from(
    tabsRoot.querySelectorAll("[data-mode]"),
  );

  if (!tabButtons.length) {
    console.warn("[tabs] No tab buttons found under #modeTabs.");
    return { getMode: () => "convert" };
  }

  let currentMode = "convert";

  const applyModeToPanels = (mode) => {
    const showResize = mode === "resize" || mode === "both";
    const showConvert = mode === "convert" || mode === "both";

    if (resizePanel) {
      resizePanel.classList.toggle("hidden", !showResize);
    }
    if (convertPanel) {
      convertPanel.classList.toggle("hidden", !showConvert);
    }
  };

  const setActiveTab = (mode) => {
    currentMode = mode;
    tabButtons.forEach((btn) => {
      const btnMode = btn.getAttribute("data-mode");
      const isActive = btnMode === mode;
      // A radio group, not a tab list: "Resize + Convert" shows two panels at
      // once, and role="tab" would promise a tabpanel relationship that does
      // not exist here.
      btn.setAttribute("aria-checked", isActive ? "true" : "false");
      // Roving tabindex: only the checked radio is in the Tab order; the rest
      // are reached with the arrow keys.
      btn.tabIndex = isActive ? 0 : -1;
      btn.classList.toggle(
        "bg-slate-900/70",
        isActive,
      );
      btn.classList.toggle(
        "shadow-sm",
        isActive,
      );
      btn.classList.toggle(
        "shadow-black/40",
        isActive,
      );
      btn.classList.toggle("text-slate-200", isActive);
      btn.classList.toggle("text-slate-200/70", !isActive);
    });

    applyModeToPanels(mode);
    onModeChange?.(mode);
  };

  const focusTabAt = (position) => {
    const count = tabButtons.length;
    const wrapped = ((position % count) + count) % count;
    const btn = tabButtons[wrapped];
    const mode = btn.getAttribute("data-mode") || "convert";
    setActiveTab(mode);
    btn.focus();
  };

  tabButtons.forEach((btn, i) => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-mode") || "convert";
      setActiveTab(mode);
    });

    // Keyboard support for the radio group: arrows move (and select) with
    // wrap-around; Home/End jump to the ends.
    btn.addEventListener("keydown", (event) => {
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          event.preventDefault();
          focusTabAt(i + 1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
          event.preventDefault();
          focusTabAt(i - 1);
          break;
        case "Home":
          event.preventDefault();
          focusTabAt(0);
          break;
        case "End":
          event.preventDefault();
          focusTabAt(tabButtons.length - 1);
          break;
        default:
          break;
      }
    });
  });

  // Initialize view state
  setActiveTab(currentMode);

  return {
    getMode: () => currentMode,
  };
}

