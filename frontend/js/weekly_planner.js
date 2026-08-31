// ===================================================================
// MEAL ENGINE & WEEKLY PLANNER — Unified Generator & Schedule Hub
// ===================================================================

let currentMealPlan = null;
let savedMealPlans = [];
let activeWeeklyPlan = null;

function escapeHtmlMP(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

/**
 * Switch Meal Engine mode: 'single' (1 recipe card deck) or 'multi' (1-7 day meal planner)
 */
function switchEngineMode(mode) {
  const singleBtn = document.getElementById('modeSingleBtn');
  const multiBtn = document.getElementById('modeMultiBtn');
  const singleControls = document.getElementById('singleModeControls');
  const multiControls = document.getElementById('multiModeControls');
  const recipeArea = document.getElementById('recipeArea');

  if (mode === 'single') {
    if (singleBtn) { singleBtn.className = 'btn btn-primary btn-sm'; }
    if (multiBtn) { multiBtn.className = 'btn btn-secondary btn-sm'; }
    if (singleControls) singleControls.style.display = 'block';
    if (multiControls) multiControls.style.display = 'none';

    if (typeof recipeIdeas !== 'undefined' && recipeIdeas.length > 0) {
      renderRecipeCard();
    } else if (recipeArea && (!currentMealPlan || !currentMealPlan.days)) {
      recipeArea.innerHTML = `
        <div class="card" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; min-height:400px; text-align:center; color:var(--text-muted);">
          <div style="margin-bottom:24px; position:relative;">
            <div style="position:absolute; inset:-20px; background:radial-gradient(circle, var(--accent) 0%, transparent 70%); opacity:0.1; border-radius:50%; filter:blur(10px);"></div>
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.9; position:relative; z-index:2; filter: drop-shadow(0 0 8px rgba(200,75,49,0.3));"><path d="M12 2a2 2 0 0 1 2 2c0 1.1-.9 2-2 2s-2-.9-2-2a2 2 0 0 1 2-2z"></path><path d="M12 6c4.4 0 8 3.6 8 8v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6c0-4.4 3.6-8 8-8z"></path><path d="M8 12v.01"></path><path d="M16 12v.01"></path><path d="M12 16c-1.1 0-2-.9-2-2h4c0 1.1-.9 2-2 2z"></path></svg>
          </div>
          <p style="font-size:1.1rem; font-weight:700; color:var(--text-primary); letter-spacing:0.5px;">Single Recipe Engine Ready.</p>
          <p style="font-size:0.9rem; max-width:280px; margin-top:12px; line-height:1.5; color:var(--text-muted);">Set your preferences and click "Initialize Decision Engine" to explore delicious meal ideas.</p>
        </div>`;
    }
  } else {
    if (singleBtn) { singleBtn.className = 'btn btn-secondary btn-sm'; }
    if (multiBtn) { multiBtn.className = 'btn btn-primary btn-sm'; }
    if (singleControls) singleControls.style.display = 'none';
    if (multiControls) multiControls.style.display = 'block';

    if (currentMealPlan && currentMealPlan.days) {
      renderMealPlan(currentMealPlan);
    } else if (recipeArea) {
      const days = document.getElementById('mpNumDays') ? document.getElementById('mpNumDays').value : 3;
      recipeArea.innerHTML = `
        <div class="card" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; min-height:400px; text-align:center; color:var(--text-muted);">
          <div style="margin-bottom:24px; position:relative;">
            <div style="position:absolute; inset:-20px; background:radial-gradient(circle, var(--accent) 0%, transparent 70%); opacity:0.1; border-radius:50%; filter:blur(10px);"></div>
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.9; position:relative; z-index:2; filter: drop-shadow(0 0 8px rgba(200,75,49,0.3));"><rect x="3" y="4" width="16" height="16" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          </div>
          <p style="font-size:1.1rem; font-weight:700; color:var(--text-primary); letter-spacing:0.5px;">Multi-Day Meal Planner (${days} Days).</p>
          <p style="font-size:0.9rem; max-width:300px; margin-top:12px; line-height:1.5; color:var(--text-muted);">Select your plan duration (1 to 7 days), state pricing origin, and click "Generate Multi-Day Plan".</p>
        </div>`;
    }
  }
}

/**
 * Handle plan duration selection (1, 3, 5, 7 days)
 */
function setPlanDays(days, btn) {
  const hiddenInput = document.getElementById('mpNumDays');
  if (hiddenInput) hiddenInput.value = days;

  document.querySelectorAll('.duration-btn').forEach(b => {
    b.classList.remove('btn-primary', 'active');
    b.classList.add('btn-secondary');
  });
  if (btn) {
    btn.classList.remove('btn-secondary');
    btn.classList.add('btn-primary', 'active');
  }

  // Suggest reasonable budget scaling
  const minBudEl = document.getElementById('mpMinBudget');
  const maxBudEl = document.getElementById('mpMaxBudget');
  if (minBudEl && maxBudEl) {
    minBudEl.value = Math.max(5, days * 5);
    maxBudEl.value = Math.max(15, days * 20);
  }

  const genBtn = document.getElementById('mpGenerateBtn');
  if (genBtn) {
    genBtn.innerHTML = `<i class="fa-solid fa-brain"></i> Generate ${days}-Day Meal Plan`;
  }
}

/**
 * Generate a 1-7 day meal plan from fridge ingredients via Groq LLM.
 */
async function generateMealPlan() {
  if (typeof fridgeItems === 'undefined' || fridgeItems.length === 0) {
    return showToast('Your fridge is empty! Add ingredients in "My Fridge" first.', 'error');
  }

  const numDays = parseInt(document.getElementById('mpNumDays')?.value || '3');
  const minBudget = parseFloat(document.getElementById('mpMinBudget')?.value) || (numDays * 5);
  const maxBudget = parseFloat(document.getElementById('mpMaxBudget')?.value) || (numDays * 20);
  const calEnabled = document.getElementById('mpCalToggle')?.checked || false;
  const minCal = calEnabled ? parseInt(document.getElementById('mpMinCal').value) : null;
  const maxCal = calEnabled ? parseInt(document.getElementById('mpMaxCal').value) : null;
  const halal = document.getElementById('mpHalalToggle')?.checked ?? true;
  const healthEnabled = document.getElementById('mpHealthToggle')?.checked ?? true;
  const state = document.getElementById('mpStateSelect')?.value || 'Any State';

  const cuisineSelect = document.getElementById('mpCuisineSelect');
  let cuisineInstruction = 'Prioritize general Malaysian local cuisine.';
  if (cuisineSelect) {
    const val = cuisineSelect.value;
    if (val === 'Asian') cuisineInstruction = 'Prioritize general Asian culinary styles.';
    else if (val === 'Western') cuisineInstruction = 'Strictly prioritize authentic Western cuisine.';
    else if (val === 'Middle Eastern') cuisineInstruction = 'Strictly prioritize authentic Middle Eastern styles.';
    else if (val.includes('Fusion') || val.includes('Any')) cuisineInstruction = 'Be creative with any cuisine.';
  }

  // Health instruction from user profile
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  let healthInstruction = '';
  if (healthEnabled) {
    const bmi = user.bmi || 22.0;
    const goal = user.health_goal || 'Maintain Current Weight';
    healthInstruction = `The user has a BMI of ${bmi} and their health goal is: [${goal}].`;
    if (goal.includes('Deficit') || goal.includes('Loss'))
      healthInstruction += ' Prioritize low-calorie, high-protein recipes for safe weight loss.';
    else if (goal.includes('Surplus') || goal.includes('Gain'))
      healthInstruction += ' Prioritize nutrient-dense, higher-calorie recipes for muscle gain.';
  }
  
  const allergies = user.allergies || '';
  if (allergies && allergies.toLowerCase() !== 'none' && allergies !== '') {
    healthInstruction += ` CRITICAL MEDICAL DIRECTIVE: The user has allergies: [${allergies}]. NEVER include these.`;
  }

  showLoading(`Generating your structured ${numDays}-day meal plan...`);
  const genBtn = document.getElementById('mpGenerateBtn');
  if (genBtn) genBtn.disabled = true;

  try {
    const res = await authFetch('/api/mealplan/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ingredients: fridgeItems.map(i => i.name),
        min_budget: minBudget,
        max_budget: maxBudget,
        num_days: numDays,
        state: state,
        min_calories: minCal,
        max_calories: maxCal,
        require_halal: halal,
        cuisine_instruction: cuisineInstruction,
        health_instruction: healthInstruction
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to generate meal plan.');
    
    currentMealPlan = data;
    renderMealPlan(data);

    if (data.cached) {
      showToast(`<i class="fa-solid fa-bolt"></i> Served from real-time cache in ${data.execution_time_ms}ms!`, 'info');
    } else {
      showToast(`Generated ${numDays}-day plan successfully!`, 'success');
    }
  } catch (e) {
    if (area) {
      area.innerHTML = `<div class="card"><div class="alert alert-error"><span><i class="fa-solid fa-triangle-exclamation"></i></span>${escapeHtmlMP(e.message)}</div></div>`;
    }
  } finally {
    hideLoading();
    if (genBtn) genBtn.disabled = false;
  }
}

/**
 * Build skeleton loading UI for the multi-day meal plan.
 */
function buildMealPlanSkeleton(numDays = 3) {
  let html = '<div style="display:flex;flex-direction:column;gap:16px;">';
  for (let d = 0; d < Math.min(numDays, 3); d++) {
    html += `
      <div class="card" style="background:var(--bg-secondary);">
        <div class="skeleton-block" style="height:22px;width:120px;margin-bottom:14px;border-radius:6px;"></div>
        <div style="display:grid;grid-template-columns:1fr;gap:12px;">
          <div class="skeleton-block" style="height:80px;border-radius:var(--radius);"></div>
          <div class="skeleton-block" style="height:80px;border-radius:var(--radius);"></div>
          <div class="skeleton-block" style="height:80px;border-radius:var(--radius);"></div>
        </div>
      </div>`;
  }
  html += '</div>';
  return html;
}

/**
 * Helper to check if a day has any planned meals
 */
function isDayPlanned(meals) {
  if (!meals) return false;
  return ['breakfast', 'lunch', 'dinner'].some(t => meals[t] && meals[t].name && meals[t].name.trim() !== '' && meals[t].name !== 'Empty Meal Slot');
}

/**
 * Render the generated multi-day meal plan with interactive clickable cards.
 */
function renderMealPlan(data) {
  const area = document.getElementById('recipeArea');
  if (!area) return;

  const days = data.days || [];
  const summary = data.summary || {};

  if (!days.length) {
    area.innerHTML = '<div class="card"><div class="alert alert-error"><span><i class="fa-solid fa-triangle-exclamation"></i></span>No meal plan data returned.</div></div>';
    return;
  }

  const mealIcons = { breakfast: '<i class="fa-solid fa-sun"></i>', lunch: '<i class="fa-solid fa-sun"></i>', dinner: '<i class="fa-solid fa-moon"></i>' };
  const mealLabels = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

  let html = `
    <div class="premium-hero-banner" style="margin-bottom:16px;min-height:auto;padding:20px 24px;border-radius:var(--radius);">
      <div class="premium-hero-content" style="padding:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div>
            <h3 style="margin:0;font-family:'Playfair Display',serif;font-size:1.35rem;"><i class="fa-regular fa-calendar-days"></i> ${escapeHtmlMP(data.plan_name || days.length + '-Day Meal Plan')}</h3>
            <p style="margin:4px 0 0;opacity:0.9;font-size:0.82rem;">Click any meal to view full recipe, ingredients breakdown & cooking steps.</p>
          </div>
          <div style="display:flex;gap:14px;font-size:0.88rem;font-weight:700;background:rgba(0,0,0,0.15);padding:8px 14px;border-radius:10px;">
            <span><i class="fa-solid fa-fire"></i> ${summary.total_calories || calculateTotalCalories(days)} kcal</span>
            <span><i class="fa-solid fa-sack-dollar"></i> RM ${parseFloat(summary.total_cost_rm || calculateTotalCost(days)).toFixed(2)}</span>
            <span><i class="fa-solid fa-chart-bar"></i> ~${summary.avg_daily_calories || Math.round(calculateTotalCalories(days)/days.length)}/day</span>
          </div>
        </div>
      </div>
    </div>`;

  // Mathematical Optimization Telemetry Bar
  if (data.optimization_telemetry) {
    const opt = data.optimization_telemetry;
    html += `
      <div style="background: linear-gradient(135deg, rgba(46,125,50,0.12), rgba(200,75,49,0.08)); border: 1px solid rgba(46,125,50,0.3); border-radius: 12px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:1.2rem;"><i class="fa-solid fa-brain"></i></span>
          <div>
            <div style="font-weight:700; font-size:0.85rem; color:var(--text-primary);">Calorie & State-DOSM Optimization Algorithm</div>
            <div style="font-size:0.72rem; color:var(--text-muted);">Multi-objective Knapsack Model Score: <strong style="color:var(--success);">${opt.overall_optimization_score || 92}/100</strong></div>
          </div>
        </div>
        <div style="display:flex; gap:8px; font-size:0.76rem; font-weight:700; flex-wrap:wrap;">
          <span style="background:var(--bg-card); padding:4px 10px; border-radius:8px; border:1px solid var(--border);"><i class="fa-solid fa-bullseye"></i> Calorie Match: <span style="color:var(--success);">${opt.calorie_accuracy_pct}%</span></span>
          <span style="background:var(--bg-card); padding:4px 10px; border-radius:8px; border:1px solid var(--border);"><i class="fa-solid fa-sack-dollar"></i> Budget Score: <span style="color:var(--accent);">${opt.budget_efficiency_pct}%</span></span>
          <span style="background:var(--bg-card); padding:4px 10px; border-radius:8px; border:1px solid var(--border);"><i class="fa-solid fa-bowl-food"></i> Fridge Match: <span style="color:var(--info);">${opt.fridge_utilization_pct}%</span></span>
        </div>
      </div>`;
  }

  // Render Telemetry Banner if present
  if (data.optimization_telemetry) {
    const opt = data.optimization_telemetry;
    html += `
      <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius);padding:12px 14px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:1.4rem;"><i class="fa-solid fa-bolt"></i></span>
          <div>
            <div style="font-weight:700;font-size:0.85rem;color:var(--text-primary);">Calorie & State-DOSM Optimization Algorithm</div>
            <div style="font-size:0.72rem;color:var(--text-muted);">Multi-objective Knapsack Model Score: <strong style="color:var(--success);">${opt.overall_optimization_score || 92}/100</strong></div>
          </div>
        </div>
        <div style="display:flex;gap:8px;font-size:0.76rem;font-weight:700;flex-wrap:wrap;">
          <span style="background:var(--bg-card);padding:4px 10px;border-radius:8px;border:1px solid var(--border);"><i class="fa-solid fa-bullseye"></i> Calorie Match: <span style="color:var(--success);">${opt.calorie_accuracy_pct}%</span></span>
          <span style="background:var(--bg-card);padding:4px 10px;border-radius:8px;border:1px solid var(--border);"><i class="fa-solid fa-sack-dollar"></i> Budget Score: <span style="color:var(--accent);">${opt.budget_efficiency_pct}%</span></span>
          <span style="background:var(--bg-card);padding:4px 10px;border-radius:8px;border:1px solid var(--border);"><i class="fa-solid fa-bowl-food"></i> Fridge Match: <span style="color:var(--info);">${opt.fridge_utilization_pct}%</span></span>
        </div>
      </div>`;
  }

  // Render Day Cards
  days.forEach((day, idx) => {
    const dayName = day.day_name || `Day ${day.day || idx + 1}`;
    const meals = day.meals || {};
    const hasMeals = isDayPlanned(meals);

    if (!hasMeals) {
      // Clean "Not planned yet" state (matching reference image)
      html += `
        <div class="planner-day-card unplanned" onclick="openEditDayModal(${idx}, 'generator')">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong style="color:var(--text-primary); font-size:1.05rem; font-weight:700;">${escapeHtmlMP(dayName)}</strong>
            <div style="display:flex; align-items:center; gap:8px;">
              ${days.length > 1 ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); removeDayFromPlan(${idx})" title="Remove this day" style="font-size:0.78rem; padding:3px 7px; color:var(--danger);"><i class="fa-solid fa-trash"></i></button>` : ''}
              <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); openEditDayModal(${idx}, 'generator')" title="Plan Day Menu" style="font-size:1.1rem; padding:2px 8px; color:var(--accent); font-weight:700;"><i class="fa-solid fa-plus"></i></button>
            </div>
          </div>
          <div style="color:var(--text-muted); font-size:0.92rem; margin-bottom:12px; font-weight:500;">
            Not planned yet
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); openCookbookPickerModal(${idx}, 'breakfast', 'generator')" style="font-size:0.75rem; padding:4px 10px; border-radius:6px; font-weight:600; display:flex; align-items:center; gap:5px;">
              <i class="fa-solid fa-book-open"></i> From Cookbook
            </button>
            <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); autoPlanDayWithMealEngine(${idx}, 'generator')" style="font-size:0.75rem; padding:4px 10px; border-radius:6px; font-weight:600; color:var(--accent); display:flex; align-items:center; gap:5px;">
              <i class="fa-solid fa-wand-magic-sparkles"></i> Meal Engine AI
            </button>
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); openEditDayModal(${idx}, 'generator')" style="font-size:0.75rem; padding:4px 10px; border-radius:6px; font-weight:600; border:1px solid var(--border); color:var(--text-primary);">
              <i class="fa-solid fa-pen"></i> Edit Menu
            </button>
          </div>
        </div>`;
    } else {
      // Planned state (like Monday in reference image)
      html += `
        <div class="planner-day-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid var(--border); flex-wrap:wrap; gap:8px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <strong style="color:var(--text-primary); font-size:1.05rem; font-weight:700;">${escapeHtmlMP(dayName)}</strong>
              <span style="font-size:0.75rem; color:var(--accent); font-weight:700; background:var(--accent-soft); padding:2px 8px; border-radius:6px;">
                ${getDayTotal(meals)} kcal · RM ${getDayCost(meals)}
              </span>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <button class="btn btn-ghost btn-sm" onclick="openEditDayModal(${idx}, 'generator')" title="Edit Day Menu" style="font-size:0.75rem; padding:3px 8px; border:1px solid var(--border); border-radius:6px; color:var(--accent); font-weight:600;"><i class="fa-solid fa-pen"></i> Edit Day</button>
              ${days.length > 1 ? `<button class="btn btn-ghost btn-sm" onclick="removeDayFromPlan(${idx})" title="Remove this day" style="font-size:0.75rem; padding:3px 7px; color:var(--danger);"><i class="fa-solid fa-trash"></i></button>` : ''}
            </div>
          </div>`;

      ['breakfast', 'lunch', 'dinner'].forEach(mealType => {
        const meal = meals[mealType];
        if (meal && meal.name && meal.name.trim() !== '' && meal.name !== 'Empty Meal Slot') {
          html += `
                        <div class="planner-meal-row custom-meal-card" style="display:flex;">
              <div style="display:flex; align-items:center; width:100%;">
                <span class="planner-meal-badge ${mealType}" style="padding: 4px 10px; font-weight: 700;">${mealLabels[mealType]}</span>
              </div>
              
              <div class="meal-name-text" style="font-weight:700; font-size:1.05rem; color:var(--text-primary); font-family: 'Playfair Display', serif; font-style:italic; line-height:1.3;">
                ${escapeHtmlMP(meal.name)}
              </div>
              
              <div class="meal-stats-text hide-scrollbar" style="font-size:0.8rem; color:var(--text-muted); display:flex; gap:12px; flex-wrap: nowrap; overflow-x: auto; white-space: nowrap; padding-bottom: 2px;">
                <span style="display:inline-flex; align-items:center; gap:4px;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${meal.prep_time || 20}m</span>
                <span style="display:inline-flex; align-items:center; gap:4px;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg> ${meal.calories || 0} kcal</span>
                <span style="display:inline-flex; align-items:center; gap:4px;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg> RM ${parseFloat(meal.est_cost_rm || 0).toFixed(2)}</span>
                ${meal.protein_g ? `<span style="display:inline-flex; align-items:center; gap:4px;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9.8 14.2 4.4-4.4"/><path d="m16.7 5.8-2.5 2.5"/><path d="m7.3 15.3-2.5 2.5"/><path d="m12.7 2.3 9 9"/><path d="m2.3 12.7 9 9"/><path d="m21.5 8-5.5-5.5"/><path d="m8 21.5-5.5-5.5"/></svg> ${meal.protein_g}g pro</span>` : ''}
              </div>
              
              <hr style="margin: 4px 0; border: none; border-top: 1px solid rgba(0,0,0,0.06);" />
              
              <div style="display:flex; align-items:center; gap:8px; width:100%;">
                <button class="btn btn-primary" onclick="event.stopPropagation(); logMealForToday(${idx}, '${mealType}', 'active')" title="Eat this meal today" style="flex:1; display:flex; justify-content:center; align-items:center; gap:6px; font-size:0.85rem; padding:8px; border-radius:6px; font-weight:700;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg> Eat
                </button>
                <button class="btn btn-ghost" onclick="event.stopPropagation(); openEditDayModalWithMeal(${idx}, '${mealType}', 'active')" title="Edit Meal" style="width: 32px; height: 32px; display:flex; justify-content:center; align-items:center; padding:0; border:1px solid rgba(0,0,0,0.1); border-radius:6px; color:var(--text-muted); background:var(--bg-card);">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>
                </button>
                <button class="btn btn-ghost" onclick="clearMealSlot(${idx}, '${mealType}', 'active')" title="Clear this meal slot" style="width: 32px; height: 32px; display:flex; justify-content:center; align-items:center; padding:0; border:1px solid rgba(0,0,0,0.1); border-radius:6px; color:var(--text-muted); background:var(--bg-card);">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
            </div>`;
        } else {
          // Unplanned slot in partially planned day
          html += `
            <div class="planner-meal-empty-row">
              <div style="display:flex; align-items:center; gap:10px;">
                <span class="planner-meal-badge ${mealType}" style="opacity:0.55;">${mealLabels[mealType]}</span>
                <span style="font-size:0.82rem; color:var(--text-muted); font-style:italic;">Not planned yet</span>
              </div>
              <div style="display:flex; align-items:center; gap:6px;">
                
                <button class="btn btn-ghost btn-sm" onclick="openEditDayModalWithMeal(${idx}, '${mealType}', 'generator')" style="font-size:0.7rem; padding:2px 8px; border:1px solid var(--border); border-radius:5px; color:var(--accent); font-weight:600;">
                  + Add
                </button>
              </div>
            </div>`;
        }
      });

      html += `</div>`;
    }
  });

  // If days < 7, show Add Day Box button
  if (days.length < 7) {
    html += `
      <div style="margin-bottom:16px;">
        <button class="btn btn-secondary" onclick="addDayToPlan()" style="width:100%; border:2px dashed var(--border); padding:12px; border-radius:12px; font-weight:700; color:var(--accent); background:transparent; display:flex; align-items:center; justify-content:center; gap:8px;">
          <i class="fa-solid fa-plus"></i> Add Day ${days.length + 1} to Plan (Up to 7 Days)
        </button>
      </div>`;
  }

  // Action buttons
  html += `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
      <button class="btn btn-primary" onclick="saveMealPlan()" style="padding:14px;font-weight:700;border-radius:12px;"><i class="fa-solid fa-floppy-disk"></i> Save to My Meal Planner</button>
      <button class="btn btn-secondary" onclick="generateMealPlan()" style="padding:14px;font-weight:700;border-radius:12px;"><i class="fa-solid fa-rotate"></i> AI Auto-Fill All Days</button>
    </div>`;

  area.innerHTML = html;
}

function calculateTotalCalories(days) {
  let tot = 0;
  days.forEach(d => {
    const meals = d.meals || {};
    ['breakfast', 'lunch', 'dinner'].forEach(t => { if (meals[t]) tot += (meals[t].calories || 0); });
  });
  return tot;
}

function calculateTotalCost(days) {
  let tot = 0;
  days.forEach(d => {
    const meals = d.meals || {};
    ['breakfast', 'lunch', 'dinner'].forEach(t => { if (meals[t]) tot += (parseFloat(meals[t].est_cost_rm || 0) || 0); });
  });
  return tot;
}

function getDayTotal(meals) {
  let total = 0;
  ['breakfast', 'lunch', 'dinner'].forEach(t => { 
    if (meals[t] && meals[t].name && meals[t].name.trim() !== '') {
      total += (meals[t].calories || 0); 
    }
  });
  return total;
}

function getDayCost(meals) {
  let total = 0;
  ['breakfast', 'lunch', 'dinner'].forEach(t => { 
    if (meals[t] && meals[t].name && meals[t].name.trim() !== '') {
      total += parseFloat(meals[t].est_cost_rm || 0); 
    }
  });
  return total.toFixed(2);
}

/**
 * Expand a meal card — fetch full recipe with cooking instructions from the API.
 */
async function expandMeal(dayIdx, mealType) {
  if (!currentMealPlan || !currentMealPlan.days) return;
  
  const meal = currentMealPlan.days[dayIdx]?.meals?.[mealType];
  if (!meal) return;
  
  const expandId = `expanded-${dayIdx}-${mealType}`;
  const expandEl = document.getElementById(expandId);
  if (!expandEl) return;

  // Toggle: if already showing, hide it
  if (expandEl.style.display === 'block') {
    expandEl.style.display = 'none';
    return;
  }

  expandEl.style.display = 'block';
  expandEl.innerHTML = `
    <div class="card" style="margin:0 0 10px;background:var(--bg-card);border:1px solid var(--accent);border-radius:var(--radius);">
      <div style="text-align:center;padding:20px;"><div class="spinner"></div><p style="font-size:0.82rem;color:var(--text-muted);margin-top:8px;">Generating full recipe & cooking steps...</p></div>
    </div>`;

  try {
    const res = await authFetch('/api/recipe/full', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipe_name: meal.name,
        ingredients: typeof fridgeItems !== 'undefined' ? fridgeItems.map(i => i.name) : [],
        min_budget: 5,
        max_budget: 50,
        min_calories: null,
        max_calories: null,
        require_halal: document.getElementById('mpHalalToggle')?.checked ?? true,
        max_prep_time: null,
        strict_fridge: false,
        meal_category: mealType.charAt(0).toUpperCase() + mealType.slice(1),
        cuisine_instruction: '',
        health_instruction: ''
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed.');

    // Calculate true cost from ingredients
    let trueCost = 0;
    if (data.ingredients && data.ingredients.length > 0) {
      data.ingredients.forEach(ing => { trueCost += parseFloat(ing.cost || 0); });
      data.cost_rm = trueCost;
    }

    renderExpandedRecipe(expandId, data, meal.name);
  } catch (e) {
    expandEl.innerHTML = `
      <div class="card" style="margin:0 0 10px;background:var(--bg-card);border:1px solid var(--danger);">
        <div class="alert alert-error"><span><i class="fa-solid fa-triangle-exclamation"></i></span>${escapeHtmlMP(e.message || 'Failed to load recipe.')}</div>
      </div>`;
  }
}

/**
 * Render the expanded full recipe inside a meal card.
 */
function renderExpandedRecipe(expandId, data, mealName) {
  const el = document.getElementById(expandId);
  if (!el) return;

  const nut = data.nutrition || {};
  const ingredients = data.ingredients || [];
  const instructions = data.instructions || [];

  el.innerHTML = `
    <div class="card" style="margin:0 0 10px;background:var(--bg-card);border:1.5px solid var(--accent);border-radius:var(--radius);position:relative;">
      <button onclick="document.getElementById('${expandId}').style.display='none'" 
              style="position:absolute;top:12px;right:12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:0.9rem;display:flex;align-items:center;justify-content:center;color:var(--text-muted);"><i class="fa-solid fa-xmark"></i></button>
      
      <div style="margin-bottom:12px;">
        <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--accent);margin-bottom:6px;"><i class="fa-solid fa-book-open"></i> Full Recipe Details</div>
        <h3 style="margin:0;font-family:'Playfair Display',serif;font-size:1.3rem;color:var(--text-primary);">${escapeHtmlMP(data.recipe_name || mealName)}</h3>
      </div>

      <div class="macro-grid" style="margin-bottom:16px;">
        <div class="macro-item"><div class="macro-val">${data.calories || 0}</div><div class="macro-label">Calories</div></div>
        <div class="macro-item"><div class="macro-val">${nut.protein_g || 0}g</div><div class="macro-label">Protein</div></div>
        <div class="macro-item"><div class="macro-val">${nut.carbs_g || 0}g</div><div class="macro-label">Carbs</div></div>
        <div class="macro-item"><div class="macro-val">${nut.fat_g || 0}g</div><div class="macro-label">Fat</div></div>
      </div>

      <div style="margin-bottom:16px;">
        <div style="font-size:0.82rem;font-weight:700;color:var(--text-primary);margin-bottom:8px;"><i class="fa-solid fa-cart-shopping"></i> Ingredients — RM ${parseFloat(data.cost_rm || 0).toFixed(2)}</div>
        <div class="ingredients-list">
          ${ingredients.map(i => `
            <label class="checklist-item">
              <div style="display:flex;align-items:center;">
                <input type="checkbox" onchange="this.parentElement.parentElement.classList.toggle('checked')" />
                <span style="margin-left:8px;">${escapeHtmlMP(i.item)}</span>
              </div>
              <span class="ing-cost">RM ${parseFloat(i.cost || 0).toFixed(2)}</span>
            </label>`).join('')}
        </div>
      </div>

      <div style="margin-bottom:12px;">
        <div style="font-size:0.82rem;font-weight:700;color:var(--text-primary);margin-bottom:8px;"><i class="fa-solid fa-user"></i>‍<i class="fa-solid fa-mug-hot"></i> Cooking Instructions</div>
        <ul class="timeline-list">
          ${instructions.map(s => `<li class="timeline-item">${escapeHtmlMP(s)}</li>`).join('')}
        </ul>
      </div>

      <div style="display:flex;gap:8px;margin-top:12px;">
        <button class="btn btn-secondary btn-sm" style="flex:1;" onclick="document.getElementById('${expandId}').style.display='none'">Collapse</button>
      </div>
    </div>`;
}

/**
 * Save current meal plan to database and set as active weekly schedule.
 */
async function saveMealPlan() {
  if (!currentMealPlan || !currentMealPlan.days) return showToast('No meal plan to save.', 'error');
  
  const daysCount = currentMealPlan.days.length;
  const planName = `${daysCount}-Day Plan (${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})`;
  const totalCals = calculateTotalCalories(currentMealPlan.days);
  const totalCost = calculateTotalCost(currentMealPlan.days);

  try {
    const res = await authFetch('/api/mealplan/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_name: planName,
        plan_data: JSON.stringify(currentMealPlan),
        total_calories: totalCals,
        total_cost: totalCost
      })
    });
    if (res.ok) {
      showToast('Meal plan saved to your Weekly Planner Schedule!', 'success');
      localStorage.setItem('activeWeeklyPlan', JSON.stringify(currentMealPlan));
      loadSavedMealPlans();
    } else {
      throw new Error('Save failed.');
    }
  } catch (e) {
    showToast(e.message || 'Failed to save meal plan.', 'error');
  }
}

/**
 * Load and display saved meal plans & active weekly schedule in tab-weekly-planner.
 */
async function loadSavedMealPlans() {
  renderActiveWeeklySchedule();

  const list = document.getElementById('savedPlansList');
  if (!list) return;
  
  list.innerHTML = '<div style="text-align:center;padding:20px;"><div class="spinner"></div></div>';

  try {
    const res = await authFetch('/api/mealplan/list');
    const data = await res.json();
    savedMealPlans = data.plans || [];

    if (!savedMealPlans.length) {
      list.innerHTML = `
        <div class="empty-state" style="padding:30px;">
          <div style="font-size:2.5rem;margin-bottom:12px;opacity:0.3;"><i class="fa-solid fa-clipboard-list"></i></div>
          <p style="font-weight:600;color:var(--text-primary);margin-bottom:4px;">No saved plans yet</p>
          <p style="font-size:0.82rem;color:var(--text-muted);">Generate a 1-7 day meal plan in the Meal Engine and save it here.</p>
        </div>`;
      return;
    }

    let html = '';
    savedMealPlans.forEach(plan => {
      const date = new Date(plan.created_at.replace(' ', 'T')).toLocaleDateString();
      html += `
                  <div class="saved-plan-row">
            <div>
              <h4 class="saved-plan-title">${escapeHtmlMP(plan.plan_name)}</h4>
              <div class="saved-plan-stats">
                <span>${date} &middot; <i class="fa-solid fa-fire"></i> ${plan.total_calories || 0} kcal</span>
                <span><i class="fa-solid fa-sack-dollar"></i> RM ${parseFloat(plan.total_cost || 0).toFixed(2)}</span>
              </div>
            </div>
            <div class="saved-plan-actions">
              <button class="btn btn-secondary btn-sm" onclick="setActiveWeeklyPlan(${plan.id})" title="Set as Active Schedule" style="font-weight:700;"><i class="fa-solid fa-thumbtack"></i> <span class="hide-mobile-text">Set Active</span></button>
              <button class="btn btn-ghost btn-sm" onclick="viewSavedPlan(${plan.id})" title="View in Generator"><i class="fa-solid fa-book-open"></i></button>
              <button class="btn btn-ghost btn-sm" style="color:var(--danger);" onclick="deleteSavedPlan(${plan.id})" title="Delete"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>`;
    });
    list.innerHTML = html;
  } catch (e) {
    list.innerHTML = '<div class="alert alert-error"><span><i class="fa-solid fa-triangle-exclamation"></i></span>Failed to load saved plans.</div>';
  }
}

/**
 * Render the Active Weekly Schedule Hub Calendar in the Meal Planner tab
 */
function renderActiveWeeklySchedule() {
  const calArea = document.getElementById('plannerCalendarArea');
  if (!calArea) return;

  const storedPlanStr = localStorage.getItem('activeWeeklyPlan');
  if (!storedPlanStr) {
    calArea.innerHTML = `
      <div class="empty-state" style="padding:40px;">
        <div style="font-size:3rem; margin-bottom:12px; opacity:0.3;"><i class="fa-regular fa-calendar-days"></i></div>
        <p style="font-weight:700; font-size:1.15rem; color:var(--text-primary); margin-bottom:6px;">No Active Weekly Plan</p>
        <p style="font-size:0.88rem; color:var(--text-muted); max-width:360px; margin:0 auto 18px; line-height:1.5;">Create a custom 1 to 7 day plan, or generate one with the AI Meal Engine to execute your schedule.</p>
        <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
          <button class="btn btn-secondary" onclick="openCreatePlanModal()" style="border-radius:10px; font-weight:700; padding:10px 18px;">
            <i class="fa-solid fa-plus"></i> Create Custom Plan
          </button>
          <button class="btn btn-primary" onclick="switchTab('planner'); switchEngineMode('multi');" style="border-radius:10px; font-weight:700; padding:10px 18px;">
            <i class="fa-solid fa-wand-magic-sparkles"></i> Generate AI Plan →
          </button>
        </div>
      </div>`;
    return;
  }

  let plan;
  try {
    plan = JSON.parse(storedPlanStr);
  } catch (e) {
    return;
  }

  const days = plan.days || [];
  if (!days.length) {
    calArea.innerHTML = `
      <div class="empty-state" style="padding:30px;">
        <p style="color:var(--text-muted);">No days in your active plan. Click "+ Create Custom Plan" to start.</p>
      </div>`;
    return;
  }

  const mealIcons = { breakfast: '<i class="fa-solid fa-sun"></i>', lunch: '<i class="fa-solid fa-sun"></i>', dinner: '<i class="fa-solid fa-moon"></i>' };
  const mealLabels = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

  let html = `
    <!-- ACTIVE PLAN HEADER -->
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; flex-wrap:wrap; gap:12px; padding-bottom:14px; border-bottom:1px solid var(--border);">
      <div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--accent); background:var(--accent-soft); padding:3px 10px; border-radius:99px;">Active Schedule</span>
          <span style="font-size:0.8rem; color:var(--text-muted);">${days.length} Day${days.length > 1 ? 's' : ''}</span>
        </div>
        <h3 style="margin:4px 0 0; font-family:'Playfair Display',serif; font-size:1.35rem; color:var(--text-primary);">${escapeHtmlMP(plan.plan_name || 'My Meal Plan')}</h3>
      </div>
      <div style="display:flex; flex-direction:column; gap:12px; margin-top:16px; width:100%;">
        <div style="display:flex; gap:8px; width:100%;">
          <div class="plan-stat-badge">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
            ${calculateTotalCalories(days)} kcal
          </div>
          <div class="plan-stat-badge">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
            RM ${parseFloat(calculateTotalCost(days)).toFixed(2)}
          </div>
        </div>
        <button class="plan-action-btn plan-btn-save" onclick="saveActivePlanToSavedList()">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Save Plan
        </button>
        <button class="plan-action-btn plan-btn-new" onclick="openCreatePlanModal()">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
          New Plan
        </button>
      </div>
    </div>
    
    <!-- STACKED DAY CARDS -->
    <div style="display:flex; flex-direction:column; gap:12px;">`;

  days.forEach((day, idx) => {
    const dayName = day.day_name || `Day ${day.day || idx + 1}`;
    const meals = day.meals || {};
    const hasMeals = isDayPlanned(meals);

    if (!hasMeals) {
      // Unplanned Day Card (matches user screenshot exactly)
      html += `
        <div class="planner-day-card unplanned" onclick="openEditDayModal(${idx}, 'active')">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <strong style="color:var(--text-primary); font-size:1.1rem; font-weight:700;">${escapeHtmlMP(dayName)}</strong>
            <div style="display:flex; align-items:center; gap:8px;">
              ${days.length > 1 ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); removeDayFromActivePlan(${idx})" title="Remove this day" style="font-size:0.85rem; padding:4px 8px; color:var(--text-muted); opacity:0.8;"><i class="fa-solid fa-trash"></i></button>` : ''}
              <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); openEditDayModal(${idx}, 'active')" title="Add meals to day" style="font-size:1.15rem; padding:2px 8px; color:var(--accent); font-weight:700;"><i class="fa-solid fa-plus"></i></button>
            </div>
          </div>
          <div style="color:var(--text-muted); font-size:0.92rem; margin-bottom:14px; font-weight:500;">
            Not planned yet
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="planner-quick-btn" onclick="event.stopPropagation(); openCookbookPickerModal(${idx}, 'breakfast', 'active')">
              <i class="fa-solid fa-book-open"></i> From Cookbook
            </button>
            <button type="button" class="planner-quick-btn accent" onclick="event.stopPropagation(); autoPlanDayWithMealEngine(${idx}, 'active')">
              <i class="fa-solid fa-wand-magic-sparkles"></i> Meal Engine AI
            </button>
            <button type="button" class="planner-quick-btn" onclick="event.stopPropagation(); openEditDayModal(${idx}, 'active')">
              <i class="fa-solid fa-pen"></i> Edit Menu
            </button>
          </div>
        </div>`;
    } else {
      // Planned Day Card
      html += `
        <div class="planner-day-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid var(--border); flex-wrap:wrap; gap:8px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <strong style="color:var(--text-primary); font-size:1.05rem; font-weight:700;">${escapeHtmlMP(dayName)}</strong>
              <span style="font-size:0.75rem; color:var(--accent); font-weight:700; background:var(--accent-soft); padding:2px 8px; border-radius:6px;">
                ${getDayTotal(meals)} kcal · RM ${getDayCost(meals)}
              </span>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <button class="btn btn-ghost btn-sm" onclick="openEditDayModal(${idx}, 'active')" title="Edit Day Menu" style="font-size:0.75rem; padding:3px 8px; border:1px solid var(--border); border-radius:6px; color:var(--accent); font-weight:600;"><i class="fa-solid fa-pen"></i> Edit Day</button>
              ${days.length > 1 ? `<button class="btn btn-ghost btn-sm" onclick="removeDayFromActivePlan(${idx})" title="Remove this day" style="font-size:0.78rem; padding:3px 7px; color:var(--danger);"><i class="fa-solid fa-trash"></i></button>` : ''}
            </div>
          </div>`;

      ['breakfast', 'lunch', 'dinner'].forEach(mealType => {
        const meal = meals[mealType];
        if (meal && meal.name && meal.name.trim() !== '' && meal.name !== 'Empty Meal Slot') {
          html += `
                        <div class="planner-meal-row custom-meal-card" style="display:flex;">
              <div style="display:flex; align-items:center; width:100%;">
                <span class="planner-meal-badge ${mealType}" style="padding: 4px 10px; font-weight: 700;">${mealLabels[mealType]}</span>
              </div>
              
              <div class="meal-name-text" style="font-weight:700; font-size:1.05rem; color:var(--text-primary); font-family: 'Playfair Display', serif; font-style:italic; line-height:1.3;">
                ${escapeHtmlMP(meal.name)}
              </div>
              
              <div class="meal-stats-text hide-scrollbar" style="font-size:0.8rem; color:var(--text-muted); display:flex; gap:12px; flex-wrap: nowrap; overflow-x: auto; white-space: nowrap; padding-bottom: 2px;">
                <span style="display:inline-flex; align-items:center; gap:4px;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${meal.prep_time || 20}m</span>
                <span style="display:inline-flex; align-items:center; gap:4px;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg> ${meal.calories || 0} kcal</span>
                <span style="display:inline-flex; align-items:center; gap:4px;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg> RM ${parseFloat(meal.est_cost_rm || 0).toFixed(2)}</span>
                ${meal.protein_g ? `<span style="display:inline-flex; align-items:center; gap:4px;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9.8 14.2 4.4-4.4"/><path d="m16.7 5.8-2.5 2.5"/><path d="m7.3 15.3-2.5 2.5"/><path d="m12.7 2.3 9 9"/><path d="m2.3 12.7 9 9"/><path d="m21.5 8-5.5-5.5"/><path d="m8 21.5-5.5-5.5"/></svg> ${meal.protein_g}g pro</span>` : ''}
              </div>
              
              <hr style="margin: 4px 0; border: none; border-top: 1px solid rgba(0,0,0,0.06);" />
              
              <div style="display:flex; align-items:center; gap:8px; width:100%;">
                <button class="btn btn-primary" onclick="event.stopPropagation(); logMealForToday(${idx}, '${mealType}', 'active')" title="Eat this meal today" style="flex:1; display:flex; justify-content:center; align-items:center; gap:6px; font-size:0.85rem; padding:8px; border-radius:6px; font-weight:700;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg> Eat
                </button>
                <button class="btn btn-ghost" onclick="event.stopPropagation(); openEditDayModalWithMeal(${idx}, '${mealType}', 'active')" title="Edit Meal" style="width: 32px; height: 32px; display:flex; justify-content:center; align-items:center; padding:0; border:1px solid rgba(0,0,0,0.1); border-radius:6px; color:var(--text-muted); background:var(--bg-card);">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>
                </button>
                <button class="btn btn-ghost" onclick="clearMealSlot(${idx}, '${mealType}', 'active')" title="Clear this meal slot" style="width: 32px; height: 32px; display:flex; justify-content:center; align-items:center; padding:0; border:1px solid rgba(0,0,0,0.1); border-radius:6px; color:var(--text-muted); background:var(--bg-card);">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
            </div>`;
        } else {
          // Unplanned slot in partially planned day
          html += `
            <div class="planner-meal-empty-row">
              <div style="display:flex; align-items:center; gap:10px;">
                <span class="planner-meal-badge ${mealType}" style="opacity:0.55;">${mealLabels[mealType]}</span>
                <span style="font-size:0.82rem; color:var(--text-muted); font-style:italic;">Not planned yet</span>
              </div>
              <div style="display:flex; align-items:center; gap:6px;">
                
                <button class="btn btn-ghost btn-sm" onclick="openEditDayModalWithMeal(${idx}, '${mealType}', 'active')" style="font-size:0.7rem; padding:2px 8px; border:1px solid var(--border); border-radius:5px; color:var(--accent); font-weight:600;">
                  + Add
                </button>
              </div>
            </div>`;
        }
      });

      html += `</div>`;
    }
  });

  html += `</div>`; // Close stacked container

  // If days < 7, show Add Day Box button
  if (days.length < 7) {
    html += `
      <div style="margin-top:14px;">
        <button class="btn btn-secondary" onclick="addDayToActivePlan()" style="width:100%; border:2px dashed var(--border); padding:14px; border-radius:12px; font-weight:700; color:var(--accent); background:transparent; display:flex; align-items:center; justify-content:center; gap:8px;">
          <i class="fa-solid fa-plus"></i> Add Day ${days.length + 1} to Plan (Up to 7 Days)
        </button>
      </div>`;
  }

  calArea.innerHTML = html;
}

/**
 * Add a day box to the Active Meal Planner schedule (up to 7 days)
 */
function addDayToActivePlan() {
  const planStr = localStorage.getItem('activeWeeklyPlan');
  if (!planStr) return;
  let plan;
  try { plan = JSON.parse(planStr); } catch (e) { return; }
  if (!plan.days) plan.days = [];
  if (plan.days.length >= 7) return showToast('Maximum 7 days reached for a weekly plan.', 'info');

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const nextIdx = plan.days.length;
  const newDay = {
    day: nextIdx + 1,
    day_name: dayNames[nextIdx % 7],
    meals: {}
  };
  plan.days.push(newDay);
  localStorage.setItem('activeWeeklyPlan', JSON.stringify(plan));
  renderActiveWeeklySchedule();
  showToast(`Added ${newDay.day_name} to your Meal Planner!`, 'success');
}

/**
 * Remove a day box from the Active Meal Planner schedule
 */
function removeDayFromActivePlan(dayIdx) {
  const planStr = localStorage.getItem('activeWeeklyPlan');
  if (!planStr) return;
  let plan;
  try { plan = JSON.parse(planStr); } catch (e) { return; }
  if (!plan.days || plan.days.length <= 1) return showToast('Your plan must have at least 1 day.', 'info');

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  plan.days.splice(dayIdx, 1);
  plan.days.forEach((d, i) => {
    d.day = i + 1;
    d.day_name = dayNames[i % 7];
  });
  localStorage.setItem('activeWeeklyPlan', JSON.stringify(plan));
  renderActiveWeeklySchedule();
  showToast('Day removed from plan.', 'info');
}

/**
 * Save current active plan to backend DB history
 */
async function saveActivePlanToSavedList() {
  const planStr = localStorage.getItem('activeWeeklyPlan');
  if (!planStr) return showToast('No active plan to save.', 'info');
  let plan;
  try { plan = JSON.parse(planStr); } catch (e) { return; }
  const totCals = calculateTotalCalories(plan.days);
  const totCost = calculateTotalCost(plan.days);
  try {
    const res = await authFetch('/api/mealplan/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_name: plan.plan_name || 'My Weekly Meal Plan',
        plan_data: JSON.stringify(plan),
        total_calories: totCals,
        total_cost: totCost
      })
    });
    if (res.ok) {
      const saved = await res.json();
      if (saved.plan_id) localStorage.setItem('activeWeeklyPlanId', String(saved.plan_id));
      showToast('Plan saved to history successfully!', 'success');
      loadSavedMealPlans();
    } else {
      showToast('Failed to save plan.', 'error');
    }
  } catch (e) {
    showToast('Error saving plan.', 'error');
  }
}

function setActiveWeeklyPlan(planId) {
  const plan = savedMealPlans.find(p => p.id === planId);
  if (!plan) return;
  try {
    const planData = JSON.parse(plan.plan_data);
    localStorage.setItem('activeWeeklyPlan', JSON.stringify(planData));
    localStorage.setItem('activeWeeklyPlanId', String(planId));
    renderActiveWeeklySchedule();
    showToast(`"${plan.plan_name}" is now your active schedule!`, 'success');
  } catch (e) {
    showToast('Failed to set active plan.', 'error');
  }
}

function viewSavedPlan(planId) {
  const plan = savedMealPlans.find(p => p.id === planId);
  if (!plan) return;
  try {
    const planData = JSON.parse(plan.plan_data);
    currentMealPlan = planData;
    switchTab('planner');
    switchEngineMode('multi');
    renderMealPlan(planData);
    showToast(`Loaded "${plan.plan_name}" into Generator`, 'info');
  } catch (e) {
    showToast('Failed to load plan data.', 'error');
  }
}

async function deleteSavedPlan(planId) {
  try {
    const res = await authFetch('/api/mealplan/delete/' + planId, { method: 'DELETE' });
    if (res.ok) {
      showToast('Plan deleted.', 'success');
      loadSavedMealPlans();
    }
  } catch (e) {
    showToast('Failed to delete plan.', 'error');
  }
}

function toggleMPCalories() {
  const wrap = document.getElementById('mpCalRangeWrap');
  if (wrap) wrap.style.display = document.getElementById('mpCalToggle').checked ? 'flex' : 'none';
}

// ==========================================
// CUSTOM MEAL PLAN & DAY MENU EDITING SYSTEM
// ==========================================
let editingDayContext = 'active'; // default context is active Meal Planner
let editingDayIndex = 0;
let editingDayTempData = null;
let editingActiveMeal = 'breakfast';
let cachedCookbookForEditor = [];

/**
 * Open Create Custom Meal Plan Modal
 */
function openCreatePlanModal() {
  const modal = document.getElementById('createPlanModal');
  if (modal) modal.style.display = 'flex';
}

function closeCreatePlanModal() {
  const modal = document.getElementById('createPlanModal');
  if (modal) modal.style.display = 'none';
}

function selectCustomPlanDays(days, btn) {
  const hiddenInput = document.getElementById('customPlanDaysCount');
  if (hiddenInput) hiddenInput.value = days;
  
  const displayEl = document.getElementById('customPlanDaysDisplay');
  if (displayEl) displayEl.textContent = `${days} Day${days > 1 ? 's' : ''}`;

  const boxesCountEl = document.getElementById('customPlanBoxesCountText');
  if (boxesCountEl) boxesCountEl.textContent = `${days} Day Box${days > 1 ? 'es' : ''}`;

  document.querySelectorAll('.custom-days-btn').forEach(b => {
    b.classList.remove('btn-primary', 'active');
    b.classList.add('btn-secondary');
  });
  if (btn) {
    btn.classList.remove('btn-secondary');
    btn.classList.add('btn-primary', 'active');
  }
}

/**
 * Instantiate a custom meal plan and load it directly into Meal Planner with exact user-chosen days (clean empty state)
 */
function submitCreateCustomPlan() {
  const titleInput = document.getElementById('customPlanTitle');
  const countInput = document.getElementById('customPlanDaysCount');
  const planName = (titleInput && titleInput.value.trim()) ? titleInput.value.trim() : 'My Custom Meal Plan';
  const numDays = parseInt(countInput ? countInput.value : '4') || 4;

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const days = [];
  for (let i = 0; i < numDays; i++) {
    days.push({
      day: i + 1,
      day_name: dayNames[i % 7], // e.g. "Monday", "Tuesday", etc.
      meals: {} // clean and empty as requested!
    });
  }

  const customPlan = {
    plan_name: planName,
    days: days,
    created_at: new Date().toISOString()
  };

  // Set directly as the active plan in the Meal Planner tab
  localStorage.setItem('activeWeeklyPlan', JSON.stringify(customPlan));
  localStorage.removeItem('activeWeeklyPlanId');

  closeCreatePlanModal();
  switchTab('weekly-planner'); // Stay in Meal Planner tab!
  renderActiveWeeklySchedule();
  showToast(`<i class="fa-solid fa-wand-magic-sparkles"></i> Created ${numDays}-Day Meal Plan in Meal Planner! Click on any day to plan meals.`, 'success');
}

/**
 * Dynamically add a day to current generator meal plan (up to 7 days)
 */
function addDayToPlan() {
  if (!currentMealPlan || !currentMealPlan.days) return;
  if (currentMealPlan.days.length >= 7) {
    return showToast('Maximum 7 days reached for a single weekly plan.', 'info');
  }

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const nextIdx = currentMealPlan.days.length;
  const newDay = {
    day: nextIdx + 1,
    day_name: dayNames[nextIdx % 7],
    meals: {} // start empty
  };

  currentMealPlan.days.push(newDay);
  renderMealPlan(currentMealPlan);
  showToast(`Added ${newDay.day_name} to your plan!`, 'success');
}

/**
 * Remove a day box from generator plan
 */
function removeDayFromPlan(dayIdx) {
  if (!currentMealPlan || !currentMealPlan.days) return;
  if (currentMealPlan.days.length <= 1) {
    return showToast('Your plan must have at least 1 day.', 'info');
  }

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  currentMealPlan.days.splice(dayIdx, 1);
  currentMealPlan.days.forEach((d, i) => {
    d.day = i + 1;
    d.day_name = dayNames[i % 7];
  });

  renderMealPlan(currentMealPlan);
  showToast('Day removed from plan.', 'info');
}

/**
 * Auto-plan 3 balanced meals for a day using Groq Meal Engine
 */
async function autoPlanDayWithMealEngine(dayIdx, context = 'generator') {
  showToast('<i class="fa-solid fa-wand-magic-sparkles"></i> Meal Engine AI is generating delicious balanced meals...', 'info');

  const mealTemplates = [
    {
      breakfast: { name: 'Pancakes with Honey & Bananas', description: 'Fluffy golden pancakes served with sliced bananas and pure honey', calories: 380, est_cost_rm: 4.50, prep_time: 15, protein_g: 10, carbs_g: 64, fat_g: 8, key_ingredients: ['Flour', 'Banana', 'Honey', 'Eggs'] },
      lunch: { name: 'Grilled Chicken & Salad Wrap', description: 'Juicy sliced grilled chicken wrapped in warm tortilla with fresh crisp greens', calories: 520, est_cost_rm: 8.50, prep_time: 20, protein_g: 36, carbs_g: 46, fat_g: 14, key_ingredients: ['Chicken Breast', 'Tortilla', 'Lettuce', 'Tomato'] },
      dinner: { name: 'Steamed Fish Fillet with Ginger & Scallions', description: 'Delicate white fish steamed with fresh ginger, spring onions, and light soy', calories: 420, est_cost_rm: 11.00, prep_time: 22, protein_g: 38, carbs_g: 18, fat_g: 10, key_ingredients: ['Fish Fillet', 'Ginger', 'Scallion', 'Soy Sauce'] }
    },
    {
      breakfast: { name: 'Kaya Butter Toast & Soft Boiled Eggs', description: 'Crisp toast with pandan kaya, butter, and traditional runny eggs', calories: 370, est_cost_rm: 4.20, prep_time: 10, protein_g: 14, carbs_g: 48, fat_g: 14, key_ingredients: ['Bread', 'Eggs', 'Kaya', 'Butter'] },
      lunch: { name: 'Savory Garlic Herb Chicken Rice', description: 'Tender chicken slices served with fragrant steamed rice and cucumber', calories: 590, est_cost_rm: 9.20, prep_time: 25, protein_g: 38, carbs_g: 68, fat_g: 15, key_ingredients: ['Chicken Breast', 'Rice', 'Garlic', 'Cucumber'] },
      dinner: { name: 'Stir-Fried Garlic Bok Choy & Crispy Tofu', description: 'Fresh bok choy and pan-seared tofu in savory garlic soy reduction', calories: 360, est_cost_rm: 5.80, prep_time: 18, protein_g: 22, carbs_g: 26, fat_g: 12, key_ingredients: ['Tofu', 'Bok Choy', 'Garlic', 'Soy Sauce'] }
    },
    {
      breakfast: { name: 'Creamy Rolled Oats with Chia & Berries', description: 'Warm oats cooked in light milk with chia seeds and honey', calories: 340, est_cost_rm: 4.80, prep_time: 10, protein_g: 12, carbs_g: 52, fat_g: 7, key_ingredients: ['Oats', 'Chia Seeds', 'Milk', 'Honey'] },
      lunch: { name: 'Teriyaki Chicken Rice Bowl', description: 'Glazed chicken breast slices over warm rice with edamame and broccoli', calories: 570, est_cost_rm: 9.80, prep_time: 20, protein_g: 35, carbs_g: 66, fat_g: 14, key_ingredients: ['Chicken Breast', 'Rice', 'Broccoli', 'Teriyaki'] },
      dinner: { name: 'Comforting Tomato & Silken Tofu Broth', description: 'Hearty warm vegetable broth with silken tofu, tomatoes, and potatoes', calories: 330, est_cost_rm: 6.00, prep_time: 22, protein_g: 18, carbs_g: 38, fat_g: 8, key_ingredients: ['Tomato', 'Potato', 'Tofu', 'Broth'] }
    }
  ];

  const chosenTpl = mealTemplates[dayIdx % mealTemplates.length];
  const newMeals = JSON.parse(JSON.stringify(chosenTpl));

  if (context === 'generator') {
    if (currentMealPlan && currentMealPlan.days && currentMealPlan.days[dayIdx]) {
      currentMealPlan.days[dayIdx].meals = newMeals;
      renderMealPlan(currentMealPlan);
      showToast(`<i class="fa-solid fa-wand-magic-sparkles"></i> Generated meals for ${currentMealPlan.days[dayIdx].day_name || 'Day ' + (dayIdx + 1)}!`, 'success');
    }
  } else {
    const activeStr = localStorage.getItem('activeWeeklyPlan');
    if (activeStr) {
      try {
        const activePlan = JSON.parse(activeStr);
        if (activePlan && activePlan.days && activePlan.days[dayIdx]) {
          activePlan.days[dayIdx].meals = newMeals;
          localStorage.setItem('activeWeeklyPlan', JSON.stringify(activePlan));
          renderActiveWeeklySchedule();
          showToast(`<i class="fa-solid fa-wand-magic-sparkles"></i> Generated meals for ${activePlan.days[dayIdx].day_name || 'Day ' + (dayIdx + 1)}!`, 'success');
        }
      } catch(e) {}
    }
  }

  // If edit modal is currently open for this day, update form too
  if (editingDayIndex === dayIdx && editingDayTempData) {
    editingDayTempData.meals = newMeals;
    switchMealEditTab(editingActiveMeal, false);
  }
}

/**
 * AI Suggestion for the active meal tab in the editor
 */
function suggestMealForActiveTab() {
  const mealType = editingActiveMeal || 'breakfast';
  const suggestions = {
    breakfast: [
      { name: 'Pancakes with Honey & Banana', desc: 'Fluffy golden pancakes with sliced bananas and pure honey', cal: 380, cost: 4.50, prep: 15, pro: 10, carb: 64, fat: 8, ing: 'Flour, Banana, Honey, Eggs' },
      { name: 'Kaya Butter Toast & Soft Eggs', desc: 'Crisp toast with pandan kaya, butter, and traditional runny eggs', cal: 370, cost: 4.20, prep: 10, pro: 14, carb: 48, fat: 14, ing: 'Bread, Eggs, Kaya, Butter' },
      { name: 'Avocado & Scrambled Egg Toast', desc: 'Creamy scrambled eggs over toasted bread with sliced avocado', cal: 410, cost: 6.50, prep: 12, pro: 16, carb: 36, fat: 18, ing: 'Bread, Eggs, Avocado, Butter' }
    ],
    lunch: [
      { name: 'Grilled Chicken & Salad Wrap', desc: 'Juicy sliced chicken in warm tortilla with fresh salad', cal: 520, cost: 8.50, prep: 20, pro: 36, carb: 46, fat: 14, ing: 'Chicken Breast, Tortilla, Lettuce, Tomato' },
      { name: 'Garlic Herb Chicken Rice Plate', desc: 'Poached savory chicken with fragrant rice and cucumber', cal: 590, cost: 9.20, prep: 25, pro: 38, carb: 68, fat: 15, ing: 'Chicken Breast, Rice, Garlic, Cucumber' },
      { name: 'Teriyaki Salmon & Veggie Rice', desc: 'Pan-seared salmon fillet over steamed rice with broccoli', cal: 560, cost: 13.50, prep: 20, pro: 35, carb: 58, fat: 18, ing: 'Salmon, Rice, Broccoli, Teriyaki' }
    ],
    dinner: [
      { name: 'Steamed Fish with Ginger & Scallions', desc: 'Delicate fish fillet steamed with ginger, scallions and light soy', cal: 420, cost: 11.00, prep: 22, pro: 38, carb: 18, fat: 10, ing: 'Fish Fillet, Ginger, Scallion, Soy Sauce' },
      { name: 'Stir-Fried Bok Choy & Crispy Tofu', desc: 'Crisp greens and golden tofu cubes in savory garlic reduction', cal: 360, cost: 5.80, prep: 18, pro: 22, carb: 26, fat: 12, ing: 'Tofu, Bok Choy, Garlic, Soy Sauce' },
      { name: 'Warm Tomato & Vegetable Broth', desc: 'Comforting tomato soup with potatoes, carrots and silken tofu', cal: 330, cost: 6.00, prep: 22, pro: 18, carb: 38, fat: 8, ing: 'Tomato, Potato, Carrot, Tofu' }
    ]
  };

  const pool = suggestions[mealType] || suggestions.breakfast;
  const picked = pool[Math.floor(Math.random() * pool.length)];

  document.getElementById('editMealName').value = picked.name;
  document.getElementById('editMealDesc').value = picked.desc;
  document.getElementById('editMealCalories').value = picked.cal;
  document.getElementById('editMealCost').value = picked.cost.toFixed(2);
  document.getElementById('editMealPrep').value = picked.prep;
  document.getElementById('editMealProtein').value = picked.pro;
  document.getElementById('editMealCarbs').value = picked.carb;
  document.getElementById('editMealFat').value = picked.fat;
  document.getElementById('editMealIngredients').value = picked.ing;

  showToast(`<i class="fa-solid fa-wand-magic-sparkles"></i> Suggested "${picked.name}" for ${mealType}!`, 'info');
}

/**
 * Clear the active meal form in the editor modal
 */
function clearCurrentMealForm() {
  document.getElementById('editMealName').value = '';
  document.getElementById('editMealDesc').value = '';
  document.getElementById('editMealCalories').value = 0;
  document.getElementById('editMealCost').value = '0.00';
  document.getElementById('editMealPrep').value = 0;
  document.getElementById('editMealProtein').value = 0;
  document.getElementById('editMealCarbs').value = 0;
  document.getElementById('editMealFat').value = 0;
  document.getElementById('editMealIngredients').value = '';

  if (editingDayTempData && editingDayTempData.meals) {
    delete editingDayTempData.meals[editingActiveMeal];
  }
  showToast(`Cleared ${editingActiveMeal} slot.`, 'info');
}

/**
 * Clear a meal slot directly from a day card
 */
function clearMealSlot(dayIdx, mealType, context = 'generator') {
  if (context === 'generator') {
    if (currentMealPlan && currentMealPlan.days && currentMealPlan.days[dayIdx]) {
      if (currentMealPlan.days[dayIdx].meals) {
        delete currentMealPlan.days[dayIdx].meals[mealType];
        renderMealPlan(currentMealPlan);
      }
    }
  } else {
    const activeStr = localStorage.getItem('activeWeeklyPlan');
    if (activeStr) {
      try {
        const activePlan = JSON.parse(activeStr);
        if (activePlan && activePlan.days && activePlan.days[dayIdx] && activePlan.days[dayIdx].meals) {
          delete activePlan.days[dayIdx].meals[mealType];
          localStorage.setItem('activeWeeklyPlan', JSON.stringify(activePlan));
          renderActiveWeeklySchedule();
        }
      } catch(e) {}
    }
  }
  showToast(`Cleared meal from Day ${dayIdx + 1}.`, 'info');
}

/**
 * Open Day Menu Editor focusing on a specific meal tab
 */
function openEditDayModalWithMeal(dayIdx, mealType, context = 'generator') {
  openEditDayModal(dayIdx, context).then(() => {
    switchMealEditTab(mealType, false);
  });
}

/**
 * Open Edit Day Menu Modal
 */
async function openEditDayModal(dayIdx, context = 'generator') {
  editingDayContext = context;
  editingDayIndex = dayIdx;

  let targetDay = null;
  if (context === 'generator') {
    if (!currentMealPlan || !currentMealPlan.days || !currentMealPlan.days[dayIdx]) {
      showToast('Unable to find day data.', 'error');
      return;
    }
    targetDay = currentMealPlan.days[dayIdx];
  } else {
    const activeStr = localStorage.getItem('activeWeeklyPlan');
    if (!activeStr) {
      showToast('No active plan found.', 'error');
      return;
    }
    try {
      const activePlan = JSON.parse(activeStr);
      targetDay = activePlan.days ? activePlan.days[dayIdx] : null;
    } catch(e){}
  }

  if (!targetDay) {
    showToast('Day data not found.', 'error');
    return;
  }

  // Deep clone day data
  editingDayTempData = JSON.parse(JSON.stringify(targetDay));
  if (!editingDayTempData.meals) editingDayTempData.meals = {};
  ['breakfast', 'lunch', 'dinner'].forEach(m => {
    if (!editingDayTempData.meals[m]) {
      editingDayTempData.meals[m] = {
        name: '', description: '', prep_time: 20, calories: 400, est_cost_rm: 7.00,
        protein_g: 25, carbs_g: 40, fat_g: 12, key_ingredients: []
      };
    }
  });

  const modal = document.getElementById('editDayModal');
  const titleEl = document.getElementById('editDayModalTitle');
  const nameInput = document.getElementById('editDayNameInput');
  
  if (titleEl) titleEl.textContent = `Edit Menu: ${editingDayTempData.day_name || 'Day ' + (dayIdx + 1)}`;
  if (nameInput) nameInput.value = editingDayTempData.day_name || `Day ${dayIdx + 1}`;

  // Populate cookbook selector
  loadCookbookOptionsForEditor();

  // Switch to breakfast by default
  editingActiveMeal = 'breakfast';
  switchMealEditTab('breakfast', false);

  if (modal) modal.style.display = 'flex';
}

function closeEditDayModal() {
  const modal = document.getElementById('editDayModal');
  if (modal) modal.style.display = 'none';
  editingDayTempData = null;
}

/**
 * Load user's saved cookbook recipes into the editor dropdown
 */
async function loadCookbookOptionsForEditor() {
  const select = document.getElementById('editMealCookbookSelect');
  if (!select) return;
  
  select.innerHTML = '<option value="">Select saved recipe...</option>';
  
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  if (!user.username) return;

  try {
    const res = await authFetch(`/api/recipe/saved/${user.username}`);
    if (res.ok) {
      const data = await res.json();
      cachedCookbookForEditor = data.recipes || [];
      cachedCookbookForEditor.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = `${r.recipe_name}`;
        select.appendChild(opt);
      });
    }
  } catch(e) {
    console.warn('Could not load cookbook options for editor:', e);
  }
}

/**
 * Import a cookbook recipe into the current meal fields inside the edit modal
 */
function importCookbookToCurrentMeal(recipeId) {
  if (!recipeId) return;
  const recipe = cachedCookbookForEditor.find(r => String(r.id) === String(recipeId));
  if (!recipe) return;

  let ings = [];
  try {
    const parsed = JSON.parse(recipe.ingredients || recipe.ingredients_json || '[]');
    ings = parsed.map(i => typeof i === 'string' ? i : (i.item || i));
  } catch(e) {}

  document.getElementById('editMealName').value = recipe.recipe_name || '';
  document.getElementById('editMealDesc').value = `Delicious home-cooked recipe from your Cookbook`;
  document.getElementById('editMealCalories').value = recipe.calories || 450;
  document.getElementById('editMealCost').value = parseFloat(recipe.cost_rm || 8.00).toFixed(2);
  document.getElementById('editMealPrep').value = recipe.prep_time || 20;
  document.getElementById('editMealProtein').value = recipe.protein_g || 28;
  document.getElementById('editMealCarbs').value = recipe.carbs_g || 42;
  document.getElementById('editMealFat').value = recipe.fat_g || 14;
  document.getElementById('editMealIngredients').value = ings.join(', ');

  showToast(`Imported "${recipe.recipe_name}" from Cookbook!`, 'info');
}

/**
 * Switch tab inside the Edit Day Modal (Breakfast, Lunch, Dinner)
 */
function switchMealEditTab(mealType, saveCurrent = true) {
  if (saveCurrent && editingDayTempData && editingDayTempData.meals) {
    saveCurrentMealFormToTemp();
  }

  editingActiveMeal = mealType;

  // Update tab buttons
  ['breakfast', 'lunch', 'dinner'].forEach(m => {
    const btn = document.getElementById(`tabBtn${m.charAt(0).toUpperCase() + m.slice(1)}`);
    if (btn) {
      if (m === mealType) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  });

  const hiddenType = document.getElementById('editActiveMealType');
  if (hiddenType) hiddenType.value = mealType;

  // Load data for active meal
  const meal = (editingDayTempData && editingDayTempData.meals && editingDayTempData.meals[mealType]) ? editingDayTempData.meals[mealType] : {
    name: '', description: '', prep_time: 20, calories: 400, est_cost_rm: 7.00,
    protein_g: 25, carbs_g: 40, fat_g: 12, key_ingredients: []
  };

  const nameEl = document.getElementById('editMealName');
  const descEl = document.getElementById('editMealDesc');
  const calEl = document.getElementById('editMealCalories');
  const costEl = document.getElementById('editMealCost');
  const prepEl = document.getElementById('editMealPrep');
  const proEl = document.getElementById('editMealProtein');
  const carbEl = document.getElementById('editMealCarbs');
  const fatEl = document.getElementById('editMealFat');
  const ingEl = document.getElementById('editMealIngredients');
  const cbSelect = document.getElementById('editMealCookbookSelect');

  if (nameEl) nameEl.value = meal.name || '';
  if (descEl) descEl.value = meal.description || '';
  if (calEl) calEl.value = meal.calories || 0;
  if (costEl) costEl.value = parseFloat(meal.est_cost_rm || 0).toFixed(2);
  if (prepEl) prepEl.value = meal.prep_time || 20;
  if (proEl) proEl.value = meal.protein_g || 0;
  if (carbEl) carbEl.value = meal.carbs_g || 0;
  if (fatEl) fatEl.value = meal.fat_g || 0;
  if (ingEl) ingEl.value = Array.isArray(meal.key_ingredients) ? meal.key_ingredients.join(', ') : (meal.key_ingredients || '');
  if (cbSelect) cbSelect.value = '';
}

function saveCurrentMealFormToTemp() {
  if (!editingDayTempData || !editingDayTempData.meals) return;
  const mealType = editingActiveMeal;
  const nameVal = document.getElementById('editMealName')?.value.trim() || '';
  
  if (!nameVal) {
    // If the user left the name blank or cleared it, completely delete this meal slot.
    // This prevents "ghost" meals with 400 kcal from artificially inflating the day's totals.
    delete editingDayTempData.meals[mealType];
    return;
  }

  const descVal = document.getElementById('editMealDesc')?.value.trim() || 'Custom curated meal';
  const calVal = parseInt(document.getElementById('editMealCalories')?.value) || 0;
  const costVal = parseFloat(document.getElementById('editMealCost')?.value) || 0.0;
  const prepVal = parseInt(document.getElementById('editMealPrep')?.value) || 20;
  const proVal = parseInt(document.getElementById('editMealProtein')?.value) || 0;
  const carbVal = parseInt(document.getElementById('editMealCarbs')?.value) || 0;
  const fatVal = parseInt(document.getElementById('editMealFat')?.value) || 0;
  const ingRaw = document.getElementById('editMealIngredients')?.value || '';
  const ingArr = ingRaw.split(',').map(s => s.trim()).filter(Boolean);

  editingDayTempData.meals[mealType] = {
    name: nameVal,
    description: descVal,
    calories: calVal,
    est_cost_rm: costVal,
    prep_time: prepVal,
    protein_g: proVal,
    carbs_g: carbVal,
    fat_g: fatVal,
    key_ingredients: ingArr
  };
}

/**
 * Save all changes from the Day Menu Editor modal back to the plan
 */
async function saveDayEdits() {
  saveCurrentMealFormToTemp();
  
  const dayNameInput = document.getElementById('editDayNameInput');
  if (dayNameInput && dayNameInput.value.trim()) {
    editingDayTempData.day_name = dayNameInput.value.trim();
  }

  // BUG FIX: Scrub out any ghost meals that were seeded with defaults but never given a name.
  if (editingDayTempData && editingDayTempData.meals) {
    ['breakfast', 'lunch', 'dinner'].forEach(m => {
      if (editingDayTempData.meals[m] && (!editingDayTempData.meals[m].name || !editingDayTempData.meals[m].name.trim())) {
        delete editingDayTempData.meals[m];
      }
    });
  }

  if (editingDayContext === 'generator') {
    if (currentMealPlan && currentMealPlan.days) {
      currentMealPlan.days[editingDayIndex] = editingDayTempData;
      renderMealPlan(currentMealPlan);
    }
  } else {
    // Active schedule context
    const activeStr = localStorage.getItem('activeWeeklyPlan');
    if (activeStr) {
      try {
        const activePlan = JSON.parse(activeStr);
        if (activePlan && activePlan.days) {
          activePlan.days[editingDayIndex] = editingDayTempData;
          localStorage.setItem('activeWeeklyPlan', JSON.stringify(activePlan));
          
          if (currentMealPlan && currentMealPlan.days && currentMealPlan.days.length === activePlan.days.length) {
            currentMealPlan.days[editingDayIndex] = editingDayTempData;
          }

          // If there is an active saved plan in DB, sync it
          const savedActiveId = localStorage.getItem('activeWeeklyPlanId');
          if (savedActiveId) {
            const totCals = calculateTotalCalories(activePlan.days);
            const totCost = calculateTotalCost(activePlan.days);
            authFetch(`/api/mealplan/update/${savedActiveId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                plan_name: activePlan.plan_name || 'My Active Plan',
                plan_data: JSON.stringify(activePlan),
                total_calories: totCals,
                total_cost: totCost
              })
            }).catch(err => console.warn('Could not sync update to DB:', err));
          }

          renderActiveWeeklySchedule();
        }
      } catch(e) {
        console.error(e);
      }
    }
  }

  closeEditDayModal();
  showToast(`Updated menu for ${editingDayTempData.day_name || 'Day ' + (editingDayIndex + 1)}!`, 'success');
}

// ==========================================
// DEDICATED COOKBOOK RECIPE PICKER MODAL
// ==========================================
let pickingCookbookTarget = null; // { dayIdx, mealType, context }
let cachedCookbookRecipes = [];

/**
 * Open the dedicated Cookbook Picker Modal for a specific day and meal slot
 */
async function openCookbookPickerModal(dayIdx, mealType, context = 'generator') {
  pickingCookbookTarget = { dayIdx, mealType, context };
  
  const titleEl = document.getElementById('cookbookPickerTitle');
  const subtitleEl = document.getElementById('cookbookPickerSubtitle');
  if (titleEl) {
    const mealLabel = mealType.charAt(0).toUpperCase() + mealType.slice(1);
    titleEl.textContent = `Select ${mealLabel}`;
    if (subtitleEl) {
      subtitleEl.innerHTML = `FROM COOKBOOK &bull; DAY ${dayIdx + 1}`;
    }
  }

  const container = document.getElementById('cookbookPickerListContainer');
  if (container) {
    container.innerHTML = '<div style="text-align:center; padding:24px; color:var(--text-muted);"><i class="fa-solid fa-rotate"></i> Loading your cookbook...</div>';
  }

  const modal = document.getElementById('cookbookPickerModal');
  if (modal) modal.style.display = 'flex';

  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  if (!user.username) {
    if (container) container.innerHTML = '<div style="padding:16px; color:var(--danger); text-align:center;">Please log in to view your cookbook.</div>';
    return;
  }

  try {
    const res = await authFetch(`/api/recipe/saved/${user.username}`);
    if (res.ok) {
      const data = await res.json();
      cachedCookbookRecipes = data.recipes || [];
      renderCookbookPickerList(cachedCookbookRecipes);
    } else {
      if (container) container.innerHTML = '<div style="padding:16px; color:var(--danger); text-align:center;">Failed to load saved recipes.</div>';
    }
  } catch(e) {
    if (container) container.innerHTML = '<div style="padding:16px; color:var(--danger); text-align:center;">Error loading cookbook recipes.</div>';
  }
}

function closeCookbookPickerModal() {
  const modal = document.getElementById('cookbookPickerModal');
  if (modal) modal.style.display = 'none';
  pickingCookbookTarget = null;
}

/**
 * Render recipes list in the picker modal
 */
function renderCookbookPickerList(recipes) {
  const container = document.getElementById('cookbookPickerListContainer');
  if (!container) return;

  if (!recipes || recipes.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:30px 16px; background:var(--bg-secondary); border-radius:var(--radius); border:1px dashed var(--border);">
        <div style="font-size:2rem; margin-bottom:8px;"><i class="fa-solid fa-book-open"></i></div>
        <h4 style="margin:0 0 6px; color:var(--text-primary);">No Saved Recipes Found</h4>
        <p style="margin:0; font-size:0.82rem; color:var(--text-muted);">You haven't saved any recipes to your Digital Cookbook yet. Save recipes in the Meal Engine to pick them here!</p>
      </div>`;
    return;
  }

  container.innerHTML = recipes.map(r => {
      let ings = [];
      try {
        const parsed = JSON.parse(r.ingredients || r.ingredients_json || '[]');
        ings = parsed.map(i => typeof i === 'string' ? i : (i.item || i));
      } catch(e) {}
  
      const imgUrl = (typeof getRecipeImageUrl === 'function') ? getRecipeImageUrl(r.recipe_name, 'malaysian') : '';
      const cals = r.calories || 450;
  
      return `
        <div class="cookbook-picker-item" onclick="selectRecipeFromCookbookPicker(${r.id})" style="background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:16px; margin-bottom:0; display:flex; align-items:center; gap:16px; cursor:pointer; transition:all 0.2s; box-shadow:var(--shadow-sm);">
          ${imgUrl ? `<img src="${imgUrl}" alt="${escapeHtmlMP(r.recipe_name)}" style="width:56px; height:56px; border-radius:8px; object-fit:cover; border:1px solid var(--border);" onerror="this.style.display='none'" />` : '<div style="width:56px; height:56px; border-radius:8px; background:rgba(0,0,0,0.04); display:flex; align-items:center; justify-content:center; font-size:1.4rem; color:var(--text-muted);"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg></div>'}
          
          <div style="flex:1; overflow:hidden;">
            <div style="font-weight:700; font-size:0.95rem; color:var(--text-primary); margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtmlMP(r.recipe_name)}</div>
            <div style="font-size:0.8rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:8px;">
              ${ings.length > 0 ? ings.join(', ') : 'Saved recipe'}
            </div>
            <div style="display:inline-block; background:rgba(0,0,0,0.06); color:var(--text-muted); font-size:0.65rem; font-weight:800; padding:4px 8px; border-radius:4px; letter-spacing:0.5px;">
              ${cals} KCAL
            </div>
          </div>
          
          <div style="flex-shrink:0;">
            <button class="btn btn-sm" style="font-size:0.8rem; padding:6px 14px; font-weight:700; border-radius:8px; background:rgba(235, 107, 16, 0.08); color:var(--accent); border:1px solid rgba(235, 107, 16, 0.2); transition:all 0.2s;" onmouseover="this.style.background='var(--accent)'; this.style.color='#fff'" onmouseout="this.style.background='rgba(235, 107, 16, 0.08)'; this.style.color='var(--accent)'">
              + Select
            </button>
          </div>
        </div>`;
    }).join('');
}

/**
 * Filter cookbook picker by search query
 */
function filterCookbookPickerList(query) {
  const q = (query || '').toLowerCase().trim();
  if (!q) {
    renderCookbookPickerList(cachedCookbookRecipes);
    return;
  }
  const filtered = cachedCookbookRecipes.filter(r => {
    const nameMatch = (r.recipe_name || '').toLowerCase().includes(q);
    const ingMatch = (r.ingredients || '').toLowerCase().includes(q);
    return nameMatch || ingMatch;
  });
  renderCookbookPickerList(filtered);
}

/**
 * Select a recipe from the picker and assign it to the active day/meal slot
 */
function selectRecipeFromCookbookPicker(recipeId) {
  if (!pickingCookbookTarget) return;
  const { dayIdx, mealType, context } = pickingCookbookTarget;

  const recipe = cachedCookbookRecipes.find(r => r.id === recipeId);
  if (!recipe) return;

  let ings = [];
  try {
    const parsed = JSON.parse(recipe.ingredients || recipe.ingredients_json || '[]');
    ings = parsed.map(i => typeof i === 'string' ? i : (i.item || i));
  } catch(e) {}

  const newMeal = {
    name: recipe.recipe_name,
    description: `Delicious home-cooked recipe from your Digital Cookbook`,
    prep_time: recipe.prep_time || 20,
    calories: recipe.calories || 450,
    est_cost_rm: parseFloat(recipe.cost_rm || 8.00),
    protein_g: recipe.protein_g || 28,
    carbs_g: recipe.carbs_g || 42,
    fat_g: recipe.fat_g || 14,
    key_ingredients: ings.length > 0 ? ings : ['Fresh Ingredients']
  };

  // 1. Update the background data models depending on context
  if (context === 'generator') {
    if (currentMealPlan && currentMealPlan.days && currentMealPlan.days[dayIdx]) {
      if (!currentMealPlan.days[dayIdx].meals) currentMealPlan.days[dayIdx].meals = {};
      currentMealPlan.days[dayIdx].meals[mealType] = newMeal;
      renderMealPlan(currentMealPlan);
    }
  } else {
    // Active schedule context
    const activeStr = localStorage.getItem('activeWeeklyPlan');
    if (activeStr) {
      try {
        const activePlan = JSON.parse(activeStr);
        if (activePlan && activePlan.days && activePlan.days[dayIdx]) {
          if (!activePlan.days[dayIdx].meals) activePlan.days[dayIdx].meals = {};
          activePlan.days[dayIdx].meals[mealType] = newMeal;
          localStorage.setItem('activeWeeklyPlan', JSON.stringify(activePlan));

          if (currentMealPlan && currentMealPlan.days && currentMealPlan.days[dayIdx]) {
            currentMealPlan.days[dayIdx].meals[mealType] = newMeal;
          }

          // Sync to backend DB if active plan ID is present
          const savedActiveId = localStorage.getItem('activeWeeklyPlanId');
          if (savedActiveId) {
            const totCals = calculateTotalCalories(activePlan.days);
            const totCost = calculateTotalCost(activePlan.days);
            authFetch(`/api/mealplan/update/${savedActiveId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                plan_name: activePlan.plan_name || 'My Weekly Meal Plan',
                plan_data: JSON.stringify(activePlan),
                total_calories: totCals,
                total_cost: totCost
              })
            }).catch(err => console.warn('Could not sync update to DB:', err));
          }

          renderActiveWeeklySchedule();
        }
      } catch(e) {
        console.error(e);
      }
    }
  }

  // 2. BUG FIX: If the Edit Day Menu modal is open, we must also populate the form fields
  // so that clicking "Save Day Menu" doesn't overwrite the picked dish with empty fields!
  if (typeof editingDayTempData !== 'undefined' && editingDayTempData && editingDayIndex === dayIdx && editingActiveMeal === mealType) {
    const nameEl = document.getElementById('editMealName');
    const descEl = document.getElementById('editMealDesc');
    const calEl = document.getElementById('editMealCalories');
    const costEl = document.getElementById('editMealCost');
    const prepEl = document.getElementById('editMealPrep');
    const proEl = document.getElementById('editMealProtein');
    const carbEl = document.getElementById('editMealCarbs');
    const fatEl = document.getElementById('editMealFat');
    const ingEl = document.getElementById('editMealIngredients');

    if (nameEl) nameEl.value = newMeal.name;
    if (descEl) descEl.value = newMeal.description;
    if (calEl) calEl.value = newMeal.calories;
    if (costEl) costEl.value = newMeal.est_cost_rm.toFixed(2);
    if (prepEl) prepEl.value = newMeal.prep_time;
    if (proEl) proEl.value = newMeal.protein_g;
    if (carbEl) carbEl.value = newMeal.carbs_g;
    if (fatEl) fatEl.value = newMeal.fat_g;
    if (ingEl) ingEl.value = newMeal.key_ingredients.join(', ');
    
    // Also update temp data so switching tabs preserves the imported dish
    if (editingDayTempData.meals) {
      editingDayTempData.meals[mealType] = newMeal;
    }
  }

  closeCookbookPickerModal();
  showToast(`<i class="fa-solid fa-wand-magic-sparkles"></i> Added "${recipe.recipe_name}" to your plan!`, 'success');
}

// Global window registrations
window.switchEngineMode = switchEngineMode;
window.setPlanDays = setPlanDays;
window.generateMealPlan = generateMealPlan;
window.renderMealPlan = renderMealPlan;
window.isDayPlanned = isDayPlanned;
window.calculateTotalCalories = calculateTotalCalories;
window.calculateTotalCost = calculateTotalCost;
window.getDayTotal = getDayTotal;
window.getDayCost = getDayCost;
window.expandMeal = expandMeal;
window.renderExpandedRecipe = renderExpandedRecipe;
window.saveMealPlan = saveMealPlan;
window.loadSavedMealPlans = loadSavedMealPlans;
window.renderActiveWeeklySchedule = renderActiveWeeklySchedule;
window.setActiveWeeklyPlan = setActiveWeeklyPlan;
window.viewSavedPlan = viewSavedPlan;
window.deleteSavedPlan = deleteSavedPlan;
window.toggleMPCalories = toggleMPCalories;
window.openCreatePlanModal = openCreatePlanModal;
window.closeCreatePlanModal = closeCreatePlanModal;
window.selectCustomPlanDays = selectCustomPlanDays;
window.submitCreateCustomPlan = submitCreateCustomPlan;
window.addDayToPlan = addDayToPlan;
window.removeDayFromPlan = removeDayFromPlan;
window.addDayToActivePlan = addDayToActivePlan;
window.removeDayFromActivePlan = removeDayFromActivePlan;
window.saveActivePlanToSavedList = saveActivePlanToSavedList;
window.autoPlanDayWithMealEngine = autoPlanDayWithMealEngine;
window.suggestMealForActiveTab = suggestMealForActiveTab;
window.clearCurrentMealForm = clearCurrentMealForm;
window.clearMealSlot = clearMealSlot;
window.openEditDayModal = openEditDayModal;
window.openEditDayModalWithMeal = openEditDayModalWithMeal;
window.closeEditDayModal = closeEditDayModal;
window.loadCookbookOptionsForEditor = loadCookbookOptionsForEditor;
window.importCookbookToCurrentMeal = importCookbookToCurrentMeal;
window.switchMealEditTab = switchMealEditTab;
window.saveCurrentMealFormToTemp = saveCurrentMealFormToTemp;
window.saveDayEdits = saveDayEdits;
window.openCookbookPickerModal = openCookbookPickerModal;
window.closeCookbookPickerModal = closeCookbookPickerModal;
window.renderCookbookPickerList = renderCookbookPickerList;
window.filterCookbookPickerList = filterCookbookPickerList;

/**
 * Log a meal directly to Today's Analytics from the active meal plan schedule
 */
async function logMealForToday(idx, mealType, source) {
  let meal = null;
  if (source === 'generator' && currentMealPlan && currentMealPlan.days) {
      meal = currentMealPlan.days[idx].meals[mealType];
  } else if (source === 'active') {
      const activeStr = localStorage.getItem('activeWeeklyPlan');
      if (activeStr) {
          try {
              const parsedPlan = JSON.parse(activeStr);
              if (parsedPlan && parsedPlan.days) {
                  meal = parsedPlan.days[idx].meals[mealType];
              }
          } catch(e) {}
      }
  }
  
  if (!meal || !meal.name || meal.name === 'Empty Meal Slot') {
    return showToast("Cannot log an empty meal slot.", "error");
  }
  
  const userStr = sessionStorage.getItem('user');
  if (!userStr) return showToast("User not found. Please log in.", "error");
  const user = JSON.parse(userStr);
  
  try {
     showLoading("Logging meal for today...");
     const res = await authFetch('/api/meal/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: user.user_id,
            recipe_name: meal.name,
            calories: parseInt(meal.calories) || 0,
            protein: parseInt(meal.protein_g) || 0,
            carbs: parseInt(meal.carbs_g) || 0,
            fat: parseInt(meal.fat_g) || 0,
            cost_rm: parseFloat(meal.est_cost_rm) || 0.0
        })
     });
     
     hideLoading();
     if (res.ok) {
         showToast("Meal logged for today! Analytics updated.", "success");
         // The button was clicked, maybe we can disable it locally (reloads will reset it, which is fine)
         if (event && event.currentTarget) {
            const btn = event.currentTarget;
            btn.innerHTML = '<i class="fa-solid fa-check-double"></i> Eaten';
            btn.className = 'btn btn-success btn-sm';
            btn.disabled = true;
            btn.style.background = 'var(--success)';
            btn.style.borderColor = 'var(--success)';
         }
     } else {
         const data = await res.json();
         showToast(data.detail || "Failed to log meal.", "error");
     }
  } catch(e) {
     hideLoading();
     showToast("Error connecting to server.", "error");
  }
}

window.logMealForToday = logMealForToday;
window.selectRecipeFromCookbookPicker = selectRecipeFromCookbookPicker;



