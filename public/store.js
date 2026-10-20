// ============================================================
// Datenhaltung der App: alles liegt NUR im Browser-Speicher (localStorage)
// dieses Geräts. Kein Server. Techniken/Trainingsplan sind statische,
// mitgelieferte JSON-Dateien (data/*.json) ohne Personendaten.
// ============================================================

const STORAGE_KEYS = {
  members: 'kbt_members',
  progress: 'kbt_progress',
  attendance: 'kbt_attendance',
};

function loadJson(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    showStatus('Speichern fehlgeschlagen (privater Modus oder Speicher voll?): ' + err.message, true);
    return false;
  }
}

// ---------- Gürtel-/Belt-Logik ----------

const KIDS_BELT_LEVELS = [
  'Weiß', 'Weiß-Gelb', 'Gelb', 'Gelb-Orange', 'Orange', 'Orange-Grün',
  'Grün', 'Grün-Blau', 'Blau', 'Blau-Braun', 'Braun', 'Braun-Schwarz',
];
const ADULT_BELT_LEVELS = ['Weiß', 'Gelb', 'Orange', 'Grün', 'Blau', 'Braun', 'Schwarz'];
const BELT_LEVELS_BY_TYP = { Kind: KIDS_BELT_LEVELS, Erwachsener: ADULT_BELT_LEVELS };
const KIND_GRUPPEN = ['Anfänger', 'Fortgeschrittene'];
const DEFAULT_KIND_GRUPPE = KIND_GRUPPEN[0];
const MEMBER_TYPEN = ['Kind', 'Erwachsener'];

function beltLevelsFor(typ) {
  return BELT_LEVELS_BY_TYP[typ] || KIDS_BELT_LEVELS;
}

function beltRank(name, typ) {
  const idx = beltLevelsFor(typ).indexOf(name);
  return idx === -1 ? 0 : idx;
}

function nextGuertel(member) {
  const levels = beltLevelsFor(member.typ);
  const idx = levels.indexOf(member.guertel);
  if (idx === -1 || idx === levels.length - 1) return null;
  return levels[idx + 1];
}

function kindGruppeRank(member) {
  if (member.typ !== 'Kind') return 0;
  const idx = KIND_GRUPPEN.indexOf(member.kindGruppe);
  return idx === -1 ? 0 : idx;
}

function defaultTypForAge(alter) {
  return alter != null && alter < 15 ? 'Kind' : 'Erwachsener';
}

function calcAlterFromGeburtsdatum(geburtsdatum) {
  if (!geburtsdatum) return null;
  const birth = new Date(geburtsdatum);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let alter = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) {
    alter--;
  }
  return alter;
}

function sortMembersByGraduierung(list) {
  return [...list].sort((a, b) => {
    const groupDiff = kindGruppeRank(a) - kindGruppeRank(b);
    if (groupDiff !== 0) return groupDiff;
    const diff = beltRank(a.guertel, a.typ) - beltRank(b.guertel, b.typ);
    if (diff !== 0) return diff;
    return (a.nachname + a.vorname).localeCompare(b.nachname + b.vorname, 'de');
  });
}

function sortMembersForExport(list) {
  return [...list].sort((a, b) => {
    const diff = beltRank(a.guertel, a.typ) - beltRank(b.guertel, b.typ);
    if (diff !== 0) return diff;
    const ageDiff = (a.alter ?? Infinity) - (b.alter ?? Infinity);
    if (ageDiff !== 0) return ageDiff;
    return (a.nachname + a.vorname).localeCompare(b.nachname + b.vorname, 'de');
  });
}

function sortTechniquesByGraduierung(list) {
  return [...list].sort((a, b) => {
    const diff = beltRank(a.guertel, a.zielgruppe) - beltRank(b.guertel, b.zielgruppe);
    if (diff !== 0) return diff;
    return (a.week || 0) - (b.week || 0);
  });
}

// ---------- Bayerische Feiertage + feste Trainingstage ----------

function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function toIso(date) {
  return date.toISOString().slice(0, 10);
}

function getBayernHolidays(year) {
  const easter = easterSunday(year);
  const dates = [
    new Date(Date.UTC(year, 0, 1)),
    new Date(Date.UTC(year, 0, 6)),
    addDays(easter, -2),
    addDays(easter, 1),
    new Date(Date.UTC(year, 4, 1)),
    addDays(easter, 39),
    addDays(easter, 50),
    addDays(easter, 60),
    new Date(Date.UTC(year, 7, 15)),
    new Date(Date.UTC(year, 9, 3)),
    new Date(Date.UTC(year, 10, 1)),
    new Date(Date.UTC(year, 11, 25)),
    new Date(Date.UTC(year, 11, 26)),
  ];
  return new Set(dates.map(toIso));
}

function isBayernHoliday(dateStr) {
  const year = Number(dateStr.slice(0, 4));
  return getBayernHolidays(year).has(dateStr);
}

function nextTrainingDay(typ, fromDateStr) {
  const start = new Date(`${fromDateStr}T00:00:00Z`);
  for (let i = 0; i < 14; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const weekday = d.getUTCDay();
    const iso = d.toISOString().slice(0, 10);
    if (typ === 'Kind') {
      if (weekday === 2) return iso;
    } else {
      if ((weekday === 2 || weekday === 4) && !isBayernHoliday(iso)) return iso;
    }
  }
  return null;
}

// ---------- Statische Trainingsdaten (Techniken, Trainingsplan) ----------

let techniques = [];
let trainingsplanByTyp = { Kind: {}, Erwachsener: {} };

async function loadStaticData() {
  try {
    const [techRes, planKindRes, planAdultRes] = await Promise.all([
      fetch('data/techniques.json'),
      fetch('data/trainingsplan-kind.json'),
      fetch('data/trainingsplan-erwachsener.json'),
    ]);
    techniques = sortTechniquesByGraduierung(await techRes.json());
    trainingsplanByTyp = {
      Kind: await planKindRes.json(),
      Erwachsener: await planAdultRes.json(),
    };
  } catch (err) {
    showStatus('Konnte Techniken/Trainingsplan nicht laden: ' + err.message, true);
  }
}

function loadTrainingsplan(typ, guertel) {
  return (trainingsplanByTyp[typ] || {})[guertel] || [];
}

// ---------- Mitglieder ----------

let members = [];
let progress = {};

function reloadFromStorage() {
  members = loadJson(STORAGE_KEYS.members, []);
  progress = loadJson(STORAGE_KEYS.progress, {});
}

function persistMembers() {
  members = sortMembersByGraduierung(members);
  saveJson(STORAGE_KEYS.members, members);
}

function markTechniquesUpToBeltAsDone(member) {
  const newRank = beltRank(member.guertel, member.typ);
  if (!progress[member.id]) progress[member.id] = {};
  for (const t of techniques) {
    if (t.zielgruppe !== member.typ) continue;
    if (beltRank(t.guertel, member.typ) <= newRank) {
      progress[member.id][t.id] = true;
    }
  }
  saveJson(STORAGE_KEYS.progress, progress);
}

function generateMemberId() {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function createMember({ vorname, nachname, geburtsdatum, typ }) {
  const resolvedTyp = MEMBER_TYPEN.includes(typ) ? typ : 'Kind';
  const alter = calcAlterFromGeburtsdatum(geburtsdatum);
  const member = {
    id: generateMemberId(),
    vorname: vorname || '',
    nachname: nachname || '',
    geburtsdatum: geburtsdatum || null,
    alter,
    austrittsdatum: null,
    active: true,
    guertel: beltLevelsFor(resolvedTyp)[0],
    typ: resolvedTyp,
    gekuendigt: false,
    ausgetreten: false,
    wettkaempfer: false,
    sparring: false,
    kindGruppe: DEFAULT_KIND_GRUPPE,
  };
  members.push(member);
  persistMembers();
  return member;
}

function setMemberGuertel(memberId, guertel) {
  const member = members.find((m) => m.id === memberId);
  if (!member) return;
  if (!beltLevelsFor(member.typ).includes(guertel)) return;
  member.guertel = guertel;
  markTechniquesUpToBeltAsDone(member);
  persistMembers();
}

function setMemberActive(memberId, active) {
  const member = members.find((m) => m.id === memberId);
  if (!member) return;
  member.active = Boolean(active);
  persistMembers();
}

function setMemberFlag(memberId, field, value) {
  const member = members.find((m) => m.id === memberId);
  if (!member) return;
  member[field] = Boolean(value);
  persistMembers();
}

function setMemberKindGruppe(memberId, kindGruppe) {
  const member = members.find((m) => m.id === memberId);
  if (!member || !KIND_GRUPPEN.includes(kindGruppe)) return;
  member.kindGruppe = kindGruppe;
  persistMembers();
}

function setMemberTyp(memberId, typ) {
  const member = members.find((m) => m.id === memberId);
  if (!member || !MEMBER_TYPEN.includes(typ)) return;
  member.typ = typ;
  member.guertel = beltLevelsFor(typ)[0];
  persistMembers();
}

function isDone(memberId, techniqueId) {
  return !!(progress[memberId] && progress[memberId][techniqueId]);
}

function toggleProgress(memberId, techniqueId, done) {
  if (!progress[memberId]) progress[memberId] = {};
  if (done) progress[memberId][techniqueId] = true;
  else delete progress[memberId][techniqueId];
  saveJson(STORAGE_KEYS.progress, progress);
}

// ---------- Anwesenheit ----------

function getFullAttendance() {
  return loadJson(STORAGE_KEYS.attendance, { Kind: {}, Erwachsener: {} });
}

function saveTypAttendance(typ, typAttendance) {
  const full = getFullAttendance();
  full[typ] = typAttendance;
  saveJson(STORAGE_KEYS.attendance, full);
}

function ensureSession(typ, date, typAttendance) {
  if (!typAttendance[date]) typAttendance[date] = {};
  saveTypAttendance(typ, typAttendance);
}

function deleteSession(typ, date, typAttendance) {
  delete typAttendance[date];
  saveTypAttendance(typ, typAttendance);
}

function setAttendance(typ, date, memberId, present, typAttendance) {
  if (!typAttendance[date]) typAttendance[date] = {};
  typAttendance[date][memberId] = present;
  saveTypAttendance(typ, typAttendance);
}

function getAttendanceSummary(typ) {
  const attendance = getFullAttendance()[typ] || {};
  const dates = Object.keys(attendance).sort();
  const months = [...new Set(dates.map((d) => d.slice(0, 7)))].sort();

  const totalByMonth = {};
  for (const month of months) {
    totalByMonth[month] = dates.filter((d) => d.slice(0, 7) === month).length;
  }

  const relevantMembers = members.filter((m) => m.typ === typ && !m.ausgetreten);
  return {
    months,
    members: relevantMembers.map((m) => {
      const byMonth = {};
      for (const month of months) {
        const attended = dates.filter((d) => d.slice(0, 7) === month && attendance[d][m.id]).length;
        byMonth[month] = {
          attended,
          total: totalByMonth[month],
          pct: totalByMonth[month] ? Math.round((attended / totalByMonth[month]) * 100) : 0,
        };
      }
      return { id: m.id, vorname: m.vorname, nachname: m.nachname, byMonth };
    }),
  };
}

function excelDateToIso(serial) {
  if (!serial || Number.isNaN(Number(serial))) return null;
  const utcDays = Math.floor(Number(serial) - 25569);
  const date = new Date(utcDays * 86400 * 1000);
  return date.toISOString().slice(0, 10);
}

// ---------- Excel: Offline-Checkliste exportieren/importieren ----------

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportChecklist() {
  const activeMembers = members.filter((m) => m.active);
  const header = ['Mitgl.-Nr.', 'Nachname', 'Vorname', 'Alter', 'Typ', 'Gürtel', ...techniques.map((t) => t.label)];
  const dataRows = sortMembersForExport(activeMembers).map((m) => {
    const row = [m.id, m.nachname, m.vorname, m.alter ?? '', m.typ, m.guertel];
    for (const t of techniques) {
      row.push(progress[m.id] && progress[m.id][t.id] ? 'X' : '');
    }
    return row;
  });

  const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
  ws['!cols'] = [
    { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 8 }, { wch: 12 }, { wch: 12 },
    ...techniques.map(() => ({ wch: 22 })),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Checkliste');
  const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  downloadBlob(new Blob([wbout], { type: 'application/octet-stream' }), 'Checkliste-Offline.xlsx');
}

function importChecklistFromExcel(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (rows.length < 2) throw new Error('Die Datei enthält keine Daten.');

  const header = rows[0];
  const labelToId = new Map(techniques.map((t) => [t.label, t.id]));
  const knownMemberIds = new Set(members.map((m) => m.id));
  const columnTechniqueIds = header.map((label) => labelToId.get(String(label).trim()) || null);

  let cellsMarked = 0;
  let cellsUnmarked = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const memberId = String(row[0] || '').trim();
    if (!memberId || !knownMemberIds.has(memberId)) continue;
    if (!progress[memberId]) progress[memberId] = {};

    for (let c = 0; c < header.length; c++) {
      const techniqueId = columnTechniqueIds[c];
      if (!techniqueId) continue;
      const cell = String(row[c] || '').trim().toLowerCase();
      const checked = cell === 'x' || cell === '1' || cell === 'ja' || cell === 'true';
      if (checked) {
        if (!progress[memberId][techniqueId]) cellsMarked++;
        progress[memberId][techniqueId] = true;
      } else if (progress[memberId][techniqueId]) {
        delete progress[memberId][techniqueId];
        cellsUnmarked++;
      }
    }
  }

  saveJson(STORAGE_KEYS.progress, progress);
  return { cellsMarked, cellsUnmarked };
}

// ---------- Excel: Mitgliederliste für Massenänderung ----------

function exportMembersList() {
  const list = sortMembersByGraduierung(members.filter((m) => !m.ausgetreten));
  const header = [
    'Nr.', 'Vorname', 'Nachname', 'Geburtsdatum', 'Alter', 'Austrittsdatum', 'Status',
    'Trainingsgruppe', 'Gürtel', 'Wettkämpfer', 'Sparring', 'Kindergruppe',
  ];
  const dataRows = list.map((m) => {
    const alter = m.geburtsdatum ? calcAlterFromGeburtsdatum(m.geburtsdatum) : m.alter ?? '';
    return [
      m.id, m.vorname, m.nachname, m.geburtsdatum || '', alter, m.austrittsdatum || '',
      m.active ? 'Aktiv' : 'Inaktiv',
      m.typ === 'Kind' ? 'Kindertraining' : 'Erwachsenentraining',
      m.guertel,
      m.wettkaempfer ? 'Ja' : 'Nein',
      m.sparring ? 'Ja' : 'Nein',
      m.typ === 'Kind' ? m.kindGruppe || DEFAULT_KIND_GRUPPE : '',
    ];
  });
  const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
  ws['!cols'] = [
    { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 10 },
    { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 16 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mitgliederliste');
  const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  downloadBlob(new Blob([wbout], { type: 'application/octet-stream' }), 'Mitgliederliste.xlsx');
}

function normalizeHeader(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Spaltennamen statt fester Position auswerten - robust gegenüber
// abweichender Spaltenreihenfolge/-schreibweise in importierten Dateien.
const MEMBER_LIST_COLUMN_ALIASES = {
  id: ['nr', 'mitglnr', 'mitgliedsnr', 'id'],
  vorname: ['vorname'],
  nachname: ['nachname'],
  geburtsdatum: ['geburtsdatum'],
  alter: ['alter'],
  austrittsdatum: ['austrittsdatum'],
  status: ['status'],
  trainingsgruppe: ['trainingsgruppe'],
  guertel: ['gurtel'],
  wettkaempfer: ['wettkampfer'],
  sparring: ['sparring'],
  kindGruppe: ['kindergruppe', 'kindgruppe'],
};
const MEMBER_LIST_COLUMN_DEFAULTS = {
  id: 0, vorname: 1, nachname: 2, geburtsdatum: 3, alter: 4, austrittsdatum: 5, status: 6,
  trainingsgruppe: 7, guertel: 8, wettkaempfer: 9, sparring: 10, kindGruppe: 11,
};

function resolveMemberListColumns(headerRow) {
  const normalized = headerRow.map(normalizeHeader);
  const cols = {};
  for (const [key, aliases] of Object.entries(MEMBER_LIST_COLUMN_ALIASES)) {
    const idx = normalized.findIndex((h) => aliases.includes(h));
    cols[key] = idx !== -1 ? idx : MEMBER_LIST_COLUMN_DEFAULTS[key];
  }
  return cols;
}

function parseDatumCell(value) {
  if (value === '' || value == null) return null;
  if (value instanceof Date) return toIso(value);
  if (typeof value === 'number') return excelDateToIso(value);
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : toIso(parsed);
}

function importMembersListFromExcel(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (rows.length < 2) throw new Error('Die Datei enthält keine Daten.');

  const cols = resolveMemberListColumns(rows[0]);
  const byId = new Map(members.map((m) => [m.id, m]));
  const importedIds = new Set();
  let created = 0;
  let updated = 0;
  let ausgetreten = 0;
  const warnings = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const memberId = String(row[cols.id] || '').trim();
    if (!memberId) continue;
    importedIds.add(memberId);

    const vorname = String(row[cols.vorname] || '').trim();
    const nachname = String(row[cols.nachname] || '').trim();
    const geburtsdatum = parseDatumCell(row[cols.geburtsdatum]);
    const austrittsdatum = parseDatumCell(row[cols.austrittsdatum]);
    const alterInput = String(row[cols.alter] || '').trim();
    const status = String(row[cols.status] || '').trim();
    const trainingsgruppe = String(row[cols.trainingsgruppe] || '').trim();
    const guertelInput = String(row[cols.guertel] || '').trim();
    const wettkaempfer = String(row[cols.wettkaempfer] || '').trim();
    const sparring = String(row[cols.sparring] || '').trim();

    const rawAlter = alterInput === '' ? null : Number(alterInput);
    const alterFromSpalte = Number.isNaN(rawAlter) ? null : rawAlter;
    // Das Geburtsdatum ist zuverlässiger als die Spalte "Alter" (die seit
    // dem letzten Geburtstag veraltet sein kann) oder der Trainingsgruppe-
    // Text (der z.B. aus einem früheren, falsch zugeordneten Export stammen
    // kann) - wenn vorhanden, hat es Vorrang bei der Kind/Erwachsener-
    // Entscheidung.
    const alter = geburtsdatum ? calcAlterFromGeburtsdatum(geburtsdatum) : alterFromSpalte;
    const typFromTrainingsgruppe =
      trainingsgruppe === 'Kindertraining' ? 'Kind' : trainingsgruppe === 'Erwachsenentraining' ? 'Erwachsener' : null;
    const typ = alter != null ? defaultTypForAge(alter) : typFromTrainingsgruppe;

    let member = byId.get(memberId);
    const isNew = !member;
    if (isNew) {
      member = {
        id: memberId,
        vorname,
        nachname,
        geburtsdatum: geburtsdatum || null,
        alter,
        austrittsdatum: austrittsdatum || null,
        active: true,
        guertel: beltLevelsFor(typ || 'Kind')[0],
        typ: typ || 'Kind',
        gekuendigt: Boolean(austrittsdatum),
        ausgetreten: false,
        wettkaempfer: false,
        sparring: false,
        kindGruppe: DEFAULT_KIND_GRUPPE,
      };
      byId.set(memberId, member);
    } else {
      member.ausgetreten = false;
      if (geburtsdatum) member.geburtsdatum = geburtsdatum;
      member.austrittsdatum = austrittsdatum || null;
    }

    member.active = status.toLowerCase() === 'inaktiv' ? false : true;
    if (typ) member.typ = typ;
    if (alter != null) member.alter = alter;

    if (beltLevelsFor(member.typ).includes(guertelInput)) {
      member.guertel = guertelInput;
    } else {
      member.guertel = beltLevelsFor(member.typ)[0];
      if (guertelInput) {
        warnings.push(`Mitglied ${memberId}: Gürtel "${guertelInput}" ist für ${member.typ} ungültig, auf "${member.guertel}" zurückgesetzt.`);
      }
    }
    member.wettkaempfer = wettkaempfer.toLowerCase() === 'ja';
    member.sparring = sparring.toLowerCase() === 'ja';

    if (member.typ === 'Kind') {
      const kindGruppeInput = String(row[cols.kindGruppe] || '').trim();
      member.kindGruppe = KIND_GRUPPEN.includes(kindGruppeInput) ? kindGruppeInput : DEFAULT_KIND_GRUPPE;
    }

    if (isNew) created++;
    else updated++;
  }

  for (const [id, current] of byId) {
    if (!importedIds.has(id) && !current.ausgetreten) {
      current.ausgetreten = true;
      current.active = false;
      ausgetreten++;
    }
  }

  members = Array.from(byId.values());
  persistMembers();
  return { created, updated, ausgetreten, warnings };
}

// ---------- JSON-Archivierung (Backup) ----------

const BACKUP_VERSION = 1;

function exportBackupObject() {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    members: loadJson(STORAGE_KEYS.members, []),
    progress: loadJson(STORAGE_KEYS.progress, {}),
    attendance: loadJson(STORAGE_KEYS.attendance, { Kind: {}, Erwachsener: {} }),
  };
}

function importBackupObject(backup) {
  if (!backup || !Array.isArray(backup.members)) {
    throw new Error('Diese Datei sieht nicht wie ein gültiges Archiv aus (keine Mitgliederliste gefunden).');
  }
  saveJson(STORAGE_KEYS.members, backup.members);
  saveJson(STORAGE_KEYS.progress, backup.progress || {});
  saveJson(STORAGE_KEYS.attendance, backup.attendance || { Kind: {}, Erwachsener: {} });
  reloadFromStorage();
}

function clearAllData() {
  localStorage.removeItem(STORAGE_KEYS.members);
  localStorage.removeItem(STORAGE_KEYS.progress);
  localStorage.removeItem(STORAGE_KEYS.attendance);
  reloadFromStorage();
}
