const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
function sourceBetween(start, end) {
  const from = html.indexOf(start);
  const to = html.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `Navigation source markers missing: ${start}`);
  return html.slice(from, to);
}
const navigationSource = [
  sourceBetween('function bindNavigation(onNavigate)', '// ---- iOS-style edge swipe back ----'),
  sourceBetween('async function handleSwipeBack(startScreen)', '// ---- js/quiz.js ----'),
  sourceBetween('async function navigate(screen', 'function startSession(mode)')
].join('\n');

function makeApp() {
  const app = { innerHTML: '', focus() { this.focused = true; } };
  const listeners = {};
  const context = vm.createContext({
    app, listeners, activeScreen: 'home', activeRoute: null, screenHistory: [],
    activeSession: null, lastSession: null, pendingKind: null,
    pendingVocabLevel: 'a1', pendingZahlenRange: '0-1000',
    swipeShell: { inert: false }, state: { stats: {}, settings: {}, achievements: [] },
    glossaryWords: [], b1GlossaryWords: [], a2GlossaryEntries: [{}], b1PlusGlossaryEntries: [{}],
    A2_ENTRY_COUNT: 1486, B1_PLUS_ENTRY_COUNT: 2782,
    document: {
      body: { classList: { toggle() {} } },
      addEventListener(type, listener) { listeners[type] = listener; }
    },
    getVerbs: () => [], updateNavigation() {}, abandonSession: async () => false
  });
  for (const [renderer, screen] of Object.entries({
    renderHome: 'home', renderModeSelect: 'mode-select', renderVocabLevelSelect: 'vocab-level-select',
    renderA2Glossary: 'a2-glossary', renderB1PlusGlossary: 'b1plus-glossary',
    renderA2ChapterSelect: 'a2-chapter-select', renderB1PlusChapterSelect: 'b1plus-chapter-select',
    renderStatistics: 'statistics', renderSettings: 'settings', renderAchievements: 'achievements'
  })) context[renderer] = () => screen;
  context.renderSessionTypeSelect = (kind, level) => `${kind}:${level}`;
  context.renderActiveQuestion = () => { app.innerHTML = context.activeScreen; };
  context.renderReview = session => `review:${session.id}`;
  vm.runInContext(navigationSource, context);
  context.render('home');
  return context;
}

function enterVocabulary(context, level = 'a2', screen = 'session-type-select') {
  context.render('mode-select');
  if (screen === 'mode-select') return;
  context.pendingKind = 'vocab';
  context.render('vocab-level-select');
  if (screen === 'vocab-level-select') return;
  context.pendingVocabLevel = level;
  context.render('session-type-select');
  if (screen !== 'session-type-select') context.render(screen);
}

let passed = 0;
const failures = [];
async function test(name, run) {
  try { await run(); passed += 1; }
  catch (error) { failures.push(`${name}: ${error.message}`); }
}

(async () => {
  for (const [level, screen] of [
    ['a2', 'a2-glossary'], ['a2', 'a2-chapter-select'],
    ['b1plus', 'b1plus-glossary'], ['b1plus', 'b1plus-chapter-select']
  ]) await test(`${screen} returns through its vocabulary hierarchy`, async () => {
    const context = makeApp();
    enterVocabulary(context, level, screen);
    await context.handleSwipeBack(screen);
    assert.equal(context.activeScreen, 'session-type-select');
    assert.equal(context.pendingKind, 'vocab');
    assert.equal(context.pendingVocabLevel, level);
    assert.equal(context.app.innerHTML, `vocab:${level}`);
    for (const expected of ['vocab-level-select', 'mode-select', 'home']) {
      await context.handleSwipeBack(context.activeScreen);
      assert.equal(context.activeScreen, expected);
    }
    assert.equal(context.screenHistory.length, 0);
    assert.equal(context.app.focused, true);
  });

  for (const screen of [
    'mode-select', 'vocab-level-select', 'session-type-select', 'a2-glossary',
    'a2-chapter-select', 'b1plus-glossary', 'b1plus-chapter-select', 'achievements'
  ]) await test(`Noten and Mehr return to ${screen}`, async () => {
    const context = makeApp();
    enterVocabulary(context, 'b1plus', screen);
    context.render('statistics');
    context.render('settings');
    await context.handleSwipeBack('settings');
    assert.equal(context.activeScreen, 'statistics');
    await context.handleSwipeBack('statistics');
    assert.equal(context.activeScreen, screen);
  });

  for (const kind of ['conjugation', 'possessive', 'zahlen', 'vocab-reverse']) {
    await test(`${kind} preserves its previous screen and range`, async () => {
      const context = makeApp();
      context.render('mode-select');
      context.pendingKind = kind;
      context.pendingZahlenRange = '0-100';
      context.render('session-type-select');
      context.render('settings');
      await context.handleSwipeBack('settings');
      assert.equal(context.pendingKind, kind);
      assert.equal(context.pendingZahlenRange, '0-100');
      await context.handleSwipeBack('session-type-select');
      assert.equal(context.activeScreen, 'mode-select');
    });
  }

  await test('Forward header navigation remains real visit history', async () => {
    const context = makeApp();
    enterVocabulary(context);
    for (const screen of ['statistics', 'settings', 'statistics']) await context.navigate(screen);
    for (const expected of ['settings', 'statistics', 'session-type-select']) {
      await context.handleSwipeBack(context.activeScreen);
      assert.equal(context.activeScreen, expected);
    }
  });

  await test('Back buttons consume history without adding a return loop', async () => {
    const context = makeApp();
    enterVocabulary(context, 'a2', 'a2-glossary');
    await context.navigate('session-type-select', true);
    assert.equal(context.activeScreen, 'session-type-select');
    await context.handleSwipeBack(context.activeScreen);
    assert.equal(context.activeScreen, 'vocab-level-select');
    await context.navigate('practice', true);
    assert.equal(context.activeScreen, 'mode-select');
    await context.handleSwipeBack(context.activeScreen);
    assert.equal(context.activeScreen, 'home');
  });

  await test('Home clears old routes and same-screen renders add no entries', async () => {
    const context = makeApp();
    enterVocabulary(context);
    const count = context.screenHistory.length;
    context.render('session-type-select');
    assert.equal(context.screenHistory.length, count);
    await context.navigate('home');
    assert.equal(context.screenHistory.length, 0);
    await context.handleSwipeBack('home');
    assert.equal(context.activeScreen, 'home');
  });

  await test('Cancelled quiz exit preserves the quiz and its history', async () => {
    const context = makeApp();
    enterVocabulary(context, 'a2', 'a2-chapter-select');
    context.activeSession = { id: 'cancelled' };
    context.render('practice');
    const count = context.screenHistory.length;
    let confirmations = 0;
    context.abandonSession = async () => { confirmations += 1; return false; };
    await context.handleSwipeBack('practice');
    assert.equal(confirmations, 1);
    assert.equal(context.activeScreen, 'practice');
    assert.equal(context.screenHistory.length, count);
  });

  for (const mode of ['practice', 'exam']) await test(`Ended ${mode} is never restored by back`, async () => {
    const context = makeApp();
    enterVocabulary(context, 'a2', 'a2-chapter-select');
    context.activeSession = { id: mode };
    context.render(mode);
    context.abandonSession = async () => {
      context.lastSession = context.activeSession;
      context.render('review');
      context.activeSession = null;
      return true;
    };
    await context.handleSwipeBack(mode);
    assert.equal(context.activeScreen, 'review');
    await context.handleSwipeBack('review');
    assert.equal(context.activeScreen, 'a2-chapter-select');
    assert.ok(context.screenHistory.every(route => route.screen !== 'practice' && route.screen !== 'exam'));
  });

  await test('Review survives utility navigation and retains the right results', async () => {
    const context = makeApp();
    enterVocabulary(context);
    const first = { id: 'first' };
    const second = { id: 'second' };
    context.lastSession = first;
    context.render('review');
    context.render('statistics');
    await context.handleSwipeBack('statistics');
    assert.equal(context.app.innerHTML, 'review:first');
    context.activeSession = second;
    context.render('practice');
    context.render('review');
    context.lastSession = second;
    context.activeSession = null;
    await context.handleSwipeBack('review');
    assert.equal(context.activeScreen, 'review');
    assert.equal(context.lastSession, first);
    assert.equal(context.app.innerHTML, 'review:first');
  });

  await test('Stale gestures and modal-background swipes do nothing', async () => {
    const context = makeApp();
    enterVocabulary(context);
    const count = context.screenHistory.length;
    await context.handleSwipeBack('mode-select');
    assert.equal(context.screenHistory.length, count);
    context.swipeShell.inert = true;
    await context.handleSwipeBack('session-type-select');
    assert.equal(context.activeScreen, 'session-type-select');
    assert.equal(context.screenHistory.length, count);
  });

  await test('Missing history uses the parent and histories stay bounded', async () => {
    const context = makeApp();
    context.pendingKind = 'vocab';
    context.pendingVocabLevel = 'a2';
    context.render('a2-glossary', false);
    await context.handleSwipeBack('a2-glossary');
    assert.equal(context.activeScreen, 'session-type-select');
    for (let index = 0; index < 15; index += 1) context.render(index % 2 ? 'settings' : 'statistics');
    assert.equal(context.screenHistory.length, 10);
    assert.ok(context.screenHistory.every(route => !Object.hasOwn(route, 'html')));
  });

  await test('All six Back controls declare back intent to the navigation binding', async () => {
    assert.equal((html.match(/data-back>←/g) || []).length, 6);
    const context = makeApp();
    let received;
    context.bindNavigation((screen, isBack) => { received = [screen, isBack]; });
    context.listeners.click({ target: { closest: () => ({ dataset: { nav: 'practice' }, hasAttribute: name => name === 'data-back' }) } });
    assert.deepEqual(received, ['practice', true]);
  });

  console.log(`Navigation checks passed: ${passed}`);
  console.log(`Failures: ${failures.length}`);
  failures.forEach(failure => console.error(`- ${failure}`));
  if (failures.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
