// Turns a line of text such as
//   "Tab. Paracetamol 500mg 1-0-1 x 5 days"
// into { name: "Paracetamol", dosage: "500mg", frequency: "1-0-1 x 5 days" }.
// Used for OCR text and for manual entry (when the user types more than the name).

const FORM_WORDS =
  '(?:tab(?:let)?s?|cap(?:sule)?s?|syp|syr(?:up)?|susp(?:ension)?|inj(?:ection)?|oint(?:ment)?|cream|gel|lotion|drops?|eye\\s*drops?|ear\\s*drops?|inhaler|sachet|powder)';
const FORM_PREFIX = new RegExp(`^${FORM_WORDS}\\b\\.?\\s*`, 'i');
const FORM_ANYWHERE = new RegExp(`\\b${FORM_WORDS}\\b\\.?`, 'i');

const DOSAGE_RE =
  /(\d+(?:[.,]\d+)?\s?(?:mg|mcg|µg|ug|gm|g|ml|iu|units?|%)(?:\s?\/\s?\d*(?:[.,]\d+)?\s?(?:ml|mg|g|l))?)/i;

const FREQUENCY_PATTERNS = [
  /\b\d\s*[-–]\s*\d\s*[-–]\s*\d(?:\s*[-–]\s*\d)?\b/,
  /\b(?:once|twice|thrice)\s+(?:a\s+|per\s+)?(?:daily|day)\b/i,
  /\bevery\s+\d+\s*(?:hours?|hrs?|h)\b/i,
  /\b(?:od|bd|bid|tds|tid|qid|qd|hs|sos|prn|stat)\b/i,
  /\b(?:daily|nightly|weekly|morning|night|evening)\b/i,
];
const DURATION_RE = /\b(?:x|for)\s*\d+\s*(?:days?|weeks?|months?)\b/i;

function cleanName(raw) {
  return raw
    .replace(/[|_*#]/g, ' ')
    .replace(/[()[\]]/g, ' ')
    .replace(/[,;:.]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMedicineLine(line) {
  if (!line) return null;
  let text = String(line).trim();
  // leading bullets / numbering: "1.", "2)", "-", "•"
  text = text.replace(/^\s*(?:\d{1,2}\s*[.)]|[-•*►>])\s*/, '');
  text = text.replace(/^rx\s*[:.\-]?\s*/i, '');

  const hasForm = FORM_ANYWHERE.test(text);
  text = text.replace(FORM_PREFIX, '');

  const dosageMatch = text.match(DOSAGE_RE);
  const dosage = dosageMatch ? dosageMatch[1].replace(/\s+/g, '').replace(',', '.') : null;

  let frequency = null;
  for (const re of FREQUENCY_PATTERNS) {
    const m = text.match(re);
    if (m) {
      frequency = m[0].replace(/\s+/g, ' ').trim();
      break;
    }
  }
  const dur = text.match(DURATION_RE);
  if (dur) frequency = frequency ? `${frequency} ${dur[0]}` : dur[0];

  // The name is everything before the first number / dash-separator / frequency word.
  const tokens = text.split(/\s+/);
  const nameTokens = [];
  for (const tok of tokens) {
    if (/^\d/.test(tok)) break;
    if (/^[-–—:]+$/.test(tok)) break;
    if (/^(?:od|bd|bid|tds|tid|qid|qd|hs|sos|prn|stat|once|twice|thrice|daily|x|for)$/i.test(tok)) break;
    nameTokens.push(tok);
  }
  const name = cleanName(nameTokens.join(' ')).replace(FORM_PREFIX, '').slice(0, 100);
  if (!name || name.replace(/[^a-z]/gi, '').length < 3) return null;

  return { name, dosage, frequency, hasForm, hasDosage: Boolean(dosage) };
}

module.exports = { parseMedicineLine };
