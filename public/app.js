// UI-Logik. Datenhaltung kommt komplett aus store.js (localStorage).

let selectedTechniqueId = null;
let belts = { Kind: KIDS_BELT_LEVELS, Erwachsener: ADULT_BELT_LEVELS };

const SCOPES = {
  Kind: { typ: 'Kind', prefix: 'child' },
  Erwachsener: { typ: 'Erwachsener', prefix: 'adult' },
};
const selected = { Kind: null, Erwachsener: null };

const statusEl = document.getElementById('status');

function showStatus(msg, isError) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? '#ff6b6b' : '#7ee787';
  if (msg) setTimeout(() => { if (statusEl.textContent === msg) statusEl.textContent = ''; }, 4000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

function memberFullName(m) {
  return `${m.vorname} ${m.nachname}`;
}

function memberName(m) {
  const initial = m.nachname ? `${m.nachname.trim().charAt(0).toUpperCase()}.` : '';
  const alter = currentAlter(m);
  return [m.vorname, initial, alter != null ? String(alter) : null].filter(Boolean).join(' ');
}

async function init() {
  await loadStaticData();
  reloadFromStorage();
  renderAll();
  initPlanTypOptions();
}

function renderAll() {
  renderMemberList(SCOPES.Kind);
  renderMemberDetail(SCOPES.Kind);
  renderMemberTechniques(SCOPES.Kind);
  renderMemberList(SCOPES.Erwachsener);
  renderMemberDetail(SCOPES.Erwachsener);
  renderMemberTechniques(SCOPES.Erwachsener);
  renderTechniqueSelect();
  renderOverviewMatrix();
}

function getActiveFilteredMembers() {
  const filter = document.getElementById('activeFilter').value;
  let result;
  if (filter === 'ausgetreten') result = members.filter((m) => m.ausgetreten);
  else if (filter === 'all') result = members;
  else if (filter === 'inactive') result = members.filter((m) => !m.active && !m.ausgetreten);
  else result = members.filter((m) => m.active && !m.ausgetreten);

  if (document.getElementById('filterWettkaempfer').checked) result = result.filter((m) => m.wettkaempfer);
  if (document.getElementById('filterSparring').checked) result = result.filter((m) => m.sparring);

  const kindGruppe = document.getElementById('kindGruppeFilter').value;
  if (kindGruppe !== 'all') result = result.filter((m) => m.typ === 'Kind' && m.kindGruppe === kindGruppe);

  return result;
}

function getFilteredMembers() {
  const typ = document.getElementById('typFilter').value;
  const base = getActiveFilteredMembers();
  if (typ === 'all') return base;
  return base.filter((m) => m.typ === typ);
}

// ---------- Mitglieder-Ansichten (Kind / Erwachsene) ----------

function renderMemberList(scope) {
  const search = document.getElementById(`${scope.prefix}Search`).value.trim().toLowerCase();
  const list = document.getElementById(`${scope.prefix}List`);
  list.innerHTML = '';
  const filtered = getActiveFilteredMembers().filter(
    (m) => m.typ === scope.typ && memberFullName(m).toLowerCase().includes(search)
  );
  filtered.sort((a, b) => {
    const ageA = currentAlter(a);
    const ageB = currentAlter(b);
    if (ageA == null && ageB == null) return 0;
    if (ageA == null) return 1;
    if (ageB == null) return -1;
    return ageA - ageB;
  });
  for (const m of filtered) {
    const btn = document.createElement('button');
    btn.className =
      'pill' +
      (m.id === selected[scope.typ] ? ' selected' : '') +
      (m.gekuendigt ? ' gekuendigt' : '') +
      (m.ausgetreten ? ' ausgetreten' : '') +
      (m.probetraining ? ' probetraining' : '');
    btn.textContent = memberName(m);
    btn.onclick = () => {
      selected[scope.typ] = m.id;
      renderMemberList(scope);
      renderMemberDetail(scope);
      renderMemberTechniques(scope);
    };
    list.appendChild(btn);
  }
}

function renderMemberDetail(scope) {
  const detail = document.getElementById(`${scope.prefix}Detail`);
  const gekuendigtInfo = document.getElementById(`${scope.prefix}Gekuendigt`);
  const member = members.find((m) => m.id === selected[scope.typ]);
  if (!member) {
    detail.classList.add('hidden');
    gekuendigtInfo.classList.add('hidden');
    return;
  }
  detail.classList.remove('hidden');
  const alter = currentAlter(member);
  document.getElementById(`${scope.prefix}Age`).textContent = alter != null ? `${alter} Jahre` : '';

  if (member.gekuendigt) {
    gekuendigtInfo.textContent = `Gekündigt zum ${member.austrittsdatum}`;
    gekuendigtInfo.classList.remove('hidden');
  } else {
    gekuendigtInfo.classList.add('hidden');
  }

  const activeCheckbox = document.getElementById(`${scope.prefix}Active`);
  activeCheckbox.checked = !!member.active;
  activeCheckbox.onchange = () => {
    setMemberActive(member.id, activeCheckbox.checked);
    renderMemberList(scope);
    renderOverviewMatrix();
  };

  const FLAG_ID_SUFFIX = { wettkaempfer: 'Wettkaempfer', sparring: 'Sparring', probetraining: 'Probetraining' };
  for (const field of ['wettkaempfer', 'sparring', 'probetraining']) {
    const checkbox = document.getElementById(`${scope.prefix}${FLAG_ID_SUFFIX[field]}`);
    checkbox.checked = !!member[field];
    checkbox.onchange = () => {
      setMemberFlag(member.id, field, checkbox.checked);
      renderMemberList(scope);
      renderMemberTechniques(scope);
      renderOverviewMatrix();
    };
  }

  const kindGruppeSelect = document.getElementById(`${scope.prefix}KindGruppe`);
  if (kindGruppeSelect) {
    kindGruppeSelect.value = member.kindGruppe || DEFAULT_KIND_GRUPPE;
    kindGruppeSelect.onchange = () => {
      setMemberKindGruppe(member.id, kindGruppeSelect.value);
      renderMemberList(scope);
      renderOverviewMatrix();
    };
  }

  const select = document.getElementById(`${scope.prefix}Guertel`);
  select.innerHTML = '';
  for (const belt of belts[member.typ] || []) {
    const opt = document.createElement('option');
    opt.value = belt;
    opt.textContent = belt;
    select.appendChild(opt);
  }
  select.value = member.guertel;
  select.onchange = () => {
    setMemberGuertel(member.id, select.value);
    renderMemberList(scope);
    renderMemberTechniques(scope);
    renderOverviewMatrix();
  };
}

function renderMemberTechniques(scope) {
  const container = document.getElementById(`${scope.prefix}Techniques`);
  const nextInfo = document.getElementById(`${scope.prefix}NextInfo`);
  container.innerHTML = '';
  nextInfo.classList.add('hidden');
  const memberId = selected[scope.typ];
  if (!memberId) return;

  const member = members.find((m) => m.id === memberId);
  if (!member) return;
  const next = nextGuertel(member);

  if (!next) {
    nextInfo.textContent = 'Höchste Graduierung erreicht.';
    nextInfo.classList.remove('hidden');
    return;
  }
  nextInfo.textContent = `Techniken für die nächste Graduierung: ${next}`;
  nextInfo.classList.remove('hidden');

  const relevant = techniques.filter((t) => t.zielgruppe === member.typ && t.guertel === next);
  const categories = [...new Set(relevant.map((t) => t.category))];
  for (const cat of categories) {
    const title = document.createElement('div');
    title.className = 'categoryTitle';
    title.textContent = cat;
    container.appendChild(title);

    for (const t of relevant.filter((x) => x.category === cat)) {
      const done = isDone(memberId, t.id);
      const row = document.createElement('div');
      row.className = 'techItem' + (done ? ' done' : '');
      const checkboxId = `chk_${scope.prefix}_${t.id}`;
      row.innerHTML = `
        <input type="checkbox" id="${checkboxId}" ${done ? 'checked' : ''} />
        <label for="${checkboxId}">${escapeHtml(t.name)}<span class="techLabelSmall">${escapeHtml(t.label)}</span></label>
      `;
      row.querySelector('input').addEventListener('change', (e) => {
        toggleProgress(memberId, t.id, e.target.checked);
        row.classList.toggle('done', e.target.checked);
        renderOverviewMatrix();
      });
      container.appendChild(row);
    }
  }
}

function addMember(typ) {
  const vorname = prompt('Vorname?');
  if (vorname === null) return;
  const nachname = prompt('Nachname?');
  if (nachname === null) return;
  const geburtsdatum = prompt('Geburtsdatum (JJJJ-MM-TT, optional)?') || null;
  const member = createMember({ vorname: vorname.trim(), nachname: nachname.trim(), geburtsdatum, typ });
  const scope = SCOPES[member.typ];
  selected[scope.typ] = member.id;
  renderAll();
  showStatus(`${memberName(member)} wurde angelegt.`);
}

document.getElementById('btnAddChild').onclick = () => addMember('Kind');
document.getElementById('btnAddAdult').onclick = () => addMember('Erwachsener');

// ---------- Nach-Technik-Ansicht ----------

function renderTechniqueSelect() {
  const select = document.getElementById('techniqueSelect');
  select.innerHTML = '';
  for (const t of techniques) {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = `${t.label} — ${t.name}`;
    select.appendChild(opt);
  }
  if (!selectedTechniqueId && techniques.length) selectedTechniqueId = techniques[0].id;
  select.value = selectedTechniqueId;
  renderTechniqueMembers();
}

function renderTechniqueMembers() {
  const container = document.getElementById('techniqueMembers');
  container.innerHTML = '';
  if (!selectedTechniqueId) return;

  for (const m of getFilteredMembers()) {
    const done = isDone(m.id, selectedTechniqueId);
    const row = document.createElement('div');
    row.className =
      'memberItem' +
      (done ? ' done' : '') +
      (m.gekuendigt ? ' gekuendigt' : '') +
      (m.ausgetreten ? ' ausgetreten' : '') +
      (m.probetraining ? ' probetraining' : '');
    const checkboxId = `mchk_${m.id}`;
    row.innerHTML = `
      <input type="checkbox" id="${checkboxId}" ${done ? 'checked' : ''} />
      <label for="${checkboxId}">${escapeHtml(memberName(m))}</label>
    `;
    row.querySelector('input').addEventListener('change', (e) => {
      toggleProgress(m.id, selectedTechniqueId, e.target.checked);
      row.classList.toggle('done', e.target.checked);
      renderOverviewMatrix();
    });
    container.appendChild(row);
  }
}

document.getElementById('activeFilter').addEventListener('change', renderAll);
document.getElementById('typFilter').addEventListener('change', renderAll);
document.getElementById('filterWettkaempfer').addEventListener('change', renderAll);
document.getElementById('filterSparring').addEventListener('change', renderAll);
document.getElementById('kindGruppeFilter').addEventListener('change', renderAll);
document.getElementById('childSearch').addEventListener('input', () => renderMemberList(SCOPES.Kind));
document.getElementById('adultSearch').addEventListener('input', () => renderMemberList(SCOPES.Erwachsener));
document.getElementById('techniqueSelect').addEventListener('change', (e) => {
  selectedTechniqueId = e.target.value;
  renderTechniqueMembers();
});

// ---------- Übersicht (Matrix) ----------

function renderOverviewMatrix() {
  const container = document.getElementById('overviewMatrix');
  if (!container) return;
  container.innerHTML = '';
  const visibleMembers = getFilteredMembers();
  if (!visibleMembers.length || !techniques.length) return;

  const filterMissing = document.getElementById('filterMissing').checked;
  const visibleTechniques = techniques.filter(
    (t) => !filterMissing || !visibleMembers.every((m) => isDone(m.id, t.id))
  );

  const table = document.createElement('table');
  table.className = 'matrixTable';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.appendChild(document.createElement('th'));
  for (const t of visibleTechniques) {
    const th = document.createElement('th');
    th.innerHTML = `${escapeHtml(t.name)}<span class="techLabelSmall">${escapeHtml(t.guertel)}</span>`;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const m of visibleMembers) {
    const row = document.createElement('tr');
    const nameCell = document.createElement('th');
    nameCell.className =
      'matrixRowHead' +
      (m.gekuendigt ? ' gekuendigt' : '') +
      (m.ausgetreten ? ' ausgetreten' : '') +
      (m.probetraining ? ' probetraining' : '');
    nameCell.textContent = memberName(m);
    row.appendChild(nameCell);

    for (const t of visibleTechniques) {
      const done = isDone(m.id, t.id);
      const cell = document.createElement('td');
      cell.className = 'matrixCell' + (done ? ' done' : '');
      if (filterMissing && done) {
        cell.classList.add('cell-hidden-filtered');
      } else {
        cell.textContent = done ? '✓' : '';
      }
      cell.onclick = () => {
        toggleProgress(m.id, t.id, !done);
        renderOverviewMatrix();
      };
      row.appendChild(cell);
    }
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

document.getElementById('filterMissing').addEventListener('change', renderOverviewMatrix);

// ---------- Trainingsplan ----------

function renderPlanGuertelOptions() {
  const typSelect = document.getElementById('planTyp');
  const guertelSelect = document.getElementById('planGuertel');
  guertelSelect.innerHTML = '';
  for (const belt of belts[typSelect.value] || []) {
    const opt = document.createElement('option');
    opt.value = belt;
    opt.textContent = belt;
    guertelSelect.appendChild(opt);
  }
}

function renderPlanTable() {
  const typ = document.getElementById('planTyp').value;
  const guertel = document.getElementById('planGuertel').value;
  const container = document.getElementById('planTable');
  container.innerHTML = '';
  if (!typ || !guertel) return;

  const plan = loadTrainingsplan(typ, guertel);
  if (!plan.length) {
    container.textContent = 'Für diese Graduierung liegt noch kein Trainingsplan vor.';
    return;
  }

  const table = document.createElement('table');
  table.className = 'matrixTable';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Woche</th><th>Schwerpunkt</th><th>Technik</th><th>Anwendung</th><th>Spiel</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  for (const row of plan) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${row.woche}</td><td>${escapeHtml(row.schwerpunkt)}</td><td>${escapeHtml(row.technik)}</td><td>${escapeHtml(row.anwendung)}</td><td>${escapeHtml(row.spiel)}</td>`;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

document.getElementById('planTyp').addEventListener('change', () => { renderPlanGuertelOptions(); renderPlanTable(); });
document.getElementById('planGuertel').addEventListener('change', renderPlanTable);

function initPlanTypOptions() {
  renderPlanGuertelOptions();
}

// ---------- Anwesenheit ----------

let attendanceData = {};

function loadAttendanceView() {
  const typ = document.getElementById('attendanceTyp').value;
  attendanceData = getFullAttendance()[typ] || {};

  const today = new Date().toISOString().slice(0, 10);
  const nextDate = nextTrainingDay(typ, today);
  const isToday = nextDate === today;
  const nextInfo = document.getElementById('attendanceNextInfo');

  if (isToday && !attendanceData[nextDate]) {
    ensureSession(typ, nextDate, attendanceData);
  }

  if (isToday) {
    nextInfo.classList.add('hidden');
  } else {
    nextInfo.textContent = `Heute kein Trainingstag für diese Gruppe. Nächstes Training: ${nextDate}`;
    nextInfo.classList.remove('hidden');
  }

  const sessionSelect = document.getElementById('attendanceSessionSelect');
  const dates = Object.keys(attendanceData).sort();
  sessionSelect.innerHTML = '';
  for (const date of dates) {
    const opt = document.createElement('option');
    opt.value = date;
    opt.textContent = date;
    sessionSelect.appendChild(opt);
  }
  sessionSelect.value = isToday ? nextDate : dates[dates.length - 1] || '';

  renderAttendanceList();
  renderAttendanceSummary();
}

function renderAttendanceList() {
  const typ = document.getElementById('attendanceTyp').value;
  const date = document.getElementById('attendanceSessionSelect').value;
  const container = document.getElementById('attendanceList');
  const quickActions = document.getElementById('attendanceQuickActions');
  container.innerHTML = '';

  if (!date) {
    quickActions.classList.add('hidden');
    return;
  }
  quickActions.classList.remove('hidden');

  const sessionMap = attendanceData[date] || {};
  const allDates = Object.keys(attendanceData);
  const kindGruppe = document.getElementById('kindGruppeFilter').value;

  let relevant = members.filter((m) => m.typ === typ && m.active && !m.ausgetreten);
  if (typ === 'Kind' && kindGruppe !== 'all') {
    relevant = relevant.filter((m) => m.kindGruppe === kindGruppe);
  }

  for (const m of relevant) {
    const present = !!sessionMap[m.id];
    const attendedCount = allDates.filter((d) => attendanceData[d][m.id]).length;
    const pct = allDates.length ? Math.round((attendedCount / allDates.length) * 100) : 0;

    const row = document.createElement('div');
    row.className = 'memberItem' + (present ? ' done' : '') + (m.probetraining ? ' probetraining' : '');
    const checkboxId = `att_${m.id}`;
    row.innerHTML = `
      <input type="checkbox" id="${checkboxId}" ${present ? 'checked' : ''} />
      <label for="${checkboxId}">${escapeHtml(memberName(m))}<span class="techLabelSmall">${pct}% Beteiligung</span></label>
    `;
    row.querySelector('input').addEventListener('change', (e) => {
      setAttendance(typ, date, m.id, e.target.checked, attendanceData);
      row.classList.toggle('done', e.target.checked);
    });
    container.appendChild(row);
  }
}

function renderAttendanceSummary() {
  const typ = document.getElementById('attendanceTyp').value;
  const container = document.getElementById('attendanceSummary');
  container.innerHTML = '';

  const summary = getAttendanceSummary(typ);
  if (!summary.months.length) {
    container.textContent = 'Noch keine Trainingstermine erfasst.';
    return;
  }

  const kindGruppe = document.getElementById('kindGruppeFilter').value;
  if (typ === 'Kind' && kindGruppe !== 'all') {
    const idsInGruppe = new Set(members.filter((m) => m.kindGruppe === kindGruppe).map((m) => m.id));
    summary.members = summary.members.filter((m) => idsInGruppe.has(m.id));
  }

  const table = document.createElement('table');
  table.className = 'matrixTable';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.appendChild(document.createElement('th'));
  for (const month of summary.months) {
    const th = document.createElement('th');
    th.textContent = month;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const m of summary.members) {
    const row = document.createElement('tr');
    const nameCell = document.createElement('th');
    nameCell.className = 'matrixRowHead' + (m.probetraining ? ' probetraining' : '');
    nameCell.textContent = `${m.vorname} ${m.nachname}`;
    row.appendChild(nameCell);
    for (const month of summary.months) {
      const cell = document.createElement('td');
      const data = m.byMonth[month];
      cell.textContent = `${data.attended}/${data.total} (${data.pct}%)`;
      row.appendChild(cell);
    }
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

document.getElementById('attendanceTyp').addEventListener('change', loadAttendanceView);
document.getElementById('attendanceSessionSelect').addEventListener('change', renderAttendanceList);

document.getElementById('btnCreateSession').onclick = () => {
  const typ = document.getElementById('attendanceTyp').value;
  const date = document.getElementById('attendanceDate').value;
  if (!date) {
    showStatus('Bitte ein Datum wählen.', true);
    return;
  }
  ensureSession(typ, date, attendanceData);
  loadAttendanceView();
  document.getElementById('attendanceSessionSelect').value = date;
  renderAttendanceList();
};

document.getElementById('btnDeleteSession').onclick = () => {
  const typ = document.getElementById('attendanceTyp').value;
  const date = document.getElementById('attendanceSessionSelect').value;
  if (!date) return;
  deleteSession(typ, date, attendanceData);
  loadAttendanceView();
};

document.getElementById('btnMarkAllPresent').onclick = () => bulkMarkAttendance(true);
document.getElementById('btnMarkAllAbsent').onclick = () => bulkMarkAttendance(false);

function bulkMarkAttendance(present) {
  const typ = document.getElementById('attendanceTyp').value;
  const date = document.getElementById('attendanceSessionSelect').value;
  if (!date) return;
  const kindGruppe = document.getElementById('kindGruppeFilter').value;
  let relevant = members.filter((m) => m.typ === typ && m.active && !m.ausgetreten);
  if (typ === 'Kind' && kindGruppe !== 'all') {
    relevant = relevant.filter((m) => m.kindGruppe === kindGruppe);
  }
  for (const m of relevant) {
    setAttendance(typ, date, m.id, present, attendanceData);
  }
  renderAttendanceList();
}

// ---------- Excel: Mitgliederliste exportieren/importieren ----------

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

document.getElementById('btnExportMembers').onclick = () => {
  try {
    exportMembersList();
  } catch (err) {
    showStatus('Fehler beim Export: ' + err.message, true);
  }
};

document.getElementById('importMembersFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  showStatus('Importiere Mitgliederliste…');
  try {
    const buffer = await readFileAsArrayBuffer(file);
    const result = importMembersListFromExcel(buffer);
    renderAll();
    let msg = `Mitgliederliste importiert: ${result.created} neu angelegt, ${result.updated} aktualisiert, ${result.ausgetreten} ausgetreten.`;
    if (result.warnings.length) msg += ` ${result.warnings.length} Warnung(en), siehe Konsole.`;
    showStatus(msg, result.warnings.length > 0);
    if (result.warnings.length) console.warn(result.warnings.join('\n'));
  } catch (err) {
    showStatus('Fehler beim Import: ' + err.message, true);
  }
  e.target.value = '';
});

// ---------- Daten/Archiv (JSON-Backup) ----------

document.getElementById('btnExportBackup').onclick = () => {
  const backup = exportBackupObject();
  downloadBlob(
    new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
    `kickbox-archiv-${new Date().toISOString().slice(0, 10)}.json`
  );
  showStatus('Archiv wurde heruntergeladen.');
};

document.getElementById('importBackupFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const backup = JSON.parse(reader.result);
      importBackupObject(backup);
      renderAll();
      showStatus('Archiv wurde importiert.');
    } catch (err) {
      showStatus('Fehler beim Importieren: ' + err.message, true);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

document.getElementById('btnClearAll').onclick = () => {
  if (!confirm('Wirklich ALLE lokalen Daten (Mitglieder, Fortschritt, Anwesenheit) auf diesem Gerät löschen? Vorher unbedingt ein Archiv exportieren!')) return;
  clearAllData();
  renderAll();
  showStatus('Alle lokalen Daten wurden gelöscht.');
};

// ---------- View-Umschaltung ----------

function setView(view) {
  document.getElementById('viewChild').classList.toggle('hidden', view !== 'child');
  document.getElementById('viewAdult').classList.toggle('hidden', view !== 'adult');
  document.getElementById('viewTechnique').classList.toggle('hidden', view !== 'technique');
  document.getElementById('viewOverview').classList.toggle('hidden', view !== 'overview');
  document.getElementById('viewPlan').classList.toggle('hidden', view !== 'plan');
  document.getElementById('viewAttendance').classList.toggle('hidden', view !== 'attendance');
  document.getElementById('viewBackup').classList.toggle('hidden', view !== 'backup');
  document.getElementById('btnViewChild').classList.toggle('active', view === 'child');
  document.getElementById('btnViewAdult').classList.toggle('active', view === 'adult');
  document.getElementById('btnViewTechnique').classList.toggle('active', view === 'technique');
  document.getElementById('btnViewOverview').classList.toggle('active', view === 'overview');
  document.getElementById('btnViewPlan').classList.toggle('active', view === 'plan');
  document.getElementById('btnViewAttendance').classList.toggle('active', view === 'attendance');
  document.getElementById('btnViewBackup').classList.toggle('active', view === 'backup');
}

document.getElementById('btnViewChild').onclick = () => setView('child');
document.getElementById('btnViewAdult').onclick = () => setView('adult');
document.getElementById('btnViewTechnique').onclick = () => setView('technique');
document.getElementById('btnViewOverview').onclick = () => { setView('overview'); renderOverviewMatrix(); };
document.getElementById('btnViewPlan').onclick = () => { setView('plan'); renderPlanTable(); };
document.getElementById('btnViewAttendance').onclick = () => { setView('attendance'); loadAttendanceView(); };
document.getElementById('btnViewBackup').onclick = () => setView('backup');

// ---------- Start ----------

document.getElementById('attendanceDate').value = new Date().toISOString().slice(0, 10);

init();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
