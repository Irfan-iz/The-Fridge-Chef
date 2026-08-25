// =============================================
// MEAL ENGINE — Groq-powered Recipe Generation
// =============================================
let currentRecipe = null;
let recipeIdeas = [];
let currentCardIndex = 0;
let lastOptimizationTelemetry = null;

// =============================================
// SMART HYBRID CULINARY IMAGE ENGINE
const WIKI_CULINARY_DATABASE = [
  { keywords: ['nasi lemak'], url: 'https://upload.wikimedia.org/wikipedia/commons/5/55/Nasi_Lemak_dengan_Chili_Nasi_Lemak_dan_Sotong_Pedas%2C_di_Penang_Summer_Restaurant.jpg' },
  { keywords: ['nasi goreng', 'fried rice'], url: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Nasi_Goreng_Kampung_%2811967588375%29.jpg' },
  { keywords: ['rendang', 'daging'], url: 'https://upload.wikimedia.org/wikipedia/commons/7/70/Rendang_daging_sapi_asli_Padang.JPG' },
  { keywords: ['curry', 'kari', 'gulai', 'masak lemak'], url: 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Taj_Mahal_-_Lamb_Curry_Madras.jpg' },
  { keywords: ['laksa'], url: 'https://upload.wikimedia.org/wikipedia/commons/1/1c/Nyonya_Laksa.jpg' },
  { keywords: ['omelette', 'telur', 'egg'], url: 'https://upload.wikimedia.org/wikipedia/commons/4/4d/Gorgonzola_%2B_Bacon_Omelette_%40_Omelegg_%40_Amsterdam_%2816600947041%29.jpg' },
  { keywords: ['fried chicken', 'ayam goreng'], url: 'https://upload.wikimedia.org/wikipedia/commons/2/2c/Fried-Chicken-Set.jpg' },
  { keywords: ['satay', 'sate'], url: 'https://upload.wikimedia.org/wikipedia/commons/2/24/Sate_Udang.JPG' },
  { keywords: ['roti canai', 'roti', 'canai', 'flatbread'], url: 'https://upload.wikimedia.org/wikipedia/commons/1/19/YosriRotiCanai.jpg' },
  { keywords: ['soup', 'sup', 'broth', 'tomyum'], url: 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Asparagus_soup_%28spargelsuppe%29.jpg' },
  { keywords: ['noodle', 'mee', 'bihun', 'kuey teow'], url: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/Dalian_Liaoning_China_Noodlemaker-01.jpg' },
  { keywords: ['beef'], url: 'https://upload.wikimedia.org/wikipedia/commons/6/60/Standing-rib-roast.jpg' },
  { keywords: ['chicken', 'ayam'], url: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=700&auto=format&fit=crop&q=80' },
  { keywords: ['fish', 'ikan', 'prawn', 'sotong', 'seafood'], url: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=700&auto=format&fit=crop&q=80' },
  { keywords: ['salad', 'kerabu', 'ulam', 'cabbage', 'vegetable'], url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=700&auto=format&fit=crop&q=80' },
  { keywords: ['stir fry', 'goreng', 'tumis', 'paprik'], url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=700&auto=format&fit=crop&q=80' },
  { keywords: ['nasi', 'rice'], url: 'https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?w=700&auto=format&fit=crop&q=80' }
];

function getRecipeImageUrl(recipeName = '', culturalTag = '', description = '') {
  const query = `${recipeName} ${culturalTag} ${description}`.toLowerCase();
  
  let bestMatch = null;
  let maxKeywordLength = 0;
  
  for (const entry of WIKI_CULINARY_DATABASE) {
    for (const keyword of entry.keywords) {
      if (query.includes(keyword) && keyword.length > maxKeywordLength) {
        maxKeywordLength = keyword.length;
        bestMatch = entry.url;
      }
    }
  }
  
  if (bestMatch) return bestMatch;
  
  return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=700&auto=format&fit=crop&q=80';
}
window.getRecipeImageUrl = getRecipeImageUrl;

function escapeHtmlMP(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}

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
  
  // <i class="fa-solid fa-star"></i> NEW: Grab the slider value <i class="fa-solid fa-star"></i>
  const prepEnabled  = document.getElementById('prepTimeToggle') ? document.getElementById('prepTimeToggle').checked : true;
  const maxPrepTime  = prepEnabled ? parseInt(document.getElementById('maxPrepTime').value) : null;
  const strictFridge = document.getElementById('strictFridgeToggle') ? document.getElementById('strictFridgeToggle').checked : false;

  showLoading('Generating delicious recipe ideas with Groq AI...');
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
    lastOptimizationTelemetry = data.optimization_telemetry || null;
    currentCardIndex = 0;

    if (data.cached) {
      showToast(`<i class="fa-solid fa-bolt"></i> Served from real-time cache in ${data.execution_time_ms}ms!`, 'info');
    }
    renderRecipeCard();
  } catch(e) {
    document.getElementById('recipeArea').innerHTML=`<div class="card"><div class="alert alert-error"><span><i class="fa-solid fa-triangle-exclamation"></i></span>${e.message}</div></div>`;
  } finally {
    hideLoading();
    document.getElementById('generateBtn').disabled = false;
  }
}

// <i class="fa-solid fa-star"></i> UPGRADED: PREMIUM SLIDING RECIPE CARD WITH MISSING ITEMS & MACROS <i class="fa-solid fa-star"></i>
function renderRecipeCard() {
  const area = document.getElementById('recipeArea');
  if (!recipeIdeas.length || currentCardIndex >= recipeIdeas.length) {
    area.innerHTML=`<div class="card" style="text-align:center;padding:40px 20px;">
      <div style="font-size:3rem;margin-bottom:12px;"><i class="fa-solid fa-party-horn"></i></div>
      <p style="font-weight:700;font-size:1rem;color:var(--text-primary);margin-bottom:6px;">Deck exhausted!</p>
      <p style="color:var(--text-muted);font-size:.88rem;margin-bottom:18px;">No suitable parameters accepted.</p>
      <button class="btn btn-primary btn-sm" onclick="generateRecipeIdeas()"><i class="fa-solid fa-rotate"></i> Query New Parameters</button>
    </div>`;
    return;
  }
  const recipe = recipeIdeas[currentCardIndex];
  const tags = Array.isArray(recipe.tags)
    ? recipe.tags.map(t => String(t).trim()).filter(Boolean)
    : (String(recipe.tags||'')).split(',').map(t => t.trim()).filter(Boolean);
  const isFirst = currentCardIndex === 0;
  const isLast = currentCardIndex >= recipeIdeas.length - 1;

  // Logic to build the Missing Items Warning
  const missingArr = recipe.missing_items || [];
  let missingHtml = '';
  if (missingArr.length > 0) {
    missingHtml = `<div class="missing-alert">
                     <span><i class="fa-solid fa-triangle-exclamation"></i></span>
                     <span><strong>Missing ingredients:</strong> ${missingArr.join(', ')}</span>
                   </div>`;
  } else {
    missingHtml = `<div class="missing-alert success">
                     <span><i class="fa-solid fa-check"></i></span>
                     <span>You have all the ingredients!</span>
                   </div>`;
  }

  const recipeImgUrl = recipe.image_url || getRecipeImageUrl(recipe.name, tags.join(' '), recipe.description);

  area.innerHTML = `
    <div class="recipe-deck">
      <div class="premium-recipe-card">
        
        <div class="recipe-image-header">
          <img 
            src="${recipeImgUrl}" 
            alt="${escapeHtmlMP(recipe.name)}" 
            class="recipe-card-img" 
            loading="lazy"
            onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=700&auto=format&fit=crop&q=80';"
          />
          <div class="recipe-img-gradient"></div>
          <button class="card-save-btn" onclick="saveIdeaToCookbook()" title="Save to Cookbook"><i class="fa-solid fa-heart"></i></button>
        </div>

        <div class="premium-card-body">
          <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 12px;">
            Option ${currentCardIndex + 1} of ${recipeIdeas.length}
          </div>

          <div class="recipe-tags" style="margin-bottom: 12px;">
            ${tags.map(t=>`<span class="tag">${t}</span>`).join('')}
          </div>
          
          ${(() => {
            const optScore = recipe.optimization_score ?? (recipe.optimization_telemetry?.optimization_score ?? lastOptimizationTelemetry?.optimization_score);
            const calMatch = recipe.calorie_accuracy_pct ?? (recipe.optimization_telemetry?.calorie_accuracy_pct ?? lastOptimizationTelemetry?.calorie_accuracy_pct);
            const budScore = recipe.budget_efficiency_pct ?? (recipe.optimization_telemetry?.budget_efficiency_pct ?? lastOptimizationTelemetry?.budget_efficiency_pct);
            if (optScore !== undefined && optScore !== null) {
              return `
                <div style="background: linear-gradient(135deg, rgba(46,125,50,0.1), rgba(200,75,49,0.06)); border: 1px solid rgba(46,125,50,0.25); border-radius: 10px; padding: 8px 12px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem; flex-wrap: wrap; gap: 6px;">
                  <span style="font-weight: 700; color: var(--text-primary);"><i class="fa-solid fa-brain"></i> Optimizer Score: <strong style="color: var(--success);">${optScore}/100</strong></span>
                  <span style="color: var(--text-muted);">Calorie Match: <strong style="color:var(--success);">${calMatch}%</strong> · Budget Score: <strong style="color:var(--accent);">${budScore}%</strong></span>
                </div>`;
            }
            return '';
          })()}

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
            <span><i class="fa-regular fa-clock"></i> ${recipe.prep_time || '25'} min</span>
            <span class="cost-highlight" title="Rough AI Estimate">Est. RM ${parseFloat(recipe.est_cost_rm||0).toFixed(2)}</span>
          </div>

          <div style="display:grid;grid-template-columns:1fr 2fr 1fr;gap:8px;">
            <button class="btn btn-secondary" onclick="prevCard()" ${isFirst?'disabled':''}><i class="fa-solid fa-arrow-left"></i> Prev</button>
            <button class="btn btn-success" onclick="acceptRecipe('${recipe.name.replace(/'/g,"\\'")}')"><i class="fa-solid fa-check"></i> Accept</button>
            <button class="btn btn-secondary" onclick="nextCard()" ${isLast?'disabled':''}>Next <i class="fa-solid fa-arrow-right"></i></button>
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
  const shoppingText = [`<i class="fa-solid fa-mug-hot"></i> *${data.recipe_name}* Shopping List`,`Budget: RM ${parseFloat(data.cost_rm||0).toFixed(2)}`,'',
    ...ingredients.map(i=>`• ${i.item} — RM ${parseFloat(i.cost||0).toFixed(2)}`),
    '', missing.length?`<i class="fa-solid fa-lightbulb"></i> *Buy next time:*\n${missing.map(m=>`• ${m}`).join('\n')}`:''].join('\n');
  const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(shoppingText)}`;

  const heroImgUrl = data.image_url || getRecipeImageUrl(data.recipe_name, data.cultural_tag, '');

  area.innerHTML=`<div>
    <div class="premium-hero-banner" style="background-image: linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(15, 18, 20, 0.92) 100%), url('${heroImgUrl}');">
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
      <div class="ingredients-list">
        ${missing.map(m=>`
          <label class="checklist-item">
            <div style="display:flex; align-items:center;">
              <input type="checkbox" onchange="this.parentElement.parentElement.classList.toggle('checked')" />
              <span>${m}</span>
            </div>
          </label>
        `).join('')}
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
      <button class="btn btn-ghost" onclick="addCurrentToQuickList()">Add to Quick List</button>
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
  // Always add all ingredients, since users might want to re-stock even if they have some left.
  const allItems = (data.ingredients || []).map(i => i.item);
  addToQuickList(data.recipe_name, allItems);
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
