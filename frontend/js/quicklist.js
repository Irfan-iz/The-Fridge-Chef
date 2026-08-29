// =============================================
// QUICK LIST (SHOPPING) MANAGEMENT
// =============================================

let globalShoppingItems = [];

async function loadQuickList() {
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  if (!user.username) return;
  try {
    const res = await authFetch(`/api/shopping/${user.username}`);
    const data = await res.json();
    globalShoppingItems = data.items || [];
    renderQuickList(globalShoppingItems);
  } catch (e) {
    console.error('Failed to load quick list', e);
  }
}

function parseItemNameAndDesc(str) {
  // If ends with (xxx), extract it as desc
  const match = str.match(/(.*?)\s*\(([^)]+)\)$/);
  if (match) {
    return { name: match[1].trim(), desc: match[2].trim() };
  }
  return { name: str, desc: '' };
}

function renderQuickList(items) {
  const content = document.getElementById('quicklistContent');
  let headerHtml = `
    <div style="margin-bottom: 20px;">
      <h2 style="font-family: 'Playfair Display', serif; font-size: 1.5rem; color: var(--text-primary); margin: 0 0 8px 0; font-weight: 800;">Procurement Quick List</h2>
      <p style="font-size: 0.85rem; color: var(--success); margin: 0; display: flex; align-items: flex-start; gap: 8px;">
        <i class="fa-solid fa-circle-info" style="margin-top: 3px;"></i>
        <span>Prices are sourced from <strong>DOSM (Department of Statistics Malaysia)</strong>. The estimated retail prices are based on their respective standard packaging or weight (e.g. per 1kg, per 10pcs, etc).</span>
      </p>
    </div>
  `;

  if (items.length === 0) {
    content.innerHTML = headerHtml + `<div class="empty-state" style="margin-top: 32px;"><div class="empty-icon" style="margin-bottom:12px;"><svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted);"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg></div><p>Your grocery list is empty.</p></div>`;
    return;
  }

  // 1. Group items by recipe_name
  const grouped = {};
  items.forEach(item => {
    const recipe = item.recipe_name || 'General Items';
    if (!grouped[recipe]) grouped[recipe] = [];
    grouped[recipe].push(item);
  });

  let html = headerHtml;
  
  for (const [recipeName, recipeItems] of Object.entries(grouped)) {
    const safeId = recipeName.replace(/[^a-zA-Z0-9]/g, '-');
    
    html += `
      <div class="cookbook-card" style="margin-bottom: 24px; border-radius: 12px; border: 1px solid var(--border); overflow: hidden; background: var(--bg-card); box-shadow: var(--shadow-sm);">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="background: rgba(235, 107, 16, 0.15); border-radius: 50%; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"></path><line x1="6" y1="17" x2="18" y2="17"></line></svg>
            </div>
            <h3 style="margin:0; font-family:'Playfair Display', serif; font-size:1.15rem; color:var(--text-primary); font-weight: 800;">${recipeName}</h3>
          </div>
          <div style="display: flex; flex-direction: column; align-items: center;">
            <span style="font-size:1.15rem; color:var(--accent); font-weight:800; line-height: 1;" id="count-${safeId}">${recipeItems.length}</span>
            <span style="font-size:0.65rem; color:var(--text-muted); font-weight:800; letter-spacing: 0.5px; margin-top: 4px;">LEFT</span>
          </div>
        </div>
        
        <div style="display: flex; flex-direction: column;" id="group-list-${safeId}">
          ${recipeItems.map(item => {
            const parsed = parseItemNameAndDesc(item.item_name);
            return `
            <div class="shop-item-row" id="shop-item-${item.id}" data-recipe-id="${safeId}" data-price="${item.dosm_price || 0}" style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-top: 1px solid var(--border);">
              <div style="display: flex; align-items: center; gap: 16px; overflow: hidden; flex: 1;">
                <div class="custom-checkbox" onclick="toggleBought(${item.id})" style="cursor:pointer; width: 28px; height: 28px; border-radius: 50%; border: 2px solid #cbd5e1; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s; background: transparent;">
                  <svg class="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0; transition: opacity 0.2s;"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <div style="display: flex; flex-direction: column; overflow: hidden; transition: opacity 0.2s;" class="item-text-wrap">
                  <span style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2;" class="item-name-text">${parsed.name}</span>
                  ${parsed.desc ? `<span style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;" class="item-desc-text">${parsed.desc}</span>` : ''}
                </div>
              </div>
              
              <div style="display: flex; align-items: center; gap: 16px; flex-shrink: 0; margin-left: 12px;">
                ${item.dosm_price > 0 ? `<span style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);" class="item-price-text"><span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin-right: 2px;">RM</span>${item.dosm_price.toFixed(2)} <span style="font-size: 0.7rem; color: var(--text-muted); font-weight: 500;">/${(item.dosm_price_label || \'per unit\').replace(\'per \', \'\')}</span></span>` : \'\'}
                <button class="btn btn-ghost btn-sm" onclick="deleteShoppingItem(${item.id})" style="color:var(--text-muted); font-size:1.1rem; padding: 0; width: 24px; height: 24px; display:flex; justify-content:center; align-items:center;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
              </div>
            </div>
            `;
          }).join('')}
        </div>
        
        <div style="padding: 16px 20px; border-top: 1px solid var(--border);">
          <div style="display:flex; gap:12px;">
            <input type="text" id="add-input-${safeId}" class="form-input" placeholder="Add extra item (e.g. Lime)" style="flex:1; border-radius: 8px; border-color: rgba(0,0,0,0.15);" onkeypress="if(event.key === 'Enter') addSingleItem('${recipeName.replace(/'/g,"\\'")}', '${safeId}')" />
            <button class="btn btn-secondary" onclick="addSingleItem('${recipeName.replace(/'/g,"\\'")}', '${safeId}')" style="border-radius: 8px; font-weight: 700; padding: 0 16px; font-size: 0.9rem; border-color: rgba(0,0,0,0.15); background: var(--bg-secondary); color: var(--text-primary);"><i class="fa-solid fa-plus" style="margin-right: 6px;"></i> Add</button>
          </div>
        </div>
      </div>
    `;
  }

  // Footer for calculation and export
  html += `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 24px; margin-bottom: 32px; padding: 0 4px;">
      <div style="display: flex; flex-direction: column;">
        <span style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); letter-spacing: 0.5px;">EST. REMAINING</span>
        <span style="font-size: 1.7rem; font-weight: 900; color: var(--text-primary); line-height: 1; margin-top: 6px;"><span style="font-size: 1.1rem; font-weight: 700; color: var(--text-muted); margin-right: 4px;">RM</span><span id="estRemainingTotal">0.00</span></span>
      </div>
      <button class="btn" onclick="exportToWhatsApp()" style="background: #25D366; color: white; font-weight: 700; border-radius: 8px; padding: 12px 20px; font-size: 0.95rem; border: none; box-shadow: 0 4px 12px rgba(37, 211, 102, 0.3); transition: transform 0.2s;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px; vertical-align: middle;"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg> WhatsApp Export
      </button>
    </div>
  `;

  content.innerHTML = html;
  recalculateTotal();
}

function toggleBought(id) {
  const row = document.getElementById(`shop-item-${id}`);
  if (!row) return;
  
  const checkbox = row.querySelector('.custom-checkbox');
  const icon = row.querySelector('.check-icon');
  const textWrap = row.querySelector('.item-text-wrap');
  const priceText = row.querySelector('.item-price-text');
  
  const isChecked = row.classList.toggle('is-bought');
  
  if (isChecked) {
    checkbox.style.background = '#2ecc71';
    checkbox.style.borderColor = '#2ecc71';
    icon.style.opacity = '1';
    
    textWrap.style.opacity = '0.4';
    textWrap.style.textDecoration = 'line-through';
    
    if (priceText) {
      priceText.style.opacity = '0.4';
      priceText.style.textDecoration = 'line-through';
    }
  } else {
    checkbox.style.background = 'transparent';
    checkbox.style.borderColor = '#cbd5e1';
    icon.style.opacity = '0';
    
    textWrap.style.opacity = '1';
    textWrap.style.textDecoration = 'none';
    
    if (priceText) {
      priceText.style.opacity = '1';
      priceText.style.textDecoration = 'none';
    }
  }
  
  // Update the LEFT count for this specific recipe group
  const recipeId = row.getAttribute('data-recipe-id');
  const groupList = document.getElementById(`group-list-${recipeId}`);
  if (groupList) {
    const totalItems = groupList.querySelectorAll('.shop-item-row').length;
    const boughtItems = groupList.querySelectorAll('.shop-item-row.is-bought').length;
    const countEl = document.getElementById(`count-${recipeId}`);
    if (countEl) countEl.textContent = (totalItems - boughtItems).toString();
  }
  
  recalculateTotal();
}

function recalculateTotal() {
  const rows = document.querySelectorAll('.shop-item-row');
  let total = 0;
  
  rows.forEach(row => {
    if (!row.classList.contains('is-bought')) {
      const price = parseFloat(row.getAttribute('data-price')) || 0;
      total += price;
    }
  });
  
  const totalEl = document.getElementById('estRemainingTotal');
  if (totalEl) {
    totalEl.textContent = total.toFixed(2);
  }
}

function exportToWhatsApp() {
  let text = "?? *My Grocery List*\n\n";
  const rows = document.querySelectorAll('.shop-item-row');
  
  let currentGroup = null;
  let remainingTotal = 0;
  
  const grouped = {};
  globalShoppingItems.forEach(item => {
    const recipe = item.recipe_name || 'General Items';
    if (!grouped[recipe]) grouped[recipe] = [];
    grouped[recipe].push(item);
  });
  
  for (const [recipeName, recipeItems] of Object.entries(grouped)) {
    text += `*${recipeName}*\n`;
    recipeItems.forEach(item => {
      const row = document.getElementById(`shop-item-${item.id}`);
      const isBought = row && row.classList.contains('is-bought');
      
      const parsed = parseItemNameAndDesc(item.item_name);
      let itemLine = isBought ? `~${parsed.name}~` : `${parsed.name}`;
      
      if (parsed.desc) {
        itemLine += isBought ? ` ~( ${parsed.desc} )~` : ` ( ${parsed.desc} )`;
      }
      
      if (item.dosm_price > 0) {
        let unit_lbl = (item.dosm_price_label || 'per unit').replace('per ', '');
        itemLine += isBought ? ` ~RM${item.dosm_price.toFixed(2)}/${unit_lbl}~` : ` RM${item.dosm_price.toFixed(2)}/${unit_lbl}`;
      }
      
      if (!isBought && item.dosm_price > 0) {
        remainingTotal += item.dosm_price;
      }
      
      text += `- ${itemLine}\n`;
    });
    text += "\n";
  }
  
  text += `*EST. REMAINING: RM ${remainingTotal.toFixed(2)}*`;
  
  const encodedText = encodeURIComponent(text);
  window.open(`https://wa.me/?text=${encodedText}`, '_blank');
}

// Add a single item manually to a specific recipe card
async function addSingleItem(recipeName, safeId) {
  const input = document.getElementById(`add-input-${safeId}`);
  if (!input || !input.value.trim()) return;
  
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  try {
    await authFetch('/api/shopping/add', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ username: user.username, recipe_name: recipeName, items: [input.value.trim()] })
    });
    loadQuickList(); // Refresh the list
  } catch(e) {
    showToast('Failed to add item', 'error');
  }
}

async function deleteShoppingItem(id) {
  try {
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    await authFetch(`/api/shopping/${id}?username=${user.username}`, { method: 'DELETE' });
    loadQuickList();
  } catch(e) {
    showToast('Failed to delete item', 'error');
  }
}
