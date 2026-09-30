const fs = require('fs');
const path = require('path');
const vm = require('node:vm');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'a1-glossary.json'), 'utf8'));
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
const failures = [];
let checks = 0;
const check = (condition, message) => {
  checks += 1;
  if (!condition) failures.push(message);
};
const expectedCounts = [206, 250, 157, 198, 151, 144, 139, 168, 137, 112, 161, 153];
const lines = new Map(data.source_lines.map(line => [line.id, line]));
const entries = new Map(data.entries.map(entry => [entry.id, entry]));
const references = new Map();

check(data.document.title === 'A1 Glossary' && data.document.level === 'A1', 'Generic A1 document metadata must be retained.');
check(data.document.page_count === 48, 'All 48 source pages must be represented.');
check(data.document.chapter_count === 12 && data.chapters.length === 12, 'All 12 source chapters must be retained.');
check(data.document.entry_count === 1976 && data.entries.length === 1976, 'All 1,976 source occurrences must be retained, without deduplication.');
check(JSON.stringify(Object.keys(data.document).sort()) === JSON.stringify(['chapter_count', 'entry_count', 'level', 'page_count', 'title']), 'Document metadata must not include local paths or publisher/author credits.');
check(lines.size === data.source_lines.length, 'Source line IDs must be unique.');
check(entries.size === data.entries.length, 'Entry IDs must be unique.');
check(JSON.stringify([...new Set(data.source_lines.map(line => line.page))]) === JSON.stringify(Array.from({ length: 48 }, (_, index) => index + 1)), 'Every PDF page must have source-line provenance.');

data.chapters.forEach((chapter, index) => {
  check(chapter.number === index + 1, `Chapter ${index + 1} must be in source order.`);
  check(chapter.entry_ids.length === expectedCounts[index], `Chapter ${chapter.number} has an incorrect entry count.`);
  check(JSON.stringify(chapter.entry_ids) === JSON.stringify(data.entries.filter(entry => entry.chapter.number === chapter.number).map(entry => entry.id)), `Chapter ${chapter.number} index must match its entries in order.`);
});

data.entries.forEach(entry => {
  const chapter = data.chapters[entry.chapter.number - 1];
  check(chapter?.title === entry.chapter.title, `${entry.id}: chapter title mismatch.`);
  check(typeof entry.german === 'string' && entry.german.trim() && typeof entry.english === 'string' && entry.english.trim(), `${entry.id}: empty German or English.`);
  check(entry.line_refs.length > 0 && entry.line_refs.every(ref => lines.has(ref)), `${entry.id}: missing source-line references.`);
  const source = entry.line_refs.map(ref => lines.get(ref)).filter(Boolean);
  check(entry.id === `a1-${entry.line_refs[0]}`, `${entry.id}: unstable source-derived ID.`);
  check(source.map(line => line.german).filter(Boolean).join(' ') === entry.german, `${entry.id}: German differs from its source lines.`);
  check(source.map(line => line.english).filter(Boolean).join(' ') === (entry.source_english || entry.english), `${entry.id}: original English differs from its source lines.`);
  check(JSON.stringify([...new Set(source.map(line => line.page))]) === JSON.stringify(entry.pages), `${entry.id}: page provenance mismatch.`);
  check((entry.german.match(/\(/g) || []).length === (entry.german.match(/\)/g) || []).length, `${entry.id}: truncated German example or grammatical note.`);
  check((entry.english.match(/\(/g) || []).length === (entry.english.match(/\)/g) || []).length, `${entry.id}: truncated English example or grammatical note.`);
  check(!/[\uFFFD\u0000]/.test(entry.german + entry.english), `${entry.id}: invalid extracted character.`);
  entry.line_refs.forEach(ref => references.set(ref, (references.get(ref) || 0) + 1));
});

data.source_lines.forEach(line => {
  check(line.id === `p${String(line.page).padStart(3, '0')}-l${String(line.line).padStart(3, '0')}`, `${line.id}: source line numbering mismatch.`);
  check(line.heading ? !references.has(line.id) : references.get(line.id) === 1, `${line.id}: source text must belong to exactly one entry, except headings.`);
});

const has = (german, english) => data.entries.some(entry => german.test(entry.german) && english.test(entry.english));
check(has(/^null$/, /^zero$/), 'Missing null / zero.');
check(has(/^die S-Bahn, -en$/, /^suburban train$/), 'Missing die S-Bahn / suburban train.');
check(has(/^nach Hause$/, /^\(toward\) home$/), 'Missing nach Hause / (toward) home.');
check(has(/^die Dame, -n \(Sehr geehrte Damen und Herren,/, /^madam \(Dear Sir or Madam,/), 'Missing die Dame with its full example.');
check(has(/^ruhig \(Seid bitte ruhig!\)$/, /^quiet \(Please be quiet!\)$/), 'Missing ruhig with its example.');
check(has(/^danken$/, /^to thank$/), 'Missing danken / to thank.');
check(has(/^das Reiseziel, -e$/, /^\(travel\) destination$/), 'Missing das Reiseziel / (travel) destination.');
check(has(/^die Reaktion, -en$/, /^reaction$/), 'The singular noun die Reaktion must not be replaced by the section heading.');
check(has(/^sie \(/, /^she \(/) && has(/^sie \(/, /^they \(/) && has(/^sie \(/, /^her \(/), 'Distinct lowercase sie meanings must not be collapsed.');
check(has(/^Sie \(/, /^you \(/) && has(/^ihr \(/, /^you \(/), 'Formal Sie and plural ihr must remain distinct.');
check(has(/^die Autobahn, -en$/, /^highway$/), 'Noun plural endings must remain intact.');
check(has(/^heißen, er heißt, hat geheißen \(/, /^to be named \(/), 'Irregular verb forms and examples must remain intact.');
check(has(/^Englisch$/, /^English$/), 'Stressed glyph overlay must not split Englisch.');
check(data.source_lines.some(line => line.german === 'Englisch' && line.style?.underlined), 'Source pronunciation stress formatting must remain traceable.');
check(data.entries.some(entry => entry.activity?.includes('ÜB')), 'Workbook exercise references must be retained.');
check(data.entries.some(entry => entry.pages[0] === 3 && entry.german === 'guten Morgen'), 'Top-of-page Guten Morgen must not be cropped.');
check(data.entries.some(entry => entry.pages[0] === 7 && /^der Moment, -e/.test(entry.german)), 'Top-of-page multiline Moment entry must not be cropped.');

const corrections = [
  [
    "a1-p005-l010",
    "Portugese",
    "Portuguese"
  ],
  [
    "a1-p005-l039",
    "to great",
    "to greet"
  ],
  [
    "a1-p005-l004",
    "Brasil",
    "Brazil"
  ],
  [
    "a1-p035-l012",
    "refridgerator",
    "refrigerator"
  ],
  [
    "a1-p043-l004",
    "balllpoint pen",
    "ballpoint pen"
  ],
  [
    "a1-p027-l005",
    "morning",
    "early"
  ],
  [
    "a1-p027-l027",
    "result",
    "event"
  ],
  [
    "a1-p024-l004",
    "extracurricular activity",
    "leisure activity"
  ],
  [
    "a1-p012-l013",
    "over (The tower is over 160 years old.)",
    "over (The tower is over 120 years old.)"
  ]
];
check(data.entries.filter(entry => entry.source_english).length === corrections.length, 'Only reviewed source errors may be corrected.');
corrections.forEach(([id, original, corrected]) => {
  check(entries.get(id)?.source_english === original && entries.get(id)?.english === corrected, `${id}: correction or original wording was lost.`);
});
check(html.includes('const A1_ENTRY_COUNT = 1976;'), 'Displayed A1 count must match the new data.');
check(!html.includes('const GLOSSARY_WORDS =') && !html.includes('1,897 Wörter'), 'Old A1 data/count must not remain active.');
check(serviceWorker.includes('./data/a1-glossary.json'), 'A1 JSON must be available offline.');
check(html.includes('if (level === "a1" || level === "both")'), 'A1 and reverse practice must load rebuilt data.');
check(html.includes('for="a1-search"') && html.includes('for="a1-chapter-select"'), 'Search and native chapter selector require labels.');

function sourceBetween(start, end) {
  const from = html.indexOf(start);
  const to = html.indexOf(end, from);
  if (from < 0 || to <= from) throw new Error(`Missing application source: ${start}`);
  return html.slice(from, to);
}

function makeContext() {
  const elements = {
    '#a1-glossary-results': { innerHTML: '' }, '#a1-result-count': { textContent: '' },
    '[data-a1-chapter-select]': { value: 'all' }
  };
  const context = vm.createContext({
    A1_DATA_URL: './data/a1-glossary.json', A1_ENTRY_COUNT: 1976,
    a1GlossaryEntries: [], a1GlossaryDocument: null, glossaryWords: [], a1GlossaryPromise: null,
    a1GlossaryFilter: { query: '', chapter: 'all' }, a1SearchTimer: null, a1GlossaryError: false,
    pendingKind: 'vocab', b1PlusGlossaryError: false,
    state: { progress: {}, stats: {}, settings: {}, b1PlusSession: { unchanged: true } }, activeSession: null, lastSession: null,
    crypto: require('node:crypto').webcrypto, performance: { now: () => 100 },
    b1GlossaryWords: [], a2GlossaryWords: [], b1PlusGlossaryWords: [], pendingVocabLevel: 'a1',
    saveState() {}, saveB1PlusSession() {}, stopTimer() {}, tickExam() {}, sound() {}, toast() {},
    confirmation: async () => false, timerId: null, renderActiveQuestion() {},
    gradeFor: () => 'D', updateAchievements: () => [], updatePunchHoles() {}, celebrate() {},
    cleanText: value => String(value).trim(),
    escapeHtml: value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]),
    document: { querySelector: selector => elements[selector] || null, querySelectorAll: () => [] },
    window: { clearTimeout() {}, setTimeout(callback) { callback(); return 1; }, setInterval() { return 1; } },
    app: { querySelector: () => ({ focus() {} }) },
    fetch: async url => ({ ok: true, json: async () => url.includes('b1-glossary') ? JSON.parse(fs.readFileSync(path.join(__dirname, 'data/b1-glossary.json'), 'utf8')) : data }),
    render(screen) { context.screen = screen; }
  });
  vm.runInContext([
    sourceBetween('function shuffle(items)', 'function percent(numerator'),
    sourceBetween('function percent(numerator', 'function average(values)'),
    sourceBetween('const posLabels =', '// ---- js/possessive.js ----'),
    sourceBetween('function sectionLabel(section)', 'function filteredA2Entries()'),
    sourceBetween('function inferGlossaryPos(german, english)', 'async function loadA2Glossary()'),
    sourceBetween('function renderSessionTypeSelect(kind, vocabLevel)', 'function b1PlusChapterSummaries()'),
    sourceBetween('async function startVocabSession(', 'function startPossessiveSession('),
    sourceBetween('async function handleAction(event)', 'function paraAnswer('),
    sourceBetween('function nextQuestion()', 'async function abandonSession(')
  ].join('\n'), context);
  return context;
}

async function verifyApp() {
  const context = makeContext();
  let requests = 0;
  context.fetch = async url => { requests += 1; return { ok: true, json: async () => url.includes('b1-glossary') ? JSON.parse(fs.readFileSync(path.join(__dirname, 'data/b1-glossary.json'), 'utf8')) : data }; };
  await context.loadA1Glossary();
  await context.loadA1Glossary();
  check(requests === 1, 'A1 data must load once and reuse the cached result.');
  check(context.glossaryWords.length === 1976 && new Set(context.glossaryWords.map(word => word.key)).size === 1976, 'Practice must use every source occurrence with unique keys.');
  check(context.glossaryWords.some(word => word.word === 'grüßen' && word.meaning === 'to greet'), 'Practice must use corrected, not raw source, translations.');
  const menu = context.renderSessionTypeSelect('vocab', 'a1');
  check(menu.indexOf('Prüfung') < menu.indexOf('open-a1-glossary') && menu.includes('Ganzes Glossar'), 'A1 Ganzes Glossar must appear below Prüfung.');
  check(menu.includes('Kapitelweise') && menu.includes('Choose a chapter and practise every entry'), 'A1 practice menu must match the B1+ chapter flow.');
  check((context.renderA1ChapterSelect().match(/data-action="choose-a1-chapter"/g) || []).length === 12, 'A1 picker must expose all twelve chapters.');
  for (let chapter = 1; chapter <= 12; chapter += 1) {
    await context.startVocabSession('practice', 'a1', 'vocab', chapter);
    const expected = data.entries.filter(entry => entry.chapter.number === chapter).map(entry => JSON.stringify([entry.german, entry.english])).sort();
    const actual = context.activeSession.questions.map(question => JSON.stringify([question.word, question.correct])).sort();
    check(JSON.stringify(actual) === JSON.stringify(expected), `Chapter ${chapter}: practice must include every source occurrence, with no entries from other chapters.`);
    check(context.activeSession.chapter === chapter && context.activeSession.questions.length === expectedCounts[chapter - 1], `Chapter ${chapter}: practice must not use the 20-question limit.`);
  }
  check(context.state.b1PlusSession.unchanged, 'A1 saves must not overwrite B1+ progress.');
  context.activeSession.currentAnswer = { correct: true };
  context.activeSession.answers.push({ correct: true });
  context.saveA1Session();
  context.nextQuestion();
  const persisted = JSON.parse(JSON.stringify(context.state));
  context.state = persisted; context.activeSession = null;
  check(context.resumeA1Session(12) && context.activeSession.index === 1 && context.activeSession.answers.length === 1, 'Serialized A1 progress must resume at the saved position without dropping answers.');
  check(context.activeSession.requeued instanceof vm.runInContext('Set', context), 'Resume must restore the retry Set.');
  check(context.renderA1ChapterSelect().includes('Übung fortsetzen') && context.renderA1ChapterSelect().includes('resume-meter'), 'Saved chapter must show B1+-style resume text and progress.');
  check(!context.resumeA1Session(1), 'Choosing another chapter must not resume the wrong chapter.');
  context.finishSession(false);
  check(context.state.a1Session === null && context.state.b1PlusSession.unchanged, 'Finishing A1 must clear only its saved session.');
  await context.startVocabSession('exam', 'a1');
  check(context.activeSession.questions.length === 50 && context.activeSession.chapter === null && context.activeSession.endsAt, 'A1 exam must remain 50 questions with a timer, not chapter practice.');
  await context.startVocabSession('practice', 'both', 'vocab-reverse');
  check(context.activeSession.questions.length === 20 && context.activeSession.direction === 'reverse' && context.activeSession.chapter === null, 'Reverse practice must keep its existing mixed-list behavior.');
  const buttonFor = dataset => ({ dataset, disabled: false, setAttribute() {}, removeAttribute() {} });
  await context.startVocabSession('practice', 'b1');
  check(context.activeSession.questions.length === 20 && context.activeSession.level === 'b1', 'B1 source rebuild must preserve existing practice mode.');
  await context.startVocabSession('exam', 'b1');
  check(context.activeSession.questions.length === 50 && context.activeSession.endsAt, 'B1 source rebuild must preserve its timed exam.');
  const eventFor = dataset => ({ target: { closest: () => buttonFor(dataset) } });
  await context.handleAction(eventFor({ action: 'start-session', mode: 'practice', kind: 'vocab' }));
  check(context.screen === 'a1-chapter-select', 'A1 Übungsmodus must open its chapter picker.');
  await context.startVocabSession('practice', 'a1', 'vocab', 1);
  context.activeSession = null;
  context.confirmation = async () => false;
  await context.handleAction(eventFor({ action: 'choose-a1-chapter', chapter: '2' }));
  check(context.activeSession === null && context.state.a1Session.chapter === 1, 'Cancelling a chapter replacement must preserve the saved session.');
  context.confirmation = async () => true;
  await context.handleAction(eventFor({ action: 'choose-a1-chapter', chapter: '2' }));
  check(context.activeSession.chapter === 2 && context.state.a1Session.chapter === 2, 'Confirmed chapter replacement must start and save the selected full chapter.');
  context.state.a1Session = { ...context.state.a1Session, chapter: 13 };
  check(context.savedA1Session() === null, 'Out-of-range saved chapters must not be resumed.');
  const sectionCount = new Set(data.entries.map(entry => JSON.stringify([entry.chapter.number, entry.section || 'other']))).size;
  check((context.renderA1Glossary().match(/<tr>/g) || []).length === 1976 + sectionCount, 'Rendered glossary must retain all data rows and section headers.');
  context.setA1ChapterFilter('1');
  check(context.filteredA1Entries().length === 206, 'Chapter filtering must retain all 206 chapter-one entries.');
  context.a1GlossaryFilter = { chapter: 'all', query: 'refrigerator' };
  check(context.filteredA1Entries().some(entry => entry.german.startsWith('der Kühlschrank')), 'English search must use corrected translations.');
  context.handleA1Search({ target: { closest: () => ({ value: 'NO_MATCH_876542' }) } });
  check(context.filteredA1Entries().length === 0 && context.renderA1Results([]).includes('No matching A1 entries'), 'No-results search must be recoverable.');
  check(context.renderA1Results([{ chapter: { number: 1, title: '<script>' }, german: '<img>', english: '&test', section: '<section>' }]).includes('&lt;img&gt;'), 'Source text must be escaped when rendered.');

  const button = { disabled: false, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; }, removeAttribute(name) { delete this.attributes[name]; } };
  const failed = makeContext();
  failed.fetch = async () => ({ ok: false, status: 503 });
  await failed.openA1Glossary(button);
  check(failed.a1GlossaryError && failed.screen === 'session-type-select' && !failed.a1GlossaryPromise, 'Loading failure must show retry and reset the failed promise.');
  check(failed.renderSessionTypeSelect('vocab', 'a1').includes('role="alert"') && !button.disabled && !button.attributes['aria-busy'], 'Failure must be announced and release the loading button.');
  failed.fetch = async () => ({ ok: true, json: async () => data });
  await failed.openA1Glossary(button);
  check(!failed.a1GlossaryError && failed.screen === 'a1-glossary' && failed.glossaryWords.length === 1976, 'Retry must recover and open the complete glossary.');
  for (const invalid of [
    { entries: data.entries.slice(1) },
    { entries: data.entries.map((entry, index) => index ? entry : { ...entry, english: '' }) },
    { entries: data.entries.map((entry, index) => index ? entry : { ...entry, id: data.entries[1].id }) }
  ]) {
    const incomplete = makeContext();
    incomplete.fetch = async () => ({ ok: true, json: async () => invalid });
    let rejected = false;
    try { await incomplete.loadA1Glossary(); } catch { rejected = true; }
    check(rejected && incomplete.glossaryWords.length === 0, 'Incomplete or duplicate-ID data must not become actionable practice data.');
  }
}

verifyApp().catch(error => { failures.push(error.stack || error.message); }).finally(() => {
  console.log(`A1 entries: ${data.entries.length}; chapters: ${data.chapters.length}; source pages: ${data.document.page_count}; source lines: ${data.source_lines.length}`);
  console.log(`Checks: ${checks}; failures: ${failures.length}`);
  failures.forEach(failure => console.error(`- ${failure}`));
  if (failures.length) process.exitCode = 1;
});
