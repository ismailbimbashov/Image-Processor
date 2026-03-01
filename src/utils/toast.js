let container = null;

const ensureContainer = () => {
  if (container) return container;

  const el = document.createElement("div");
  el.id = "toast-root";
  el.className =
    "fixed inset-x-0 top-4 flex flex-col items-center space-y-2 z-50 pointer-events-none sm:items-end sm:right-4 sm:left-auto";
  document.body.appendChild(el);
  container = el;
  return el;
};

export const showToast = ({
  message,
  type = "info",
  duration = 3000,
} = {}) => {
  if (!message) return;

  const root = ensureContainer();

  const colors = {
    info: "bg-slate-900/90 border-slate-600 text-slate-100",
    success: "bg-emerald-500/90 border-emerald-300 text-emerald-950",
    error: "bg-rose-600/90 border-rose-300 text-rose-50",
  };

  const tone = colors[type] || colors.info;

  const toast = document.createElement("div");
  toast.className = `pointer-events-auto max-w-xs rounded-xl border px-3 py-2.5 text-xs shadow-lg shadow-black/40 backdrop-blur ${tone} animate-fade-in-up`;
  toast.textContent = message;

  root.appendChild(toast);

  const remove = () => {
    if (!toast.isConnected) return;
    toast.classList.add("animate-fade-out-down");
    setTimeout(() => {
      if (toast.isConnected) root.removeChild(toast);
    }, 180);
  };

  if (duration > 0) {
    setTimeout(remove, duration);
  }

  toast.addEventListener("click", remove);
};

