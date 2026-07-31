// =============================================
// QUICK LIST (SHOPPING) MANAGEMENT
// =============================================

async function loadQuickList() {
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  if (!user.username) return;
  try {
    const res = await fetch(`/api/shopping/${user.username}`);
    const data = await res.json();
    renderQuickList(data.items || []);
  } catch (e) {
    console.error('Failed to load quick list', e);
  }
}

function renderQuickList(items) {
  const content = document.getElementById('quicklistContent');
  if (items.length === 0) {
    content.innerHTML = `<div class="empty-state"><div class="empty-icon">🛒</div><p>Your grocery list is empty.</p></div>`;
    return;
  }

  // 1. Group items by recipe_name
  const grouped = {};
  items.forEach(item => {
    const recipe = item.recipe_name || 'General Items';
    if (!grouped[recipe]) grouped[recipe] = [];
    grouped[recipe].push(item);
  });

  // 2. Generate HTML
  let html = `<p style="font-size:0.85rem; color:var(--success); margin-bottom:16px;">✅ Check off items as you buy them — they will be removed automatically.</p>`;
  
  for (const [recipeName, recipeItems] of Object.entries(grouped)) {
    const safeId = recipeName.replace(/[^a-zA-Z0-9]/g, '-');
    
    html += `
      <div class="cookbook-card" style="margin-bottom: 16px;">
        <div class="cookbook-header" style="cursor: default;">
          <h3 style="margin:0; font-family:'Playfair Display', serif; font-size:1.1rem; color:var(--text-primary);">🍽️ ${recipeName}</h3>
          <span style="font-size:0.8rem; color:var(--accent); font-weight:700;">${recipeItems.length} items</span>
        </div>
        
        <div style="padding: 0 16px 16px 16px;">
          <div style="display:flex; flex-direction:column; gap:8px; margin-bottom: 12px;">
            ${recipeItems.map(item => `
              <label class="checklist-item" id="shop-item-${item.id}" style="background:var(--bg-main); padding:10px 14px; border-radius:var(--radius-sm); border:1px solid var(--border); margin:0;">
                <div style="display:flex; align-items:center;">
                  <input type="checkbox" onchange="markAsBought(${item.id})" />
                  <span style="font-weight:500;">${item.item_name}</span>
                </div>
                
                <div style="display:flex; align-items:center; gap:12px;">
                  ${item.dosm_price > 0 ? `<span style="font-size:0.85rem; color:var(--text-muted); font-weight:600;">RM ${item.dosm_price.toFixed(2)} <span style="font-size:0.72rem; color:var(--text-muted); font-weight:400;">/unit</span></span>` : ''}
                  <button class="btn btn-ghost btn-sm" onclick="event.preventDefault(); deleteShoppingItem(${item.id})" style="color:var(--text-muted); font-size:1.2rem; padding:0;">✕</button>
                </div>
              </label>
            `).join('')}
          </div>
          
          <div style="display:flex; gap:8px;">
            <input type="text" id="add-input-${safeId}" class="form-input" placeholder="Add extra item (e.g. Salt)..." style="flex:1;" onkeypress="if(event.key === 'Enter') addSingleItem('${recipeName.replace(/'/g,"\\'")}', '${safeId}')" />
            <button class="btn btn-secondary" onclick="addSingleItem('${recipeName.replace(/'/g,"\\'")}', '${safeId}')">➕ Add</button>
          </div>
        </div>
      </div>
    `;
  }

  content.innerHTML = html;
}

// Add a single item manually to a specific recipe card
async function addSingleItem(recipeName, safeId) {
  const input = document.getElementById(`add-input-${safeId}`);
  if (!input || !input.value.trim()) return;
  
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  try {
    await fetch('/api/shopping/add', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ username: user.username, recipe_name: recipeName, items: [input.value.trim()] })
    });
    loadQuickList(); // Refresh the list
  } catch(e) {
    showToast('Failed to add item', 'error');
  }
}

function markAsBought(id) {
  const el = document.getElementById(`shop-item-${id}`);
  if (el) {
    el.classList.add('checked');
    setTimeout(() => { deleteShoppingItem(id); }, 600);
  }
}

async function deleteShoppingItem(id) {
  try {
    await fetch(`/api/shopping/delete/${id}`, { method: 'DELETE' });
    loadQuickList();
  } catch(e) { showToast('Failed to delete item', 'error'); }
}