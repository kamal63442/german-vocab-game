const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const data = JSON.parse(fs.readFileSync('data/b1-glossary.json', 'utf8'));
const entries = data.entries;
assert.equal(entries.length, 2007);
assert.equal(data.document.page_count, 45);
assert.equal(data.chapters.length, 12);
assert.equal(new Set(entries.map(e => e.id)).size, 2007);
assert.deepEqual(data.chapters.flatMap(c => c.entry_ids), entries.map(e => e.id));
const lines = new Map(data.source_lines.map(l => [l.id, l]));
const referenced = new Set();
for (const e of entries) {
  assert.ok(e.german && e.english);
  for (const field of ['german', 'english']) {
    const original = e.line_refs.map(ref => lines.get(ref)[field] || '').join('');
    const chars = value => [...value.replace(/\s/g, '')].sort().join('');
    assert.equal(chars(e[field]), chars(original), e.id);
  }
  e.line_refs.forEach(ref => { assert.ok(!referenced.has(ref)); referenced.add(ref); });
}
assert.equal(referenced.size, data.source_lines.filter(l => !l.heading).length);
assert.equal(new Set(data.source_lines.map(l => l.page)).size, 45);
assert.ok(entries.some(e => e.german === 'der Pilz, -e' && e.english === 'mushroom'));
assert.ok(!JSON.stringify(data).includes('\ufffd'));
const nodes = { '#b1-glossary-results': {}, '#b1-result-count': {}, '[data-b1-chapter-select]': {} };
let pending;
const context = vm.createContext({
  cleanText: value => value.trim(),
  escapeHtml: value => String(value).replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  document: { querySelector: selector => nodes[selector], querySelectorAll: () => [] },
  window: { clearTimeout() {}, setTimeout: callback => { pending = callback; return 1; } },
  fetch: async () => ({ ok: true, json: async () => data }), b1GlossaryWords: [],
  inferGlossaryPos: () => 'other'
});
vm.runInContext(html.slice(html.indexOf('function sectionLabel(section)'), html.indexOf('function filteredA1Entries()')), context);
vm.runInContext(html.slice(html.indexOf('async function loadB1Glossary()'), html.indexOf('async function loadA2Glossary()')), context);
(async () => {
  await context.loadB1Glossary();
  assert.equal(context.b1GlossaryWords.length, 2007);
  for (let chapter = 1; chapter <= 12; chapter++) {
    context.setB1ChapterFilter(String(chapter));
    assert.equal(context.filteredB1Entries().length, data.chapters[chapter - 1].entry_ids.length);
    assert.equal(nodes['[data-b1-chapter-select]'].value, String(chapter));
  }
  context.setB1ChapterFilter('all');
  for (const query of ['faulenzen', 'poisonous', '  GIFTIG  ', 'zzzz-no-matching-entry', '']) {
    context.handleB1Search({ target: { closest: () => ({ value: query }) } }); pending();
    const expected = entries.filter(e => (e.german + ' ' + e.english + ' ' + context.sectionLabel(e.section)).toLocaleLowerCase('de-DE').includes(query.trim().toLocaleLowerCase('de-DE')));
    assert.equal(context.filteredB1Entries().length, expected.length);
  }
  assert.match(context.renderB1Glossary(), /for="b1-chapter-select"/);
  assert.match(context.renderB1Glossary(), /aria-live="polite"/);
  assert.equal((context.renderB1Results(entries).match(/<td lang="de">/g) || []).length, 2007);
  vm.runInContext('b1GlossaryEntries = []; b1GlossaryPromise = null;', context);
  context.fetch = async () => ({ ok: false, status: 503 });
  await assert.rejects(context.loadB1Glossary(), /503/);
  context.fetch = async () => ({ ok: true, json: async () => data });
  await context.loadB1Glossary();
  for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(script[1]);
  console.log('B1: 2,007 entries / 12 chapters / 45 pages; source coverage, filters, search, retry and syntax passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
