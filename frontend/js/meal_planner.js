// =============================================
// MEAL ENGINE — Groq-powered Recipe Generation
// =============================================
let recipeIdeas = [];
let currentCardIndex = 0;

function getHealthInstruction() {
  const user = JSON.parse(sessionStorage.getItem('user')||'{}');
  const allergies = user.allergies || '';
  const healthEnabled = document.getElementById('healthModeToggle') ? document.getElementById('healthModeToggle').checked : true;

  let inst = '';

  if (healthEnabled) {
    const bmi  = user.bmi || 22.0;
    const goal = user.health_goal || 'Maintain Current Weight';
    inst = 'The user has a BMI of ' + bmi + ' and their goal is: [' + goal + '].';
    if (goal.includes('Deficit') || goal.includes('Loss'))
      inst += ' CRITICAL: Prioritize low-calorie, high-protein recipes for safe weight loss.';
    else if (goal.includes('Surplus') || goal.includes('Gain'))
      inst += ' CRITICAL: Prioritize nutrient-dense, higher-calorie, high-protein recipes for muscle gain.';
    else
      inst += ' CRITICAL: Prioritize balanced macronutrients for healthy weight maintenance.';
  } else {
    inst = 'Health optimization is OFF. The user just wants something delicious today. Focus on great taste and variety — do NOT restrict based on calories or health goals.';
  }

  // Allergy injection — always applied regardless of health mode
  if (allergies && allergies.toLowerCase() !== 'none' && allergies !== '') {
    inst += ' CRITICAL MEDICAL DIRECTIVE: The user has the following strict dietary restrictions/allergies: [' + allergies + ']. You MUST strictly adhere to this and NEVER include these ingredients.';
  }

  return inst;
}

function getCuisineInstruction() {
  const cuisine = document.getElementById('cuisineSelect').value;
  const state = document.getElementById('stateSelect')?.value || 'Any State';
  
  if (cuisine === 'Local (Malaysian)' && state !== 'Any State')
    return `Strictly prioritize traditional ${state}, Malaysia local cuisine.`;
  if (cuisine === 'Local (Malaysian)')
    return 'Prioritize general Malaysian local cuisine.';
  if (cuisine === 'Asian')
    return 'Prioritize general Asian culinary styles.';
  if (cuisine === 'Western')
    return 'Strictly prioritize authentic Western cuisine (e.g., continental, Italian, pasta, steaks, bakes, salads). Do NOT generate traditional Malaysian noodle/rice dishes.';
  if (cuisine === 'Middle Eastern')
    return 'Strictly prioritize authentic Middle Eastern styles (e.g., kebabs, spiced stews, flatbread dynamics).';
  
  return 'No specific regional cuisine preference. Be creative.';
}

async function generateRecipeIdeas() {
  if (fridgeItems.length === 0) return showToast('Your fridge is empty! Add ingredients first.', 'error');
  
  const minBudget = parseFloat(document.getElementById('minBudget').value);
  const maxBudget = parseFloat(document.getElementById('maxBudget').value);
  const calEnabled = document.getElementById('calToggle').checked;
  const minCal = calEnabled ? parseInt(document.getElementById('minCal').value) : null;
  const maxCal = calEnabled ? parseInt(document.getElementById('maxCal').value) : null;
  const halal = document.getElementById('halalToggle').checked;
  const mealType = document.getElementById('mealTypeSelect').value;
  
  // 🌟 NEW: Grab the slider value 🌟
  const prepEnabled  = document.getElementById('prepTimeToggle') ? document.getElementById('prepTimeToggle').checked : true;
  const maxPrepTime  = prepEnabled ? parseInt(document.getElementById('maxPrepTime').value) : null;
  const strictFridge = document.getElementById('strictFridgeToggle') ? document.getElementById('strictFridgeToggle').checked : false;

  document.getElementById('recipeArea').innerHTML = `
    <div class="recipe-deck">
      <div class="skeleton-card">
        <div class="skeleton-block sk-tags"></div>
        <div class="skeleton-block sk-title"></div>
        <div class="skeleton-block sk-text"></div>
        <div class="skeleton-block sk-text"></div>
        <div class="skeleton-block sk-text-short"></div>
        <div style="margin-top:24px;" class="sk-box-grid">
          <div class="skeleton-block sk-box"></div><div class="skeleton-block sk-box"></div>
          <div class="skeleton-block sk-box"></div><div class="skeleton-block sk-box"></div>
        </div>
        <div style="display:flex;gap:12px;margin-top:24px;">
           <div class="skeleton-block sk-box" style="height:44px;flex:1;"></div>
           <div class="skeleton-block sk-box" style="height:44px;flex:1;"></div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('generateBtn').disabled = true;
  try {
    const res = await authFetch('/api/recipe/ideas', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        ingredients: fridgeItems.map(i => i.name),
        min_budget: minBudget,
        max_budget: maxBudget,
        min_calories: minCal,
        max_calories: maxCal,
        require_halal: halal,
        meal_category: mealType,
        max_prep_time: maxPrepTime,
        strict_fridge: strictFridge,
        cuisine_instruction: getCuisineInstruction(),
        health_instruction: getHealthInstruction()
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed.');
    recipeIdeas = data.ideas || [];
    currentCardIndex = 0;
    renderRecipeCard();
  } catch(e) {
    document.getElementById('recipeArea').innerHTML=`<div class="card"><div class="alert alert-error"><span>⚠️</span>${e.message}</div></div>`;
  } finally {
    hideLoading();
    document.getElementById('generateBtn').disabled = false;
  }
}

// 🌟 UPGRADED: PREMIUM SLIDING RECIPE CARD WITH MISSING ITEMS & MACROS 🌟
function renderRecipeCard() {
  const area = document.getElementById('recipeArea');
  if (!recipeIdeas.length || currentCardIndex >= recipeIdeas.length) {
    area.innerHTML=`<div class="card" style="text-align:center;padding:40px 20px;">
      <div style="font-size:3rem;margin-bottom:12px;">🎉</div>
      <p style="font-weight:700;font-size:1rem;color:var(--text-primary);margin-bottom:6px;">Deck exhausted!</p>
      <p style="color:var(--text-muted);font-size:.88rem;margin-bottom:18px;">No suitable parameters accepted.</p>
      <button class="btn btn-primary btn-sm" onclick="generateRecipeIdeas()">🔄 Query New Parameters</button>
    </div>`;
    return;
  }
  const recipe = recipeIdeas[currentCardIndex];
  const tags = (recipe.tags||'').split(',').map(t=>t.trim()).filter(Boolean);
  const isFirst = currentCardIndex === 0;
  const isLast = currentCardIndex >= recipeIdeas.length - 1;

  // Logic to build the Missing Items Warning
  const missingArr = recipe.missing_items || [];
  let missingHtml = '';
  if (missingArr.length > 0) {
    missingHtml = `<div class="missing-alert">
                     <span>⚠️</span>
                     <span><strong>Missing ingredients:</strong> ${missingArr.join(', ')}</span>
                   </div>`;
  } else {
    missingHtml = `<div class="missing-alert success">
                     <span>✅</span>
                     <span>You have all the ingredients!</span>
                   </div>`;
  }

  area.innerHTML = `
    <div class="recipe-deck">
      <div class="premium-recipe-card">
        
        <div class="recipe-image-header" style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--bg-secondary); color: var(--text-muted); min-height: 220px; border-bottom: 1px solid var(--border);">
          <div style="font-size: 3.5rem; margin-bottom: 8px;">🧑‍🍳</div>
          <p style="font-size: 0.95rem; font-weight: 600;">There is no image for now</p>
          <button class="card-save-btn" onclick="saveIdeaToCookbook()">❤️</button>
        </div>

        <div class="premium-card-body">
          <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 12px;">
            Option ${currentCardIndex + 1} of ${recipeIdeas.length}
          </div>

          <div class="recipe-tags" style="margin-bottom: 12px;">
            ${tags.map(t=>`<span class="tag">${t}</span>`).join('')}
          </div>
          
          <h2 style="margin-top: 0; margin-bottom: 6px; font-family: 'Playfair Display', serif; font-size: 1.6rem; color: var(--text-primary);">${recipe.name}</h2>
          <p class="premium-card-desc">${recipe.description}</p>

          ${missingHtml}

          <div class="mini-macro-grid">
            <div class="mini-macro-box"><strong>${recipe.calories || 0}</strong><span>kcal</span></div>
            <div class="mini-macro-box"><strong>${recipe.protein_g || 0}g</strong><span>Pro</span></div>
            <div class="mini-macro-box"><strong>${recipe.carbs_g || 0}g</strong><span>Carb</span></div>
            <div class="mini-macro-box"><strong>${recipe.fat_g || 0}g</strong><span>Fat</span></div>
          </div>

          <div class="recipe-meta-row">
            <span>⏱️ ${recipe.prep_time || '25'} min</span>
            <span class="cost-highlight" title="Rough AI Estimate">Est. RM ${parseFloat(recipe.est_cost_rm||0).toFixed(2)}</span>
          </div>

          <div style="display:grid;grid-template-columns:1fr 2fr 1fr;gap:8px;">
            <button class="btn btn-secondary" onclick="prevCard()" ${isFirst?'disabled':''}>⬅️ Prev</button>
            <button class="btn btn-success" onclick="acceptRecipe('${recipe.name.replace(/'/g,"\\'")}')">✅ Accept</button>
            <button class="btn btn-secondary" onclick="nextCard()" ${isLast?'disabled':''}>Next ➡️</button>
          </div>
        </div>

      </div>
    </div>`;
}

function prevCard() { if (currentCardIndex > 0) { currentCardIndex--; renderRecipeCard(); } }
function nextCard() { if (currentCardIndex < recipeIdeas.length - 1) { currentCardIndex++; renderRecipeCard(); } }

function saveIdeaToCookbook() {
    showToast('Requires full recipe generation first! Click Accept.', 'error');
}

async function acceptRecipe(recipeName) {
  const minBudget = parseFloat(document.getElementById('minBudget').value);
  const maxBudget = parseFloat(document.getElementById('maxBudget').value);
  const calEnabled = document.getElementById('calToggle').checked;
  const minCal = calEnabled ? parseInt(document.getElementById('minCal').value) : null;
  const maxCal = calEnabled ? parseInt(document.getElementById('maxCal').value) : null;
  const halal = document.getElementById('halalToggle').checked;
  const mealType = document.getElementById('mealTypeSelect').value;
  
  const prepEnabled2  = document.getElementById('prepTimeToggle') ? document.getElementById('prepTimeToggle').checked : true;
  const maxPrepTime   = prepEnabled2 ? parseInt(document.getElementById('maxPrepTime').value) : null;
  const strictFridge2 = document.getElementById('strictFridgeToggle') ? document.getElementById('strictFridgeToggle').checked : false;

  document.getElementById('recipeArea').innerHTML = `
    <div>
      <div class="skeleton-block" style="height: 180px; border-radius: var(--radius-lg); margin-bottom: 20px;"></div>
      <div class="sk-box-grid" style="margin-bottom:24px;">
        <div class="skeleton-block sk-box"></div><div class="skeleton-block sk-box"></div>
        <div class="skeleton-block sk-box"></div><div class="skeleton-block sk-box"></div>
      </div>
      <div class="skeleton-card" style="margin-bottom:20px;">
        <div class="skeleton-block sk-title" style="margin-bottom:12px;"></div>
        <div class="skeleton-block sk-text"></div>
        <div class="skeleton-block sk-text" style="margin-top:8px;"></div>
        <div class="skeleton-block sk-text" style="margin-top:8px;"></div>
      </div>
    </div>
  `;
  try {
    const res = await authFetch('/api/recipe/full', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        recipe_name: recipeName,
        ingredients: fridgeItems.map(i=>i.name),
        min_budget: minBudget,
        max_budget: maxBudget,
        min_calories: minCal,
        max_calories: maxCal,
        require_halal: halal,
        meal_category: mealType,
        max_prep_time: maxPrepTime,
        strict_fridge: strictFridge2,
        cuisine_instruction: getCuisineInstruction(),
        health_instruction: getHealthInstruction()
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail||'Failed.');
    let trueCost = 0;
    if (data.ingredients && data.ingredients.length > 0) {
        data.ingredients.forEach(ing => {
            trueCost += parseFloat(ing.cost || 0);
        });
        data.cost_rm = trueCost; // Overwrite the AI's bad math
    }
    window._currentFullRecipe = data;
    renderFullRecipe(data);
    // Log meal
    const user = JSON.parse(sessionStorage.getItem('user')||'{}');
    if (user.user_id) {
      const nut = data.nutrition || {};
      await authFetch('/api/meal/log', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          user_id: user.user_id,
          recipe_name: data.recipe_name,
          calories: data.calories || 0,
          protein: nut.protein_g || 0,
          carbs: nut.carbs_g || 0,
          fat: nut.fat_g || 0,
          cost_rm: data.cost_rm || 0
        })
      });
    }
  } catch(e) { showToast(e.message, 'error'); }
  finally { hideLoading(); }
}

function renderFullRecipe(data) {
  const area = document.getElementById('recipeArea');
  const nut = data.nutrition || {};
  const ingredients = data.ingredients || [];
  const instructions = data.instructions || [];
  const missing = data.missing_pantry_items || [];
  const user = JSON.parse(sessionStorage.getItem('user')||'{}');
  const phone = user.phone_number || '';
  const cleanPhone = phone.replace(/\D/g,'');
  const shoppingText = [`🍳 *${data.recipe_name}* Shopping List`,`Budget: RM ${parseFloat(data.cost_rm||0).toFixed(2)}`,'',
    ...ingredients.map(i=>`• ${i.item} — RM ${parseFloat(i.cost||0).toFixed(2)}`),
    '', missing.length?`💡 *Buy next time:*\n${missing.map(m=>`• ${m}`).join('\n')}`:''].join('\n');
  const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(shoppingText)}`;

  area.innerHTML=`<div>
<div class="premium-hero-banner">
      <div class="premium-hero-content">
        <div style="font-size: 0.85rem; color: var(--accent-2); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">
          ${data.cultural_tag||'Malaysian'}
        </div>
        <h2 style="font-family: 'Playfair Display', serif; font-size: 2.2rem; font-weight: 900; line-height: 1.1; margin-bottom: 12px;">${data.recipe_name}</h2>
        <div style="display:flex; gap:16px; font-size:1rem; font-weight: 600; flex-wrap: wrap;">
          <span title="Exact mathematical sum of ingredient portions">Exact RM ${parseFloat(data.cost_rm||0).toFixed(2)}</span>
          <span>${data.calories||0} kcal</span>
          <span>${data.prep_time||'30'} mins</span>
        </div>
      </div>
    </div>

    <div class="macro-grid" style="margin-bottom:24px;">
      <div class="macro-item"><div class="macro-val">${data.calories||0}</div><div class="macro-label">Calories</div></div>
      <div class="macro-item"><div class="macro-val">${nut.protein_g||0}g</div><div class="macro-label">Protein</div></div>
      <div class="macro-item"><div class="macro-val">${nut.carbs_g||0}g</div><div class="macro-label">Carbs</div></div>
      <div class="macro-item"><div class="macro-val">${nut.fat_g||0}g</div><div class="macro-label">Fat</div></div>
    </div>

    <div class="card" style="margin-bottom:20px; background:var(--bg-secondary);">
      <div class="card-header" style="margin-bottom:8px;">
        <div class="card-title">Itemized Procurement List</div>
        <div style="display:flex; flex-direction:column; text-align:right;">
          <span style="font-size:1rem;color:var(--text-primary);font-weight:700;">RM ${parseFloat(data.cost_rm||0).toFixed(2)}</span>
          <span style="font-size:0.65rem;color:var(--text-muted);margin-top:2px;">Exact portion sum</span>
        </div>
      </div>
      <div class="ingredients-list">
        ${ingredients.map(i=>`
          <label class="checklist-item">
            <div style="display:flex; align-items:center;">
              <input type="checkbox" onchange="this.parentElement.parentElement.classList.toggle('checked')" />
              <span>${i.item}</span>
            </div>
            <span class="ing-cost">RM ${parseFloat(i.cost||0).toFixed(2)}</span>
          </label>
        `).join('')}
      </div>
    </div>

    ${missing.length?`<div class="card" style="margin-bottom:20px; background:var(--bg-secondary);">
      <div class="card-header"><div class="card-title">Suggested Inventory Additions</div></div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
        ${missing.map(m=>`<span class="tag" style="background:var(--bg-card); color:var(--text-primary); border:1px solid var(--border);">+ ${m}</span>`).join('')}
      </div>
    </div>`:''}

    <div class="card" style="margin-bottom:24px; background:var(--bg-secondary);">
      <div class="card-header"><div class="card-title">Execution Protocols</div></div>
      <ul class="timeline-list">
        ${instructions.map((s)=>`<li class="timeline-item">${s}</li>`).join('')}
      </ul>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
      <button class="btn btn-secondary" onclick="saveCurrentRecipe()">Save to Cookbook</button>
      ${missing.length?`<button class="btn btn-ghost" onclick="addCurrentToQuickList()">Add to Quick List</button>`:'<div></div>'}
    </div>
    
    <a href="${waLink}" target="_blank" class="whatsapp-btn" style="display:flex; width:100%; justify-content:center; padding:14px; font-size:1.05rem; margin-bottom:12px;">
      Send Shopping List to WhatsApp
    </a>
    
    <button class="btn btn-danger" style="width:100%; background:var(--danger); color:white; border:none; margin-bottom: 20px;" onclick="generateRecipeIdeas()">Terminate Session & Reset</button>
  </div>`;
}

function saveCurrentRecipe() {
  saveRecipe(window._currentFullRecipe);
}

function addCurrentToQuickList() {
  const data = window._currentFullRecipe;
  addToQuickList(data.recipe_name, data.missing_pantry_items || []);
}

async function saveRecipe(data) {
  const user = JSON.parse(sessionStorage.getItem('user')||'{}');
  try {
    const res = await authFetch('/api/recipe/save', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        username: user.username,
        recipe_name: data.recipe_name,
        ingredients_json: JSON.stringify(data.ingredients||[]),
        instructions_json: JSON.stringify(data.instructions||[])
      })
    });
    if (res.ok) showToast('Recipe saved to Cookbook!', 'success');
  } catch(e) { showToast('Failed to save recipe.', 'error'); }
}

async function addToQuickList(recipeName, items) {
  const user = JSON.parse(sessionStorage.getItem('user')||'{}');
  try {
    const res = await authFetch('/api/shopping/add', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ username: user.username, recipe_name: recipeName, items: items })
    });
    if (res.ok) showToast('Items added to Quick List!', 'success');
  } catch(e) { showToast('Failed to add items.', 'error'); }
}