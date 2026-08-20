// =============================================
// ADMIN DASHBOARD — Full Version
// =============================================

let allUsers = [];
let pendingDeleteId = null;
let pendingResetId  = null;

function escapeHtml(str) {
  if (typeof str !== 'string') str = String(str);
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// =============================================
// LOAD ALL STATS
// =============================================
async function loadStats() {
  try {
    const [statsRes, usersRes] = await Promise.all([
      authFetch('/api/admin/stats'),
      authFetch('/api/admin/users')
    ]);
    const stats     = await statsRes.json();
    const usersData = await usersRes.json();

    // KPI cards
    document.getElementById('kpiUsers').textContent      = stats.total_users     ?? '—';
    document.getElementById('kpiMeals').textContent      = stats.total_meals     ?? '—';
    document.getElementById('kpiMealsToday').textContent = stats.meals_today     ?? '—';
    document.getElementById('kpiSavings').textContent    = 'RM ' + (stats.total_savings ?? '0.00');

    // Real-Time Cache Telemetry on System Status KPI
    if (stats.cache_performance) {
      const cp = stats.cache_performance;
      const kpis = document.querySelectorAll('.kpi-card');
      if (kpis.length >= 5) {
        const valEl = kpis[4].querySelector('.kpi-value');
        const trendEl = kpis[4].querySelector('.kpi-trend');
        if (valEl) {
          valEl.innerHTML = `<span style="color:#22C55E;">Online</span> <span style="font-size:0.8rem;color:var(--text-muted);">(${cp.hit_rate_pct}% Cache Hit)</span>`;
          valEl.style.fontSize = '1.05rem';
        }
        if (trendEl) {
          trendEl.innerHTML = `<i class="fa-solid fa-bolt"></i> Saved ~${(cp.estimated_latency_saved_ms/1000).toFixed(1)}s LLM latency`;
          trendEl.className = 'kpi-trend trend-up';
        }
      }
    }

    // Charts
    renderBarChart('healthChart', stats.health_distribution || [], 'health_goal',  'count');
    renderBarChart('recipeChart', stats.top_recipes         || [], 'recipe_name', 'count');
    renderHourlyChart(stats.hourly_activity || []);

    // User table
    allUsers = usersData.users || [];
    renderUserTable(allUsers);

    // Last refresh timestamp
    const el = document.getElementById('lastRefresh');
    if (el) el.textContent = new Date().toLocaleTimeString();

  } catch (e) {
    console.error('Admin load failed:', e);
    showAdminError('Failed to connect to backend. Make sure the server is running.');
  }
}

// =============================================
// BAR CHART
// =============================================
function renderBarChart(containerId, data, labelKey, valueKey) {
  const container = document.getElementById(containerId);
  if (!data || !data.length) {
    container.innerHTML = '<div class="empty-state" style="padding:20px 0;"><p>No data yet.</p></div>';
    return;
  }
  const max = Math.max(...data.map(d => d[valueKey]), 1);
  container.innerHTML = data.map(row => {
    const pct   = Math.round((row[valueKey] / max) * 100);
    const label = String(row[labelKey] || 'Unknown');
    return '<div class="chart-row">' +
      '<span class="bar-label" title="' + label + '">' + label + '</span>' +
      '<div class="bar-track"><div class="bar-fill" style="width:0%" data-target="' + pct + '"></div></div>' +
      '<span class="bar-val">' + row[valueKey] + '</span>' +
    '</div>';
  }).join('');
  requestAnimationFrame(() => {
    container.querySelectorAll('.bar-fill').forEach(bar => {
      setTimeout(() => { bar.style.width = bar.getAttribute('data-target') + '%'; }, 100);
    });
  });
}

// =============================================
// HOURLY CHART
// =============================================
function renderHourlyChart(data) {
  const container = document.getElementById('hourlyChart');
  if (!data || !data.length) {
    container.innerHTML = '<div class="empty-state" style="padding:10px 0;width:100%;"><p>No activity data yet.</p></div>';
    return;
  }
  
  const hourMap = {};
  data.forEach(d => { hourMap[parseInt(d.hour)] = d.count; });
  const max = Math.max(...Object.values(hourMap), 1);

  let html = '<div style="display:flex;align-items:flex-end;height:120px;gap:4px;padding-top:10px;width:100%;">';
  for (let h = 0; h < 24; h++) {
    const count = hourMap[h] || 0;
    const heightPct = count > 0 ? Math.max((count / max) * 100, 5) : 0;
    
    let label = '';
    if (h === 0) label = '12am';
    else if (h === 6) label = '6am';
    else if (h === 12) label = '12pm';
    else if (h === 18) label = '6pm';
    else if (h === 23) label = '11pm';
    
    const labelHtml = label ? `<div style="position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);font-size:0.65rem;color:var(--text-muted);white-space:nowrap;">${label}</div>` : '';

    html += `
      <div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;position:relative;height:100%;" title="${h}:00 - ${count} meal(s)">
        <div style="width:100%;height:${heightPct}%;background:var(--accent);border-radius:2px 2px 0 0;opacity:0.85;transition:height 0.3s ease;"></div>
        ${labelHtml}
      </div>
    `;
  }
  html += '</div>';

  container.innerHTML = html;
  container.style.paddingBottom = '24px';
}

// =============================================
// USER TABLE
// =============================================
function renderUserTable(users) {
  const badge = document.getElementById('userCountBadge');
  if (badge) badge.textContent = users.length + ' user' + (users.length !== 1 ? 's' : '');

  const tbody = document.getElementById('userTableBody');
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;color:var(--text-muted);padding:24px;">No users found.</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(u => {
    const bmi   = getBmiColor(u.bmi);
    const isAdmin = u.username === 'Admin';
    const statusPill = `<span class="status-badge status-active">Active</span>`;
    return '<tr>' +
      '<td>' + u.id + '</td>' +
      '<td><strong>' + escapeHtml(u.username) + '</strong>' + (isAdmin ? ' <span class="tag" style="font-size:.65rem;">Admin</span>' : '') + '</td>' +
      '<td>' + escapeHtml(u.phone_number || '—') + '</td>' +
      '<td>' + (u.age || '—') + '</td>' +
      '<td>' + escapeHtml(u.gender || '—') + '</td>' +
      '<td>' + (u.height || '—') + '</td>' +
      '<td>' + (u.weight || '—') + '</td>' +
      '<td><span style="display:inline-block;padding:2px 8px;border-radius:99px;font-size:.75rem;font-weight:700;background:' + bmi.bg + ';color:' + bmi.text + ';">' + (u.bmi ?? '—') + '</span></td>' +
      '<td style="font-size:.8rem;">' + escapeHtml(u.health_goal || '—') + '</td>' +
      '<td style="font-size:.78rem;color:var(--text-muted);">' + escapeHtml((u.activity_level || '').split(' ')[0] || '—') + '</td>' +
      '<td style="font-size:.78rem;color:var(--danger);">' + escapeHtml(u.allergies || 'None') + '</td>' +
      '<td>' + statusPill + '</td>' +
      '<td><div class="action-btns">' +
        '<button class="btn btn-ghost btn-sm" onclick="viewUserHistory(' + u.id + ', \'' + escapeHtml(u.username).replace(/'/g, "\\'") + '\')" title="View History"><i class="fa-solid fa-scroll"></i></button>' +
        '<button class="btn btn-ghost btn-sm" onclick="openResetModal(' + u.id + ', \'' + escapeHtml(u.username).replace(/'/g, "\\'") + '\')" title="Reset Password"><i class="fa-solid fa-key"></i></button>' +
        (!isAdmin ? '<button class="btn btn-danger btn-sm" onclick="openDeleteModal(' + u.id + ', \'' + escapeHtml(u.username).replace(/'/g, "\\'") + '\')" title="Delete User"><i class="fa-solid fa-trash"></i></button>' : '') +
      '</div></td>' +
    '</tr>';
  }).join('');
}

// =============================================
// SEARCH & FILTER
// =============================================
function filterUsers() {
  const query      = (document.getElementById('userSearchInput').value || '').toLowerCase();
  const gender     = document.getElementById('genderFilter').value;
  const goalFilter = document.getElementById('goalFilter').value;

  const filtered = allUsers.filter(u => {
    const matchSearch = !query ||
      (u.username || '').toLowerCase().includes(query) ||
      (u.phone_number || '').toLowerCase().includes(query) ||
      (u.health_goal || '').toLowerCase().includes(query) ||
      (u.allergies || '').toLowerCase().includes(query);
    const matchGender = !gender || u.gender === gender;
    const matchGoal   = !goalFilter || (u.health_goal || '').includes(goalFilter);
    return matchSearch && matchGender && matchGoal;
  });

  renderUserTable(filtered);
}

// =============================================
// USER HISTORY MODAL
// =============================================
async function viewUserHistory(userId, username) {
  document.getElementById('historyModalTitle').textContent = username + "'s Meal History";
  document.getElementById('historyModalBody').innerHTML = '<div style="text-align:center;padding:20px;"><div class="spinner"></div></div>';
  document.getElementById('historyModal').classList.add('active');
  try {
    const res  = await authFetch('/api/admin/user/' + userId + '/history');
    const data = await res.json();
    const history = data.history || [];
    if (!history.length) {
      document.getElementById('historyModalBody').innerHTML = '<div class="empty-state"><p>No meals logged yet.</p></div>';
      return;
    }
    let rows = '';
    history.forEach(function(h) {
      rows += '<tr>' +
        '<td><strong>' + h.recipe_name + '</strong></td>' +
        '<td>' + (h.calories || 0) + '</td>' +
        '<td>RM ' + parseFloat(h.cost_rm || 0).toFixed(2) + '</td>' +
        '<td style="font-size:.75rem;color:var(--text-muted);">' + new Date(h.timestamp).toLocaleDateString() + '</td>' +
      '</tr>';
    });
    document.getElementById('historyModalBody').innerHTML =
      '<table class="data-table">' +
      '<thead><tr><th>Recipe</th><th>Cal</th><th>Cost</th><th>Date</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '</table>';
  } catch (e) {
    document.getElementById('historyModalBody').innerHTML = '<div class="alert alert-error"><span><i class="fa-solid fa-triangle-exclamation"></i></span>Failed to load history.</div>';
  }
}

// =============================================
// DELETE USER
// =============================================
function openDeleteModal(userId, username) {
  pendingDeleteId = userId;
  document.getElementById('deleteUsername').textContent = username;
  document.getElementById('deleteModal').classList.add('active');
}

async function confirmDeleteUser() {
  if (!pendingDeleteId) return;
  const btn = document.getElementById('deleteConfirmBtn');
  btn.disabled = true;
  btn.textContent = 'Deleting...';
  try {
    const res = await authFetch('/api/admin/user/' + pendingDeleteId, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Delete failed.');
    closeModal('deleteModal');
    showToast('User deleted successfully.', 'success');
    loadStats();
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-trash"></i> Yes, Delete';
    pendingDeleteId = null;
  }
}

// =============================================
// RESET PASSWORD
// =============================================
function openResetModal(userId, username) {
  pendingResetId = userId;
  document.getElementById('resetUsername').textContent = username;
  document.getElementById('resetPasswordInput').value  = '';
  document.getElementById('resetAlert').innerHTML      = '';
  document.getElementById('resetModal').classList.add('active');
}

async function confirmResetPassword() {
  const newPassword = document.getElementById('resetPasswordInput').value.trim();
  if (!newPassword) {
    document.getElementById('resetAlert').innerHTML = '<div class="alert alert-error"><span><i class="fa-solid fa-triangle-exclamation"></i></span>Please enter a new password.</div>';
    return;
  }
  const btn = document.getElementById('resetConfirmBtn');
  btn.disabled = true;
  btn.textContent = 'Resetting...';
  try {
    const res = await authFetch('/api/admin/user/' + pendingResetId + '/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_password: newPassword })
    });
    if (!res.ok) throw new Error('Reset failed.');
    document.getElementById('resetAlert').innerHTML = '<div class="alert alert-success"><span><i class="fa-solid fa-check"></i></span>Password reset successfully!</div>';
    setTimeout(() => { closeModal('resetModal'); }, 1500);
  } catch (e) {
    document.getElementById('resetAlert').innerHTML = '<div class="alert alert-error"><span><i class="fa-solid fa-triangle-exclamation"></i></span>' + e.message + '</div>';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-key"></i> Reset Password';
    pendingResetId = null;
  }
}

// =============================================
// HELPERS
// =============================================
function getBmiColor(bmi) {
  if (!bmi) return { bg: 'var(--bg-secondary)', text: 'var(--text-muted)' };
  if (bmi < 18.5) return { bg: '#DBEAFE', text: '#1D4ED8' };
  if (bmi < 25)   return { bg: 'var(--success-soft)', text: 'var(--success)' };
  if (bmi < 30)   return { bg: '#FEF9C3', text: '#A16207' };
  return { bg: 'var(--danger-soft)', text: 'var(--danger)' };
}

function showAdminError(msg) {
  const content = document.querySelector('.page-content');
  if (!content) return;
  const alert = document.createElement('div');
  alert.className = 'alert alert-error';
  alert.style.marginBottom = '16px';
  alert.innerHTML = '<span><i class="fa-solid fa-triangle-exclamation"></i></span>' + msg;
  content.prepend(alert);
}

// Close modals on overlay click
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

// =============================================
// DATABASE TAB
// =============================================
let allDatabasePrices = [];

async function loadDatabasePrices() {
  const tbody = document.getElementById('databaseTableBody');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;"><div class="spinner"></div></td></tr>';
  
  try {
    const res = await authFetch('/api/dosm-prices');
    if (!res.ok) throw new Error('Failed to load prices');
    const data = await res.json();
    allDatabasePrices = data.prices || [];
    renderDatabaseTable(allDatabasePrices);
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--danger);padding:24px;"><i class="fa-solid fa-triangle-exclamation"></i> Error loading database: ${err.message}</td></tr>`;
  }
}

function renderDatabaseTable(prices) {
  const tbody = document.getElementById('databaseTableBody');
  if (!prices || prices.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px;">No items found.</td></tr>';
    return;
  }
  
  let html = '';
  prices.forEach(details => {
    const name = details.name_english || details.name_malay || 'Unknown Item';
    html += `
      <tr>
        <td><strong>${name}</strong></td>
        <td style="color:var(--text-secondary);">${details.category || 'Pantry'}</td>
        <td style="font-family:monospace;font-size:1rem;">RM ${(details.price_median || 0).toFixed(2)}</td>
        <td style="color:var(--text-muted);">${details.unit || 'per unit'}</td>
        <td><span class="status-badge status-active">Live</span></td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function filterDatabase() {
  const query = (document.getElementById('dbSearchInput').value || '').toLowerCase();
  
  if (!query) {
    renderDatabaseTable(allDatabasePrices);
    return;
  }
  
  const filtered = allDatabasePrices.filter(item => {
    const nameEn = (item.name_english || '').toLowerCase();
    const nameMy = (item.name_malay || '').toLowerCase();
    const cat = (item.category || '').toLowerCase();
    return nameEn.includes(query) || nameMy.includes(query) || cat.includes(query);
  });
  
  renderDatabaseTable(filtered);
}
