(function () {
  'use strict';

  /* =========================================================
     Constants / seed data
     ========================================================= */

  var STORAGE_KEY = 'residencyTrackerData_v1';

  var DOMAINS = [
    'Patient Care',
    'Advancing Practice & Improving Patient Care',
    'Leadership & Management',
    'Teaching, Education & Dissemination of Knowledge'
  ];

  var DEFAULT_GOALS = [
    { code: 'R1.1', domain: DOMAINS[0], description: 'Collects and organizes patient information systematically for CCU/critical care cardiology patients.' },
    { code: 'R1.2', domain: DOMAINS[0], description: 'Interprets and analyzes patient information to determine the effects of disease and medication therapy on the patient.' },
    { code: 'R1.3', domain: DOMAINS[0], description: 'Designs or recommends evidence-based therapeutic regimens for CCU patients (e.g. ACS, ADHF, arrhythmia, cardiogenic shock).' },
    { code: 'R1.4', domain: DOMAINS[0], description: 'Designs monitoring plans to assess efficacy and safety of therapy for critically ill cardiac patients.' },
    { code: 'R1.5', domain: DOMAINS[0], description: 'Recommends or provides patient-centered education tailored to cardiac patients and caregivers.' },
    { code: 'R1.6', domain: DOMAINS[0], description: 'Documents direct patient care activities appropriately and in a timely manner.' },
    { code: 'R2.1', domain: DOMAINS[1], description: 'Participates in the design, execution, or evaluation of a quality improvement or medication-use initiative.' },
    { code: 'R2.2', domain: DOMAINS[1], description: 'Demonstrates knowledge of pharmacy practice management (formulary, drug policy) as relevant to critical care cardiology.' },
    { code: 'R2.3', domain: DOMAINS[1], description: 'Utilizes medication-use and quality-improvement processes to enhance patient safety in the CCU.' },
    { code: 'R3.1', domain: DOMAINS[2], description: 'Demonstrates leadership skills within the interprofessional CCU team.' },
    { code: 'R3.2', domain: DOMAINS[2], description: 'Manages time, workload, and competing priorities effectively throughout the rotation.' },
    { code: 'R4.1', domain: DOMAINS[3], description: 'Provides effective medication and practice-related education to patients, caregivers, students, or healthcare professionals.' },
    { code: 'R4.2', domain: DOMAINS[3], description: 'Effectively prepares and delivers topic discussions/presentations.' },
    { code: 'R4.3', domain: DOMAINS[3], description: 'Contributes to the development of other learners (e.g. precepting, mentoring, or training) where applicable.' }
  ];

  var DEFAULT_TOPICS = [
    'Anticoagulation',
    'ADHF & Cardiogenic Shock',
    'PE/VTE',
    'ECG & Antiarrhythmics',
    'Warfarin Case-Based Session'
  ];

  var DIAGNOSIS_CATEGORIES = ['ACS', 'HF / ADHF', 'Arrhythmia', 'Cardiogenic Shock', 'Endocarditis', 'Post-Cardiac Surgery', 'PE/VTE', 'Other'];
  var COMPLEXITY_LEVELS = ['Low', 'Medium', 'High'];
  var ROLES = ['Observed', 'Assisted', 'Led'];
  var EVAL_DOMAINS = DOMAINS;

  var STATUS_LABELS = { 'not-started': 'Not Started', 'in-progress': 'In Progress', 'achieved': 'Achieved' };

  /* =========================================================
     Utilities
     ========================================================= */

  function uid() {
    return 'id_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    var d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function daysBetween(a, b) {
    var msPerDay = 1000 * 60 * 60 * 24;
    return Math.round((b - a) / msPerDay);
  }

  /* =========================================================
     State
     ========================================================= */

  function defaultSettings() {
    return { preceptorName: 'Gail Hopkins', institution: 'RVH PGY1 Pharmacy Residency' };
  }

  function newResident(name, pgyLevel, rotationStart, rotationEnd) {
    return {
      id: uid(),
      name: name || 'New Resident',
      program: 'RVH PGY1',
      pgyLevel: pgyLevel || 'PGY1',
      rotationStart: rotationStart || '',
      rotationEnd: rotationEnd || '',
      goals: DEFAULT_GOALS.map(function (g) {
        return { id: uid(), code: g.code, domain: g.domain, description: g.description, status: 'not-started', evidenceNotes: '', dateAchieved: '' };
      }),
      topics: DEFAULT_TOPICS.map(function (t) {
        return { id: uid(), title: t, dateCompleted: '', selfScore: '', preceptorScore: '', notes: '' };
      }),
      cases: [],
      evaluations: []
    };
  }

  function loadState() {
    var raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.residents) {
          if (!parsed.settings) parsed.settings = defaultSettings();
          return parsed;
        }
      } catch (e) { /* fall through to default */ }
    }
    var first = newResident('New Resident');
    return { residents: [first], activeResidentId: first.id, settings: defaultSettings() };
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }

  var state = loadState();
  var currentView = 'dashboard';

  function getActiveResident() {
    var r = null;
    for (var i = 0; i < state.residents.length; i++) {
      if (state.residents[i].id === state.activeResidentId) { r = state.residents[i]; break; }
    }
    return r || state.residents[0] || null;
  }

  /* =========================================================
     Modal helper
     ========================================================= */

  var modalOverlay = document.getElementById('modal-overlay');
  var modalBody = document.getElementById('modal-body');
  document.getElementById('modal-close').addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', function (e) { if (e.target === modalOverlay) closeModal(); });

  function openModal(html) {
    modalBody.innerHTML = html;
    modalOverlay.classList.add('open');
  }
  function closeModal() {
    modalOverlay.classList.remove('open');
    modalBody.innerHTML = '';
  }

  /* =========================================================
     Rendering: header / nav / resident switcher
     ========================================================= */

  var navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      currentView = btn.getAttribute('data-view');
      navButtons.forEach(function (b) { b.classList.toggle('active', b === btn); });
      renderView();
    });
  });

  var residentSelect = document.getElementById('resident-select');
  residentSelect.addEventListener('change', function () {
    state.activeResidentId = residentSelect.value;
    saveState();
    renderView();
  });
  document.getElementById('btn-new-resident').addEventListener('click', openNewResidentModal);

  function renderResidentSwitcher() {
    residentSelect.innerHTML = state.residents.map(function (r) {
      return '<option value="' + r.id + '">' + escapeHtml(r.name) + ' (' + escapeHtml(r.pgyLevel) + ')</option>';
    }).join('');
    if (getActiveResident()) residentSelect.value = getActiveResident().id;
  }

  function openNewResidentModal() {
    openModal(
      '<h3>New Resident</h3>' +
      '<form id="form-new-resident">' +
      '<div class="form-grid">' +
        field('text', 'name', 'Resident Name', '', true) +
        field('text', 'pgyLevel', 'PGY Level', 'PGY1', false) +
        field('date', 'rotationStart', 'Rotation Start', '', false) +
        field('date', 'rotationEnd', 'Rotation End', '', false) +
      '</div>' +
      '<div class="form-actions">' +
        '<button type="submit" class="btn btn-teal">Add Resident</button>' +
        '<button type="button" class="btn" id="cancel-new-resident">Cancel</button>' +
      '</div>' +
      '</form>'
    );
    document.getElementById('cancel-new-resident').addEventListener('click', closeModal);
    document.getElementById('form-new-resident').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var name = (fd.get('name') || '').toString().trim();
      if (!name) return;
      var r = newResident(name, (fd.get('pgyLevel') || 'PGY1').toString(), fd.get('rotationStart'), fd.get('rotationEnd'));
      state.residents.push(r);
      state.activeResidentId = r.id;
      saveState();
      closeModal();
      renderResidentSwitcher();
      renderView();
    });
  }

  function field(type, name, label, value, required, extra) {
    extra = extra || '';
    return '<div class="field"><label for="f-' + name + '">' + escapeHtml(label) + '</label>' +
      '<input type="' + type + '" id="f-' + name + '" name="' + name + '" value="' + escapeHtml(value) + '" ' + (required ? 'required' : '') + ' ' + extra + '></div>';
  }
  function selectField(name, label, options, value, required) {
    var opts = options.map(function (o) {
      var v = typeof o === 'string' ? o : o.value;
      var l = typeof o === 'string' ? o : o.label;
      return '<option value="' + escapeHtml(v) + '"' + (v === value ? ' selected' : '') + '>' + escapeHtml(l) + '</option>';
    }).join('');
    return '<div class="field"><label for="f-' + name + '">' + escapeHtml(label) + '</label>' +
      '<select id="f-' + name + '" name="' + name + '" ' + (required ? 'required' : '') + '>' + opts + '</select></div>';
  }
  function textareaField(name, label, value) {
    return '<div class="field field-full"><label for="f-' + name + '">' + escapeHtml(label) + '</label>' +
      '<textarea id="f-' + name + '" name="' + name + '">' + escapeHtml(value) + '</textarea></div>';
  }

  /* =========================================================
     Main view dispatcher
     ========================================================= */

  var appRoot = document.getElementById('app-root');

  function renderView() {
    renderResidentSwitcher();
    var resident = getActiveResident();
    if (!resident) {
      appRoot.innerHTML = '<div class="empty-state"><h3>No resident yet</h3><p>Add a resident to get started.</p></div>';
      return;
    }
    switch (currentView) {
      case 'dashboard': renderDashboard(resident); break;
      case 'goals': renderGoals(resident); break;
      case 'topics': renderTopics(resident); break;
      case 'cases': renderCases(resident); break;
      case 'evaluations': renderEvaluations(resident); break;
      case 'export': renderExport(resident); break;
      case 'settings': renderSettings(resident); break;
      default: renderDashboard(resident);
    }
  }

  /* =========================================================
     Dashboard
     ========================================================= */

  function computeHeatmap(cases) {
    var grid = {};
    DIAGNOSIS_CATEGORIES.forEach(function (cat) {
      grid[cat] = {};
      COMPLEXITY_LEVELS.forEach(function (lvl) { grid[cat][lvl] = 0; });
    });
    cases.forEach(function (c) {
      if (grid[c.diagnosisCategory] && grid[c.diagnosisCategory][c.complexity] !== undefined) {
        grid[c.diagnosisCategory][c.complexity]++;
      }
    });
    var max = 1;
    Object.keys(grid).forEach(function (cat) {
      COMPLEXITY_LEVELS.forEach(function (lvl) { if (grid[cat][lvl] > max) max = grid[cat][lvl]; });
    });
    return { grid: grid, max: max };
  }

  function heatCellStyle(count, max) {
    if (count === 0) return '';
    var alpha = 0.15 + 0.65 * (count / max);
    return ' style="background: rgba(0,212,170,' + alpha.toFixed(2) + ');"';
  }

  function renderHeatmapTable(cases) {
    var hm = computeHeatmap(cases);
    var rows = DIAGNOSIS_CATEGORIES.map(function (cat) {
      var cells = COMPLEXITY_LEVELS.map(function (lvl) {
        var count = hm.grid[cat][lvl];
        return '<td class="heatmap-cell"' + heatCellStyle(count, hm.max) + '>' + (count || '') + '</td>';
      }).join('');
      return '<tr><td class="cat-label">' + escapeHtml(cat) + '</td>' + cells + '</tr>';
    }).join('');
    return '<table class="heatmap-table"><thead><tr><th>Diagnosis Category</th>' +
      COMPLEXITY_LEVELS.map(function (l) { return '<th>' + l + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function renderDashboard(resident) {
    var goals = resident.goals;
    var achieved = goals.filter(function (g) { return g.status === 'achieved'; }).length;
    var goalsPct = goals.length ? Math.round((achieved / goals.length) * 100) : 0;

    var topics = resident.topics;
    var topicsCompleted = topics.filter(function (t) { return !!t.dateCompleted; }).length;
    var topicsPct = topics.length ? Math.round((topicsCompleted / topics.length) * 100) : 0;

    var daysRemaining = null;
    if (resident.rotationEnd) {
      var today = new Date(); today.setHours(0, 0, 0, 0);
      var end = new Date(resident.rotationEnd + 'T00:00:00');
      daysRemaining = daysBetween(today, end);
    }

    var casesCount = resident.cases.length;

    var recentCases = resident.cases.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); }).slice(0, 5);
    var recentTopics = topics.filter(function (t) { return t.dateCompleted; }).sort(function (a, b) { return b.dateCompleted.localeCompare(a.dateCompleted); }).slice(0, 5);

    appRoot.innerHTML =
      '<div class="view-heading"><h2>' + escapeHtml(resident.name) + '</h2>' +
      '<p>' + escapeHtml(resident.program) + ' · ' + escapeHtml(resident.pgyLevel) +
      (resident.rotationStart || resident.rotationEnd ? ' · ' + formatDate(resident.rotationStart) + ' – ' + formatDate(resident.rotationEnd) : '') +
      '</p></div>' +

      '<div class="stat-grid">' +
        '<div class="stat-tile"><div class="stat-label">Goals Achieved</div><div class="stat-value">' + goalsPct + '%</div>' +
          '<div class="stat-sub">' + achieved + ' of ' + goals.length + ' objectives</div>' +
          '<div class="progress-bar"><span style="width:' + goalsPct + '%"></span></div></div>' +
        '<div class="stat-tile"><div class="stat-label">Topic Discussions</div><div class="stat-value">' + topicsCompleted + ' / ' + topics.length + '</div>' +
          '<div class="stat-sub">' + topicsPct + '% completed</div>' +
          '<div class="progress-bar"><span style="width:' + topicsPct + '%"></span></div></div>' +
        '<div class="stat-tile"><div class="stat-label">Case Exposures</div><div class="stat-value">' + casesCount + '</div>' +
          '<div class="stat-sub">logged this rotation</div></div>' +
        '<div class="stat-tile"><div class="stat-label">Days Remaining</div><div class="stat-value">' + (daysRemaining === null ? '—' : daysRemaining) + '</div>' +
          '<div class="stat-sub">' + (resident.rotationEnd ? 'ends ' + formatDate(resident.rotationEnd) : 'set rotation dates in Settings') + '</div></div>' +
      '</div>' +

      '<div class="dash-section"><h3>Case Exposure Heat Map</h3><div class="card">' +
        (resident.cases.length ? renderHeatmapTable(resident.cases) : '<p style="color:var(--text-dim)">No cases logged yet. Add entries in Case Log.</p>') +
      '</div></div>' +

      '<div class="panel-row" style="grid-template-columns: 1fr 1fr;">' +
        '<div class="dash-section"><h3>Recent Case Exposures</h3><div class="card">' +
          (recentCases.length ? recentCases.map(function (c) {
            return '<p style="margin-bottom:.5rem;"><strong>' + formatDate(c.date) + '</strong> — ' + escapeHtml(c.diagnosisCategory) + ' (' + escapeHtml(c.complexity) + ', ' + escapeHtml(c.role) + ')</p>';
          }).join('') : '<p style="color:var(--text-dim)">No cases yet.</p>') +
        '</div></div>' +
        '<div class="dash-section"><h3>Recently Completed Topics</h3><div class="card">' +
          (recentTopics.length ? recentTopics.map(function (t) {
            return '<p style="margin-bottom:.5rem;"><strong>' + formatDate(t.dateCompleted) + '</strong> — ' + escapeHtml(t.title) + '</p>';
          }).join('') : '<p style="color:var(--text-dim)">No topic discussions completed yet.</p>') +
        '</div></div>' +
      '</div>';

    appRoot.querySelector('.panel-row').style.display = 'grid';
    appRoot.querySelector('.panel-row').style.gap = '1rem';
  }

  /* =========================================================
     Goals & Objectives (kanban)
     ========================================================= */

  var goalsFilterDomain = 'all';

  function renderGoals(resident) {
    var filtered = resident.goals.filter(function (g) { return goalsFilterDomain === 'all' || g.domain === goalsFilterDomain; });
    var cols = ['not-started', 'in-progress', 'achieved'];

    appRoot.innerHTML =
      '<div class="view-heading"><h2>Goals &amp; Objectives</h2><p>ACCP/PGY1-aligned goals, adapted for the critical care cardiology rotation.</p></div>' +
      '<div class="filter-row">' +
        '<select id="goal-domain-filter"><option value="all">All Domains</option>' +
        DOMAINS.map(function (d) { return '<option value="' + escapeHtml(d) + '"' + (d === goalsFilterDomain ? ' selected' : '') + '>' + escapeHtml(d) + '</option>'; }).join('') +
        '</select>' +
      '</div>' +
      '<div class="kanban">' +
        cols.map(function (status) {
          var items = filtered.filter(function (g) { return g.status === status; });
          return '<div class="kanban-col"><h4>' + STATUS_LABELS[status] + ' <span>' + items.length + '</span></h4>' +
            items.map(function (g) { return renderGoalCard(g); }).join('') +
            (items.length === 0 ? '<p style="color:var(--text-mute); font-size:.8rem;">None</p>' : '') +
            '</div>';
        }).join('') +
      '</div>';

    document.getElementById('goal-domain-filter').addEventListener('change', function (e) {
      goalsFilterDomain = e.target.value;
      renderGoals(resident);
    });

    appRoot.querySelectorAll('.goal-card').forEach(function (card) {
      card.addEventListener('click', function () { openGoalModal(resident, card.getAttribute('data-id')); });
    });
  }

  function renderGoalCard(g) {
    return '<div class="goal-card status-' + g.status + '" data-id="' + g.id + '">' +
      '<div class="goal-code">' + escapeHtml(g.code) + '</div>' +
      '<div class="goal-domain">' + escapeHtml(g.domain) + '</div>' +
      '<div class="goal-desc">' + escapeHtml(g.description) + '</div>' +
      '</div>';
  }

  function openGoalModal(resident, goalId) {
    var goal = resident.goals.filter(function (g) { return g.id === goalId; })[0];
    if (!goal) return;
    openModal(
      '<h3>' + escapeHtml(goal.code) + ' — ' + escapeHtml(goal.domain) + '</h3>' +
      '<p style="color:var(--text-dim); margin-bottom:1rem;">' + escapeHtml(goal.description) + '</p>' +
      '<form id="form-goal">' +
      '<div class="form-grid">' +
        selectField('status', 'Status', [
          { value: 'not-started', label: 'Not Started' },
          { value: 'in-progress', label: 'In Progress' },
          { value: 'achieved', label: 'Achieved' }
        ], goal.status, true) +
        field('date', 'dateAchieved', 'Date Achieved', goal.dateAchieved, false) +
        textareaField('evidenceNotes', 'Evidence Notes', goal.evidenceNotes) +
      '</div>' +
      '<div class="form-actions">' +
        '<button type="submit" class="btn btn-teal">Save</button>' +
        '<button type="button" class="btn" id="cancel-goal">Cancel</button>' +
      '</div>' +
      '</form>'
    );
    document.getElementById('cancel-goal').addEventListener('click', closeModal);
    document.getElementById('form-goal').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      goal.status = fd.get('status');
      goal.dateAchieved = fd.get('dateAchieved') || '';
      goal.evidenceNotes = (fd.get('evidenceNotes') || '').toString();
      if (goal.status === 'achieved' && !goal.dateAchieved) {
        goal.dateAchieved = new Date().toISOString().slice(0, 10);
      }
      saveState();
      closeModal();
      renderGoals(resident);
    });
  }

  /* =========================================================
     Topic Discussions
     ========================================================= */

  function renderTopics(resident) {
    var rows = resident.topics.slice().sort(function (a, b) {
      return (b.dateCompleted || '').localeCompare(a.dateCompleted || '');
    }).map(function (t) {
      return '<tr>' +
        '<td>' + escapeHtml(t.title) + '</td>' +
        '<td>' + (t.dateCompleted ? formatDate(t.dateCompleted) : '<span class="badge badge-mute">Not yet</span>') + '</td>' +
        '<td>' + (t.selfScore !== '' && t.selfScore !== undefined ? escapeHtml(t.selfScore) : '—') + '</td>' +
        '<td>' + (t.preceptorScore !== '' && t.preceptorScore !== undefined ? escapeHtml(t.preceptorScore) : '—') + '</td>' +
        '<td>' + escapeHtml(t.notes || '') + '</td>' +
        '<td><button class="btn btn-sm edit-topic" data-id="' + t.id + '">Edit</button> ' +
          '<button class="btn btn-sm btn-danger delete-topic" data-id="' + t.id + '">Delete</button></td>' +
        '</tr>';
    }).join('');

    appRoot.innerHTML =
      '<div class="view-heading"><h2>Topic Discussion Log</h2><p>Pulled from your existing package library; add custom topics as needed.</p></div>' +
      '<div class="form-actions" style="margin-bottom:1rem;"><button id="btn-add-topic" class="btn btn-teal">+ Add Topic Discussion</button></div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>Title</th><th>Date Completed</th><th>Self Score</th><th>Preceptor Score</th><th>Notes</th><th>Actions</th></tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="6" style="color:var(--text-dim)">No topic discussions yet.</td></tr>') + '</tbody></table></div>';

    document.getElementById('btn-add-topic').addEventListener('click', function () { openTopicModal(resident, null); });
    appRoot.querySelectorAll('.edit-topic').forEach(function (btn) {
      btn.addEventListener('click', function () { openTopicModal(resident, btn.getAttribute('data-id')); });
    });
    appRoot.querySelectorAll('.delete-topic').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        if (!confirm('Delete this topic discussion entry?')) return;
        resident.topics = resident.topics.filter(function (t) { return t.id !== id; });
        saveState();
        renderTopics(resident);
      });
    });
  }

  function openTopicModal(resident, topicId) {
    var topic = topicId ? resident.topics.filter(function (t) { return t.id === topicId; })[0] : null;
    var isNew = !topic;
    if (isNew) topic = { id: uid(), title: '', dateCompleted: '', selfScore: '', preceptorScore: '', notes: '' };

    openModal(
      '<h3>' + (isNew ? 'Add' : 'Edit') + ' Topic Discussion</h3>' +
      '<form id="form-topic">' +
      '<div class="form-grid">' +
        field('text', 'title', 'Title', topic.title, true) +
        field('date', 'dateCompleted', 'Date Completed', topic.dateCompleted, false) +
        field('number', 'selfScore', 'Self-Assessment Score (1–5)', topic.selfScore, false, 'min="1" max="5" step="0.5"') +
        field('number', 'preceptorScore', 'Preceptor Score (1–5)', topic.preceptorScore, false, 'min="1" max="5" step="0.5"') +
        textareaField('notes', 'Notes / Feedback', topic.notes) +
      '</div>' +
      '<div class="form-actions">' +
        '<button type="submit" class="btn btn-teal">Save</button>' +
        '<button type="button" class="btn" id="cancel-topic">Cancel</button>' +
      '</div>' +
      '</form>'
    );
    document.getElementById('cancel-topic').addEventListener('click', closeModal);
    document.getElementById('form-topic').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      topic.title = (fd.get('title') || '').toString().trim();
      topic.dateCompleted = fd.get('dateCompleted') || '';
      topic.selfScore = fd.get('selfScore') || '';
      topic.preceptorScore = fd.get('preceptorScore') || '';
      topic.notes = (fd.get('notes') || '').toString();
      if (!topic.title) return;
      if (isNew) resident.topics.push(topic);
      saveState();
      closeModal();
      renderTopics(resident);
    });
  }

  /* =========================================================
     Case Log
     ========================================================= */

  function renderCases(resident) {
    var sorted = resident.cases.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    var rows = sorted.map(function (c) {
      return '<tr>' +
        '<td>' + formatDate(c.date) + '</td>' +
        '<td>' + escapeHtml(c.diagnosisCategory) + '</td>' +
        '<td>' + escapeHtml(c.complexity) + '</td>' +
        '<td>' + escapeHtml(c.role) + '</td>' +
        '<td>' + escapeHtml(c.docTemplate || '—') + '</td>' +
        '<td>' + escapeHtml(c.notes || '') + '</td>' +
        '<td><button class="btn btn-sm btn-danger delete-case" data-id="' + c.id + '">Delete</button></td>' +
        '</tr>';
    }).join('');

    appRoot.innerHTML =
      '<div class="view-heading"><h2>Case Log</h2><p>Quick-entry case exposures build the dashboard heat map automatically.</p></div>' +
      '<div class="card" style="margin-bottom:1.5rem;">' +
        '<form id="form-case">' +
        '<div class="form-grid">' +
          field('date', 'date', 'Date', new Date().toISOString().slice(0, 10), true) +
          selectField('diagnosisCategory', 'Diagnosis Category', DIAGNOSIS_CATEGORIES, DIAGNOSIS_CATEGORIES[0], true) +
          selectField('complexity', 'Clinical Complexity', COMPLEXITY_LEVELS, 'Medium', true) +
          selectField('role', "Resident's Role", ROLES, 'Assisted', true) +
          field('text', 'docTemplate', 'Documentation Template Used', '', false) +
          textareaField('notes', 'Notes', '') +
        '</div>' +
        '<div class="form-actions"><button type="submit" class="btn btn-teal">Add Case</button></div>' +
        '</form>' +
      '</div>' +
      '<div class="dash-section"><h3>Exposure Heat Map</h3><div class="card">' +
        (resident.cases.length ? renderHeatmapTable(resident.cases) : '<p style="color:var(--text-dim)">No cases logged yet.</p>') +
      '</div></div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Category</th><th>Complexity</th><th>Role</th><th>Template</th><th>Notes</th><th></th></tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="7" style="color:var(--text-dim)">No cases yet.</td></tr>') + '</tbody></table></div>';

    document.getElementById('form-case').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      resident.cases.push({
        id: uid(),
        date: fd.get('date'),
        diagnosisCategory: fd.get('diagnosisCategory'),
        complexity: fd.get('complexity'),
        role: fd.get('role'),
        docTemplate: (fd.get('docTemplate') || '').toString(),
        notes: (fd.get('notes') || '').toString()
      });
      saveState();
      renderCases(resident);
    });

    appRoot.querySelectorAll('.delete-case').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        if (!confirm('Delete this case entry?')) return;
        resident.cases = resident.cases.filter(function (c) { return c.id !== id; });
        saveState();
        renderCases(resident);
      });
    });
  }

  /* =========================================================
     Evaluations
     ========================================================= */

  function renderEvaluations(resident) {
    var sorted = resident.evaluations.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    var cards = sorted.map(function (ev) {
      var domainRows = EVAL_DOMAINS.map(function (d) {
        return '<tr><td>' + escapeHtml(d) + '</td><td>' + (ev.scores[d] || '—') + ' / 5</td></tr>';
      }).join('');
      return '<div class="card" style="margin-bottom:1rem;">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:.75rem;">' +
        '<div><span class="badge ' + (ev.type === 'final' ? 'badge-green' : 'badge-amber') + '">' + (ev.type === 'final' ? 'Final' : 'Midpoint') + '</span> ' +
        '<strong style="margin-left:.5rem;">' + formatDate(ev.date) + '</strong></div>' +
        '<div><button class="btn btn-sm btn-danger delete-eval" data-id="' + ev.id + '">Delete</button></div></div>' +
        '<table class="data-table" style="margin-bottom:.75rem;"><tbody>' + domainRows + '</tbody></table>' +
        '<p style="color:var(--text-dim); font-size:.85rem; white-space:pre-wrap;">' + escapeHtml(ev.narrative || '') + '</p>' +
        '<p style="margin-top:.5rem; font-size:.78rem; color:var(--text-mute);">' + (ev.signed ? 'Signed &amp; dated ' + formatDate(ev.date) : 'Not yet signed') + '</p>' +
        '</div>';
    }).join('');

    appRoot.innerHTML =
      '<div class="view-heading"><h2>Evaluations</h2><p>Midpoint and final rubric evaluations for ' + escapeHtml(resident.name) + '.</p></div>' +
      '<div class="form-actions" style="margin-bottom:1rem;"><button id="btn-add-eval" class="btn btn-teal">+ New Evaluation</button></div>' +
      (cards || '<div class="empty-state">No evaluations recorded yet.</div>');

    document.getElementById('btn-add-eval').addEventListener('click', function () { openEvalModal(resident); });
    appRoot.querySelectorAll('.delete-eval').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        if (!confirm('Delete this evaluation?')) return;
        resident.evaluations = resident.evaluations.filter(function (e) { return e.id !== id; });
        saveState();
        renderEvaluations(resident);
      });
    });
  }

  function openEvalModal(resident) {
    openModal(
      '<h3>New Evaluation</h3>' +
      '<form id="form-eval">' +
      '<div class="form-grid">' +
        selectField('type', 'Type', [{ value: 'midpoint', label: 'Midpoint' }, { value: 'final', label: 'Final' }], 'midpoint', true) +
        field('date', 'date', 'Date', new Date().toISOString().slice(0, 10), true) +
        EVAL_DOMAINS.map(function (d, i) {
          return field('number', 'domain_' + i, d + ' (1–5)', '', false, 'min="1" max="5" step="0.5"');
        }).join('') +
        textareaField('narrative', 'Narrative Feedback', '') +
        '<div class="field"><label><input type="checkbox" name="signed" style="width:auto; min-height:auto; margin-right:.4rem;">Signed &amp; dated</label></div>' +
      '</div>' +
      '<div class="form-actions">' +
        '<button type="submit" class="btn btn-teal">Save Evaluation</button>' +
        '<button type="button" class="btn" id="cancel-eval">Cancel</button>' +
      '</div>' +
      '</form>'
    );
    document.getElementById('cancel-eval').addEventListener('click', closeModal);
    document.getElementById('form-eval').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var scores = {};
      EVAL_DOMAINS.forEach(function (d, i) { scores[d] = fd.get('domain_' + i) || ''; });
      resident.evaluations.push({
        id: uid(),
        type: fd.get('type'),
        date: fd.get('date'),
        scores: scores,
        narrative: (fd.get('narrative') || '').toString(),
        signed: fd.get('signed') === 'on'
      });
      saveState();
      closeModal();
      renderEvaluations(resident);
    });
  }

  /* =========================================================
     Export Report (Word / PDF)
     ========================================================= */

  function buildReportHtml(resident) {
    var goals = resident.goals;
    var achieved = goals.filter(function (g) { return g.status === 'achieved'; }).length;
    var inProgress = goals.filter(function (g) { return g.status === 'in-progress'; }).length;
    var topicsCompleted = resident.topics.filter(function (t) { return t.dateCompleted; }).length;

    var goalsRows = goals.map(function (g) {
      return '<tr><td class="label-cell">' + escapeHtml(g.code) + '</td><td>' + escapeHtml(g.domain) + '</td>' +
        '<td>' + escapeHtml(g.description) + '</td><td>' + STATUS_LABELS[g.status] + '</td><td>' + formatDate(g.dateAchieved) + '</td></tr>';
    }).join('');

    var topicsRows = resident.topics.map(function (t) {
      return '<tr><td class="label-cell">' + escapeHtml(t.title) + '</td><td>' + (t.dateCompleted ? formatDate(t.dateCompleted) : 'Not yet') + '</td>' +
        '<td>' + escapeHtml(t.selfScore || '—') + '</td><td>' + escapeHtml(t.preceptorScore || '—') + '</td></tr>';
    }).join('');

    var casesRows = resident.cases.slice().sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); }).map(function (c) {
      return '<tr><td>' + formatDate(c.date) + '</td><td>' + escapeHtml(c.diagnosisCategory) + '</td><td>' + escapeHtml(c.complexity) + '</td><td>' + escapeHtml(c.role) + '</td></tr>';
    }).join('');

    var evalRows = resident.evaluations.map(function (ev) {
      var scoreStr = EVAL_DOMAINS.map(function (d) { return d + ': ' + (ev.scores[d] || '—') + '/5'; }).join(' · ');
      return '<tr><td class="label-cell">' + (ev.type === 'final' ? 'Final' : 'Midpoint') + '</td><td>' + formatDate(ev.date) + '</td><td>' + escapeHtml(scoreStr) + '</td></tr>';
    }).join('');

    var preceptorName = state.settings.preceptorName || 'Preceptor';
    var institution = state.settings.institution || '';
    var generatedDate = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

    return '' +
      '<h2>End-of-Rotation Summary — ' + escapeHtml(resident.name) + '</h2>' +
      '<table><tbody>' +
      '<tr><td class="label-cell" style="width:35%;">Program</td><td>' + escapeHtml(resident.program) + ' (' + escapeHtml(resident.pgyLevel) + ')</td></tr>' +
      '<tr><td class="label-cell">Rotation</td><td>Critical Care Cardiology — ' + formatDate(resident.rotationStart) + ' to ' + formatDate(resident.rotationEnd) + '</td></tr>' +
      '<tr><td class="label-cell">Preceptor</td><td>' + escapeHtml(preceptorName) + '</td></tr>' +
      '<tr><td class="label-cell">Goals Achieved</td><td>' + achieved + ' of ' + goals.length + ' (' + inProgress + ' in progress)</td></tr>' +
      '<tr><td class="label-cell">Topic Discussions Completed</td><td>' + topicsCompleted + ' of ' + resident.topics.length + '</td></tr>' +
      '<tr><td class="label-cell">Case Exposures Logged</td><td>' + resident.cases.length + '</td></tr>' +
      '</tbody></table>' +

      '<h3>Goals &amp; Objectives</h3>' +
      '<table><thead><tr><th>Code</th><th>Domain</th><th>Description</th><th>Status</th><th>Date Achieved</th></tr></thead><tbody>' + goalsRows + '</tbody></table>' +

      '<h3>Topic Discussions</h3>' +
      '<table><thead><tr><th>Title</th><th>Date Completed</th><th>Self Score</th><th>Preceptor Score</th></tr></thead><tbody>' + topicsRows + '</tbody></table>' +

      '<h3>Case Exposure Log</h3>' +
      '<table><thead><tr><th>Date</th><th>Category</th><th>Complexity</th><th>Role</th></tr></thead><tbody>' + (casesRows || '<tr><td colspan="4">No cases logged.</td></tr>') + '</tbody></table>' +

      '<h3>Evaluations</h3>' +
      '<table><thead><tr><th>Type</th><th>Date</th><th>Domain Scores</th></tr></thead><tbody>' + (evalRows || '<tr><td colspan="3">No evaluations recorded.</td></tr>') + '</tbody></table>' +

      '<div class="export-footer">Prepared by ' + escapeHtml(preceptorName) + (institution ? ' · ' + escapeHtml(institution) : '') + ' · Generated ' + generatedDate + '</div>';
  }

  function renderExport(resident) {
    appRoot.innerHTML =
      '<div class="view-heading no-print"><h2>Export Report</h2><p>End-of-rotation summary in house style — export as Word (.doc) or print to PDF.</p></div>' +
      '<div class="form-actions no-print" style="margin-bottom:1rem;">' +
        '<button id="btn-export-word" class="btn btn-teal">Export Word (.doc)</button>' +
        '<button id="btn-export-pdf" class="btn">Print / Save as PDF</button>' +
      '</div>' +
      '<div class="export-preview" id="export-preview">' + buildReportHtml(resident) + '</div>';

    document.getElementById('btn-export-pdf').addEventListener('click', function () { window.print(); });
    document.getElementById('btn-export-word').addEventListener('click', function () { exportWord(resident); });
  }

  function exportWord(resident) {
    var reportHtml = buildReportHtml(resident);
    var doc = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
      '<head><meta charset="utf-8"><title>' + escapeHtml(resident.name) + ' - Rotation Summary</title>' +
      '<style>' +
      'body{font-family:Arial,sans-serif;color:#1a1a1a;} ' +
      'h2{color:#1f3864;border-bottom:2px solid #1f3864;padding-bottom:4px;} ' +
      'h3{color:#1f3864;margin-top:18px;} ' +
      'table{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:13px;} ' +
      'th{background:#1f3864;color:#ffffff;padding:6px 8px;text-align:left;} ' +
      'td{padding:6px 8px;border:1px solid #cdd8e6;} ' +
      'td.label-cell{background:#dce6f2;font-weight:bold;} ' +
      '.export-footer{margin-top:20px;font-size:11px;color:#55627a;border-top:1px solid #cdd8e6;padding-top:8px;}' +
      '</style></head><body>' + reportHtml + '</body></html>';

    var blob = new Blob(['﻿', doc], { type: 'application/msword' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = resident.name.replace(/[^a-z0-9]+/gi, '_') + '_Rotation_Summary.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* =========================================================
     Settings
     ========================================================= */

  function renderSettings(resident) {
    appRoot.innerHTML =
      '<div class="view-heading"><h2>Settings</h2><p>Preceptor details and resident record management.</p></div>' +

      '<div class="card" style="margin-bottom:1.5rem;">' +
        '<h3 style="margin-bottom:1rem;">Report Details</h3>' +
        '<form id="form-settings"><div class="form-grid">' +
          field('text', 'preceptorName', 'Preceptor Name', state.settings.preceptorName, true) +
          field('text', 'institution', 'Institution / Program Label', state.settings.institution, false) +
        '</div><div class="form-actions"><button type="submit" class="btn btn-teal">Save</button></div></form>' +
      '</div>' +

      '<div class="card">' +
        '<h3 style="margin-bottom:1rem;">Resident Record — ' + escapeHtml(resident.name) + '</h3>' +
        '<form id="form-resident"><div class="form-grid">' +
          field('text', 'name', 'Name', resident.name, true) +
          field('text', 'pgyLevel', 'PGY Level', resident.pgyLevel, false) +
          field('date', 'rotationStart', 'Rotation Start', resident.rotationStart, false) +
          field('date', 'rotationEnd', 'Rotation End', resident.rotationEnd, false) +
        '</div><div class="form-actions">' +
          '<button type="submit" class="btn btn-teal">Save Resident</button>' +
          (state.residents.length > 1 ? '<button type="button" id="btn-delete-resident" class="btn btn-danger">Delete Resident</button>' : '') +
        '</div></form>' +
      '</div>';

    document.getElementById('form-settings').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      state.settings.preceptorName = (fd.get('preceptorName') || '').toString().trim() || 'Preceptor';
      state.settings.institution = (fd.get('institution') || '').toString().trim();
      saveState();
      renderSettings(resident);
    });

    document.getElementById('form-resident').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      resident.name = (fd.get('name') || '').toString().trim() || resident.name;
      resident.pgyLevel = (fd.get('pgyLevel') || '').toString().trim() || resident.pgyLevel;
      resident.rotationStart = fd.get('rotationStart') || '';
      resident.rotationEnd = fd.get('rotationEnd') || '';
      saveState();
      renderResidentSwitcher();
      renderSettings(resident);
    });

    var delBtn = document.getElementById('btn-delete-resident');
    if (delBtn) {
      delBtn.addEventListener('click', function () {
        if (!confirm('Delete ' + resident.name + ' and all associated data? This cannot be undone.')) return;
        state.residents = state.residents.filter(function (r) { return r.id !== resident.id; });
        state.activeResidentId = state.residents.length ? state.residents[0].id : null;
        saveState();
        renderResidentSwitcher();
        renderView();
      });
    }
  }

  /* =========================================================
     Init
     ========================================================= */

  renderResidentSwitcher();
  renderView();
})();
