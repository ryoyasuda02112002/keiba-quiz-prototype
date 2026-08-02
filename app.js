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
let route = attempt?.completedAt ? 'summary' : attempt ? 'quiz' : 'home';

// 画面遷移はブラウザ履歴にも記録し、戻る操作で開始画面へ安全に復帰できるようにする。
history.replaceState({ route }, '', location.href);
const navigate = (nextRoute, { replace = false } = {}) => {
  route = nextRoute;
  history[replace ? 'replaceState' : 'pushState']({ route }, '', location.href);
  render();
};

const esc = (v) => String(v).replace(/[&<>'"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' })[c]);
const save = () => saveAttempt(attempt);
const shell = (body) => { app.innerHTML = `<header class="site-header"><p>KEIBA QUIZ / PROTOTYPE</p><h1>競馬クイズ</h1></header>${body}<footer>プロトタイプ版・正式ランキングなし・JRA公式サービスではありません。<br>2026年JRA平地G1の馬券圏内馬を対象にした身内検証用です。</footer>`; };
const getCurrent = () => { const answer = attempt.answers[attempt.currentPosition]; return { answer, question: questionById.get(answer.questionId) }; };

function home() {
  const existing = loadAttempt(dateKey);
  shell(`<section class="card hero"><span class="badge">身内テスト版</span><h2>2026年 JRA G1馬券圏内馬</h2><p>戦績とヒントから、競走馬の名前を当てる5問クイズです。少ないヒントほど高得点。</p><dl class="meta"><div><dt>問題数</dt><dd>5問</dd></div><div><dt>最大得点</dt><dd>5,000点</dd></div><div><dt>基準日</dt><dd>問題ごとに表示</dd></div></dl><button class="primary" id="start">${existing ? '今日のクイズを再開' : '今日の5問を始める'}</button></section><section class="card"><h2>遊び方</h2><ol><li>通算成績・G1成績・騎手から推理します。</li><li>必要なら5種類のヒントを開きます。</li><li>すべてのヒント後は頭文字で救済できます。</li><li>誤答は1回50点減点。ギブアップは0点です。</li></ol><p class="notice">データ訂正や感想は、共有者へお知らせください。</p></section>`);
  document.querySelector('#start').onclick = () => { attempt = existing ?? createAttempt(dateKey, setIds); save(); navigate('quiz'); };
}

function quiz() {
  const { question, answer } = getCurrent();
  const currentScore = scoreQuestion({ correct: true, ...answer });
  const hints = HINTS.map(({ id, label, cost }) => answer.revealedHints.includes(id)
    ? `<article class="hint open"><h3>${label}<span>−${cost}点</span></h3><p>${Array.isArray(question.hints[id]) ? question.hints[id].map(esc).join('<br>') : esc(question.hints[id])}</p></article>`
    : `<button class="hint" data-hint="${id}"><span>${label}</span><strong>−${cost}点</strong></button>`).join('');
  const firstReady = canRevealFirstCharacter(answer.revealedHints);
  shell(`<section class="quiz-head"><span>第${attempt.currentPosition + 1}問 / 5問</span><strong>現在の得点 ${currentScore}点</strong></section><section class="card"><p class="caption">この馬は誰？</p><dl class="facts"><div><dt>通算成績</dt><dd>${esc(question.initial.overallRecord)}</dd></div><div><dt>G1通算成績</dt><dd>${esc(question.initial.g1Record)}</dd></div><div><dt>騎乗騎手</dt><dd>${question.initial.jockeys.map(esc).join('、')}</dd></div><div><dt>集計基準日</dt><dd>${esc(question.initial.asOfDate)}</dd></div><div><dt>対象条件</dt><dd>${esc(question.initial.eligibility)}</dd></div></dl></section><section class="hint-grid">${hints}</section><section class="card rescue"><button class="secondary" id="first" ${firstReady && !answer.usedFirstCharacter ? '' : 'disabled'}>${answer.usedFirstCharacter ? `頭文字：${esc(question.firstCharacter)}` : '頭文字を表示（−150点）'}</button><p>${firstReady ? '最後の救済ヒントです。' : '通常ヒントをすべて開くと使えます。'}</p></section><section class="card"><label for="answer">馬名を入力</label><input id="answer" autocomplete="off" placeholder="例：サンプルホース" /><p class="error" id="message" role="alert"></p><div class="button-row"><button id="submit" class="primary">回答する</button><button id="giveup" class="text-button">ギブアップ（0点）</button></div><p class="small">誤答: ${answer.wrongAnswerCount}回（1回につき−50点）</p></section>`);
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
  document.querySelector('#share').onclick = async () => { const text = `競馬クイズ ${dateKey}\n2026年 JRA G1馬券圏内馬\n\n正解 ${correctCount(attempt)}/5\nスコア ${totalScore(attempt).toLocaleString()} / 5,000\n${attempt.answers.map((a) => a.result === 'correct' ? '🟩' : '🟥').join(' ')}\n\nプロトタイプ版`; try { if (navigator.share) await navigator.share({ title: '競馬クイズ', text }); else { await navigator.clipboard.writeText(text); alert('結果をコピーしました。'); } } catch (e) { if (e.name !== 'AbortError') alert('共有できませんでした。'); } };
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
