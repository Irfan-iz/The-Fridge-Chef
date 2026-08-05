// =============================================
// BMI CATEGORY & STREAK HELPERS
// =============================================
function getBmiCategory(bmi) {
  if (!bmi) return { label: '—', color: 'var(--text-muted)' };
  let cat = 'NORMAL';
  let cColor = 'var(--success)';
  if (bmi < 18.5) { cat = 'UNDERWEIGHT'; cColor = 'var(--info)'; }
  else if (bmi >= 25) { cat = 'OVERWEIGHT'; cColor = 'var(--danger)'; }
  return { 
    label: '<span style="display:inline-block;padding:2px 8px;border-radius:99px;background:' + cColor + '20;color:' + cColor + ';font-size:0.65rem;border:1px solid ' + cColor + '40;">' + cat + '</span>', 
    color: cColor 
  };
}

function getCookingStreak(history) {
  if (!history.length) return 0;
  history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const dates = [...new Set(history.map(h => new Date(h.timestamp).toDateString()))];
  let streak = 0;
  const todayDate = new Date(new Date().toDateString());
  let currentDiff = Math.round((todayDate - new Date(dates[0])) / 86400000);
  if (currentDiff > 1) return 0; 
  for (let i = 0; i < dates.length; i++) {
    const diffDays = Math.round((todayDate - new Date(dates[i])) / 86400000);
    if (diffDays === i + currentDiff) streak++;
    else break;
  }
  return streak;
}

// =============================================
// TDEE CALCULATOR
// =============================================
function calculateTDEE(weight, height, age, gender, activity, goal) {
  let bmr = gender === 'Male'
    ? (10 * weight) + (6.25 * height) - (5 * age) + 5
    : (10 * weight) + (6.25 * height) - (5 * age) - 161;

  const multipliers = {
    'Sedentary (Little to no exercise)': 1.2,
    'Light (Exercise 1-3 times/week)': 1.375,
    'Moderate (Exercise 4-5 times/week)': 1.55,
    'Active (Daily exercise or intense 3-4 times/week)': 1.725,
    'Very Active (Intense exercise 6-7 times/week)': 1.9
  };

  let tdee = bmr * (multipliers[activity] || 1.2);
  if (goal.includes('Deficit') || goal.includes('Loss')) tdee -= 500;
  else if (goal.includes('Surplus') || goal.includes('Gain')) tdee += 500;
  tdee = Math.max(tdee, 1200);

  return {
    calories: Math.round(tdee),
    protein:  Math.round((tdee * 0.30) / 4),
    carbs:    Math.round((tdee * 0.40) / 4),
    fat:      Math.round((tdee * 0.30) / 9)
  };
}

// =============================================
// LOAD PROFILE
// =============================================
async function loadProfile() {
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');

  // --- Biometrics display ---
  document.getElementById('profHeight').textContent   = user.height || '—';
  document.getElementById('profWeight').textContent   = user.weight || '—';
  document.getElementById('profBmi').textContent      = user.bmi    || '—';
  document.getElementById('profAge').textContent      = user.age    || '—';
  document.getElementById('profGoal').textContent     = user.health_goal    || '—';
  document.getElementById('profActivity').textContent = user.activity_level || '—';
  document.getElementById('profGender').textContent   = user.gender || '—';

  // BMI category label
  const bmiCat = getBmiCategory(user.bmi);
  const bmiCatEl = document.getElementById('profBmiCategory');
  if (bmiCatEl) {
    bmiCatEl.innerHTML  = bmiCat.label;
    bmiCatEl.style.color  = bmiCat.color;
  }

  // Allergies
  const allergyEl = document.getElementById('profAllergies');
  if (allergyEl) {
    allergyEl.textContent = (user.allergies && user.allergies.toLowerCase() !== 'none' && user.allergies !== '')
      ? user.allergies : 'None';
  }

  // --- Fill edit form ---
  document.getElementById('editPhone').value    = user.phone_number  || '';
  document.getElementById('editAge').value      = user.age           || 25;
  document.getElementById('editGender').value   = user.gender        || 'Male';
  document.getElementById('editHeight').value   = user.height        || 170;
  document.getElementById('editWeight').value   = user.weight        || 65;
  document.getElementById('editActivity').value = user.activity_level || 'Sedentary (Little to no exercise)';
  document.getElementById('editGoal').value     = user.health_goal   || 'Maintain Current Weight';
  document.getElementById('editAllergies').value = user.allergies    || '';

  // --- TDEE targets ---
  const targets = calculateTDEE(
    user.weight || 65, user.height || 170, user.age || 25,
    user.gender || 'Male',
    user.activity_level || 'Sedentary (Little to no exercise)',
    user.health_goal    || 'Maintain Current Weight'
  );

  const tdeeEl = document.getElementById('tdeeDisplay');
  if (tdeeEl) {
    tdeeEl.textContent = 'Daily Targets — Calories: ' + targets.calories + ' kcal | Protein: ' + targets.protein + 'g | Carbs: ' + targets.carbs + 'g | Fat: ' + targets.fat + 'g';
  }

  // --- Fetch history ---
  try {
    const res  = await authFetch('/api/meal/history/' + user.user_id);
    const data = await res.json();
    const history = data.history || [];

    // Cooking streak
    const streak = getCookingStreak(history);
    const streakEl = document.getElementById('cookingStreak');
    if (streakEl) {
      streakEl.innerHTML = streak > 0
        ? '🔥 <strong>' + streak + '-day</strong> cooking streak!'
        : '🍳 Cook a meal to start your streak!';
    }

    // Today macros
    const today      = new Date().toDateString();
    const todayMeals = history.filter(h => new Date(h.timestamp).toDateString() === today);
    const dailyCal   = todayMeals.reduce((s, h) => s + (h.calories || 0), 0);
    const dailyPro   = todayMeals.reduce((s, h) => s + (h.protein  || 0), 0);
    const dailyCarb  = todayMeals.reduce((s, h) => s + (h.carbs    || 0), 0);
    const dailyFat   = todayMeals.reduce((s, h) => s + (h.fat      || 0), 0);

    // Meal count badge
    const mealCountEl = document.getElementById('todayMealCount');
    if (mealCountEl) {
      mealCountEl.textContent = todayMeals.length > 0
        ? todayMeals.length + ' meal(s) today' : '';
    }

    // Show/hide no-meals state
    const noMealsTodayEl  = document.getElementById('noMealsToday');
    const macroProgressEl = document.getElementById('macroProgress');
    if (todayMeals.length === 0) {
      if (noMealsTodayEl)  noMealsTodayEl.style.display  = 'block';
      if (macroProgressEl) macroProgressEl.style.display = 'none';
    } else {
      if (noMealsTodayEl)  noMealsTodayEl.style.display  = 'none';
      if (macroProgressEl) macroProgressEl.style.display = 'block';
      macroProgressEl.innerHTML =
        renderMacroBar('Calories', dailyCal,  targets.calories, '', '#FF5E3A')  +
        renderMacroBar('Protein',  dailyPro,  targets.protein,  'g', '#3A82FF') +
        renderMacroBar('Carbs',    dailyCarb, targets.carbs,    'g', '#32D74B') +
        renderMacroBar('Fat',      dailyFat,  targets.fat,      'g', '#FFD60A');
    }

    // Recent meals table
    const recentEl = document.getElementById('recentMeals');
    if (!history.length) {
      recentEl.innerHTML = '<div class="empty-state" style="padding:16px 0;"><p>No meals logged yet.</p></div>';
    } else {
      let rows = '';
      history.slice(0, 5).forEach(function(h) {
        const calClass = (h.calories || 0) > targets.calories ? 'cal-over' : 'cal-under';
        rows += '<tr style="transition:background 0.2s;" onmouseover="this.style.background=\'var(--bg-secondary)\'" onmouseout="this.style.background=\'transparent\'">' +
          '<td style="padding:12px 8px;">' +
            '<div style="display:flex;align-items:center;">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" style="margin-right:8px;flex-shrink:0;"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>' +
              '<strong style="font-size:0.9rem;">' + h.recipe_name + '</strong>' +
            '</div>' +
          '</td>' +
          '<td style="padding:12px 8px;" class="' + calClass + '">' + (h.calories || 0) + '</td>' +
          '<td style="padding:12px 8px;font-weight:600;">RM ' + parseFloat(h.cost_rm || 0).toFixed(2) + '</td>' +
          '<td style="padding:12px 8px;font-size:.78rem;color:var(--text-primary);">' + new Date(h.timestamp).toLocaleDateString() + '</td>' +
          '</tr>';
      });
      recentEl.innerHTML =
        '<table class="data-table">' +
        '<thead><tr><th>Recipe</th><th>Cal</th><th>Cost</th><th>Date</th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
        '</table>';
    }

    // --- Load Stats Box ---
    loadUserStats();
  } catch (e) {
    const macroProgressEl = document.getElementById('macroProgress');
    if (macroProgressEl) macroProgressEl.innerHTML = '<p style="color:var(--text-primary);font-size:.85rem;">Could not load today\'s data.</p>';
  }
}

// =============================================
// MACRO BAR RENDERER
// =============================================
function renderMacroBar(label, current, target, unit, customColor) {
  const pct   = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;
  const color = pct >= 100 ? 'var(--danger)' : (customColor || 'var(--accent)');
  return '<div style="margin-bottom:16px;">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;font-size:.85rem;margin-bottom:6px;">' +
      '<span style="font-weight:700;color:var(--text-primary);display:flex;align-items:center;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + color + ';margin-right:6px;box-shadow:0 0 6px ' + color + '80;"></span>' + label + '</span>' +
      '<span style="color:var(--text-primary);font-weight:600;">' + current + unit + ' <span style="font-weight:400;font-size:0.75rem;">/ ' + target + unit + '</span></span>' +
    '</div>' +
    '<div style="height:12px;background:var(--bg-card);border-radius:99px;border:1px solid var(--border);overflow:hidden;position:relative;">' +
      '<div style="height:100%;width:' + pct + '%;background:' + color + ';border-radius:99px;transition:width 1s cubic-bezier(0.4, 0, 0.2, 1);box-shadow:inset 0 2px 4px rgba(255,255,255,0.1);"></div>' +
    '</div>' +
  '</div>';
}

// =============================================
// SAVE PROFILE
// =============================================
async function saveProfile() {
  const user          = JSON.parse(sessionStorage.getItem('user') || '{}');
  const phone_number  = document.getElementById('editPhone').value.trim();
  const age           = parseInt(document.getElementById('editAge').value);
  const gender        = document.getElementById('editGender').value;
  const height        = parseFloat(document.getElementById('editHeight').value);
  const weight        = parseFloat(document.getElementById('editWeight').value);
  const activity_level = document.getElementById('editActivity').value;
  const health_goal   = document.getElementById('editGoal').value;
  const allergies     = document.getElementById('editAllergies').value.trim();

  const btn = document.getElementById('saveProfileBtn');
  btn.disabled    = true;
  btn.textContent = 'Saving...';

  try {
    const res = await authFetch('/api/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user.username, phone_number, age, gender, height, weight, activity_level, health_goal, allergies })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed.');

    // Update sessionStorage
    const updated = Object.assign({}, user, { phone_number, age, gender, height, weight, activity_level, health_goal, allergies, bmi: data.bmi });
    sessionStorage.setItem('user', JSON.stringify(updated));

    // Update sidebar
    document.getElementById('sidebarGoal').textContent     = health_goal;
    document.getElementById('sidebarBmi').textContent      = data.bmi;
    document.getElementById('sidebarActivity').textContent = activity_level.split(' ')[0];

    const healthBadge = document.getElementById('healthBadge');
    if (healthBadge) healthBadge.textContent = 'Goal: ' + health_goal + ' | BMI: ' + data.bmi;

    // Immediately update biometric cards
    document.getElementById('profHeight').textContent   = height;
    document.getElementById('profWeight').textContent   = weight;
    document.getElementById('profBmi').textContent      = data.bmi;
    document.getElementById('profAge').textContent      = age;
    document.getElementById('profGoal').textContent     = health_goal;
    document.getElementById('profActivity').textContent = activity_level;
    document.getElementById('profGender').textContent   = gender;

    const bmiCat   = getBmiCategory(data.bmi);
    const bmiCatEl = document.getElementById('profBmiCategory');
    if (bmiCatEl) { bmiCatEl.innerHTML = bmiCat.label; bmiCatEl.style.color = bmiCat.color; }

    const allergyEl = document.getElementById('profAllergies');
    if (allergyEl) allergyEl.textContent = (allergies && allergies.toLowerCase() !== 'none' && allergies !== '') ? allergies : 'None';

    // Recalculate TDEE
    const newTargets = calculateTDEE(weight, height, age, gender, activity_level, health_goal);
    const tdeeEl     = document.getElementById('tdeeDisplay');
    if (tdeeEl) {
      tdeeEl.textContent = 'Daily Targets — Calories: ' + newTargets.calories + ' kcal | Protein: ' + newTargets.protein + 'g | Carbs: ' + newTargets.carbs + 'g | Fat: ' + newTargets.fat + 'g';
    }

    document.getElementById('profileAlert').innerHTML = '<div class="alert alert-success"><span>✅</span>Profile recalibrated successfully!</div>';
    loadProfile();

  } catch (e) {
    document.getElementById('profileAlert').innerHTML = '<div class="alert alert-error"><span>⚠️</span>' + e.message + '</div>';
  } finally {
    btn.disabled    = false;
    btn.textContent = '💾 Save & Recalibrate';
  }
}// =============================================
// MEAL ANALYTICS
// =============================================
function handleStatsFilterChange() {
  const filter = document.getElementById('statsFilter').value;
  const customWrap = document.getElementById('customFilterWrap');
  if (filter === 'custom') {
    customWrap.style.display = 'block';
    handleCustomFilterTypeChange();
  } else {
    customWrap.style.display = 'none';
    loadUserStats();
  }
}

function handleCustomFilterTypeChange() {
  const type = document.getElementById('customFilterType').value;
  document.getElementById('customDateInput').style.display = type === 'day' ? 'block' : 'none';
  document.getElementById('customWeekInput').style.display = type === 'week' ? 'block' : 'none';
  document.getElementById('customMonthInput').style.display = type === 'month' ? 'block' : 'none';
  loadUserStats();
}

async function loadUserStats() {
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const userId = user.id || user.user_id;
  if (!userId) return;
  
  let startDate = '';
  let endDate = '';
  const filter = document.getElementById('statsFilter').value;
  
  const getLocalDateStr = (dateObj) => {
    return dateObj.getFullYear() + '-' + String(dateObj.getMonth() + 1).padStart(2, '0') + '-' + String(dateObj.getDate()).padStart(2, '0');
  };
  
  if (filter === 'today') {
    const todayStr = getLocalDateStr(new Date());
    startDate = todayStr;
    endDate = todayStr;
  } else if (filter === '7days') {
    const today = new Date();
    const past = new Date(today);
    past.setDate(past.getDate() - 6);
    endDate = getLocalDateStr(today);
    startDate = getLocalDateStr(past);
  } else if (filter === '30days') {
    const today = new Date();
    const past = new Date(today);
    past.setDate(past.getDate() - 29);
    endDate = getLocalDateStr(today);
    startDate = getLocalDateStr(past);
  } else if (filter === 'custom') {
    const type = document.getElementById('customFilterType').value;
    if (type === 'day') {
      const val = document.getElementById('customDateInput').value;
      if (val) { startDate = val; endDate = val; }
    } else if (type === 'week') {
      const val = document.getElementById('customWeekInput').value;
      if (val) {
        // e.g. 2026-W25
        const parts = val.split('-W');
        if (parts.length === 2) {
          const year = parseInt(parts[0]);
          const week = parseInt(parts[1]);
          const simple = new Date(year, 0, 1 + (week - 1) * 7);
          const dow = simple.getDay();
          const ISOweekStart = simple;
          if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
          else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
          
          startDate = getLocalDateStr(ISOweekStart);
        const ISOweekEnd = new Date(ISOweekStart);
        ISOweekEnd.setDate(ISOweekStart.getDate() + 6);
        endDate = getLocalDateStr(ISOweekEnd);
      }
    }
  } else if (type === 'month') {
    const val = document.getElementById('customMonthInput').value;
    if (val) {
      // e.g. 2026-06
      const parts = val.split('-');
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      startDate = getLocalDateStr(firstDay);
      endDate = getLocalDateStr(lastDay);
    }
  }
}

let url = '/api/meal/stats/' + userId;
  if (startDate && endDate) {
    url += '?start_date=' + startDate + '&end_date=' + endDate;
  }
  
  try {
    const res = await authFetch(url);
    const data = await res.json();
    if (data.stats) {
      document.getElementById('statTotalCost').textContent = parseFloat(data.stats.total_cost).toFixed(2);
      document.getElementById('statTotalCalories').textContent = data.stats.total_calories;
    }
  } catch (e) {
    console.error('Error fetching stats:', e);
  }
}
