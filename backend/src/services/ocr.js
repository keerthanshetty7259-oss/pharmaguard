// Prescription image -> text (Tesseract.js) -> candidate medicine lines.
const path = require('path');
const { parseMedicineLine } = require('./parse');

let workerPromise = null;

async function getWorker() {
  if (!workerPromise) {
    const { createWorker } = require('tesseract.js');
    workerPromise = createWorker('eng', 1, {
      cachePath: path.join(__dirname, '..', '..', '.tesseract-cache'),
    }).catch((err) => {
      workerPromise = null; // allow a retry on the next request
      throw err;
    });
  }
  return workerPromise;
}

async function imageToText(buffer) {
  const worker = await getWorker();
  const { data } = await worker.recognize(buffer);
  return data.text || '';
}

// Keep only lines that look like a medicine line: a form word (Tab/Cap/Syp...) or a dose (500 mg).
function extractCandidates(text) {
  const seen = new Set();
  const out = [];
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length < 3) continue;
    const parsed = parseMedicineLine(line);
    if (!parsed || !(parsed.hasForm || parsed.hasDosage)) continue;
    const key = parsed.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: parsed.name, dosage: parsed.dosage, frequency: parsed.frequency, line });
  }
  return out;
}

module.exports = { imageToText, extractCandidates };
