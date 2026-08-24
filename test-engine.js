const { generateQuestion, NOUNS, PERSONS, ENDINGS, formOf } = require('./possessivartikel-engine.js');

const RUNS = 20000;
const errors = [];
const caseCounts = { nom: 0, akk: 0 };
const difficultyCounts = { easy: 0, medium: 0, hard: 0 };
const builderCounts = {};
const formCounts = {};

for (let i = 0; i < RUNS; i++) {
  const caseArg = ['nom', 'akk', 'both'][i % 3];
  const difficulty = ['easy', 'medium', 'hard'][i % 3];
  const q = generateQuestion(caseArg, { difficulty });

  caseCounts[q.caseType] = (caseCounts[q.caseType] || 0) + 1;
  difficultyCounts[q.difficulty]++;
  builderCounts[q.builder] = (builderCounts[q.builder] || 0) + 1;
  formCounts[q.correctForm] = (formCounts[q.correctForm] || 0) + 1;

  const tag = `#${i} [${q.caseType}/${q.difficulty}]`;
  if (q.options.length !== 4) errors.push(`${tag} options length ${q.options.length}`);
  if (new Set(q.options).size !== 4) errors.push(`${tag} duplicate options: ${q.options.join(',')}`);
  if (!q.options.includes(q.correctForm)) errors.push(`${tag} correctForm missing from options`);
  if (q.correctIndex !== q.options.indexOf(q.correctForm)) errors.push(`${tag} wrong correctIndex`);
  if (!q.mainLine || !q.mainLine.includes('___')) errors.push(`${tag} no blank in mainLine: ${q.mainLine}`);
  if (!q.explanation) errors.push(`${tag} empty explanation`);
  if (q.caseType === 'nom' && !q.setupLine) errors.push(`${tag} nom without setupLine`);

  // independent re-derivation of the correct form
  const expected = formOf(q.meta.stem, ENDINGS[q.caseType][q.meta.gender]);
  if (q.correctForm !== expected) errors.push(`${tag} form mismatch: got ${q.correctForm}, expected ${expected}`);

  // blank must be followed by the meta word
  if (!q.mainLine.includes(`___ ${q.meta.word}`) && !q.mainLine.includes(`___ ${q.meta.word}?`)) {
    errors.push(`${tag} mainLine word mismatch: "${q.mainLine}" vs "${q.meta.word}"`);
  }
}

console.log(`Runs: ${RUNS}`);
console.log(`Errors: ${errors.length}`);
if (errors.length) console.log(errors.slice(0, 10));
console.log(`Cases: ${JSON.stringify(caseCounts)}`);
console.log(`Difficulty: ${JSON.stringify(difficultyCounts)}`);
console.log(`Builders: ${JSON.stringify(builderCounts)}`);
console.log(`Distinct correct forms (${Object.keys(formCounts).length}): ${Object.keys(formCounts).sort().join(', ')}`);
console.log(`Lexicon: ${NOUNS.length} nouns x2 numbers = ${NOUNS.length * 2} words, ${PERSONS.length} persons, 2 cases, 3 difficulties`);

// show 3 samples
for (const d of ['easy', 'medium', 'hard']) {
  const q = generateQuestion('both', { difficulty: d });
  console.log(`\nSample (${d}, ${q.caseType}):`);
  if (q.setupLine) console.log('  ' + q.setupLine);
  console.log('  ' + q.mainLine);
  console.log('  Options: ' + q.options.map((o, i) => (i === q.correctIndex ? '*' : '') + o).join(' | '));
}
