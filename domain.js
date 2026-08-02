export const HINTS = [
  { id: 'H1', label: '性別・馬齢', cost: 100 },
  { id: 'H2', label: '主な適性', cost: 150 },
  { id: 'H3', label: '重賞通算成績', cost: 150 },
  { id: 'H4', label: 'G1での主な実績', cost: 150 },
  { id: 'H5', label: '直近出走', cost: 150 },
];

// 長音符「ー」は馬名の一部なので除去しない。
const IGNORABLE = /[\s・･\-‐‑–—―]/g;

export function normalizeAnswer(value = '') {
  return value.normalize('NFKC').replace(IGNORABLE, '')
    .replace(/[ぁ-ん]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0x60))
    .toUpperCase();
}

export function isCorrectAnswer(input, answer) {
  const normalized = normalizeAnswer(input);
  return [answer.nameJa, answer.nameKana, ...(answer.aliases ?? [])].map(normalizeAnswer).includes(normalized);
}

export function canRevealFirstCharacter(revealedHints) {
  return HINTS.every(({ id }) => revealedHints.includes(id));
}

export function scoreQuestion({ correct, revealedHints = [], usedFirstCharacter = false, wrongAnswerCount = 0 }) {
  if (!correct) return 0;
  const hintCost = revealedHints.reduce((total, id) => total + (id === 'H1' ? 100 : 150), 0);
  return Math.max(100, 1000 - hintCost - (usedFirstCharacter ? 150 : 0) - wrongAnswerCount * 50);
}

export function japanDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function createAttempt(setDate, questionIds) {
  return { version: 1, setDate, questionIds, currentPosition: 0, startedAt: new Date().toISOString(), completedAt: null,
    answers: questionIds.map((questionId) => ({ questionId, revealedHints: [], usedFirstCharacter: false, wrongAnswerCount: 0, result: null, score: null, completedAt: null })) };
}
export const totalScore = (attempt) => attempt.answers.reduce((sum, answer) => sum + (answer.score ?? 0), 0);
export const correctCount = (attempt) => attempt.answers.filter((answer) => answer.result === 'correct').length;
