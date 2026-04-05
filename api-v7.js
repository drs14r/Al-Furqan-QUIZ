/**
 * api-v7.js — QuranAPI v7
 *
 * Basé sur la logique de main.js (alquran.cloud)
 * - Couvre les 114 sourates / 6236 versets
 * - Buffer pré-chargé avant le début du jeu
 * - Méthode identique à main.js : fetch surah → pick ayah aléatoire + traduction
 */

const QuranAPI = (() => {

  const BASE_URL    = 'https://api.alquran.cloud/v1/surah/';
  const TRANSLATION = 'fr.hamidullah'; // traduction française (remplacer par 'en.sahih' pour anglais)
  const TOTAL_SURAHS = 114;

  // Taille du buffer pré-chargé
  const BUFFER_SIZE = 8;

  // Buffer de versets prêts à l'emploi
  let _buffer = [];
  let _warming = false;
  let _onReady = null; // callback appelé quand le buffer est prêt

  /**
   * Tire un numéro de sourate aléatoire (1–114)
   */
  function _randomSurah() {
    return Math.floor(Math.random() * TOTAL_SURAHS) + 1;
  }

  /**
   * Récupère un verset aléatoire d'une sourate via l'API alquran.cloud.
   * Identique à la logique de main.js :
   *   1. Fetch la sourate arabe
   *   2. Détermine totalAyahs
   *   3. Tire ayahNumber aléatoire
   *   4. Fetch la traduction
   *   5. Retourne { n, a, v, t } — n=surah, a=ayah, v=texte arabe, t=traduction
   */
  async function _fetchRandomVerse() {
    const surahNum  = _randomSurah();
    const arabicURL = BASE_URL + surahNum;

    // ── Étape 1 : verset arabe ────────────────────────────────
    const arRes  = await fetch(arabicURL);
    if (!arRes.ok) throw new Error(`API error ${arRes.status} for surah ${surahNum}`);
    const arJSON = await arRes.json();

    const totalAyahs = arJSON.data.numberOfAyahs;
    const ayahIndex  = Math.floor(Math.random() * totalAyahs); // 0-based comme main.js
    const ayahNum    = ayahIndex + 1; // 1-based pour affichage

    const arabicText = arJSON.data.ayahs[ayahIndex].text;

    // ── Étape 2 : traduction ──────────────────────────────────
    const transURL  = arabicURL + '/' + TRANSLATION;
    const trRes     = await fetch(transURL);
    let   transText = '';

    if (trRes.ok) {
      const trJSON = await trRes.json();
      transText = trJSON.data.ayahs[ayahIndex]?.text || '';
    }

    return {
      n: surahNum,   // numéro sourate (1–114)
      a: ayahNum,    // numéro verset (1-based)
      v: arabicText, // texte arabe
      t: transText,  // traduction
      d: _guessDifficulty(surahNum, totalAyahs), // difficulté estimée
    };
  }

  /**
   * Estime la difficulté d'un verset selon sa sourate.
   * Logique simple basée sur la longueur de la sourate et son emplacement.
   */
  function _guessDifficulty(surahNum, totalAyahs) {
    // Juz 30 (sourates courtes, bien connues) → facile
    if (surahNum >= 78) return 1;
    // Sourates très longues → difficile
    if (totalAyahs > 100) return 3;
    // Milieu du Coran → moyen
    return 2;
  }

  /**
   * Remplit le buffer de façon asynchrone.
   * Lance BUFFER_SIZE fetch en parallèle pour plus de rapidité.
   */
  async function _fillBuffer() {
    if (_warming) return;
    _warming = true;

    const promises = [];
    for (let i = 0; i < BUFFER_SIZE; i++) {
      promises.push(
        _fetchRandomVerse().catch(err => {
          console.warn('[QuranAPI] fetch échoué, ignoré:', err.message);
          return null;
        })
      );
    }

    const results = await Promise.all(promises);
    results.forEach(v => { if (v) _buffer.push(v); });

    _warming = false;

    // Notifier que le buffer est prêt
    if (_onReady && _buffer.length > 0) {
      const cb = _onReady;
      _onReady = null;
      cb(_buffer.length);
    }
  }

  /**
   * warmup() — À appeler au chargement de la page.
   * Pré-charge le buffer pour que les premières questions soient instantanées.
   * @param {Function} [onReady] — callback(nbVersets) quand prêt
   */
  function warmup(onReady) {
    _onReady = onReady || null;
    _fillBuffer();
  }

  /**
   * getBufferedVerse() — Retourne un verset du buffer (ou null si vide).
   * Déclenche un rechargement en arrière-plan si le buffer est bas.
   */
  function getBufferedVerse() {
    if (_buffer.length === 0) return null;

    const verse = _buffer.shift();

    // Recharge en arrière-plan si buffer < moitié
    if (_buffer.length < BUFFER_SIZE / 2 && !_warming) {
      _fillBuffer();
    }

    return verse;
  }

  /**
   * fetchOne() — Fetch un verset unique immédiatement (sans buffer).
   * Utile si on veut un verset en mode asynchrone avec await.
   */
  async function fetchOne() {
    return await _fetchRandomVerse();
  }

  /**
   * bufferSize() — Retourne le nombre de versets disponibles dans le buffer.
   */
  function bufferSize() {
    return _buffer.length;
  }

  return { warmup, getBufferedVerse, fetchOne, bufferSize };

})();
