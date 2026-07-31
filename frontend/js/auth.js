// Shared auth utilities used across pages
const API_BASE = '';

function showLoading(text = 'Processing...') {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.classList.add('show');
    const t = document.getElementById('loadingText');
    if (t) t.textContent = text;
  }
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.classList.remove('show');
}

function showToast(msg, type = 'info') {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:9999;
    background:var(--bg-card); border:1.5px solid var(--border);
    border-radius:var(--radius); padding:12px 18px;
    box-shadow:var(--shadow-lg); font-size:0.88rem;
    color:var(--text-primary); display:flex; align-items:center; gap:10px;
    animation: toastIn 0.3s ease; max-width:320px;
  `;
  const icons = { success: '✅', error: '⚠️', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(10px)'; toast.style.transition = '0.3s'; }, 2500);
  setTimeout(() => toast.remove(), 2900);
}
