// RxNorm standardisation: medicine name -> RxCUI, standard name and active ingredient(s).
// RxNorm REST docs: https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html
const config = require('../config');
const aliases = require('../../data/aliases.json');
const { httpError } = require('../utils');

const cache = new Map(); // lower-case input -> result (or null when not found)

async function rx(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${config.rxnormBaseUrl}${path}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`RxNorm responded with HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    throw httpError(502, `Could not reach the RxNorm service (${err.name === 'AbortError' ? 'timeout' : err.message}). Check your internet connection and try again.`);
  } finally {
    clearTimeout(timer);
  }
}

async function exactRxcui(term) {
  const data = await rx(`/rxcui.json?name=${encodeURIComponent(term)}`);
  const ids = data?.idGroup?.rxnormId;
  return Array.isArray(ids) && ids.length ? String(ids[0]) : null;
}

async function approximateRxcui(term) {
  const data = await rx(`/approximateTerm.json?term=${encodeURIComponent(term)}&maxEntries=3&option=1`);
  const candidates = data?.approximateGroup?.candidate;
  if (!Array.isArray(candidates) || !candidates.length) return null;
  const best = [...candidates].sort((a, b) => Number(a.rank) - Number(b.rank))[0];
  return best?.rxcui ? String(best.rxcui) : null;
}

async function details(rxcui) {
  const [props, related] = await Promise.all([
    rx(`/rxcui/${rxcui}/properties.json`),
    rx(`/rxcui/${rxcui}/related.json?tty=IN`),
  ]);
  const name = props?.properties?.name;
  const tty = props?.properties?.tty;
  if (!name) return null;

  const ingredients = [];
  const seen = new Set();
  for (const group of related?.relatedGroup?.conceptGroup || []) {
    for (const c of group.conceptProperties || []) {
      if (c.tty === 'IN' && !seen.has(c.rxcui)) {
        seen.add(c.rxcui);
        ingredients.push({ rxcui: String(c.rxcui), name: c.name });
      }
    }
  }
  if (!ingredients.length) ingredients.push({ rxcui: String(rxcui), name }); // fall back to the concept itself
  return { rxcui: String(rxcui), name, tty, ingredients };
}

// Returns { rxcui, name, tty, ingredients[], matchType: 'exact'|'alias'|'approximate', input } or null.
async function standardize(inputName) {
  const input = String(inputName || '').trim().replace(/\s+/g, ' ');
  if (!input) return null;
  const key = input.toLowerCase();
  if (cache.has(key)) return cache.get(key);

  let result = null;
  const aliasTarget = aliases[key];
  const attempts = [];
  if (aliasTarget) attempts.push({ term: aliasTarget, type: 'alias' });
  attempts.push({ term: input, type: 'exact' });

  for (const { term, type } of attempts) {
    const id = await exactRxcui(term);
    if (id) {
      const d = await details(id);
      if (d) {
        result = { ...d, matchType: type, input };
        break;
      }
    }
  }
  if (!result) {
    const id = await approximateRxcui(aliasTarget || input);
    if (id) {
      const d = await details(id);
      if (d) result = { ...d, matchType: 'approximate', input };
    }
  }

  cache.set(key, result);
  return result;
}

module.exports = { standardize };
