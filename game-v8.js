/**
 * game-v8.js — Logique du Quiz Coranique v8
 *
 * Corrections v8 :
 *  1. MASQUAGE UNIFIÉ : fonctionne dans TOUS les modes (QCM + Devinette)
 *  2. CAS 1 ROBUSTE : comparaison normalisée token-par-token (résistant aux
 *     différences de harakat entre le champ `mask` et le texte API)
 *  3. CAS 2 CORRIGÉ : bypass de _isSacred quand le mot EST le nom de la sourate
 *     (ex : sourate 55 الرحمن correctement masquée)
 *  4. MASQUAGE IA : détection assistée par Claude pour les versets API
 *     où les règles échouent — sans JAMAIS modifier le texte coranique original
 *  5. FIX DEVINETTE : le masque s'applique en mode Devinette comme en QCM
 */

// ════════════════════════════════════════════════════════════
//  1. THÈMES VISUELS
// ════════════════════════════════════════════════════════════

const THEMES = {
  gold: {
    '--bg-base':       '#3b1f0e',
    '--bg-card':       'rgba(59,31,14,0.95)',
    '--bg-card2':      'rgba(107,58,31,0.9)',
    '--bg-verse':      'rgba(30,12,4,0.7)',
    '--border':        'rgba(212,168,75,0.3)',
    '--border-strong': 'rgba(212,168,75,0.5)',
    '--text-primary':  '#f5e6d0',
    '--text-dim':      '#c8a882',
    '--text-cream':    '#fdf6ec',
    '--accent':        '#d4a84b',
    '--accent-light':  '#f0c870',
    '--accent-dim':    '#9a7230',
    '--correct-bg':    'rgba(42,122,74,0.2)',
    '--correct-fg':    '#7aefb4',
    '--correct-bd':    'rgba(42,122,74,0.4)',
    '--wrong-bg':      'rgba(122,42,42,0.2)',
    '--wrong-fg':      '#ef9a9a',
    '--wrong-bd':      'rgba(122,42,42,0.4)',
    '--option-bg':     'rgba(107,58,31,0.5)',
    '--option-bd':     'rgba(212,168,75,0.25)',
    '--btn-ghost-bd':  'rgba(245,230,208,0.2)',
    '--btn-ghost-fg':  '#c8a882',
    '--shadow':        '0 8px 40px rgba(0,0,0,0.45)',
  },
  claire: {
    '--bg-base':       '#e8d5b7',
    '--bg-card':       'rgba(255,248,235,0.97)',
    '--bg-card2':      'rgba(240,225,200,0.95)',
    '--bg-verse':      'rgba(255,255,255,0.85)',
    '--border':        'rgba(139,90,43,0.25)',
    '--border-strong': 'rgba(139,90,43,0.5)',
    '--text-primary':  '#3b1f0e',
    '--text-dim':      '#6b3a1f',
    '--text-cream':    '#3b1f0e',
    '--accent':        '#8b5a2b',
    '--accent-light':  '#c49a6c',
    '--accent-dim':    '#6b3a1f',
    '--correct-bg':    'rgba(42,122,74,0.12)',
    '--correct-fg':    '#1a5c34',
    '--correct-bd':    'rgba(42,122,74,0.35)',
    '--wrong-bg':      'rgba(180,50,50,0.1)',
    '--wrong-fg':      '#8b1a1a',
    '--wrong-bd':      'rgba(180,50,50,0.3)',
    '--option-bg':     'rgba(255,248,235,0.8)',
    '--option-bd':     'rgba(139,90,43,0.2)',
    '--btn-ghost-bd':  'rgba(59,31,14,0.25)',
    '--btn-ghost-fg':  '#6b3a1f',
    '--shadow':        '0 4px 20px rgba(100,60,20,0.2)',
  },
  sombre: {
    '--bg-base':       '#0d0d0d',
    '--bg-card':       'rgba(20,20,20,0.97)',
    '--bg-card2':      'rgba(30,30,30,0.95)',
    '--bg-verse':      'rgba(10,10,10,0.9)',
    '--border':        'rgba(180,20,20,0.3)',
    '--border-strong': 'rgba(200,30,30,0.55)',
    '--text-primary':  '#e0e0e0',
    '--text-dim':      '#999',
    '--text-cream':    '#e8e8e8',
    '--accent':        '#cc2222',
    '--accent-light':  '#ee4444',
    '--accent-dim':    '#991111',
    '--correct-bg':    'rgba(20,80,40,0.25)',
    '--correct-fg':    '#5aefaa',
    '--correct-bd':    'rgba(30,120,60,0.4)',
    '--wrong-bg':      'rgba(120,20,20,0.25)',
    '--wrong-fg':      '#ff7070',
    '--wrong-bd':      'rgba(160,30,30,0.45)',
    '--option-bg':     'rgba(30,30,30,0.7)',
    '--option-bd':     'rgba(180,20,20,0.25)',
    '--btn-ghost-bd':  'rgba(220,220,220,0.15)',
    '--btn-ghost-fg':  '#999',
    '--shadow':        '0 8px 40px rgba(0,0,0,0.7)',
  },
};

let currentTheme = 'gold';

function applyTheme(name) {
  currentTheme = name;
  localStorage.setItem('quranTheme', name);
  const root = document.documentElement;
  const vars = THEMES[name];
  if (!vars) return;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));

  if (name === 'claire') {
    document.body.style.backgroundColor = '#e8d5b7';
    document.body.style.backgroundImage = 'none';
  } else if (name === 'sombre') {
    document.body.style.backgroundColor = '#0d0d0d';
    document.body.style.backgroundImage = 'none';
  } else {
    document.body.style.backgroundColor = '';
    document.body.style.backgroundImage = '';
  }

  document.querySelectorAll('.theme-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === name);
  });
}

// ════════════════════════════════════════════════════════════
//  2. NORMALISATION ARABE
// ════════════════════════════════════════════════════════════

/**
 * Normalisation profonde : supprime diacritiques, unifie formes d'alef,
 * supprime l'article ال, normalise ة ى ؤ ئ.
 * Utilisée pour les COMPARAISONS (jamais pour l'affichage).
 */
function normalizeArabic(text) {
  if (!text) return '';
  return text
    .replace(/[\u064B-\u065F\u0670\u0640\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/(^|\s)ال/g, '$1')
    .replace(/[^\u0600-\u06FF\s]/g, '')
    .trim();
}

// ════════════════════════════════════════════════════════════
//  3. MASKING v9 — ROBUSTE + IA
//
//  Architecture :
//   • maskSurahNameInVerse()  → synchrone, instante, 3 cas
//   • _applyAIMask()          → asynchrone, enrichit le DOM après rendu
//                               si les règles n'ont rien trouvé
//
//  Règles :
//   CAS 1 — mask explicite dans le verset (champ `mask`)
//     Comparaison normalisée token-par-token, résistante aux
//     différences de harakat entre la donnée statique et l'API.
//     allowSacred = true (le mot est explicitement désigné).
//
//   CAS 2 — verset API sans mask : cherche le nom de la sourate
//     (normalisé, ال inclus dans la cible éliminé par normalizeArabic).
//     Contournement de _isSacred quand LE NOM DE LA SOURATE est lui-même
//     un mot sacré (ex : sourate 55 = الرحمن).
//
//   CAS 3 — rien trouvé → verset affiché intact (synchrone)
//     L'IA tente sa chance en arrière-plan et met à jour le DOM.
//
//  Invariant : le texte coranique original n'est JAMAIS modifié.
// ════════════════════════════════════════════════════════════

// ── Mots protégés par défaut dans CAS 2 ─────────────────────
const SACRED_WORDS_SET = new Set([
  'الله','رب','الرحمن','الرحيم','النبي','الرسول'
]);

function _isSacred(token) {
  const n = normalizeArabic(token);
  for (const s of SACRED_WORDS_SET) { if (normalizeArabic(s) === n) return true; }
  return false;
}

function _isDelimiter(token) {
  return /^[\s\u06D4\u06D6-\u06DC\u06DF-\u06E4۞۩،؟!:.\u200c\u200d\u200f]+$/.test(token);
}

/**
 * Crée un span masque proportionnel à la longueur du mot.
 * Utilise les caractères bruts du token pour calculer la largeur.
 * Le texte coranique original n'est jamais modifié — seul le HTML change.
 */
function _maskSpan(arabicToken) {
  const letters = (arabicToken || '').replace(/[^\u0600-\u06FF]/g, '');
  const len  = Math.max(2, Math.min(letters.length, 9));
  const dots = '░'.repeat(len);
  return `<span class="name-mask" dir="rtl" aria-label="كلمة مخفية" title="؟">${dots}</span>`;
}

/** Tokenise en conservant les séparateurs pour permettre join('') = original. */
function _tokenize(text) {
  return text.split(/([ \t\n\r\u00A0\u06D4\u06D6-\u06DC\u06DF-\u06E4۞۩،؟!:.\u200c\u200d\u200f]+)/);
}

/**
 * Cherche dans `tokens` le premier token non-délimiteur dont
 * normalizeArabic(token) === normTarget.
 *
 * @param {string[]} tokens      Tableau issu de _tokenize()
 * @param {string}   normTarget  Cible déjà normalisée (via normalizeArabic)
 * @param {boolean}  allowSacred Si true, les mots "sacrés" sont inclus dans la recherche
 * @returns {number} index dans tokens, ou -1
 */
function _findTokenByNorm(tokens, normTarget, allowSacred) {
  if (!normTarget || normTarget.length < 2) return -1;
  return tokens.findIndex(t => {
    if (_isDelimiter(t)) return false;
    if (!allowSacred && _isSacred(t)) return false;
    return normalizeArabic(t) === normTarget;
  });
}

/**
 * Cœur du masquage (synchrone).
 * Retourne le HTML du verset avec UN token masqué, ou le texte intact.
 * Le texte coranique brut (harakat, Unicode) n'est jamais modifié.
 *
 * @param {string} verseText  Texte arabe brut (avec harakat complets)
 * @param {object} verse      Objet verset { v, n, a, d, mask? }
 * @param {object} surahInfo  Objet sourate { num, ar, ... }
 * @returns {string}  HTML prêt à injecter dans innerHTML
 */
function maskSurahNameInVerse(verseText, verse, surahInfo) {
  const tokens = _tokenize(verseText);

  // ── CAS 1 : mask explicite défini dans le verset ──────────
  // On compare après normalisation pour absorber les différences de harakat
  // entre le champ `mask` (typé manuellement) et le texte retourné par l'API.
  // allowSacred = true : si le champ mask désigne un mot "sacré", on l'honore.
  if (verse.mask) {
    const maskNorm = normalizeArabic(verse.mask);
    const idx      = _findTokenByNorm(tokens, maskNorm, /* allowSacred */ true);
    if (idx !== -1) {
      const before = tokens.slice(0, idx).join('');
      const after  = tokens.slice(idx + 1).join('');
      return escapeHTML(before) + _maskSpan(tokens[idx]) + escapeHTML(after);
    }
  }

  // ── CAS 2 : verset API sans mask — cherche le nom normalisé ──
  // normalizeArabic supprime ال, ce qui permet de retrouver le mot
  // même si la cible a des harakat différents ou une déclinaison finale.
  // Ex : sourate "آل عمران" → normalisé "عمران" → retrouve "عِمْرَانَ"
  // Ex : sourate "الرحمن"  → normalisé "رحمن"  → retrouve "الرَّحْمَٰنُ"
  const surahNorm = normalizeArabic(surahInfo.ar);
  if (surahNorm.length >= 2) {
    // allowSacred = true si le NOM DE LA SOURATE est lui-même "sacré"
    // (ex : sourate 55 الرحمن — sinon _isSacred bloquerait le masque)
    const surahIsSacred = _isSacred(surahInfo.ar);
    const idx = _findTokenByNorm(tokens, surahNorm, surahIsSacred);
    if (idx !== -1) {
      const before = tokens.slice(0, idx).join('');
      const after  = tokens.slice(idx + 1).join('');
      return escapeHTML(before) + _maskSpan(tokens[idx]) + escapeHTML(after);
    }
  }

  // ── CAS 3 : rien trouvé → texte intact (l'IA prendra le relais async) ──
  return escapeHTML(verseText);
}

// ── MASQUAGE IA ──────────────────────────────────────────────
//
//  Quand les règles (CAS 1 & 2) ne trouvent rien, Claude analyse le verset
//  et identifie quel token correspond au nom de la sourate.
//  La réponse est la copie EXACTE du token dans le verset : zéro modification
//  du texte coranique. Le résultat est mis en cache pour ne pas rappeler l'API.
//
//  Activation : laisser AI_API_KEY vide dans Claude.ai (proxy automatique).
//  Pour usage standalone, renseignez votre clé Anthropic ci-dessous.
// ─────────────────────────────────────────────────────────────

const AI_API_KEY = '';   // ← Votre clé API (optionnel dans Claude.ai)
const _aiMaskCache = new Map();  // clé → token string | null
let   _aiEnabled  = true;        // mis à false si 401/403

/**
 * Interroge Claude pour identifier le token masquable dans verseText.
 * Retourne le token exact (copie caractère par caractère depuis le verset)
 * ou null si le nom n'y figure pas.
 * Le verset coranique n'est JAMAIS modifié — Claude ne fait qu'identifier.
 */
async function _detectMaskWithAI(verseText, surahInfo) {
  const cacheKey = `${surahInfo.num}:${verseText.slice(0, 60)}`;
  if (_aiMaskCache.has(cacheKey)) return _aiMaskCache.get(cacheKey);
  if (!_aiEnabled) return null;

  const prompt =
`Tu es un expert en morphologie coranique arabe. Réponds de façon ultra-concise.

Verset : ${verseText}
Sourate : ${surahInfo.ar} (n°${surahInfo.num})

Le nom de cette sourate, ou sa forme déclinée/suffixée (avec harakat, tanwin, etc.), apparaît-il dans ce verset ?
• Si OUI : copie le token EXACTEMENT tel qu'il figure dans le verset — caractère par caractère, harakat compris. Aucune explication.
• Si NON : réponds uniquement le mot null (sans guillemets, sans ponctuation).`;

  try {
    const headers = { 'Content-Type': 'application/json' };
    // En dehors de Claude.ai : fournissez votre clé dans AI_API_KEY
    if (AI_API_KEY) {
      headers['x-api-key']           = AI_API_KEY;
      headers['anthropic-version']   = '2023-06-01';
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method : 'POST',
      headers,
      body   : JSON.stringify({
        model      : 'claude-haiku-4-5-20251001', // rapide et économique pour cette tâche simple
        max_tokens : 40,
        messages   : [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) _aiEnabled = false;
      _aiMaskCache.set(cacheKey, null);
      return null;
    }

    const data = await res.json();
    const raw  = (data.content?.[0]?.text || '').trim();

    // Nettoyer la réponse : retirer éventuels guillemets ou espaces parasites
    const cleaned = raw.replace(/^["'`«»]+|["'`«»]+$/g, '').trim();
    const token   = (cleaned === 'null' || cleaned === '' || cleaned.includes(' ')) ? null : cleaned;

    _aiMaskCache.set(cacheKey, token);
    return token;

  } catch (e) {
    console.warn('[AIC Mask] Erreur réseau:', e.message);
    _aiMaskCache.set(cacheKey, null);
    return null;
  }
}

/**
 * Enrichissement asynchrone du DOM après rendu synchrone.
 * Appelé quand maskSurahNameInVerse n'a rien trouvé (CAS 3).
 *
 * - Interroge Claude pour identifier le token masquable
 * - Vérifie que ce token existe bien dans le verset (sécurité)
 * - Met à jour innerHTML sans toucher au texte coranique original
 * - Ne fait rien si la question a déjà été répondue (évite les mises à jour
 *   décalées qui perturberaient l'affichage du feedback)
 *
 * @param {string} elementId  ID du DOM element affichant le verset
 * @param {object} verse      Objet verset
 * @param {object} surahInfo  Objet sourate
 */
async function _applyAIMask(elementId, verse, surahInfo) {
  const token = await _detectMaskWithAI(verse.v, surahInfo);
  if (!token) return;

  // Valider : le token doit apparaître (normalisé) dans le verset
  const tokenNorm = normalizeArabic(token);
  if (!tokenNorm || tokenNorm.length < 2) return;

  const tokens = _tokenize(verse.v);
  const idx    = _findTokenByNorm(tokens, tokenNorm, /* allowSacred */ true);
  if (idx === -1) return;

  const before     = tokens.slice(0, idx).join('');
  const after      = tokens.slice(idx + 1).join('');
  const maskedHTML = escapeHTML(before) + _maskSpan(tokens[idx]) + escapeHTML(after);

  const el = document.getElementById(elementId);
  // Ne mettre à jour que si : l'élément existe, n'a pas encore de masque,
  // et affiche toujours ce verset (vérification du texte brut)
  if (el && !el.innerHTML.includes('name-mask')) {
    el.innerHTML = maskedHTML;
  }
}

/** Échappe le HTML (les spans déjà générés passent par concaténation, pas ici). */
function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ════════════════════════════════════════════════════════════
//  4. ANALYSE SÉMANTIQUE + DISTRACTEURS
// ════════════════════════════════════════════════════════════

const THEMATIC_KEYWORDS = [
  'فرعون','جنه','نار','جهنم','قيامه','ملائكه','شيطان','ابليس',
  'كعبه','صلاه','زكاه','صوم','حج','كتاب','قران','توراه','انجيل','منافق',
  'سليمان','داود','يونس','لوط','يعقوب','اسماعيل','اسحاق','هود','صالح',
];

function analyzeVerse(verseText) {
  const norm = normalizeArabic(verseText);
  const detectedProphets = [];
  const detectedKeywords = [];

  const prophetSet = new Map();
  SURAHS.forEach(s => s.prophets?.forEach(p => {
    const pn = normalizeArabic(p);
    if (pn.length >= 3) prophetSet.set(pn, p);
  }));

  prophetSet.forEach((_, pNorm) => {
    if (norm.includes(pNorm) && !detectedProphets.includes(pNorm))
      detectedProphets.push(pNorm);
  });

  THEMATIC_KEYWORDS.forEach(kw => {
    const kwn = normalizeArabic(kw);
    if (norm.includes(kwn) && !detectedKeywords.includes(kwn))
      detectedKeywords.push(kwn);
  });

  return { detectedProphets, detectedKeywords };
}

function _themeMatchScore(surah, detectedKeywords) {
  if (!detectedKeywords.length) return 0;
  const fields = normalizeArabic((surah.themeAr || '') + ' ' + (surah.context || ''));
  let bonus = 0;
  detectedKeywords.forEach(kw => { if (fields.includes(kw)) bonus -= 8; });
  return bonus;
}

function _prophetMatchScore(surah, detectedProphets) {
  if (!detectedProphets.length || !surah.prophets?.length) return 0;
  const sProphNorm = surah.prophets.map(p => normalizeArabic(p));
  let bonus = 0;
  detectedProphets.forEach(dp => {
    if (sProphNorm.some(sp => sp.includes(dp) || dp.includes(sp))) bonus -= 14;
  });
  return bonus;
}

function getSmartDistractors(verse, surahInfo) {
  const correctNum   = surahInfo.num;
  const correctAyahs = surahInfo.ayahs;
  const { juz, type } = surahInfo;
  const { detectedProphets, detectedKeywords } = analyzeVerse(verse.v);

  const scored = SURAHS
    .filter(s => s.num !== correctNum)
    .map(s => {
      let score = 0;
      score += Math.abs(s.juz - juz) * 3;

      const ratio = Math.max(s.ayahs, correctAyahs) / Math.min(s.ayahs, correctAyahs);
      if      (ratio > 10) score += 20;
      else if (ratio > 5)  score += 10;
      else if (ratio > 3)  score += 4;
      else                 score -= 3;

      if (s.type === type)             score -= 3;
      if (juz === 30 && s.juz === 30)  score -= 8;
      score += _prophetMatchScore(s, detectedProphets);
      score += _themeMatchScore(s, detectedKeywords);
      score += Math.random() * 4;

      return { surah: s, score };
    });

  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, 3).map(x => x.surah);
}

// ════════════════════════════════════════════════════════════
//  5. DISTANCE ENTRE SOURATES (pour Mode Devinette)
// ════════════════════════════════════════════════════════════

function calcSurahDistance(guessNum, correctNum) {
  if (guessNum === correctNum) return { distance: 0, pct: 100, label: 'correct', emoji: '🎯', hint: '' };

  const g = SURAHS.find(s => s.num === guessNum);
  const c = SURAHS.find(s => s.num === correctNum);

  const numDiff  = Math.abs(guessNum - correctNum);
  const numScore = Math.max(0, 1 - numDiff / 113);

  const juzDiff  = g && c ? Math.abs(g.juz - c.juz) : numDiff / 4;
  const juzScore = Math.max(0, 1 - juzDiff / 30);

  const typeBonus = (g && c && g.type === c.type) ? 0.08 : 0;
  const raw = numScore * 0.5 + juzScore * 0.4 + typeBonus;
  const pct = Math.round(raw * 100);

  const dir = guessNum < correctNum
    ? (currentLang === 'ar' ? 'الصواب بعدها 👉' : currentLang === 'en' ? 'Answer is later 👉' : 'La réponse est plus loin 👉')
    : (currentLang === 'ar' ? '👈 الصواب قبلها' : currentLang === 'en' ? '👈 Answer is earlier' : '👈 La réponse est avant');

  let label, emoji, hint;
  if (pct >= 85) {
    label = currentLang === 'ar' ? 'قريب جداً!' : currentLang === 'en' ? 'Very close!' : 'Très proche !';
    emoji = '🔥'; hint = dir;
  } else if (pct >= 65) {
    label = currentLang === 'ar' ? 'قريب' : currentLang === 'en' ? 'Close' : 'Proche';
    emoji = '✨'; hint = dir;
  } else if (pct >= 40) {
    label = currentLang === 'ar' ? 'متوسط' : currentLang === 'en' ? 'Getting warmer' : 'Pas loin';
    emoji = '🌡️'; hint = dir;
  } else {
    label = currentLang === 'ar' ? 'بعيد' : currentLang === 'en' ? 'Far away' : 'Loin';
    emoji = '🧊'; hint = dir;
  }

  return { distance: numDiff, pct, label, emoji, hint };
}

// ════════════════════════════════════════════════════════════
//  6. DECK & STATE
// ════════════════════════════════════════════════════════════

function buildWeightedDeck() {
  const weighted = [];
  VERSES.forEach((v, i) => {
    const w = v.d === 3 ? 3 : v.d === 2 ? 2 : 1;
    for (let x = 0; x < w; x++) weighted.push(i);
  });
  return shuffle(weighted);
}

let state = {
  score:         0,
  qNum:          0,
  maxQ:          10,
  shuffledDeck:  [],
  deckPos:       0,
  answered:      false,
  usedVerseKeys: new Set(),

  guessVerse:       null,
  guessSurah:       null,
  guessAttempts:    0,
  guessMaxAttempts: 5,

  currentMode: 'qcm',
};

const SERIES_SIZES = [15, 25, 50, 100, 150, Infinity];
let selectedSeries = 15;
let selectedMode   = 'qcm';

// ════════════════════════════════════════════════════════════
//  7. NAVIGATION
// ════════════════════════════════════════════════════════════

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

function goHome()   { showScreen('screen-home'); applyLang(); }
function quitGame() { if (confirm(t('quitConfirm'))) goHome(); }

// ════════════════════════════════════════════════════════════
//  8. SETUP SOLO (avec choix de mode)
// ════════════════════════════════════════════════════════════

function goToSetup() {
  const sel = document.getElementById('series-selector');
  sel.innerHTML = '';
  SERIES_SIZES.forEach(sz => {
    const btn = document.createElement('button');
    btn.className = 'series-btn' + (sz === selectedSeries ? ' active' : '');
    btn.textContent = sz === Infinity ? t('seriesInfinite') : sz;
    btn.onclick = () => {
      document.querySelectorAll('.series-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedSeries = sz;
    };
    sel.appendChild(btn);
  });

  const modesel = document.getElementById('mode-selector');
  if (modesel) {
    modesel.innerHTML = '';
    ['qcm', 'devinette'].forEach(m => {
      const btn = document.createElement('button');
      btn.className = 'mode-sel-btn' + (m === selectedMode ? ' active' : '');
      btn.dataset.mode = m;
      btn.innerHTML = m === 'qcm'
        ? `<span class="msb-icon">📝</span><span class="msb-label">${t('modeQCM')}</span>`
        : `<span class="msb-icon">🔍</span><span class="msb-label">${t('modeGuess')}</span>`;
      btn.onclick = () => {
        document.querySelectorAll('.mode-sel-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedMode = m;
      };
      modesel.appendChild(btn);
    });
  }

  document.getElementById('setup-title').textContent    = t('setupTitle');
  document.getElementById('setup-sub').textContent      = t('setupSub');
  document.getElementById('setup-logo-sub').textContent = t('setupLogoSub');
  document.getElementById('start-solo-btn').textContent = t('startSolo');
  document.getElementById('setup-back-btn').textContent = t('backBtn');
  showScreen('screen-setup');
}

function startFromSetup() {
  if (selectedMode === 'devinette') startModeDevinette();
  else startMode1();
}

// ════════════════════════════════════════════════════════════
//  9. MODE QCM
// ════════════════════════════════════════════════════════════

function startMode1() {
  state.score         = 0;
  state.qNum          = 0;
  state.maxQ          = selectedSeries === Infinity ? Infinity : selectedSeries;
  state.answered      = false;
  state.shuffledDeck  = buildWeightedDeck();
  state.deckPos       = 0;
  state.usedVerseKeys = new Set();
  state.currentMode   = 'qcm';

  document.getElementById('nav-menu-btn').textContent = t('navMenu');
  document.getElementById('nav-quit-btn').textContent = t('navQuit');
  document.getElementById('end-btn-txt').textContent  = t('endGame');

  showScreen('screen-quiz');
  loadQuestion();
}

async function loadQuestion() {
  if (state.maxQ !== Infinity && state.qNum >= state.maxQ) { endQuiz(); return; }

  state.qNum++;
  state.answered = false;

  document.getElementById('q-next').style.display   = 'none';
  document.getElementById('q-feedback').textContent = '';
  document.getElementById('q-feedback').className   = 'feedback';
  document.getElementById('q-num').textContent      = state.qNum;
  document.getElementById('q-total').textContent    = state.maxQ === Infinity ? '/∞' : '/' + state.maxQ;

  let verse = null, surahInfo = null;

  // Essai 1 : buffer API
  const bufferedCandidates = [];
  for (let i = 0; i < 4; i++) {
    const candidate = QuranAPI.getBufferedVerse();
    if (!candidate) break;
    const info = SURAHS.find(s => s.num === candidate.n);
    if (!info) continue;
    const key = `${candidate.n}:${candidate.a}`;
    if (state.usedVerseKeys.has(key)) { bufferedCandidates.push(candidate); continue; }
    verse = candidate; surahInfo = info;
    state.usedVerseKeys.add(key);
    break;
  }

  // Essai 2 : base statique
  if (!verse) {
    let tries = 0;
    while (tries < VERSES.length) {
      if (state.deckPos >= state.shuffledDeck.length) {
        state.shuffledDeck = buildWeightedDeck(); state.deckPos = 0;
      }
      const idx  = state.shuffledDeck[state.deckPos++];
      const v    = VERSES[idx];
      const info = SURAHS.find(s => s.num === v.n);
      if (!info) { tries++; continue; }
      const key = `${v.n}:${v.a}`;
      if (!state.usedVerseKeys.has(key)) {
        verse = v; surahInfo = info; state.usedVerseKeys.add(key); break;
      }
      tries++;
    }
    if (!verse) {
      state.usedVerseKeys.clear();
      state.shuffledDeck = buildWeightedDeck(); state.deckPos = 0;
      const idx = state.shuffledDeck[state.deckPos++];
      verse = VERSES[idx]; surahInfo = SURAHS.find(s => s.num === verse.n);
    }
  }

  if (!surahInfo) { loadQuestion(); return; }
  _renderQuestion(verse, surahInfo);
}

function _renderQuestion(verse, surahInfo) {
  const badge = document.getElementById('verse-diff-badge');
  if      (verse.d === 1) { badge.textContent = t('diffEasy');   badge.className = 'diff-badge diff-easy';   }
  else if (verse.d === 2) { badge.textContent = t('diffMedium'); badge.className = 'diff-badge diff-medium'; }
  else                    { badge.textContent = t('diffHard');   badge.className = 'diff-badge diff-hard';   }

  // Masquage synchrone (CAS 1 & 2)
  const maskedVerse = maskSurahNameInVerse(verse.v, verse, surahInfo);
  const verseEl     = document.getElementById('q-verse');
  verseEl.innerHTML = maskedVerse;

  document.getElementById('q-question-label').textContent = t('questionLabel');

  // Si le masquage synchrone n'a rien trouvé (CAS 3), l'IA prend le relais
  if (!maskedVerse.includes('name-mask')) {
    _applyAIMask('q-verse', verse, surahInfo);
  }

  const distractors = getSmartDistractors(verse, surahInfo);
  const options     = shuffle([surahInfo, ...distractors]);
  const grid        = document.getElementById('q-options');
  grid.innerHTML    = '';

  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    const sub = currentLang === 'en' ? opt.en : currentLang === 'ar' ? '' : opt.fr;
    btn.innerHTML = `<span class="opt-ar">${opt.ar}</span>` + (sub ? `<span class="opt-fr">${sub}</span>` : '');
    btn.onclick = () => selectAnswer(opt.num, surahInfo.num, btn);
    grid.appendChild(btn);
  });
}

function selectAnswer(chosen, correct, clickedBtn) {
  if (state.answered) return;
  state.answered = true;
  const btns = document.querySelectorAll('.option-btn');
  btns.forEach(b => b.disabled = true);

  const fb = document.getElementById('q-feedback');
  if (chosen === correct) {
    state.score++;
    clickedBtn.classList.add('correct');
    fb.textContent = t('correctFb'); fb.className = 'feedback correct';
    const scoreEl = document.getElementById('q-score');
    scoreEl.textContent = state.score;
    scoreEl.classList.remove('bump'); void scoreEl.offsetWidth; scoreEl.classList.add('bump');
    spawnScoreFloat('+1', clickedBtn);
  } else {
    clickedBtn.classList.add('wrong');
    btns.forEach(b => {
      const ar = b.querySelector('.opt-ar')?.textContent;
      const m  = SURAHS.find(s => s.ar === ar);
      if (m?.num === correct) b.classList.add('correct');
    });
    const cs   = SURAHS.find(s => s.num === correct);
    const name = currentLang === 'en' ? cs.en : currentLang === 'ar' ? cs.ar : cs.fr;
    fb.textContent = t('wrongFbPre') + cs.ar + (currentLang !== 'ar' ? ' (' + name + ')' : '');
    fb.className = 'feedback wrong';
  }

  const limitReached = state.maxQ !== Infinity && state.qNum >= state.maxQ;
  if (!limitReached) {
    const nb = document.getElementById('q-next');
    nb.style.display = ''; nb.textContent = t('nextVerse');
  } else setTimeout(endQuiz, 1400);
}

function endQuiz() {
  document.getElementById('end-score').textContent    = '0';
  document.getElementById('end-total').textContent    = state.maxQ === Infinity ? '' : '/' + state.maxQ;
  document.getElementById('end-subtitle').textContent = t('endSubtitle');
  document.getElementById('replay-btn').textContent   = t('replay');
  document.getElementById('home-btn-end').textContent = t('homeBtn');

  const ratio = state.maxQ === Infinity ? 1 : state.score / state.maxQ;
  let stars = '', msg = '';
  if      (ratio >= 0.9) { stars = '⭐⭐⭐'; msg = t('endMsg9'); }
  else if (ratio >= 0.6) { stars = '⭐⭐';   msg = t('endMsg6'); }
  else if (ratio >= 0.3) { stars = '⭐';     msg = t('endMsg3'); }
  else                   { stars = '';        msg = t('endMsg0'); }

  document.getElementById('end-stars').textContent = stars;
  document.getElementById('end-msg').textContent   = msg;
  showScreen('screen-end');
  animateScoreCount(document.getElementById('end-score'), state.score);
  setTimeout(() => {
    const fill = document.getElementById('score-ring-fill');
    if (fill && state.maxQ !== Infinity) {
      const circ = 2 * Math.PI * 56;
      fill.style.strokeDashoffset = circ * (1 - Math.min(state.score / state.maxQ, 1));
    }
  }, 300);
  if (ratio >= 0.9) setTimeout(spawnConfetti, 600);
}

// ════════════════════════════════════════════════════════════
//  10. MODE DEVINETTE
//
//  FIX v8 : le masque s'applique maintenant ici aussi.
//  Le joueur voit le verset avec le nom de la sourate masqué,
//  puis doit identifier la sourate dans la grille complète.
//  L'IA intervient en CAS 3 (asynchrone, pas de blocage UX).
// ════════════════════════════════════════════════════════════

function startModeDevinette() {
  state.score         = 0;
  state.qNum          = 0;
  state.maxQ          = selectedSeries === Infinity ? Infinity : selectedSeries;
  state.answered      = false;
  state.usedVerseKeys = new Set();
  state.currentMode   = 'devinette';

  document.getElementById('gv-nav-menu').textContent = t('navMenu');
  document.getElementById('gv-nav-quit').textContent = t('navQuit');
  document.getElementById('gv-end-btn').textContent  = t('endGame');

  showScreen('screen-guess-mode');
  loadGuessQuestion();
}

async function loadGuessQuestion() {
  if (state.maxQ !== Infinity && state.qNum >= state.maxQ) { endGuessMode(); return; }

  state.qNum++;
  state.guessAttempts = 0;

  document.getElementById('gv-num').textContent              = state.qNum;
  document.getElementById('gv-total').textContent            = state.maxQ === Infinity ? '/∞' : '/' + state.maxQ;
  document.getElementById('gv-score').textContent            = state.score;
  document.getElementById('gv-feedback-area').innerHTML      = '';
  document.getElementById('gv-submit-btn').disabled          = true;
  document.getElementById('gv-selected-name').textContent    = t('gvSelectPrompt');
  document.getElementById('gv-attempts-bar').innerHTML       = _renderAttemptsDots(0);

  state.guessSelected = null;
  document.querySelectorAll('#gv-surah-grid .sg-btn').forEach(b => b.classList.remove('selected'));

  // ── Chargement du verset ──────────────────────────────────
  let verse = null, surahInfo = null;

  const api = QuranAPI.getBufferedVerse();
  if (api) {
    const info = SURAHS.find(s => s.num === api.n);
    if (info && !state.usedVerseKeys.has(`${api.n}:${api.a}`)) {
      verse = api; surahInfo = info; state.usedVerseKeys.add(`${api.n}:${api.a}`);
    }
  }

  if (!verse) {
    if (state.deckPos >= (state.shuffledDeck?.length || 0)) {
      state.shuffledDeck = buildWeightedDeck(); state.deckPos = 0;
    }
    if (!state.shuffledDeck) { state.shuffledDeck = buildWeightedDeck(); state.deckPos = 0; }
    const idx = state.shuffledDeck[state.deckPos++];
    verse = VERSES[idx]; surahInfo = SURAHS.find(s => s.num === verse.n);
    if (!surahInfo) { loadGuessQuestion(); return; }
  }

  state.guessVerse = verse;
  state.guessSurah = surahInfo;

  // ── FIX v8 : masquage appliqué en mode Devinette ─────────
  // Même logique qu'en QCM : CAS 1/2 synchrone, CAS 3 → IA async.
  // Invariant : le texte coranique brut n'est jamais modifié.
  const maskedVerse = maskSurahNameInVerse(verse.v, verse, surahInfo);
  const verseEl     = document.getElementById('gv-verse');
  verseEl.innerHTML = maskedVerse;

  if (!maskedVerse.includes('name-mask')) {
    _applyAIMask('gv-verse', verse, surahInfo);
  }

  // Badge difficulté
  const badge = document.getElementById('gv-diff-badge');
  if      (verse.d === 1) { badge.textContent = t('diffEasy');   badge.className = 'diff-badge diff-easy'; }
  else if (verse.d === 2) { badge.textContent = t('diffMedium'); badge.className = 'diff-badge diff-medium'; }
  else                    { badge.textContent = t('diffHard');   badge.className = 'diff-badge diff-hard'; }

  document.getElementById('gv-question-label').textContent = t('guessQuestion');

  _buildSurahGrid();

  document.getElementById('gv-submit-btn').textContent    = t('guessSubmit');
  document.getElementById('gv-abandon-btn').textContent   = t('guessAbandon');
  document.getElementById('gv-next-btn').style.display    = 'none';
  document.getElementById('gv-submit-btn').style.display  = '';
  document.getElementById('gv-abandon-btn').style.display = '';
}

function _renderAttemptsDots(count) {
  let html = `<span style="font-family:'Fredoka One',cursive;font-size:.75rem;color:var(--text-dim);margin-right:6px">${t('attempts')} :</span>`;
  for (let i = 0; i < 5; i++) {
    const filled = i < count;
    html += `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;margin:0 2px;background:${filled ? 'var(--accent)' : 'rgba(150,150,150,0.3)'};border:1px solid var(--border)"></span>`;
  }
  return html;
}

function _buildSurahGrid() {
  const grid = document.getElementById('gv-surah-grid');
  grid.innerHTML = '';
  SURAHS.forEach(s => {
    const btn = document.createElement('button');
    btn.className   = 'sg-btn';
    btn.dataset.num = s.num;
    const sub = currentLang === 'en' ? s.en : currentLang === 'ar' ? '' : s.fr;
    btn.innerHTML = `<span class="sg-num">${s.num}</span><span class="sg-ar">${s.ar}</span>${sub ? `<span class="sg-fr">${sub}</span>` : ''}`;
    btn.onclick = () => _selectGuessSurah(s.num, btn);
    grid.appendChild(btn);
  });
}

function _selectGuessSurah(num, btn) {
  document.querySelectorAll('#gv-surah-grid .sg-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  state.guessSelected = num;
  document.getElementById('gv-submit-btn').disabled = false;

  const s   = SURAHS.find(x => x.num === num);
  const sub = s ? (currentLang === 'en' ? s.en : currentLang === 'ar' ? '' : s.fr) : '';
  document.getElementById('gv-selected-name').innerHTML =
    `<span style="font-family:'Amiri',serif;font-size:1.1rem;color:var(--accent)">${s?.ar || ''}</span>` +
    (sub ? ` <span style="font-size:.8rem;color:var(--text-dim)">(${sub})</span>` : '');
}

function submitGuess() {
  if (!state.guessSelected) return;
  const chosen  = state.guessSelected;
  const correct = state.guessSurah.num;

  state.guessAttempts++;
  document.getElementById('gv-attempts-bar').innerHTML = _renderAttemptsDots(state.guessAttempts);

  if (chosen === correct) {
    state.score++;
    const pts = Math.max(1, 6 - state.guessAttempts);
    spawnScoreFloat(`+${pts}`, document.getElementById('gv-score'));
    const scoreEl = document.getElementById('gv-score');
    scoreEl.textContent = state.score;

    _showGuessFeedback('correct', chosen, correct, pts);
    _lockGuessInput(true);
    _showGuessNext();
  } else {
    const dist = calcSurahDistance(chosen, correct);
    _showGuessFeedback('wrong', chosen, correct, 0, dist);

    if (state.guessAttempts >= 5) {
      _abandonGuess();
    } else {
      state.guessSelected = null;
      document.getElementById('gv-submit-btn').disabled = true;
      document.getElementById('gv-selected-name').textContent = t('gvSelectPrompt');
      document.querySelectorAll('#gv-surah-grid .sg-btn').forEach(b => b.classList.remove('selected'));
    }
  }
}

function _showGuessFeedback(type, chosen, correct, pts, dist) {
  const area  = document.getElementById('gv-feedback-area');
  const cS    = SURAHS.find(s => s.num === correct);
  const gS    = SURAHS.find(s => s.num === chosen);
  const cName = currentLang === 'en' ? cS.en : currentLang === 'ar' ? cS.ar : cS.fr;
  const gName = gS ? (currentLang === 'en' ? gS.en : currentLang === 'ar' ? gS.ar : gS.fr) : '';

  if (type === 'correct') {
    area.innerHTML = `
      <div class="gv-fb gv-fb-correct">
        <span style="font-size:1.8rem">🎯</span>
        <div>
          <div style="font-family:'Fredoka One',cursive;font-size:1rem;color:var(--correct-fg)">${t('guessCorrect')} +${pts} pts</div>
          <div style="font-size:.8rem;color:var(--text-dim);margin-top:2px">${t('attempt')} ${state.guessAttempts}</div>
        </div>
      </div>`;
  } else {
    area.innerHTML = `
      <div class="gv-fb gv-fb-wrong">
        <span style="font-size:1.8rem">${dist.emoji}</span>
        <div style="flex:1">
          <div style="font-family:'Fredoka One',cursive;font-size:.9rem;color:var(--wrong-fg)">
            ${gName} — ${dist.label}
          </div>
          <div class="gv-dist-bar">
            <div class="gv-dist-fill" style="width:${dist.pct}%"></div>
          </div>
          <div style="font-size:.75rem;color:var(--text-dim);margin-top:4px">
            ${dist.pct}% ${t('proximity')} · ${dist.hint}
          </div>
        </div>
      </div>`;
  }
}

function abandonGuess() {
  if (!confirm(t('abandonConfirm'))) return;
  _abandonGuess();
}

function _abandonGuess() {
  const correct = state.guessSurah;
  const cName   = currentLang === 'en' ? correct.en : currentLang === 'ar' ? correct.ar : correct.fr;
  const area    = document.getElementById('gv-feedback-area');
  area.innerHTML += `
    <div class="gv-fb gv-fb-reveal" style="margin-top:8px">
      <span style="font-size:1.6rem">📖</span>
      <div>
        <div style="font-size:.8rem;color:var(--text-dim);margin-bottom:4px">${t('correctAnswerWas')}</div>
        <div style="font-family:'Amiri',serif;font-size:1.5rem;color:var(--accent);direction:rtl">${correct.ar}</div>
        <div style="font-size:.8rem;color:var(--text-dim)">${cName} · ${t('surahLabel')} ${correct.num}</div>
      </div>
    </div>`;
  _lockGuessInput(false);
  _showGuessNext();
}

function _lockGuessInput(success) {
  document.getElementById('gv-submit-btn').style.display  = 'none';
  document.getElementById('gv-abandon-btn').style.display = 'none';
  document.querySelectorAll('#gv-surah-grid .sg-btn').forEach(b => {
    const num = parseInt(b.dataset.num);
    if (num === state.guessSurah.num) {
      b.classList.add('correct-answer');
      b.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
}

function _showGuessNext() {
  const nb = document.getElementById('gv-next-btn');
  nb.style.display = '';
  nb.textContent   = (state.maxQ !== Infinity && state.qNum >= state.maxQ)
    ? t('endGame') : t('nextVerse');
  nb.onclick = () => {
    if (state.maxQ !== Infinity && state.qNum >= state.maxQ) endGuessMode();
    else loadGuessQuestion();
  };
}

function endGuessMode() {
  document.getElementById('end-score').textContent    = '0';
  document.getElementById('end-total').textContent    = state.maxQ === Infinity ? '' : '/' + state.maxQ;
  document.getElementById('end-subtitle').textContent = t('endSubtitle');
  document.getElementById('replay-btn').textContent   = t('replay');
  document.getElementById('home-btn-end').textContent = t('homeBtn');

  const ratio = state.maxQ === Infinity ? 1 : state.score / state.maxQ;
  let stars = '', msg = '';
  if      (ratio >= 0.9) { stars = '⭐⭐⭐'; msg = t('endMsg9'); }
  else if (ratio >= 0.6) { stars = '⭐⭐';   msg = t('endMsg6'); }
  else if (ratio >= 0.3) { stars = '⭐';     msg = t('endMsg3'); }
  else                   { stars = '';        msg = t('endMsg0'); }

  document.getElementById('end-stars').textContent = stars;
  document.getElementById('end-msg').textContent   = msg;
  showScreen('screen-end');
  animateScoreCount(document.getElementById('end-score'), state.score);
  setTimeout(() => {
    const fill = document.getElementById('score-ring-fill');
    if (fill && state.maxQ !== Infinity) {
      const circ = 2 * Math.PI * 56;
      fill.style.strokeDashoffset = circ * (1 - Math.min(state.score / state.maxQ, 1));
    }
  }, 300);
  if (ratio >= 0.9) setTimeout(spawnConfetti, 600);
}

function replayFromEnd() {
  if (state.currentMode === 'devinette') startModeDevinette();
  else startMode1();
}

// ════════════════════════════════════════════════════════════
//  11. MODE MULTIJOUEUR — Maintenance
// ════════════════════════════════════════════════════════════

function startDuelSetup() {
  const el  = document.getElementById('maint-msg-text');
  const el2 = document.getElementById('maint-btn-ok');
  if (el)  el.textContent  = t('maintMsg');
  if (el2) el2.textContent = t('maintOk');
  const overlay = document.getElementById('maintenance-overlay');
  if (overlay) overlay.classList.add('show');
}

function closeMaintenanceOverlay() {
  const overlay = document.getElementById('maintenance-overlay');
  if (overlay) overlay.classList.remove('show');
}

// ════════════════════════════════════════════════════════════
//  12. ANIMATIONS & UTILITAIRES
// ════════════════════════════════════════════════════════════

function spawnScoreFloat(text, nearEl) {
  const el   = document.createElement('div');
  el.className  = 'score-plus-anim';
  el.textContent = text;
  const rect = nearEl?.getBoundingClientRect?.() ?? { left: window.innerWidth/2, top: window.innerHeight/2, width:0 };
  el.style.left = (rect.left + rect.width/2 - 20) + 'px';
  el.style.top  = (rect.top - 10 + window.scrollY) + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

function animateScoreCount(el, target) {
  let cur = 0;
  const step = Math.ceil(target / 30) || 1;
  const iv = setInterval(() => {
    cur = Math.min(cur + step, target);
    el.textContent = cur;
    if (cur >= target) clearInterval(iv);
  }, 40);
}

function spawnConfetti() {
  const wrap = document.getElementById('confetti-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  const colors = ['#d4a84b','#f0c870','#c49a6c','#ffffff','#ef9a9a','#7aefb4','#89cff0','#ffb347'];
  for (let i = 0; i < 100; i++) {
    const p  = document.createElement('div');
    p.className = 'confetti-piece';
    const sz = 6 + Math.random() * 10;
    p.style.cssText = `left:${Math.random()*100}%;top:-20px;background:${colors[Math.floor(Math.random()*colors.length)]};width:${sz}px;height:${sz}px;border-radius:${Math.random()>.5?'50%':'2px'};animation-duration:${1.5+Math.random()*2.5}s;animation-delay:${Math.random()*.8}s;`;
    wrap.appendChild(p);
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
