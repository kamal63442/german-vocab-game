const fs = require('fs');
const path = require('path');

const root = __dirname;
const glossaryPath = path.join(root, 'data', 'a2-glossary.json');
const data = JSON.parse(fs.readFileSync(glossaryPath, 'utf8'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

check(data.document?.title === 'A2 German–English Glossary', 'Expected generic A2 glossary metadata.');
check(data.document?.entry_count === 1486, 'Expected the A2 document entry count.');
check(data.document?.chapter_count === 12, 'Expected the A2 document chapter count.');
check(JSON.stringify(Object.keys(data.document || {}).sort()) === JSON.stringify(['chapter_count', 'entry_count', 'language_pair', 'level', 'page_count', 'title']), 'A2 document metadata must contain only generic glossary fields.');
check(Array.isArray(data.entries), 'Expected an entries array.');
check(data.entries?.length === 1486, `Expected 1,486 entries, found ${data.entries?.length ?? 0}.`);
check(data.entries?.every(entry => String(entry.german || '').trim() && String(entry.english || '').trim()), 'Every A2 entry must contain German and English text.');

const chapters = [...new Set(data.entries?.map(entry => entry.chapter?.number))].sort((a, b) => a - b);
check(JSON.stringify(chapters) === JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), `Expected chapters 1–12, found ${chapters.join(', ')}.`);
check(chapters.every(chapter => data.entries.filter(entry => entry.chapter?.number === chapter).length > 20), 'Every A2 chapter should contain more than the old 20-question practice limit.');
check(html.includes('data-level="a2"'), 'A2 practice card is missing.');
check(html.includes('Grundstufe Plus · Deutsch–Englisch'), 'The A2 glossary should use the Grundstufe Plus label.');
check(html.includes('data-action="open-a2-glossary"'), 'A2 full glossary entry point is missing.');
check(html.includes('renderA2Glossary'), 'A2 full glossary renderer is missing.');
check(serviceWorker.includes('./data/a2-glossary.json'), 'A2 glossary is missing from the offline cache.');

const levelSelect = html.slice(html.indexOf('function renderVocabLevelSelect'), html.indexOf('function sectionLabel'));
const sessionSelect = html.slice(html.indexOf('function renderSessionTypeSelect'), html.indexOf('const SKETCHY_SPEAKER'));
check(levelSelect.indexOf('data-level="a1"') < levelSelect.indexOf('data-level="a2"'), 'A2 should appear below A1.');
check(levelSelect.indexOf('data-level="a2"') < levelSelect.indexOf('data-level="b1"'), 'A2 should appear above B1.');
check(levelSelect.includes('Grundstufe Plus'), 'A2 practice card should be labelled Grundstufe Plus.');
check(!levelSelect.includes('open-a2-glossary'), 'Full A2 glossary should not appear in the main Wortschatz list.');
check(sessionSelect.indexOf('Prüfung') < sessionSelect.indexOf('open-a2-glossary'), 'Full A2 glossary must appear below Prüfung in the A2 screen.');
check(sessionSelect.includes('vocabLevel === "a2"'), 'Full A2 glossary must be limited to the A2 screen.');
check(html.includes('function renderA2ChapterSelect()'), 'A2 chapter selection screen is missing.');
check(html.includes('data-action="choose-a2-chapter"'), 'A2 chapter buttons are missing.');
check(html.includes('const count = isB1PlusChapterPractice ? words.length : isA2ChapterPractice ? words.length'), 'A2 chapter practice must include every entry in the selected chapter.');
check(html.includes('a2GlossaryWords.filter(entry => entry.chapter === selectedChapter)'), 'A2 practice must filter questions to the selected chapter.');

console.log(`A2 entries: ${data.entries?.length ?? 0}`);
console.log(`Chapters: ${chapters.join(', ')}`);
console.log(`Failures: ${failures.length}`);
if (failures.length) {
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exitCode = 1;
}
