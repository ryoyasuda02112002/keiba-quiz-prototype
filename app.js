import { HINTS, canRevealFirstCharacter, correctCount, createAttempt, isCorrectAnswer, japanDateKey, scoreQuestion, totalScore } from './domain.js';
import { clearAttempt, loadAttempt, saveAttempt } from './storage.js';

const app = document.querySelector('#app');
const [questions, dailySets] = await Promise.all([
  fetch('https://raw.githubusercontent.com/ryoyasuda02112002/keiba-quiz-prototype/main/questions.2026.json').then((r) => r.json()),
  fetch('https://raw.githubusercontent.com/ryoyasuda02112002/keiba-quiz-prototype/main/daily-sets.2026.json').then((r) => r.json()),
]);
const questionById = new Map(questions.filter((q) => q.enabled).map((q) => [q.id, q]));
const dateKey = japanDateKey();
const setIds = dailySets[dateKey] ?? dailySets.default;
let attempt = loadAttempt(dateKey);
if (attempt && attempt.answers.some((answer) => !questionById.has(answer.questionId))) {
  clearAttempt(dateKey);
  attempt = null;
}
let route = attempt?.completedAt ? 'summary' : attempt ? 'quiz' : 'home';
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
  const match = String(value).match(/(?:^|\/\s*)(芝|ダ)(\d{3,4})(?:\s*\/|\s*$)/);
  return match ? `${match[1]}/${match[2]}m` : '芝・ダート／距離の情報なし';
};

// 画面遷移はブラウザ履歴にも記録し、戻る操作で開始画面へ安全に復帰できるようにする。
history.replaceState({ route }, '', location.href);
const navigate = (nextRoute, { replace = false } = {}) => {
  route = nextRoute;
  history[replace ? 'replaceState' : 'pushState']({ route }, '', location.href);
  render();
};

const esc = (v) => String(v).replace(/[&<>'"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' })[c]);
const save = () => saveAttempt(attempt);
const shell = (body) => { app.innerHTML = `<header class="site-header"><p><span>KEIBA GUESS</span><i>PROTOTYPE</i></p><h1>KEIBA GUESS</h1><div class="header-track" aria-hidden="true"><b></b><b></b><b></b><b></b><b></b></div></header>${body}<footer>プロトタイプ版・正式ランキングなし・JRA公式サービスではありません。<br>2026年JRA平地G1の馬券圏内馬を対象にした身内検証用です。</footer>`; };
const getCurrent = () => { const answer = attempt.answers[attempt.currentPosition]; return { answer, question: questionById.get(answer.questionId) }; };

function home() {
  const existing = loadAttempt(dateKey);
  if (homeStep === 'years') {
    const years = [2020, 2021, 2022, 2023, 2024, 2025, 2026].map((year) => year === 2026
      ? `<button class="primary year-button" data-year="2026">2026年版を始める</button>`
      : `<button class="secondary year-button" disabled>${year}年版 <small>Coming soon</small></button>`).join('');
    shell(`<section class="card hero"><span class="badge">単年・G1馬券圏内馬</span><h2>対象年を選択</h2><p>対象年にJRA G1で馬券圏内に入った馬から出題します。</p><div class="mode-grid">${years}</div><button class="text-button" id="back-to-modes">← モード選択へ戻る</button></section>`);
    document.querySelector('[data-year="2026"]').onclick = () => { attempt = existing ?? createAttempt(dateKey, setIds); save(); navigate('quiz'); };
    document.querySelector('#back-to-modes').onclick = () => { homeStep = 'modes'; render(); };
    return;
  }
  const modes = [
    ['単年・G1馬券圏内馬', '中級', '対象年を選んで遊ぶ', true],
    ['単年・G1勝利馬', '初級', 'Coming soon', false],
    ['単年・重賞馬券圏内馬', '上級', 'Coming soon', false],
    ['総合・G1勝利馬', '中級', 'Coming soon', false],
    ['総合・G1馬券圏内馬', '上級', 'Coming soon', false],
    ['総合・重賞馬券圏内馬', '超上級', 'Coming soon', false],
  ].map(([title, difficulty, note, enabled]) => `<button class="mode-card ${enabled ? 'available' : ''}" ${enabled ? 'id="year-mode"' : 'disabled'}><span class="mode-card__top"><strong>${title}</strong><em class="difficulty difficulty--${difficulty}">${difficulty}</em></span><span class="mode-card__bottom"><small>${note}</small><b>${enabled ? 'PLAY →' : 'LOCKED'}</b></span></button>`).join('');
  shell(`<section class="card hero"><span class="badge">身内テスト版</span><h2>今日のレースを選ぼう</h2><p>知っている馬から、まだ知らない名馬まで。あなたの競馬知識に合うコースを選択。</p><div class="mode-grid">${modes}</div>${existing ? '<button class="resume-button" id="resume">▶ 前回のクイズを再開する</button>' : ''}</section><section class="howto card"><p class="caption">HOW TO PLAY</p><h2>少ないヒントで、馬名を見抜け。</h2><ol><li><b>戦績</b>と騎手から、まずは一頭を絞り込む</li><li>迷ったらヒントを使う。使うほど得点は下がる</li><li>5問の合計スコアで、今日の自分に挑戦</li></ol><div class="definition-note"><p class="caption">DATA RULES</p><p><b>G1</b>：国際G1（海外で実施される国際G1、および東京大賞典を含む）。<br><b>重賞</b>：国内外の重賞（G1・G2・G3等）。JpnI・JpnII・JpnIIIなどの地方重賞は含みません。</p></div><p class="notice">データ訂正や感想は、共有者へお知らせください。</p></section>`);
  document.querySelector('#year-mode').onclick = () => { homeStep = 'years'; render(); };
  document.querySelector('#resume')?.addEventListener('click', () => navigate('quiz'));
}

function quiz() {
  const { question, answer } = getCurrent();
  const currentScore = scoreQuestion({ correct: true, ...answer });
  const hintValue = (id) => {
    if (id === 'H2') return `最多騎乗騎手：${displayJockeyName(question.initial.jockeys[0])}`;
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
  const { question, answer } = getCurrent(); const correct = answer.result === 'correct';
  shell(`<section class="card result ${correct ? 'success' : 'gave-up'}"><p class="result-label">${correct ? '正解！' : '今回はギブアップ'}</p><h2>${esc(question.answer.nameJa)}</h2><p class="score">${answer.score}点</p><dl class="meta"><div><dt>使用ヒント</dt><dd>${answer.revealedHints.length}件${answer.usedFirstCharacter ? ' + 頭文字' : ''}</dd></div><div><dt>誤答</dt><dd>${answer.wrongAnswerCount}回</dd></div></dl><hr><p>${esc(question.explanation)}</p><p class="small">集計基準日: ${esc(question.initial.asOfDate)}</p><button id="next" class="primary">${attempt.currentPosition === 4 ? '総合結果へ' : '次の問題へ'}</button></section>`);
  document.querySelector('#next').onclick = () => { if (attempt.currentPosition === 4) { attempt.completedAt = new Date().toISOString(); save(); navigate('summary'); } else { attempt.currentPosition += 1; save(); navigate('quiz'); } };
}

function summary() {
  const elapsed = Math.max(0, new Date(attempt.completedAt).getTime() - new Date(attempt.startedAt).getTime());
  const items = attempt.answers.map((a, i) => `<li><span>第${i + 1}問</span><strong>${a.result === 'correct' ? '正解' : 'ギブアップ'}</strong><b>${a.score ?? 0}点</b></li>`).join('');
  shell(`<section class="card summary"><span class="badge">今日の結果</span><h2>${correctCount(attempt)} / 5問 正解</h2><p class="final-score">${totalScore(attempt).toLocaleString()}<small> / 5,000点</small></p><ul class="score-list">${items}</ul><dl class="meta"><div><dt>通常ヒント</dt><dd>${attempt.answers.reduce((n,a) => n + a.revealedHints.length, 0)}件</dd></div><div><dt>頭文字</dt><dd>${attempt.answers.filter((a) => a.usedFirstCharacter).length}件</dd></div><div><dt>所要時間</dt><dd>${Math.floor(elapsed / 60000)}分${Math.floor(elapsed / 1000) % 60}秒</dd></div></dl><div class="button-row"><button id="share" class="primary">結果を共有</button><button id="reset" class="secondary">最初から確認する</button></div><p class="notice">この版は実在馬データによる身内検証用です。結果は正式ランキングには使われません。</p></section>`);
  document.querySelector('#share').onclick = async () => { const text = `KEIBA GUESS ${dateKey}\n2026年 JRA G1馬券圏内馬\n\n正解 ${correctCount(attempt)}/5\nスコア ${totalScore(attempt).toLocaleString()} / 5,000\n${attempt.answers.map((a) => a.result === 'correct' ? '🟩' : '🟥').join(' ')}\n\nプロトタイプ版`; try { if (navigator.share) await navigator.share({ title: 'KEIBA GUESS', text }); else { await navigator.clipboard.writeText(text); alert('結果をコピーしました。'); } } catch (e) { if (e.name !== 'AbortError') alert('共有できませんでした。'); } };
  document.querySelector('#reset').onclick = () => { clearAttempt(dateKey); attempt = null; navigate('home'); };
}

function render() { ({ home, quiz, result, summary })[route](); }
window.addEventListener('popstate', (event) => {
  route = event.state?.route ?? 'home';
  // 回答済みの問題に戻った場合は、二重回答を防ぐため結果画面へ戻す。
  if (route === 'quiz' && attempt?.answers[attempt.currentPosition]?.result) route = 'result';
  render();
});
render();
