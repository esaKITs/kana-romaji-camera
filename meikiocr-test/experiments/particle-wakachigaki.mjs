// Experimental particle-aware wakachigaki. NOT connected to the camera.
// Accepts tokens produced by a morphological dictionary (e.g. kuromoji).
// Does not guess particle status from the spelling alone.
export const TARGET_PARTICLES = new Set(['で','の','に','を','が','は','へ']);
export function particleGroups(tokens) {
  if (!Array.isArray(tokens)) throw new TypeError('tokens must be an array');
  const groups = [];
  let current = [], pendingBoundary = false;
  for (const token of tokens) {
    const surface = token.surface_form ?? token.surface;
    if (typeof surface !== 'string' || !surface) throw new TypeError('invalid token');
    const particle = token.pos === '助詞' && TARGET_PARTICLES.has(surface);
    if (pendingBoundary && !particle) { if (current.length) groups.push(current); current=[]; pendingBoundary=false; }
    current.push({...token,surface_form:surface,particle});
    if (particle) pendingBoundary=true;
  }
  if (current.length) groups.push(current);
  return groups;
}
export function particleWakachigaki(tokens, romanize) {
  if (typeof romanize !== 'function') throw new TypeError('romanize callback required');
  return particleGroups(tokens).map(group => group.map(t => {
    // The grammatical reading of は/へ/を differs from the ordinary syllable.
    const pronunciation = t.particle && t.surface_form==='は' ? 'わ'
      : t.particle && t.surface_form==='へ' ? 'え'
      : t.particle && t.surface_form==='を' ? 'お'
      : t.reading && t.reading !== '*' ? t.reading : t.surface_form;
    return romanize(pronunciation);
  }).join('')).join(' ');
}
