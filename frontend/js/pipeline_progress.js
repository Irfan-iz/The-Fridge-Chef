/**
 * Real-Time Multi-Step AI Pipeline Progress Engine
 * The Fridge Chef
 *
 * Provides real-time step visualization, timer ticks, and inline pipeline progress.
 */

let pipelineTimerInterval = null;
let pipelineStartTime = 0;
let pipelineStepsList = [];
let pipelineCurrentStep = 0;

/**
 * Starts a full-screen real-time pipeline overlay with sequential step progression.
 */
function startRealtimePipeline(title, steps) {
  pipelineStepsList = steps || [];
  pipelineCurrentStep = 0;
  pipelineStartTime = Date.now();

  const overlay = document.getElementById('loadingOverlay');
  if (!overlay) return;

  // Build the pipeline modal structure
  overlay.innerHTML = `
    <div class="realtime-pipeline-card">
      <div class="pipeline-header">
        <h4 class="pipeline-title"><i class="fa-solid fa-bolt"></i> ${escapeHtml(title)}</h4>
        <span class="pipeline-timer" id="pipelineTimerBadge"><i class="fa-regular fa-clock"></i> 0.0s</span>
      </div>
      <div class="pipeline-step-list" id="pipelineStepContainer">
        ${renderPipelineStepsHtml(pipelineStepsList, 0)}
      </div>
    </div>
  `;

  overlay.classList.add('show');

  // Start real-time elapsed timer
  clearInterval(pipelineTimerInterval);
  pipelineTimerInterval = setInterval(() => {
    const elapsed = ((Date.now() - pipelineStartTime) / 1000).toFixed(1);
    const badge = document.getElementById('pipelineTimerBadge');
    if (badge) badge.innerHTML = `<i class="fa-regular fa-clock"></i> ${elapsed}s`;
  }, 100);
}

/**
 * Advance the pipeline to a specific step index.
 */
function advancePipelineStep(stepIndex) {
  pipelineCurrentStep = stepIndex;
  const container = document.getElementById('pipelineStepContainer');
  if (container) {
    container.innerHTML = renderPipelineStepsHtml(pipelineStepsList, pipelineCurrentStep);
  }
}

/**
 * Finishes and dismisses the real-time pipeline modal.
 */
function finishRealtimePipeline() {
  clearInterval(pipelineTimerInterval);
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.classList.remove('show');
    // Restore default spinner structure for basic loading
    setTimeout(() => {
      overlay.innerHTML = `
        <div class="spinner"></div>
        <p id="loadingText">Processing...</p>
      `;
    }, 300);
  }
}

/**
 * Generates HTML for pipeline steps.
 */
function renderPipelineStepsHtml(steps, activeIndex) {
  return steps.map((step, idx) => {
    let statusClass = '';
    let iconContent = `${idx + 1}`;
    if (idx < activeIndex) {
      statusClass = 'completed';
      iconContent = '<i class="fa-solid fa-check"></i>';
    } else if (idx === activeIndex) {
      statusClass = 'active';
      iconContent = '<i class="fa-solid fa-bolt"></i>';
    }
    return `
      <div class="pipeline-step-item ${statusClass}">
        <div class="pipeline-step-icon">${iconContent}</div>
        <div class="pipeline-step-label">${escapeHtml(step)}</div>
      </div>
    `;
  }).join('');
}

/**
 * Builds an inline animated pipeline skeleton to show inside recipeArea or preview cards.
 */
function buildInlinePipelineSkeleton(title, steps) {
  const stepsHtml = steps.map((step, idx) => `
    <div class="pipeline-step-item ${idx === 0 ? 'active' : ''}" id="inline-step-${idx}">
      <div class="pipeline-step-icon">${idx === 0 ? '<i class="fa-solid fa-bolt"></i>' : idx + 1}</div>
      <div class="pipeline-step-label">${escapeHtml(step)}</div>
    </div>
  `).join('');

  return `
    <div class="inline-pipeline-box">
      <div class="pipeline-header">
        <h4 class="pipeline-title"><i class="fa-solid fa-bolt"></i> ${escapeHtml(title)}</h4>
        <span class="pipeline-timer" id="inlinePipelineTimer"><i class="fa-regular fa-clock"></i> 0.0s</span>
      </div>
      <div class="pipeline-step-list">
        ${stepsHtml}
      </div>
    </div>
  `;
}

/**
 * Starts automatic step pacing for realistic visual feedback during network async operations.
 */
function startPacedStepProgression(stepCount, totalExpectedMs = 3500, onStepUpdate) {
  let step = 0;
  const interval = totalExpectedMs / stepCount;
  const timer = setInterval(() => {
    step++;
    if (step < stepCount) {
      if (onStepUpdate) onStepUpdate(step);
    } else {
      clearInterval(timer);
    }
  }, interval);

  return () => clearInterval(timer);
}

// Helper escape function if not globally defined
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[m]);
}

window.startRealtimePipeline = startRealtimePipeline;
window.advancePipelineStep = advancePipelineStep;
window.finishRealtimePipeline = finishRealtimePipeline;
window.buildInlinePipelineSkeleton = buildInlinePipelineSkeleton;
window.startPacedStepProgression = startPacedStepProgression;

