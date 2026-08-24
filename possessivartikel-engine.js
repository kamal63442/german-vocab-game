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
  // Generative paragraph — 30+ unique stories, not 4 fixed texts.
  // Each paragraph: intro (no blank) + 3–4 sentences, each with one blank, mixed Nom/Akk, one owner per paragraph.
  function buildParagraphSentences(person, difficulty) {
    const city = pick(CITIES);
    const name = person.id === 'er' ? pick(MALE_NAMES) : person.id === 'sie_sg' ? pick(FEMALE_NAMES) : person.id === 'ich' ? 'Ich' : person.id === 'du' ? 'Du' : pick(MALE_NAMES.concat(FEMALE_NAMES));
    const intro = person.id === 'ich' ? `Ich wohne in ${city}.` : person.id === 'du' ? `Du wohnst in ${city}.` : `${name} wohnt in ${city}.`;
    const sentences = [intro];
    const blanks = [];
    const usedWords = new Set();
    const blankCount = Math.random() < 0.5 ? 3 : 4;
    // Create 3–4 sentences, each with one blank, mixed cases, varied nouns (no repeats)
    for (let i = 0; i < blankCount; i++) {
      const isNom = i < 2 ? true : Math.random() < 0.5; // first 2 are nom (family), rest mixed
      const pool = NOUNS.filter(n => (isNom ? n.cat === 'person' : true) && !usedWords.has(n.sg));
      const entry = pick(pool.length ? pool : NOUNS);
      usedWords.add(entry.sg);
      const number = Math.random() < 0.2 ? 'pl' : 'sg';
      const gender = number === 'pl' ? 'pl' : entry.gender;
      const word = number === 'pl' ? entry.pl : entry.sg;
      const caseType = isNom ? 'nom' : (Math.random() < 0.5 ? 'nom' : 'akk');
      const ending = endingFor(gender, caseType);
      const correctForm = formOf(person.stem, ending);
      const distractors = buildDistractors({ stem: person.stem, ending, correctForm, difficulty });
      const options = shuffle([correctForm, ...distractors]);
      let sent = '';
      if (caseType === 'nom') {
        const adj = pick(entry.adj);
        const verb = gender === 'pl' ? 'sind' : 'ist';
        sent = `___ ${word} ${verb} ${adj}.`;
      } else {
        const verbPool = entry.cat === 'person' ? PERSON_VERBS : THING_VERBS;
        const verbInf = pick(verbPool);
        const conj = VERB_FORMS[verbInf][person.conjCat];
        // keep subject as pronoun/name for variety, but possessive stays with paragraph owner
        const subj = person.id === 'ich' ? 'Ich' : person.id === 'du' ? 'Du' : name;
        sent = `${subj} ${conj} ___ ${word}.`;
      }
      // Add connector for flow (except first)
      if (i > 0 && Math.random() < 0.4) {
        const connectors = ['Aber', 'Und', 'Denn', 'Außerdem'];
        const conn = pick(connectors);
        // lowercase only the pronoun start (Ich/Du), never the name
        const firstWord = sent.split(' ')[0];
        const lowered = (firstWord === 'Ich' || firstWord === 'Du')
          ? firstWord.toLowerCase()
          : firstWord; // keep names capitalized
        sent = conn + ' ' + lowered + sent.slice(firstWord.length);
      }
      sentences.push(sent);
      blanks.push({
        id: i + 1,
        word, en: entry.en, gender, caseType,
        label: `${word} (${genderLabel(gender)}, ${caseType === 'nom' ? 'Nominativ' : 'Akkusativ'})`,
        personId: person.id, stem: person.stem, ending, correctForm, options,
        correctIndex: options.indexOf(correctForm),
        explanation: `${person.desc}. „${word}" ist ${genderLabel(gender)} — ${caseType === 'nom' ? 'als Subjekt (Nominativ)' : 'als Akkusativobjekt'} lautet die Form: ${correctForm}.`
      });
    }
    return { text: sentences.join(' '), blanks };
  }

  const PARAGRAPH_TEMPLATES = []; // generative builder replaces fixed templates

  // ==============================
  // GENERATIVE PARAGRAPHS — scene-based stories
  // ==============================

  // Verb forms for scene verbs (keyed by third-person singular "er" only —
  // paragraphs use named protagonists, so only er/sie_sg forms are needed).
  const SCENE_VERBS = {
    backt: 'backt', spielt: 'spielt', singen: 'singen', sitzt: 'sitzt', sucht: 'sucht',
    läuft: 'läuft', wirft: 'wirft', findet: 'findet', kauft: 'kauft', trägt: 'trägt',
    kocht: 'kocht', bringt: 'bringt', vergisst: 'vergisst', besucht: 'besucht', geht: 'geht',
    ist: 'ist', hat: 'hat'
  };
  const SCENE_VERB_CONJ = {
    'startet':   { ich:'starte',  du:'startest', er:'startet',  wir:'starten',  ihr:'startet',  sie:'starten'  },
    'räumt':     { ich:'räume',   du:'räumst',   er:'räumt',    wir:'räumen',   ihr:'räumt',    sie:'räumen'   },
    'fahren':    { ich:'fahre',   du:'fährst',   er:'fährt',    wir:'fahren',   ihr:'fahrt',     sie:'fahren'   },
    'plant':     { ich:'plane',   du:'planst',   er:'plant',    wir:'planen',   ihr:'plant',    sie:'planen'   },
    'haben':     { ich:'habe',    du:'hast',     er:'hat',      wir:'haben',    ihr:'habt',     sie:'haben'    },
    'fährt':     { ich:'fahre',   du:'fährst',   er:'fährt',    wir:'fahren',   ihr:'fahrt',     sie:'fahren'   },
    'trainiert': { ich:'trainiere',du:'trainierst',er:'trainiert',wir:'trainieren',ihr:'trainiert',sie:'trainieren' },
    'ziehen':    { ich:'ziehe',   du:'ziehst',   er:'zieht',    wir:'ziehen',   ihr:'zieht',    sie:'ziehen'   }
  };


  // Scene: returns { sentences: [...], slots: [{gender, caseType, word}] }
  // Each sentence may contain one "___" blank. First sentence usually has none.
  const PARAGRAPH_SCENES = [
    {
      icon: 'Geburtstag',
      sentences(female) {
        return [
          s => `${s} hat Geburtstag.`,
          s => `___ Oma backt einen Kuchen, ___ Vater spielt Musik.`,
          s => `Alle singen für ___ Schwester.`
        ];
      },
      slots: [
        { word: 'Oma', gender: 'f', caseType: 'nom' },
        { word: 'Vater', gender: 'm', caseType: 'nom' },
        { word: 'Schwester', gender: 'f', caseType: 'akk' }
      ]
    },
    {
      icon: 'Schule',
      sentences() {
        return [
          s => `${s} ist in der Schule.`,
          s => `___ Lehrer ist nett, ___ Freundin sitzt in der ersten Reihe.`,
          s => `Nach dem Unterricht sucht ${'{NAME}'} ___ Schlüssel.`
        ];
      },
      slots: [
        { word: 'Lehrer', gender: 'm', caseType: 'nom' },
        { word: 'Freundin', gender: 'f', caseType: 'nom' },
        { word: 'Schlüssel', gender: 'm', caseType: 'akk' }
      ]
    },
    {
      icon: 'Park',
      sentences() {
        return [
          s => `${s} geht in den Park.`,
          s => `___ Hund läuft schnell, ___ Freundin wirft einen Ball.`,
          s => `Auf der Bank findet ${'{NAME}'} ___ Fahrradhelm.`
        ];
      },
      slots: [
        { word: 'Hund', gender: 'm', caseType: 'nom' },
        { word: 'Freundin', gender: 'f', caseType: 'nom' },
        { word: 'Fahrradhelm', gender: 'm', caseType: 'akk' }
      ]
    },
    {
      icon: 'Einkaufen',
      sentences() {
        return [
          s => `${s} kauft im Supermarkt ein.`,
          s => `___ Tasche ist schwer, ___ Bruder trägt die Bücher.`,
          s => `Zu Hause sucht ${'{NAME}'} ___ Geldbörse.`
        ];
      },
      slots: [
        { word: 'Tasche', gender: 'f', caseType: 'nom' },
        { word: 'Bruder', gender: 'm', caseType: 'nom' },
        { word: 'Geldbörse', gender: 'f', caseType: 'akk' }
      ]
    },
    {
      icon: 'Wochenende',
      sentences() {
        return [
          s => `${s} besucht ___ Großeltern.`,
          s => `___ Opa kocht Suppe, ___ Tante bringt Kuchen mit.`,
          s => `Am Bahnhof vergisst ${'{NAME}'} ___ Handy.`
        ];
      },
      slots: [
        { word: 'Großeltern', gender: 'pl', caseType: 'akk' },
        { word: 'Opa', gender: 'm', caseType: 'nom' },
        { word: 'Tante', gender: 'f', caseType: 'nom' },
        { word: 'Handy', gender: 'n', caseType: 'akk' }
      ]
    },
    {
      icon: 'Sport',
      sentences() {
        return [
          s => `${s} spielt Fußball im Verein.`,
          s => `___ Trainer ist streng, ___ Mannschaft trainiert zweimal pro Woche.`,
          s => `Am Samstag gewinnt ${'{NAME}'} mit ___ Tor das Spiel.`
        ];
      },
      slots: [
        { word: 'Trainer', gender: 'm', caseType: 'nom' },
        { word: 'Mannschaft', gender: 'f', caseType: 'nom' },
        { word: 'Tor', gender: 'n', caseType: 'akk' }
      ]
    },
    {
      icon: 'Kochen',
      sentences() {
        return [
          s => `${s} kocht am Wochenende.`,
          s => `___ Mutter hilft in der Küche, ___ Bruder deckt den Tisch.`,
          s => `Zum Dessert reicht ${'{NAME}'} ___ Lieblingsspeise.`
        ];
      },
      slots: [
        { word: 'Mutter', gender: 'f', caseType: 'nom' },
        { word: 'Bruder', gender: 'm', caseType: 'nom' },
        { word: 'Lieblingsspeise', gender: 'f', caseType: 'akk' }
      ]
    },
    {
      icon: 'Arzt',
      sentences() {
        return [
          s => `${s} ist beim Arzt.`,
          s => `___ Hals tut weh, ___ Fieber ist hoch.`,
          s => `Der Doktor gibt ${'{NAME}'} ___ Rezept für ___ Hustensaft.`
        ];
      },
      slots: [
        { word: 'Hals', gender: 'm', caseType: 'nom' },
        { word: 'Fieber', gender: 'n', caseType: 'nom' },
        { word: 'Rezept', gender: 'n', caseType: 'akk' },
        { word: 'Hustensaft', gender: 'm', caseType: 'akk' }
      ]
    },
    {
      icon: 'Kino',
      sentences() {
        return [
          s => `${s} geht ins Kino.`,
          s => `___ Freunde wählen einen Film, ___ Schwester kauft Popcorn.`,
          s => `Im Dunkeln verliert ${'{NAME}'} ___ Platz.`
        ];
      },
      slots: [
        { word: 'Freunde', gender: 'pl', caseType: 'nom' },
        { word: 'Schwester', gender: 'f', caseType: 'nom' },
        { word: 'Platz', gender: 'm', caseType: 'akk' }
      ]
    },
    {
      icon: 'Garten',
      sentences() {
        return [
          s => `${s} arbeitet im Garten.`,
          s => `___ Blumen brauchen Wasser, ___ Rasen ist hoch.`,
          s => `Am Abend ruht ${'{NAME}'} auf ___ Bank aus.`
        ];
      },
      slots: [
        { word: 'Blumen', gender: 'pl', caseType: 'nom' },
        { word: 'Rasen', gender: 'm', caseType: 'nom' },
        { word: 'Bank', gender: 'f', caseType: 'akk' }
      ]
    },
    {
      icon: 'Mein Tag',
      sentences() {
        return [
          s => `${'{SUBJ}'} startet in den Tag.`,
          s => `___ Kaffee ist fertig, ___ Zeitung liegt am Tisch.`,
          s => `Vor der Arbeit prüft ${'{NAME}'} ___ Termine.`
        ];
      },
      slots: [
        { word: 'Kaffee', gender: 'm', caseType: 'nom' },
        { word: 'Zeitung', gender: 'f', caseType: 'nom' },
        { word: 'Termine', gender: 'pl', caseType: 'akk' }
      ]
    },
    {
      icon: 'Dein Zimmer',
      sentences() {
        return [
          s => `${'{SUBJ}'} räumt das Zimmer auf.`,
          s => `___ Bücher kommen ins Regal, ___ Kleidung in den Schrank.`,
          s => `Danach staubsaugt ${'{NAME}'} ___ Boden.`
        ];
      },
      slots: [
        { word: 'Bücher', gender: 'pl', caseType: 'nom' },
        { word: 'Kleidung', gender: 'f', caseType: 'akk' },
        { word: 'Boden', gender: 'm', caseType: 'akk' }
      ]
    },
    {
      icon: 'Unser Ausflug',
      sentences() {
        return [
          s => `${'{SUBJ}'} fahren an den See.`,
          s => `___ Picknickkorb ist voll, ___ Fahrräder stehen am Haus.`,
          s => `Unterwegs besuchen ${'{SUBJ}'} ___ Großeltern.`
        ];
      },
      slots: [
        { word: 'Picknickkorb', gender: 'm', caseType: 'nom' },
        { word: 'Fahrräder', gender: 'pl', caseType: 'nom' },
        { word: 'Großeltern', gender: 'pl', caseType: 'akk' }
      ]
    },
    {
      icon: 'Euer Fest',
      sentences() {
        return [
          s => `${'{SUBJ}'} plant ein Sommerfest.`,
          s => `___ Nachbarn helfen mit, ___ Kinder spielen im Garten.`,
          s => `Am Abend grillt ${'{SUBJ}'} ___ Würstchen.`
        ];
      },
      slots: [
        { word: 'Nachbarn', gender: 'pl', caseType: 'nom' },
        { word: 'Kinder', gender: 'pl', caseType: 'nom' },
        { word: 'Würstchen', gender: 'pl', caseType: 'akk' }
      ]
    },
    {
      icon: 'Ihr Termin',
      sentences() {
        return [
          s => `${'{SUBJ}'} haben einen Termin beim Amt.`,
          s => `___ Unterlagen sind komplett, ___ Nummer wird aufgerufen.`,
          s => `Nach einer Stunde bekommt ${'{NAME}'} ___ neuen Pass.`
        ];
      },
      slots: [
        { word: 'Unterlagen', gender: 'pl', caseType: 'nom' },
        { word: 'Nummer', gender: 'f', caseType: 'nom' },
        { word: 'Pass', gender: 'm', caseType: 'akk' }
      ]
    },
    {
      icon: 'Meine Reise',
      sentences() {
        return [
          s => `${'{SUBJ}'} fährt mit dem Zug.`,
          s => `___ Reservierung ist bestätigt, ___ Koffer ist schwer.`,
          s => `Im Zug liest ${'{NAME}'} ___ Lieblingsbuch.`
        ];
      },
      slots: [
        { word: 'Reservierung', gender: 'f', caseType: 'nom' },
        { word: 'Koffer', gender: 'm', caseType: 'nom' },
        { word: 'Lieblingsbuch', gender: 'n', caseType: 'akk' }
      ]
    },
    {
      icon: 'Dein Sport',
      sentences() {
        return [
          s => `${'{SUBJ}'} trainiert im Fitnessstudio.`,
          s => `___ Trainer zeigt neue Übungen, ___ Muskeln schmerzen am nächsten Tag.`,
          s => `Trotzdem erreicht ${'{NAME}'} ___ Ziel.`
        ];
      },
      slots: [
        { word: 'Trainer', gender: 'm', caseType: 'nom' },
        { word: 'Muskeln', gender: 'pl', caseType: 'nom' },
        { word: 'Ziel', gender: 'n', caseType: 'akk' }
      ]
    },
    {
      icon: 'Unser Umzug',
      sentences() {
        return [
          s => `${'{SUBJ}'} ziehen in eine neue Wohnung.`,
          s => `___ Kartons stapeln sich im Flur, ___ Möbel kommen mit dem LKW.`,
          s => `Am ersten Abend fehlt ${'{SUBJ}'} ___ WLAN-Router.`
        ];
      },
      slots: [
        { word: 'Kartons', gender: 'pl', caseType: 'nom' },
        { word: 'Möbel', gender: 'pl', caseType: 'nom' },
        { word: 'WLAN-Router', gender: 'm', caseType: 'akk' }
      ]
    },
  ];

  registerBuilder('paragraph', function (ctx) {
    const difficulty = ctx.difficulty || 'hard';
    // Owner pool: named protagonists + pronoun owners for variety
    const OWNERS = [
      { id: 'er',     stem: 'sein',  subj: '{NAME}',  desc: 'er → sein' },
      { id: 'sie_sg', stem: 'ihr',   subj: '{NAME}',  desc: 'sie → ihr' },
      { id: 'ich',    stem: 'mein',  subj: 'Ich',     desc: 'ich → mein', verbCat: 'ich' },
      { id: 'du',     stem: 'dein',  subj: 'Du',      desc: 'du → dein', verbCat: 'du' },
      { id: 'wir',    stem: 'unser', subj: 'Wir',     desc: 'wir → unser', verbCat: 'wir' },
      { id: 'ihr_pl', stem: 'euer',  subj: 'Ihr',     desc: 'ihr → euer', verbCat: 'ihr' },
      { id: 'Sie',    stem: 'Ihr',   subj: 'Sie',     desc: 'Sie → Ihr', verbCat: 'sie' }
    ];
    const owner = pick(OWNERS);
    const person = PERSONS.find(pp => pp.id === owner.id) || PERSONS[0];
    const name = (owner.id === 'er' || owner.id === 'sie_sg') ? (owner.id === 'er' ? pick(MALE_NAMES) : pick(FEMALE_NAMES)) : '';
    const scene = pick(PARAGRAPH_SCENES);
    const ending = person.stem; // 'sein' or 'ihr'
    const formFor = (gender, caseType) => formOf(person.stem, endingFor(gender, caseType));
    // Determine if the owner is female (sie_sg)
    const female = owner.id === 'sie_sg';

    // Build sentences: replace {SUBJ} (subject) and {NAME} (name fallback = subject)
    const subj = owner.subj === '{NAME}' ? name : owner.subj;
    const nameOrSubj = name || subj;
    const sentenceFns = scene.sentences(female);
    const textParts = sentenceFns.map((fn, si) => {
      let s = fn(nameOrSubj)
        .replace(/\{SUBJ\}/g, subj)
        .replace(/\{NAME\}/g, nameOrSubj);
      // Fix verb conjugation in first sentence for non-er/sie_sg subjects
      if (si === 0 && owner.verbCat && SCENE_VERB_CONJ) {
        for (const [base, forms] of Object.entries(SCENE_VERB_CONJ)) {
          if (s.includes(base)) {
            s = s.replace(base, forms[owner.verbCat] || base);
            break;
          }
        }
      }
      return s;
    });

    const blanks = scene.slots.map((slot, idx) => {
      const correctForm = formFor(slot.gender, slot.caseType);
      const distractors = buildDistractors({ stem: person.stem, ending: endingFor(slot.gender, slot.caseType), correctForm, difficulty });
      const options = shuffle([correctForm, ...distractors]);
      return {
        id: idx + 1,
        word: slot.word,
        gender: slot.gender,
        caseType: slot.caseType,
        label: `${slot.word} (${genderLabel(slot.gender)}, ${slot.caseType === 'nom' ? 'Nominativ' : 'Akkusativ'})`,
        personId: person.id, stem: person.stem,
        ending: endingFor(slot.gender, slot.caseType),
        correctForm, options,
        correctIndex: options.indexOf(correctForm),
        explanation: `${person.desc}. „${slot.word}" ist ${genderLabel(slot.gender)} — ${slot.caseType === 'nom' ? 'als Subjekt (Nominativ)' : 'als Akkusativobjekt'} lautet die Form: ${correctForm}.`
      };
    });

    // Interleave blanks into text: each "___" gets replaced in order
    let finalText = textParts.join(' ');
    // blanks are already in order matching "___" occurrences
    return {
      setupLine: '',
      mainLine: finalText,
      paragraph: finalText,
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
