const fs = require('fs');
const path = require('path');

const root = __dirname;
const glossaryPath = path.join(root, 'data', 'b1plus-glossary.json');
const data = JSON.parse(fs.readFileSync(glossaryPath, 'utf8'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

check(data.document?.page_count === 58, 'Expected all 58 source pages.');
check(Array.isArray(data.entries), 'Expected an entries array.');
check(data.entries?.length === 2782, `Expected 2,782 entries, found ${data.entries?.length ?? 0}.`);
check(data.entries?.every(entry => String(entry.german || '').trim() && String(entry.english || '').trim()), 'Every entry must contain German and English text.');

const chapters = [...new Set(data.entries?.map(entry => entry.chapter?.number))].sort((a, b) => a - b);
check(JSON.stringify(chapters) === JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), `Expected chapters 1–10, found ${chapters.join(', ')}.`);
check(chapters.every(chapter => data.entries.filter(entry => entry.chapter?.number === chapter).length > 20), 'Every B1+ chapter should contain more than the old 20-question practice limit.');
check(html.includes('data-level="b1plus"'), 'B1+ practice card is missing.');
check(html.includes('data-action="open-b1plus-glossary"'), 'Full glossary entry point is missing.');
check(html.includes('renderB1PlusGlossary'), 'Full glossary renderer is missing.');
check(serviceWorker.includes('./data/b1plus-glossary.json'), 'B1+ glossary is missing from the offline cache.');

const levelSelect = html.slice(html.indexOf('function renderVocabLevelSelect'), html.indexOf('function sectionLabel'));
const sessionSelect = html.slice(html.indexOf('function renderSessionTypeSelect'), html.indexOf('const SKETCHY_SPEAKER'));
check(levelSelect.includes('Mittelstufe Plus'), 'B1+ practice card should be labelled Mittelstufe Plus.');
check(!levelSelect.includes('open-b1plus-glossary'), 'Full glossary should not appear in the main Wortschatz list.');
check(sessionSelect.indexOf('Prüfung') < sessionSelect.indexOf('open-b1plus-glossary'), 'Full glossary must appear below Prüfung in the B1+ screen.');
check(sessionSelect.includes('vocabLevel === "b1plus"'), 'Full glossary must be limited to the B1+ screen.');
check(html.includes('function renderB1PlusChapterSelect()'), 'B1+ chapter selection screen is missing.');
check(html.includes('data-action="choose-b1plus-chapter"'), 'B1+ chapter buttons are missing.');
check(html.includes('const count = isB1PlusChapterPractice ? words.length'), 'B1+ chapter practice must include every entry in the selected chapter.');
check(html.includes('entry.chapter === selectedChapter'), 'B1+ practice must filter questions to the selected chapter.');

console.log(`B1+ entries: ${data.entries?.length ?? 0}`);
console.log(`Chapters: ${chapters.join(', ')}`);
console.log(`Failures: ${failures.length}`);
if (failures.length) {
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exitCode = 1;
}
