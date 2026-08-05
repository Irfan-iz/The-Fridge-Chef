// Shared auth utilities used across pages
const API_BASE = '';

// ==========================================
// JWT TOKEN MANAGEMENT
// ==========================================
function getToken() {
  return sessionStorage.getItem('access_token');
}

function setToken(token) {
  sessionStorage.setItem('access_token', token);
}

function clearToken() {
  sessionStorage.removeItem('access_token');
}

function authHeaders(extraHeaders = {}) {
  const token = getToken();
  const headers = { ...extraHeaders };
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }
  return headers;
}

/**
 * Authenticated fetch wrapper — automatically adds JWT Authorization header.
 * Usage: const res = await authFetch('/api/some/endpoint', { method: 'POST', body: ... });
 */
async function authFetch(url, options = {}) {
  const headers = authHeaders(options.headers || {});
  const res = await fetch(url, { ...options, headers });
  
  // If token expired / invalid, redirect to login
  if (res.status === 401) {
    sessionStorage.clear();
    clearToken();
    window.location.href = '/';
    return res;
  }
  return res;
}

// ==========================================
// UI UTILITIES
// ==========================================
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
  const safeMsg = document.createElement('span');
  safeMsg.textContent = msg;
  const iconSpan = document.createElement('span');
  iconSpan.textContent = icons[type] || 'ℹ️';
  toast.appendChild(iconSpan);
  toast.appendChild(safeMsg);
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(10px)'; toast.style.transition = '0.3s'; }, 2500);
  setTimeout(() => toast.remove(), 2900);
}
