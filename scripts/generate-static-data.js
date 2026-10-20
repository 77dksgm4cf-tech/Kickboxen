// Einmal lokal ausfuehren (node scripts/generate-static-data.js), um die
// Trainingsinhalte (Techniken, Trainingsplaene) aus den Quell-Excel-Dateien
// in statische JSON-Dateien unter public/data/ zu uebernehmen. Enthaelt keine
// Personendaten, daher unbedenklich fuer das oeffentliche Repo. Erneut
// ausfuehren, wenn sich die Trainings-Excel-Dateien aendern. Benoetigt das
// npm-Paket "xlsx" (einmalig lokal installieren: npm install xlsx).
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT_DIR = path.join(__dirname, '..', '..');
const OUT_DIR = path.join(__dirname, '..', 'public', 'data');

const TRAINING_XLSX = path.join(ROOT_DIR, 'Kinder-Anfänger-Training.xlsx');
const ADULT_TRAINING_XLSX = path.join(ROOT_DIR, 'Erwachsene-Training.xlsx');

const EXTRA_TECHNIQUES = [
  { id: 'extra_purzelbaum_vor', name: 'Purzelbaum vorwärts', category: 'Bodenarbeit / Fallschule' },
  { id: 'extra_purzelbaum_rueck', name: 'Purzelbaum rückwärts', category: 'Bodenarbeit / Fallschule' },
  { id: 'extra_fallschule_vor', name: 'Fallschule vorwärts', category: 'Bodenarbeit / Fallschule' },
  { id: 'extra_fallschule_rueck', name: 'Fallschule rückwärts', category: 'Bodenarbeit / Fallschule' },
  { id: 'extra_sv_vorne', name: 'Selbstverteidigung: Umklammern von vorne', category: 'Selbstverteidigung' },
  { id: 'extra_sv_hinten', name: 'Selbstverteidigung: Umklammern von hinten', category: 'Selbstverteidigung' },
];

const EXISTING_TECHNIQUES_BELT = 'Weiß-Gelb';
const DEFAULT_TYP = 'Kind';
const TECHNIQUE_OVERVIEW_SHEET = 'Technik-Übersicht';

function slug(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function categoryForWeek(week) {
  if (week <= 4) return 'Grundlagen';
  if (week <= 8) return 'Schläge';
  if (week <= 12) return 'Schläge / Kicks';
  if (week <= 16) return 'Kicks';
  return 'Kombinationen';
}

function buildTechniques() {
  const wb = XLSX.readFile(TRAINING_XLSX);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const headerIdx = rows.findIndex((r) => String(r[0]).trim() === 'Woche');
  if (headerIdx === -1) {
    throw new Error('Konnte die Wochentabelle in der Trainings-Excel nicht finden.');
  }

  const techniques = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const week = row[0];
    if (week === '' || week === undefined || Number.isNaN(Number(week))) continue;
    const schwerpunkt = String(row[1] || '').trim();
    const technik = String(row[2] || '').trim();
    if (!technik) continue;
    techniques.push({
      id: `w${week}`,
      week: Number(week),
      name: technik,
      label: `Woche ${week}: ${schwerpunkt}`,
      category: categoryForWeek(Number(week)),
    });
  }

  for (const extra of EXTRA_TECHNIQUES) {
    techniques.push({ ...extra, week: null, label: extra.name });
  }

  for (const t of techniques) {
    t.guertel = EXISTING_TECHNIQUES_BELT;
    t.zielgruppe = DEFAULT_TYP;
  }

  const knownKeys = new Set(techniques.map((t) => `${t.zielgruppe}::${t.name}`));
  const overviewSheet = wb.Sheets[TECHNIQUE_OVERVIEW_SHEET];
  if (overviewSheet) {
    const overviewRows = XLSX.utils.sheet_to_json(overviewSheet, { header: 1, defval: '' });
    for (let i = 1; i < overviewRows.length; i++) {
      const row = overviewRows[i];
      const zielgruppe = String(row[0] || '').trim() || DEFAULT_TYP;
      const guertel = String(row[1] || '').trim();
      const woche = row[2] === '' ? null : Number(row[2]);
      const kategorie = String(row[3] || '').trim();
      const technik = String(row[4] || '').trim();
      const key = `${zielgruppe}::${technik}`;
      if (!technik || !guertel || knownKeys.has(key)) continue;
      knownKeys.add(key);
      techniques.push({
        id: `${slug(zielgruppe)}_${slug(guertel)}_${slug(technik)}`,
        week: Number.isNaN(woche) ? null : woche,
        name: technik,
        label: technik,
        category: kategorie || guertel,
        guertel,
        zielgruppe,
      });
    }
  }

  return techniques;
}

function loadTrainingsplan(file, typ, guertel) {
  if (!fs.existsSync(file)) return [];
  const wb = XLSX.readFile(file);
  const sheetName = typ === 'Kind' && guertel === 'Weiß-Gelb' ? 'Tabelle1' : `Plan_${guertel}`.slice(0, 31);
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const headerIdx = rows.findIndex((r) => String(r[0]).trim() === 'Woche');
  if (headerIdx === -1) return [];

  const plan = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const woche = row[0];
    if (woche === '' || woche === undefined || Number.isNaN(Number(woche))) continue;
    plan.push({
      woche: Number(woche),
      schwerpunkt: String(row[1] || '').trim(),
      technik: String(row[2] || '').trim(),
      anwendung: String(row[3] || '').trim(),
      spiel: String(row[4] || '').trim(),
    });
  }
  return plan;
}

const KIDS_BELT_LEVELS = [
  'Weiß', 'Weiß-Gelb', 'Gelb', 'Gelb-Orange', 'Orange', 'Orange-Grün',
  'Grün', 'Grün-Blau', 'Blau', 'Blau-Braun', 'Braun', 'Braun-Schwarz',
];
const ADULT_BELT_LEVELS = ['Weiß', 'Gelb', 'Orange', 'Grün', 'Blau', 'Braun', 'Schwarz'];

fs.mkdirSync(OUT_DIR, { recursive: true });

const techniques = buildTechniques();
fs.writeFileSync(path.join(OUT_DIR, 'techniques.json'), JSON.stringify(techniques, null, 2), 'utf8');
console.log(`techniques.json: ${techniques.length} Einträge`);

const planKind = {};
for (const belt of KIDS_BELT_LEVELS) {
  const plan = loadTrainingsplan(TRAINING_XLSX, 'Kind', belt);
  if (plan.length) planKind[belt] = plan;
}
fs.writeFileSync(path.join(OUT_DIR, 'trainingsplan-kind.json'), JSON.stringify(planKind, null, 2), 'utf8');
console.log(`trainingsplan-kind.json: ${Object.keys(planKind).length} Gürtelstufen`);

const planErwachsener = {};
for (const belt of ADULT_BELT_LEVELS) {
  const plan = loadTrainingsplan(ADULT_TRAINING_XLSX, 'Erwachsener', belt);
  if (plan.length) planErwachsener[belt] = plan;
}
fs.writeFileSync(
  path.join(OUT_DIR, 'trainingsplan-erwachsener.json'),
  JSON.stringify(planErwachsener, null, 2),
  'utf8'
);
console.log(`trainingsplan-erwachsener.json: ${Object.keys(planErwachsener).length} Gürtelstufen`);
