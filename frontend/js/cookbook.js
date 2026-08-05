// =============================================
// COOKBOOK MANAGEMENT
// =============================================

async function loadCookbook() {
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  if (!user.username) return;
  try {
    const res = await authFetch(`/api/recipe/saved/${user.username}`);
    const data = await res.json();
    renderCookbook(data.recipes || []);
  } catch (e) {
    console.error('Failed to load cookbook', e);
  }
}

function renderCookbook(recipes) {
  const list = document.getElementById('cookbookList');
  if (recipes.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg></div><p>No saved recipes yet. Generate some in the Meal Engine!</p></div>`;
    return;
  }

  list.innerHTML = recipes.map(r => {
    let ings = [], insts = [];
    
    try { ings = JSON.parse(r.ingredients || r.ingredients_json || '[]'); } catch(e){}
    try { insts = JSON.parse(r.instructions || r.instructions_json || '[]'); } catch(e){}

    return `
      <div class="cookbook-card">
        <div class="cookbook-header" onclick="document.getElementById('recipe-${r.id}').classList.toggle('open')">
          <div>
            <h3 style="margin:0; font-family:'Playfair Display', serif; font-size:1.2rem; color:var(--text-primary);"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px; vertical-align:text-bottom;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg> ${r.recipe_name}</h3>
            <span style="font-size:0.8rem; color:var(--text-muted);">Click to view details</span>
          </div>
          <button class="btn btn-secondary btn-sm" style="color:var(--danger); border-color:var(--danger-soft); width: auto;" onclick="event.stopPropagation(); deleteRecipe(${r.id})"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px; vertical-align:text-bottom;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg> Delete</button>
        </div>

        <div class="cookbook-body" id="recipe-${r.id}">
          
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; margin-bottom:12px; gap: 16px;">
            <h4 style="margin:0; color:var(--text-primary); display:flex; align-items:center;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"></path></svg> Ingredients</h4>
            <button class="btn btn-primary btn-sm" style="width: auto; padding: 6px 12px; flex-shrink: 0;" onclick="addRecipeToQuickList('${r.recipe_name.replace(/'/g,"\\'")}', ${JSON.stringify(ings).replace(/"/g,'&quot;')})"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px; vertical-align:text-bottom;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add All</button>
          </div>

          <div style="background:var(--bg-card); border-radius:var(--radius-sm); border:1px solid var(--border); margin-bottom:20px; overflow: hidden;">
            ${ings.length > 0 ? ings.map(i => `
              <div style="display:flex; justify-content:space-between; padding:10px 14px; border-bottom:1px solid var(--border); transition: background 0.2s;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
                <span style="font-size:0.95rem; font-weight:500;">${i.item || i}</span>
                <span style="font-size:0.9rem; color:var(--text-muted); font-weight:600;">RM ${parseFloat(i.cost||0).toFixed(2)}</span>
              </div>
            `).join('').replace(/border-bottom:1px solid var\(--border\);"(?!.*border-bottom:1px solid var\(--border\);")/s, 'border-bottom:none;"') : '<div style="padding:10px 14px; font-size:0.9rem; color:var(--text-muted);">No ingredients found.</div>'}
          </div>

          <h4 style="margin-bottom:16px; color:var(--text-primary); display:flex; align-items:center;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg> Execution Protocols</h4>
          <ul class="timeline-list">
            ${insts.length > 0 ? insts.map(step => `<li class="timeline-item">${step}</li>`).join('') : '<li class="timeline-item">No instructions found.</li>'}
          </ul>
        </div>
      </div>
    `;
  }).join('');
}

async function deleteRecipe(id) {
  if(!confirm('Delete this recipe?')) return;
  try {
    await authFetch(`/api/recipe/delete/${id}`, { method: 'DELETE' });
    showToast('Recipe deleted', 'success');
    loadCookbook();
  } catch(e) {
    showToast('Failed to delete', 'error');
  }
}

// 🌟 NEW: THE MAGICAL QUICK LIST TRANSFER FUNCTION 🌟
async function addRecipeToQuickList(recipeName, ingsRaw) {
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  if (!user.username) return;

  // Extract just the item names from the complex JSON objects
  const items = ingsRaw.map(i => typeof i === 'string' ? i : (i.item || 'Unknown Item'));
  
  if (items.length === 0) {
    return showToast('No ingredients found to add.', 'info');
  }

  try {
    const res = await authFetch('/api/shopping/add', {
      method: 'POST', 
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ 
        username: user.username, 
        recipe_name: recipeName, 
        items: items 
      })
    });
    
    if (res.ok) {
      showToast('All ingredients added to Quick List!', 'success');
    } else {
      showToast('Failed to add ingredients.', 'error');
    }
  } catch(e) {
    showToast('Network error.', 'error');
  }
}