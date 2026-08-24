/**
 * Possessivartikel-Engine v2 (Nominativ & Akkusativ)
 * ---------------------------------------------------
 * 4-layer architecture — no hardcoded questions, everything is generated:
 *
 *   LAYER 1  LEXICON      expandable word data (nouns with plural + adjectives,
 *                         names, cities, verb conjugations). Add entries → more questions.
 *   LAYER 2  GRAMMAR      declension rules (nom/akk × m/f/n/pl × 8 persons).
 *   LAYER 3  BUILDERS     pluggable sentence builders. A future paragraph/cloze
 *                         mode is just: registerBuilder('paragraph', fn).
 *   LAYER 4  DISTRACTORS  smart wrong answers + difficulty control
 *                         (easy = gender errors, medium = + person errors, hard = mixed).
 *
 * Usage:
 *   const q = generateQuestion('both');                       // default hard
 *   const q = generateQuestion('akk', {difficulty:'hard'});   // akkusativ only, hard
 *   const q = generateQuestion('nom', {difficulty:'easy'});
 *   q.setupLine / q.mainLine / q.options / q.correctIndex /
 *   q.correctForm / q.explanation / q.caseType / q.difficulty / q.builder / q.meta
 *
 * Extending (future paragraph mode):
 *   PossessiveEngine.registerBuilder('paragraph', (ctx) => ({
 *     setupLine, mainLine, explanation
 *   }));
 *   generateQuestion('both', {builder:'paragraph'});
 */
(function (global) {
  'use strict';

  // ==============================
  // LAYER 1 — LEXICON
  // ==============================

  const MALE_NAMES = ['Ben','Tom','Paul','Felix','Jonas','Max','Leon','Finn','Elias','Noah'];
  const FEMALE_NAMES = ['Mia','Lena','Sara','Emma','Laura','Nina','Anna','Julia','Lina','Klara'];
  const CITIES = ['Berlin','Hamburg','München','Köln','Frankfurt','Leipzig','Wien','Bremen','Dresden','Zürich'];

  // sg/pl pairs — gender belongs to the singular; plural questions use gender 'pl'.
  // adj = curated adjectives so sentences stay semantically natural.
  const NOUNS = [
    // --- persons: masculin ---
    { sg:'Bruder', en:'brother',   pl:'Brüder',    gender:'m', cat:'person', adj:['klein','groß','nett','lustig','klug','sportlich'] },
    { sg:'Vater', en:'father',    pl:'Väter',     gender:'m', cat:'person', adj:['nett','streng','freundlich','lustig','groß'] },
    { sg:'Onkel', en:'uncle',    pl:'Onkel',     gender:'m', cat:'person', adj:['nett','lustig','freundlich','alt'] },
    { sg:'Sohn', en:'son',     pl:'Söhne',     gender:'m', cat:'person', adj:['klein','groß','nett','lustig','klug'] },
    { sg:'Freund', en:'friend',   pl:'Freunde',   gender:'m', cat:'person', adj:['nett','lustig','freundlich','klug','sportlich'] },
    { sg:'Opa', en:'grandpa',      pl:'Opas',      gender:'m', cat:'person', adj:['alt','nett','lustig','freundlich'] },
    { sg:'Nachbar', en:'neighbor',  pl:'Nachbarn',  gender:'m', cat:'person', adj:['nett','freundlich','leise','lustig'] },
    { sg:'Kollege', en:'colleague',  pl:'Kollegen',  gender:'m', cat:'person', adj:['nett','freundlich','klug','fleißig'] },
    // --- persons: feminin ---
    { sg:'Mutter', en:'mother',    pl:'Mütter',      gender:'f', cat:'person', adj:['nett','streng','freundlich','klug','lustig'] },
    { sg:'Schwester', en:'sister', pl:'Schwestern',  gender:'f', cat:'person', adj:['klein','groß','nett','lustig','klug','sportlich'] },
    { sg:'Tante', en:'aunt',     pl:'Tanten',      gender:'f', cat:'person', adj:['nett','lustig','freundlich','alt'] },
    { sg:'Tochter', en:'daughter',   pl:'Töchter',     gender:'f', cat:'person', adj:['klein','groß','nett','lustig','klug'] },
    { sg:'Freundin', en:'friend',  pl:'Freundinnen', gender:'f', cat:'person', adj:['nett','lustig','freundlich','klug','sportlich'] },
    { sg:'Oma', en:'grandma',       pl:'Omas',        gender:'f', cat:'person', adj:['alt','nett','lustig','freundlich'] },
    { sg:'Kollegin', en:'colleague',  pl:'Kolleginnen', gender:'f', cat:'person', adj:['nett','freundlich','klug','fleißig'] },
    // --- persons: neutral ---
    { sg:'Kind', en:'child', en:'child', pl:'Kinder', gender:'n', cat:'person', adj:['klein','süß','laut','lustig','klug'] },
    { sg:'Baby', en:'baby', pl:'Babys',  gender:'n', cat:'person', adj:['klein','süß','laut'] },
    // --- things: masculin ---
    { sg:'Hund', en:'dog',      pl:'Hunde',     gender:'m', cat:'thing', adj:['klein','groß','süß','laut','brav','treu'] },
    { sg:'Mantel', en:'coat',    pl:'Mäntel',    gender:'m', cat:'thing', adj:['neu','alt','warm','schön','teuer'] },
    { sg:'Schlüssel', en:'key', en:'key', pl:'Schlüssel', gender:'m', cat:'thing', adj:['neu','alt','klein','wichtig'] },
    { sg:'Computer', en:'computer',  pl:'Computer',  gender:'m', cat:'thing', adj:['neu','alt','teuer','schnell','modern','kaputt'] },
    { sg:'Vogel', en:'bird',     pl:'Vögel',     gender:'m', cat:'thing', adj:['klein','süß','laut','schön'] },
    { sg:'Stuhl', en:'chair',     pl:'Stühle',    gender:'m', cat:'thing', adj:['neu','alt','schön','bequem','teuer'] },
    { sg:'Tisch', en:'table',     pl:'Tische',    gender:'m', cat:'thing', adj:['neu','alt','groß','klein','schön'] },
    // --- things: feminin ---
    { sg:'Katze', en:'cat',   pl:'Katzen',   gender:'f', cat:'thing', adj:['klein','süß','faul','schön'] },
    { sg:'Tasche', en:'bag',  pl:'Taschen',  gender:'f', cat:'thing', adj:['neu','alt','klein','groß','schön','teuer'] },
    { sg:'Uhr', en:'clock',     pl:'Uhren',    gender:'f', cat:'thing', adj:['neu','alt','klein','teuer','schön','kaputt'] },
    { sg:'Lampe', en:'lamp',   pl:'Lampen',   gender:'f', cat:'thing', adj:['neu','alt','schön','teuer','kaputt'] },
    { sg:'Flasche', en:'bottle', en:'bottle', pl:'Flaschen', gender:'f', cat:'thing', adj:['neu','alt','klein','groß','leer'] },
    { sg:'Jacke', en:'jacket',   pl:'Jacken',   gender:'f', cat:'thing', adj:['neu','alt','schön','teuer','warm'] },
    // --- things: neutral ---
    { sg:'Auto', en:'car',    pl:'Autos',    gender:'n', cat:'thing', adj:['neu','alt','schnell','teuer','klein','groß','kaputt'] },
    { sg:'Buch', en:'book',    pl:'Bücher',   gender:'n', cat:'thing', adj:['neu','alt','spannend','langweilig','dick','dünn'] },
    { sg:'Fahrrad', en:'bicycle', pl:'Fahrräder',gender:'n', cat:'thing', adj:['neu','alt','schnell','kaputt','teuer'] },
    { sg:'Handy', en:'phone',   pl:'Handys',   gender:'n', cat:'thing', adj:['neu','alt','teuer','modern','kaputt'] },
    { sg:'Haus', en:'house',    pl:'Häuser',   gender:'n', cat:'thing', adj:['neu','alt','groß','klein','schön','modern'] },
    { sg:'Zimmer', en:'room',  pl:'Zimmer',   gender:'n', cat:'thing', adj:['klein','groß','schön','hell','gemütlich'] },
    { sg:'Fenster', en:'window', pl:'Fenster',  gender:'n', cat:'thing', adj:['neu','alt','groß','klein','sauber'] },
    { sg:'Sofa', en:'sofa',    pl:'Sofas',    gender:'n', cat:'thing', adj:['neu','alt','bequem','schön','teuer'] }
  ];

  // Verb conjugations — keyed by conjCat (sie_sg uses 'er' forms, Sie/sie_pl use 'sie' forms).
  const VERB_FORMS = {
    besuchen:  { ich:'besuche',  du:'besuchst',  er:'besucht',  wir:'besuchen',  ihr:'besucht',  sie:'besuchen'  },
    kennen:    { ich:'kenne',    du:'kennst',    er:'kennt',    wir:'kennen',    ihr:'kennt',    sie:'kennen'    },
    lieben:    { ich:'liebe',    du:'liebst',    er:'liebt',    wir:'lieben',    ihr:'liebt',    sie:'lieben'    },
    vermissen: { ich:'vermisse', du:'vermisst',  er:'vermisst', wir:'vermissen', ihr:'vermisst', sie:'vermissen' },
    suchen:    { ich:'suche',    du:'suchst',    er:'sucht',    wir:'suchen',    ihr:'sucht',    sie:'suchen'    },
    verkaufen: { ich:'verkaufe', du:'verkaufst', er:'verkauft', wir:'verkaufen', ihr:'verkauft', sie:'verkaufen' },
    haben:     { ich:'habe',     du:'hast',      er:'hat',      wir:'haben',     ihr:'habt',     sie:'haben'     },
    mögen:     { ich:'mag',      du:'magst',     er:'mag',      wir:'mögen',     ihr:'mögt',     sie:'mögen'     },
    brauchen:  { ich:'brauche',  du:'brauchst',  er:'braucht',  wir:'brauchen',  ihr:'braucht',  sie:'brauchen'  },
    finden:    { ich:'finde',    du:'findest',   er:'findet',   wir:'finden',    ihr:'findet',   sie:'finden'    }
  };
  const PERSON_VERBS = ['besuchen','kennen','lieben','vermissen','haben','mögen'];
  const THING_VERBS  = ['suchen','verkaufen','kennen','haben','brauchen','finden'];

  // ==============================
  // LAYER 2 — GRAMMAR
  // ==============================

  const PERSONS = [
    { id:'ich',    stem:'mein',  conjCat:'ich', desc:'ich → mein' },
    { id:'du',     stem:'dein',  conjCat:'du',  desc:'du → dein' },
    { id:'er',     stem:'sein',  conjCat:'er',  desc:'er → sein' },
    { id:'sie_sg', stem:'ihr',   conjCat:'er',  desc:'sie (Einzahl) → ihr' },
    { id:'wir',    stem:'unser', conjCat:'wir', desc:'wir → unser' },
    { id:'ihr_pl', stem:'euer',  conjCat:'ihr', desc:'ihr → euer' },
    { id:'sie_pl', stem:'ihr',   conjCat:'sie', desc:'sie (Mehrzahl) → ihr' },
    { id:'Sie',    stem:'Ihr',   conjCat:'sie', desc:'Sie (formell) → Ihr' }
  ];
  const UNIQUE_STEMS = [...new Set(PERSONS.map(p => p.stem))];

  const ENDINGS = {
    nom: { m:'', f:'e', n:'', pl:'e' },
    akk: { m:'en', f:'e', n:'', pl:'e' }
  };

  function endingFor(gender, caseType) {
    return ENDINGS[caseType][gender];
  }

  function formOf(stem, ending) {
    if (stem === 'euer') {
      if (ending === '')  return 'euer';
      if (ending === 'e') return 'eure';
      if (ending === 'en') return 'euren';
    }
    return stem + ending;
  }

  function genderLabel(g) {
    return { m:'maskulin', f:'feminin', n:'neutral', pl:'Plural' }[g];
  }

  function sameWordDifferentCase(a, b) {
    return a.toLowerCase() === b.toLowerCase() && a !== b;
  }

  // ==============================
  // LAYER 3 — BUILDERS (plugin system)
  // ==============================

  const BUILDERS = {};
  function registerBuilder(name, fn) { BUILDERS[name] = fn; }

  function buildSetupAndSubject(person) {
    const city = pick(CITIES);
    switch (person.id) {
      case 'ich':    return { setup:`Ich wohne in ${city}.`, subject:'Ich' };
      case 'du':     return { setup:`Du wohnst in ${city}.`, subject:'Du' };
      case 'er':     { const n = pick(MALE_NAMES);   return { setup:`${n} wohnt in ${city}.`, subject:n }; }
      case 'sie_sg': { const n = pick(FEMALE_NAMES); return { setup:`${n} wohnt in ${city}.`, subject:n }; }
      case 'wir':    return { setup:`Wir wohnen in ${city}.`, subject:'Wir' };
      case 'ihr_pl': return { setup:`Ihr wohnt in ${city}.`, subject:'Ihr' };
      case 'sie_pl': {
        const pool = MALE_NAMES.concat(FEMALE_NAMES);
        const n1 = pick(pool);
        let n2 = pick(pool);
        while (n2 === n1) n2 = pick(pool);
        return { setup:`${n1} und ${n2} wohnen in ${city}.`, subject:`${n1} und ${n2}` };
      }
      case 'Sie':    return { setup:`Wohnen Sie in ${city}?`, subject:'Sie' };
    }
  }

  registerBuilder('nom-subject', function (ctx) {
    const { person, word, gender, adj, form } = ctx;
    const setup = buildSetupAndSubject(person).setup;
    const verb = gender === 'pl' ? 'sind' : 'ist';
    return {
      setupLine: setup,
      mainLine: `___ ${word} ${verb} ${adj}.`,
      explanation: `${person.desc}. „${word}" ist ${genderLabel(gender)} — als Subjekt (Nominativ) lautet die Form: ${form}.`
    };
  });

  registerBuilder('akk-object', function (ctx) {
    const { person, entry, word, gender, form } = ctx;
    const { subject } = buildSetupAndSubject(person);
    const verbPool = entry.cat === 'person' ? PERSON_VERBS : THING_VERBS;
    const verbInf = pick(verbPool);
    const conj = VERB_FORMS[verbInf][person.conjCat];
    const isQuestion = person.id === 'Sie' && Math.random() < 0.5;
    return {
      setupLine: '',
      mainLine: isQuestion
        ? `${conj[0].toUpperCase() + conj.slice(1)} ${subject} ___ ${word}?`
        : `${subject} ${conj} ___ ${word}.`,
      explanation: `${person.desc}. „${word}" ist ${genderLabel(gender)} — als Akkusativobjekt nach „${verbInf}" lautet die Form: ${form}.`
    };
  });

  // Paragraph — natural story with 3 or 4 mixed blanks (Nom+Akk), random persons per blank.
  const PARAGRAPH_TEMPLATES = [
    {
      blanks: 3,
      text: 'Mia wohnt in Hamburg. ___ Bruder Paul ist 14 und sehr sportlich, aber ___ Schwester Lena ist sehr klug. Am Abend liest sie ___ spannendes Buch auf dem Sofa.',
      slots: [
        { word:'Bruder', gender:'m',  caseType:'nom', label:'Bruder (m, Nominativ)' },
        { word:'Schwester', gender:'f', caseType:'nom', label:'Schwester (f, Nominativ)' },
        { word:'Buch', gender:'n', caseType:'akk', label:'Buch (n, Akkusativ)' }
      ]
    },
    {
      blanks: 4,
      text: 'Paul wohnt in Köln. ___ Vater arbeitet als Lehrer, ___ Mutter kocht jeden Abend leckeres Essen. Er liebt ___ Hund über alles und vermisst ___ Großeltern am Wochenende sehr.',
      slots: [
        { word:'Vater', gender:'m', caseType:'nom', label:'Vater (m, Nominativ)' },
        { word:'Mutter', gender:'f', caseType:'nom', label:'Mutter (f, Nominativ)' },
        { word:'Hund', gender:'m', caseType:'akk', label:'Hund (m, Akkusativ)' },
        { word:'Großeltern', gender:'pl', caseType:'akk', label:'Großeltern (pl, Akkusativ)' }
      ]
    },
    {
      blanks: 3,
      text: 'Ben wohnt in Berlin. ___ Opa ist alt aber sehr lustig, ___ Oma kocht wunderbar. Wir lieben ___ Haus sehr.',
      slots: [
        { word:'Opa', gender:'m', caseType:'nom', label:'Opa (m, Nominativ)' },
        { word:'Oma', gender:'f', caseType:'nom', label:'Oma (f, Nominativ)' },
        { word:'Haus', gender:'n', caseType:'akk', label:'Haus (n, Akkusativ)' }
      ]
    },
    {
      blanks: 4,
      text: 'Lena wohnt in Wien. ___ Freund Max ist sehr nett, ___ Freundin Sara ist sehr lustig. Sie suchen jeden Tag ___ alten Schlüssel im Haus und lesen abends ___ spannende Bücher.',
      slots: [
        { word:'Freund', gender:'m', caseType:'nom', label:'Freund (m, Nominativ)' },
        { word:'Freundin', gender:'f', caseType:'nom', label:'Freundin (f, Nominativ)' },
        { word:'Schlüssel', gender:'m', caseType:'akk', label:'Schlüssel (m, Akkusativ)' },
        { word:'Bücher', gender:'pl', caseType:'akk', label:'Bücher (pl, Akkusativ)' }
      ]
    }
  ];

  registerBuilder('paragraph', function (ctx) {
    const difficulty = ctx.difficulty || 'hard';
    const template = pick(PARAGRAPH_TEMPLATES);
    const blanks = template.slots.map((slot, idx) => {
      const person = pick(PERSONS);
      const ending = endingFor(slot.gender, slot.caseType);
      const correctForm = formOf(person.stem, ending);
      const distractors = buildDistractors({ stem: person.stem, ending, correctForm, difficulty });
      const options = shuffle([correctForm, ...distractors]);
      return {
        id: idx + 1,
        word: slot.word,
        gender: slot.gender,
        caseType: slot.caseType,
        label: slot.label,
        personId: person.id,
        stem: person.stem,
        ending,
        correctForm,
        options,
        correctIndex: options.indexOf(correctForm),
        explanation: `${person.desc}. „${slot.word}" ist ${genderLabel(slot.gender)} — ${slot.caseType === 'nom' ? 'als Subjekt (Nominativ)' : 'als Akkusativobjekt'} lautet die Form: ${correctForm}.`
      };
    });
    return {
      setupLine: '',
      mainLine: template.text,
      paragraph: template.text,
      blanks,
      isParagraph: true,
      explanation: blanks.map(b => b.explanation).join(' '),
      caseType: 'mixed',
      blankCount: blanks.length
    };
  });

  // ==============================
  // LAYER 4 — DISTRACTORS
  // ==============================

  // easy:   only gender confusion (same stem, wrong ending) — tops up with person
  //         forms only when 4 unique options are impossible otherwise (e.g. stem 'ihr').
  // medium: gender + person confusion.
  // hard:   mixed stems/endings (case-style confusion).
  function buildDistractors(ctx) {
    const { stem, ending, correctForm, difficulty } = ctx;
    const otherEndings = ['', 'e', 'en'].filter(e => e !== ending);
    const candidateStems = shuffle(UNIQUE_STEMS.filter(s => s !== stem && !sameWordDifferentCase(s, stem)));
    let pool = [];

    if (difficulty === 'easy') {
      pool = otherEndings.map(e => formOf(stem, e));
    } else if (difficulty === 'medium') {
      pool = [
        ...otherEndings.map(e => formOf(stem, e)),
        formOf(candidateStems[0], ending),
        formOf(candidateStems[1], pick(otherEndings))
      ];
    } else { // hard
      pool = [
        ...otherEndings.map(e => formOf(stem, e)),
        formOf(candidateStems[0], ending),
        formOf(candidateStems[1], pick(['', 'e', 'en'])),
        formOf(candidateStems[2], pick(['', 'e', 'en']))
      ];
    }

    let unique = [...new Set(pool)].filter(f => f !== correctForm);
    let guard = 0;
    while (unique.length < 3 && guard++ < 50) {
      const f = formOf(pick(candidateStems), pick(['', 'e', 'en']));
      if (f !== correctForm && !unique.includes(f)) unique.push(f);
    }
    return shuffle(unique).slice(0, 3);
  }

  // ==============================
  // PUBLIC API
  // ==============================

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * @param {'nom'|'akk'|'both'} caseType
   * @param {{difficulty?:'easy'|'medium'|'hard', builder?:string}} [opts]
   */
  function generateQuestion(caseType, opts) {
    opts = opts || {};
    // Paragraph has its own mixed-case flow — ignore caseType and delegate
    if (opts.builder === 'paragraph') {
      const difficulty = opts.difficulty || 'hard';
      const built = BUILDERS['paragraph']({ difficulty });
      // top-level paragraph question: multiple blanks
      const paragraph = built.paragraph || built.mainLine;
      return {
        setupLine: built.setupLine || '',
        mainLine: paragraph,
        paragraph,
        blanks: built.blanks,
        isParagraph: true,
        caseType: 'mixed',
        difficulty,
        builder: 'paragraph',
        blankCount: built.blankCount,
        // for compatibility, expose first blank as correctForm/options
        correctForm: built.blanks[0].correctForm,
        options: built.blanks[0].options,
        correctIndex: built.blanks[0].correctIndex,
        explanation: built.explanation,
        meta: { blankCount: built.blankCount }
      };
    }

    const actualCase = (!caseType || caseType === 'both')
      ? (Math.random() < 0.5 ? 'nom' : 'akk')
      : caseType;
    const difficulty = opts.difficulty || 'hard';

    const person = pick(PERSONS);
    const entry = pick(NOUNS);
    const number = Math.random() < 0.35 ? 'pl' : 'sg';
    const gender = number === 'pl' ? 'pl' : entry.gender;
    const word = number === 'pl' ? entry.pl : entry.sg;
    const ending = endingFor(gender, actualCase);
    const correctForm = formOf(person.stem, ending);

    const builderName = (opts.builder && BUILDERS[opts.builder]) ? opts.builder
      : (actualCase === 'nom' ? 'nom-subject' : 'akk-object');

    const ctx = {
      person, entry, word, gender, number,
      caseType: actualCase, form: correctForm,
      adj: pick(entry.adj), difficulty
    };
    const built = BUILDERS[builderName](ctx);

    const distractors = buildDistractors({ stem: person.stem, ending, correctForm, difficulty });
    const options = shuffle([correctForm, ...distractors]);

    return {
      setupLine: built.setupLine || '',
      mainLine: built.mainLine,
      options,
      correctIndex: options.indexOf(correctForm),
      correctForm,
      explanation: built.explanation,
      caseType: actualCase,
      difficulty,
      builder: builderName,
      meta: { personId: person.id, stem: person.stem, gender, number, word, en: entry.en, ending }
    };
  }

  // Exports — Node (CommonJS) + browser globals.
  const api = { generateQuestion, registerBuilder, BUILDERS, NOUNS, PERSONS, ENDINGS, endingFor, formOf };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof global !== 'undefined') {
    global.PossessiveEngine = api;
    global.generateQuestion = generateQuestion;
  }
})(typeof window !== 'undefined' ? window : globalThis);
