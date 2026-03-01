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
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
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

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-mode") || "convert";
      setActiveTab(mode);
    });
  });

  // Initialize view state
  setActiveTab(currentMode);

  return {
    getMode: () => currentMode,
  };
}

