import { HINTS, canRevealFirstCharacter, correctCount, createAttempt, formatSurfaceDistance, isCorrectAnswer, japanDateKey, scoreQuestion, totalScore } from './domain.js';
import { clearAttempt, loadAttempt, saveAttempt } from './storage.js';

const app = document.querySelector('#app');
const [questions2026, dailySets2026, questions2025, dailySets2025] = await Promise.all([
  fetch('./questions.2026.json?v=utf8-verified-20260803').then((r) => r.json()),
  fetch('./daily-sets.2026.json?v=utf8-verified-20260803').then((r) => r.json()),
  fetch('./questions.2025.json?v=utf8-verified-20260803').then((r) => r.json()),
  fetch('./daily-sets.2025.json?v=utf8-verified-20260803').then((r) => r.json()),
]);
const questions = [...questions2026, ...questions2025];
const questionById = new Map(questions.filter((q) => q.enabled).map((q) => [q.id, q]));
const dateKey = japanDateKey();
const setIds = dailySets2026[dateKey] ?? dailySets2026.default;
const MODE_DEFINITIONS = Object.freeze({
  winners: { title: '単年・G1勝利馬', difficulty: '初級', target: '勝った馬' },
  podium: { title: '単年・G1馬券圏内馬', difficulty: '中級', target: '3着以内に入った馬' },
});
const winnerIds2026 = questions2026.filter((question) => / 1着[、。]/.test(question.explanation)).map((question) => question.id);
const winnerIds2025 = questions2025.filter((question) => / 1着[、。]/.test(question.explanation)).map((question) => question.id);
const podiumIds2025 = questions2025.map((question) => question.id);
const rotate = (ids, offset) => ids.map((_, index) => ids[(index + offset) % ids.length]);
// YYYY-MM-DD をそのまま数値化して、日付が変わるたびに確実に出題順を変える。
const dateOffset = Number(dateKey.replaceAll('-', ''));
let attempt = null;
let attemptKey = null;
let selectedMode = null;
let selectedYear = null;
let route = 'home';
let homeStep = 'modes';

// netkeibaの騎手ページで使われている表記へ統一する。
// 収集元ごとの略称（地方競馬・海外レースを含む）を画面に出さないための表示用辞書。
const JOCKEY_DISPLAY_NAMES = Object.freeze({
  'キング': 'R.キング',
  'シュタル': 'A.シュタルケ',
  'ディー': 'M.ディー',
  'マーカン': 'T.マーカンド',
  'マーフィ': 'O.マーフィー',
  'ミナリク': 'F.ミナリク',
  'ムルザバ': 'B.ムルザバエフ',
  'ムーア': 'R.ムーア',
  'モレイラ': 'J.モレイラ',
  'ルメール': 'C.ルメール',
  'レーン': 'D.レーン',
  'Ｃ．デム': 'C.デムーロ',
  'Ｃ．ルメ': 'C.ルメール',
  'Ｄ．レー': 'D.レーン',
  'Ｍ．デム': 'M.デムーロ',
  '佐々木大': '佐々木大輔',
  '吉村誠之': '吉村誠之助',
  '御神本訓': '御神本訓史',
  '石川裕紀': '石川裕紀人',
});
const displayJockeyName = (name) => JOCKEY_DISPLAY_NAMES[name] ?? name;
const shuffled = (items) => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
};
const latestCondition = (value) => {
  return formatSurfaceDistance(value) ?? '芝・ダート／距離の情報なし';
};
const modeTarget = () => `${selectedYear}年のJRA平地G1${selectedMode === 'winners' ? '勝利馬' : 'で3着内'}`;
const questionIdsFor = (mode, year) => {
  if (year === 2025) {
    const source = mode === 'winners' ? winnerIds2025 : podiumIds2025;
    return rotate(source, dateOffset).slice(0, 5);
  }
  if (mode === 'winners') return rotate(winnerIds2026, dateOffset).slice(0, 5);
  return setIds;
};
const quizQuestion = (question) => {
  return {
    ...question,
    initial: { ...question.initial, eligibility: modeTarget() },
  };
};
const startQuiz = (mode, year) => {
  selectedMode = mode;
  selectedYear = year;
  attemptKey = `${dateKey}:${mode}:${year}`;
  attempt = loadAttempt(attemptKey);
  const questionIds = questionIdsFor(mode, year);
  if (attempt && attempt.answers.some((answer) => !questionById.has(answer.questionId))) {
    clearAttempt(attemptKey);
    attempt = null;
  }
  if (!attempt) {
    attempt = createAttempt(dateKey, questionIds);
    attempt.mode = mode;
    attempt.year = year;
  }
  saveAttempt(attemptKey, attempt);
  navigate(attempt.completedAt ? 'summary' : 'quiz');
};

// 画面遷移はブラウザ履歴にも記録し、戻る操作で開始画面へ安全に復帰できるようにする。
history.replaceState({ route }, '', location.href);
const navigate = (nextRoute, { replace = false } = {}) => {
  route = nextRoute;
  history[replace ? 'replaceState' : 'pushState']({ route }, '', location.href);
  render();
};

const esc = (v) => String(v).replace(/[&<>'"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' })[c]);
const save = () => saveAttempt(attemptKey, attempt);
const shell = (body) => { app.innerHTML = `<header class="site-header"><p><span>KEIBA GUESS</span><i>PROTOTYPE</i></p><h1>KEIBA GUESS</h1><div class="header-track" aria-hidden="true"><b></b><b></b><b></b><b></b><b></b></div></header>${body}<footer>プロトタイプ版・正式ランキングなし・JRA公式サービスではありません。<br>2025年・2026年のJRA平地G1馬を対象にした身内検証用です。</footer>`; };
const getCurrent = () => { const answer = attempt.answers[attempt.currentPosition]; return { answer, question: questionById.get(answer.questionId) }; };

function home() {
  if (homeStep === 'years') {
    const years = [2020, 2021, 2022, 2023, 2024, 2025, 2026].map((year) => [2025, 2026].includes(year)
      ? `<button class="primary year-button" data-year="${year}">${year}年版を始める</button>`
      : `<button class="secondary year-button" disabled>${year}年版 <small>Coming soon</small></button>`).join('');
    const definition = MODE_DEFINITIONS[selectedMode];
    shell(`<section class="card hero"><span class="badge">${definition.title}・${definition.difficulty}</span><h2>対象年を選択</h2><p>対象年のJRA平地G1で${definition.target}から出題します。2025年は対象馬を全頭収録済みです。</p><div class="mode-grid">${years}</div><button class="text-button" id="back-to-modes">← モード選択へ戻る</button></section>`);
    document.querySelectorAll('[data-year]').forEach((button) => { button.onclick = () => startQuiz(selectedMode, Number(button.dataset.year)); });
    document.querySelector('#back-to-modes').onclick = () => { homeStep = 'modes'; render(); };
    return;
  }
  const modes = [
    ['winners', '単年・G1勝利馬', '初級', '2025・2026年を選んで遊ぶ', true],
    ['podium', '単年・G1馬券圏内馬', '中級', '2025・2026年を選んで遊ぶ', true],
    [null, '単年・重賞馬券圏内馬', '上級', 'Coming soon', false],
    [null, '総合・G1勝利馬', '中級', 'Coming soon', false],
    [null, '総合・G1馬券圏内馬', '上級', 'Coming soon', false],
    [null, '総合・重賞馬券圏内馬', '超上級', 'Coming soon', false],
  ].map(([id, title, difficulty, note, enabled]) => `<button class="mode-card ${enabled ? 'available' : ''}" ${enabled ? `data-mode="${id}"` : 'disabled'}><span class="mode-card__top"><strong>${title}</strong><em class="difficulty difficulty--${difficulty}">${difficulty}</em></span><span class="mode-card__bottom"><small>${note}</small><b>${enabled ? 'PLAY →' : 'LOCKED'}</b></span></button>`).join('');
  shell(`<section class="card hero"><span class="badge">身内テスト版</span><h2>毎日の5問で、馬名を見抜け。</h2><p>戦績と騎手から馬名を推理し、迷ったらヒントを使おう。少ないヒントで5問の合計スコアに挑戦。<br><b>毎日のクイズは24時（日本時間）に更新されます。</b></p><div class="mode-grid">${modes}</div></section><section class="howto card"><p class="caption">HOW TO PLAY</p><h2>少ないヒントで、馬名を見抜け。</h2><ol><li><b>戦績</b>と騎手から、まずは一頭を絞り込む</li><li>迷ったらヒントを使う。使うほど得点は下がる</li><li>5問の合計スコアで、今日の自分に挑戦</li></ol><div class="definition-note"><p class="caption">DATA RULES</p><p><b>G1</b>：国際G1（海外で実施される国際G1、および東京大賞典を含む）。<br><b>重賞</b>：国内外の重賞（G1・G2・G3等）。JpnI・JpnII・JpnIIIなどの地方重賞は含みません。</p></div><p class="notice">2025年版は、障害G1を除くJRA平地G1全24レースの馬券内馬57頭を収録しています。</p></section>`);
  document.querySelectorAll('[data-mode]').forEach((button) => { button.onclick = () => { selectedMode = button.dataset.mode; homeStep = 'years'; render(); }; });
}

function quiz() {
  const { question: rawQuestion, answer } = getCurrent();
  const question = quizQuestion(rawQuestion);
  const currentScore = scoreQuestion({ correct: true, ...answer });
  const hintValue = (id) => {
    if (id === 'H2') return `最多騎乗騎手：${question.initial.mostRiddenJockey ?? displayJockeyName(question.initial.jockeys[0])}`;
    if (id === 'H5') return `直近出走の条件：${latestCondition(question.hints.H2)}`;
    return question.hints[id];
  };
  const hints = HINTS.map(({ id, label, description, cost }) => answer.revealedHints.includes(id)
    ? `<article class="hint open"><h3>${label}<span>−${cost}点</span></h3><p>${Array.isArray(hintValue(id)) ? hintValue(id).map(esc).join('<br>') : esc(hintValue(id))}</p></article>`
    : `<button class="hint" data-hint="${id}"><span class="hint-copy"><b>${label}</b><small>${description}</small></span><strong>−${cost}点</strong></button>`).join('');
  const firstReady = canRevealFirstCharacter(answer.revealedHints);
  const uniqueJockeys = [...new Set(question.initial.jockeys.map(displayJockeyName))];
  if (!answer.jockeyDisplayOrder) answer.jockeyDisplayOrder = shuffled(uniqueJockeys);
  const jockeys = answer.jockeyDisplayOrder;
  shell(`<section class="quiz-head"><span>第${attempt.currentPosition + 1}問 / 5問</span><strong>現在の得点 ${currentScore}点</strong><button class="text-button back-home" id="back-home">← ホームへ戻る</button></section><section class="card"><p class="caption">この馬は誰？</p><dl class="facts"><div><dt>通算成績</dt><dd>${esc(question.initial.overallRecord)}</dd></div><div><dt>G1通算成績</dt><dd>${esc(question.initial.g1Record)}</dd></div><div><dt>騎乗騎手<br><small>表示順はランダムです</small></dt><dd>${jockeys.map(esc).join('、')}</dd></div><div><dt>集計基準日</dt><dd>${esc(question.initial.asOfDate)}</dd></div><div><dt>対象条件</dt><dd>${esc(question.initial.eligibility)}</dd></div></dl></section><section class="hint-section"><div class="hint-section__head"><p class="caption">HINTS</p><p>ヒントを開くほど、獲得できる点数は下がります。</p></div><div class="hint-grid">${hints}</div></section><section class="card rescue"><button class="secondary" id="first" ${firstReady && !answer.usedFirstCharacter ? '' : 'disabled'}>${answer.usedFirstCharacter ? `頭文字：${esc(question.firstCharacter)}` : '頭文字を表示（−150点）'}</button><p>${firstReady ? '最後の救済ヒントです。' : '通常ヒントをすべて開くと使えます。'}</p></section><section class="card"><label for="answer">馬名を入力</label><input id="answer" autocomplete="off" placeholder="例：サンプルホース" /><p class="error" id="message" role="alert"></p><div class="button-row"><button id="submit" class="primary">回答する</button><button id="giveup" class="text-button">ギブアップ（0点）</button></div><p class="small">誤答: ${answer.wrongAnswerCount}回（1回につき−50点）</p></section>`);
  document.querySelector('#back-home').onclick = () => {
    if (!window.confirm('クイズを中断してホームへ戻りますか？\n進行状況は保存され、ホームから再開できます。')) return;
    homeStep = 'modes';
    navigate('home');
  };
  document.querySelectorAll('[data-hint]').forEach((b) => b.onclick = () => { answer.revealedHints.push(b.dataset.hint); save(); render(); });
  document.querySelector('#first').onclick = () => { answer.usedFirstCharacter = true; save(); render(); };
  const submit = () => {
    const input = document.querySelector('#answer').value;
    if (!input.trim()) { document.querySelector('#message').textContent = '馬名を入力してください。'; return; }
    if (isCorrectAnswer(input, question.answer)) complete('correct');
    else { answer.wrongAnswerCount += 1; save(); document.querySelector('#answer').value = ''; document.querySelector('#message').textContent = `不正解です。もう一度考えてみましょう（誤答 ${answer.wrongAnswerCount}回）。`; }
  };
  document.querySelector('#submit').onclick = submit;
  document.querySelector('#answer').onkeydown = (e) => { if (e.key === 'Enter') submit(); };
  document.querySelector('#giveup').onclick = () => complete('gave-up');
}

function complete(result) { const { answer } = getCurrent(); answer.result = result; answer.score = scoreQuestion({ correct: result === 'correct', ...answer }); answer.completedAt = new Date().toISOString(); save(); navigate('result'); }

function result() {
  const { question: rawQuestion, answer } = getCurrent(); const question = quizQuestion(rawQuestion); const correct = answer.result === 'correct';
  shell(`<section class="card result ${correct ? 'success' : 'gave-up'}"><p class="result-label">${correct ? '正解！' : '今回はギブアップ'}</p><h2>${esc(question.answer.nameJa)}</h2><p class="score">${answer.score}点</p><dl class="meta"><div><dt>使用ヒント</dt><dd>${answer.revealedHints.length}件${answer.usedFirstCharacter ? ' + 頭文字' : ''}</dd></div><div><dt>誤答</dt><dd>${answer.wrongAnswerCount}回</dd></div></dl><hr><p>${esc(question.explanation)}</p><p class="small">集計基準日: ${esc(question.initial.asOfDate)}</p><button id="next" class="primary">${attempt.currentPosition === 4 ? '総合結果へ' : '次の問題へ'}</button></section>`);
  document.querySelector('#next').onclick = () => { if (attempt.currentPosition === 4) { attempt.completedAt = new Date().toISOString(); save(); navigate('summary'); } else { attempt.currentPosition += 1; save(); navigate('quiz'); } };
}

function summary() {
  const elapsed = Math.max(0, new Date(attempt.completedAt).getTime() - new Date(attempt.startedAt).getTime());
  const items = attempt.answers.map((a, i) => `<li><span>第${i + 1}問</span><strong>${a.result === 'correct' ? '正解' : 'ギブアップ'}</strong><b>${a.score ?? 0}点</b></li>`).join('');
  shell(`<section class="card summary"><span class="badge">今日の結果</span><h2>${correctCount(attempt)} / 5問 正解</h2><p class="final-score">${totalScore(attempt).toLocaleString()}<small> / 5,000点</small></p><ul class="score-list">${items}</ul><dl class="meta"><div><dt>通常ヒント</dt><dd>${attempt.answers.reduce((n,a) => n + a.revealedHints.length, 0)}件</dd></div><div><dt>頭文字</dt><dd>${attempt.answers.filter((a) => a.usedFirstCharacter).length}件</dd></div><div><dt>所要時間</dt><dd>${Math.floor(elapsed / 60000)}分${Math.floor(elapsed / 1000) % 60}秒</dd></div></dl><div class="button-row"><button id="share" class="primary">結果を共有</button><button id="reset" class="secondary">最初から確認する</button></div><p class="notice" id="share-status" role="status"></p><p class="notice">この版は実在馬データによる身内検証用です。結果は正式ランキングには使われません。</p></section>`);
  document.querySelector('#share').onclick = async () => {
    const text = `KEIBA GUESS ${dateKey}\n${selectedYear}年 ${MODE_DEFINITIONS[selectedMode].title}\n\n正解 ${correctCount(attempt)}/5\nスコア ${totalScore(attempt).toLocaleString()} / 5,000\n${attempt.answers.map((a) => a.result === 'correct' ? '🟩' : '🟥').join(' ')}\n\nプロトタイプ版`;
    const status = document.querySelector('#share-status');
    try {
      if (navigator.share) {
        await navigator.share({ title: 'KEIBA GUESS', text });
        status.textContent = '共有画面を開きました。';
      } else {
        await navigator.clipboard.writeText(text);
        status.textContent = '共有用テキストをコピーしました。';
      }
    } catch (error) {
      try {
        await navigator.clipboard.writeText(text);
        status.textContent = '共有画面を開けなかったため、共有用テキストをコピーしました。';
      } catch {
        status.textContent = '共有用テキストをコピーできませんでした。';
      }
    }
  };
  document.querySelector('#reset').onclick = () => { clearAttempt(attemptKey); attempt = null; selectedMode = null; selectedYear = null; homeStep = 'modes'; navigate('home'); };
}

function render() { ({ home, quiz, result, summary })[route](); }
window.addEventListener('popstate', (event) => {
  route = event.state?.route ?? 'home';
  // 回答済みの問題に戻った場合は、二重回答を防ぐため結果画面へ戻す。
  if (route === 'quiz' && attempt?.answers[attempt.currentPosition]?.result) route = 'result';
  render();
});
render();
