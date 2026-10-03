// Shared, pure policy. Labels never determine whether a deal may progress.
(function (root) {
  const codes = {
    buyer: ['v2.01'], stock: ['v2.02', '5.1'], ncnda: ['v2.16', '1.4', 't2.1'],
    imfpa: ['v2.17', '2.1'], intent: ['v2.03', 'v2.04', '4.1'],
    pof: ['v2.09', '3.7'], assay: ['v2.10', '5.2'], offer: ['v2.11', '4.2'],
    spa: ['v2.12', '6.7'], security: ['v2.18', '7.1', '7.2'],
    delivery: ['v2.13', '8.1', '8.2', 't6.1'], sellerPaid: ['v2.14', '11.5'], commissionPaid: ['v2.15', '12.2']
  };
  const criticalDocs = ['ncnda', 'imfpa', 'poo', 'pof', 'assay', 'spa', 'security', 'pod', 'tickets'];
  const signed = ['ncnda', 'imfpa', 'spa'];
  const bankMethods = ['Phoned the bank on a number we found ourselves', 'Our bank confirmed it with theirs', 'An attorney or escrow confirmed it'];
  const verification = {
    buyer: { l: 'Buyer', items: [['cipc', 'Company found on CIPC', 1], ['dirid', "A director’s ID seen", 1], ['who', 'Signatory is a director or has a signed mandate', 1], ['contact', 'Phone and email independently confirmed', 1], ['nodnd', 'Not on our Do not deal list', 1], ['refs', 'References or past trades checked', 0], ['before', 'We have dealt with them before', 0]] },
    seller: { l: 'Stockpile', items: [['cipc', 'Seller’s company found on CIPC', 1], ['right', 'Mining right or permit seen', 1], ['owner', 'Proof of ownership or mandate seen', 1], ['photos', 'Dated site photos or site visit', 1], ['loc', 'Location confirmed', 1], ['assay', 'Seller’s own assay seen', 0], ['access', 'Access agreed for sampling', 0]] },
    funds: { l: 'Funds', items: [['pof', 'Proof of funds accepted in Docs', 1], ['how', 'Independently verified with bank, attorney or escrow', 1]] }
  };
  const key = s => Object.keys(codes).find(k => codes[k].includes(s.code)) || (s.code && /^10\./.test(s.code) ? 'loading' : null);
  function trust(d) {
    const t = JSON.parse(JSON.stringify((d.params || {})._trust || {}));
    t.buyer ||= {}; t.seller ||= {}; t.funds ||= {};
    // Version marker makes an explicit untick permanent. Old ticks remain in the source data.
    if (t.version !== 2) {
      if (t.seller.seen) { t.seller.photos ||= t.seller.seen; t.seller.loc ||= t.seller.seen; }
      if (t.buyer.bank && !t.funds.how) t.funds.how = { ...t.buyer.bank, v: bankMethods[0] };
      t.version = 2;
    }
    return t;
  }
  const flags = d => Object.entries(trust(d).flags || {}).filter(([, v]) => !!v).map(([k]) => k);
  function documentOK(d, doc, state, allowOverride = true) {
    const r = state.docs.find(r => r.deal_id === d.id && r.doc === doc);
    if (!r || (r.expires_on && r.expires_on < new Date(Date.now() + 7200000).toISOString().slice(0, 10))) return false;
    if (allowOverride && criticalDocs.includes(doc) && String(r.override_reason || '').trim()) return ['received', 'signed', 'na'].includes(r.status);
    if (!(signed.includes(doc) ? r.status === 'signed' : ['received', 'signed'].includes(r.status))) return false;
    return !criticalDocs.includes(doc) || state.atts.some(a => String(a.id) === String(r.att_id) && a.target_type === 'deal' && String(a.target_id) === String(d.id) && !!a.path);
  }
  function verified(d, side, state) {
    const t = trust(d)[side] || {}, def = verification[side];
    const valid = k => side === 'funds' ? (k === 'pof' ? documentOK(d, 'pof', state) : bankMethods.includes((t.how || {}).v)) : !!t[k];
    const done = def.items.filter(([k]) => valid(k)).length;
    return { done, all: def.items.length, ok: def.items.filter(x => x[2]).every(([k]) => valid(k)) };
  }
  function secured(d, state) {
    const p = (d.params || {})._payment_security || {};
    return ['escrow', 'tt', 'lc', 'equivalent'].includes(p.type) && p.confirmed === true && !!String(p.reference || '').trim() &&
      (p.type !== 'equivalent' || !!String(p.terms || '').trim()) && verified(d, 'funds', state).ok && documentOK(d, 'security', state, false);
  }
  const stepDone = (d, k, state) => state.steps.some(s => s.deal_id === d.id && codes[k].includes(s.code) && s.status === 'done');
  function loadingMissing(d, state) {
    if (d.kind !== 'mineral') return [];
    const out = flags(d).length ? ['Review Required: clear every red flag with a reason'] : [];
    for (const side of ['buyer', 'seller', 'funds']) if (!verified(d, side, state).ok) out.push(verification[side].l + ' verification');
    for (const doc of ['ncnda', 'imfpa', 'poo', 'pof', 'assay', 'spa']) if (!documentOK(d, doc, state)) out.push(doc + ': accepted evidence required');
    if (!secured(d, state)) out.push('Payment Secured: confirmed contract-specific security and attached evidence');
    return out;
  }
  function stepMissing(d, s, state) {
    const k = key(s), out = [];
    if (d.kind === 'mineral' && s.code && flags(d).length) out.push('Review Required: clear every red flag with a reason');
    if (d.kind === 'mineral' && ['delivery', 'loading'].includes(k)) out.push(...loadingMissing(d, state));
    if (k === 'security' && !secured(d, state)) out.push('Payment Secured: confirm security and attach bank/escrow evidence');
    if (k === 'buyer' && !verified(d, 'buyer', state).ok) out.push('Buyer verification');
    if (k === 'stock') { if (!verified(d, 'seller', state).ok) out.push('Stockpile verification'); if (!documentOK(d, 'poo', state)) out.push('poo: accepted evidence required'); }
    if (k === 'pof' && !verified(d, 'funds', state).ok) out.push('Funds verification');
    if (['ncnda', 'imfpa', 'pof', 'assay', 'spa'].includes(k) && !documentOK(d, k, state)) out.push(k + ': accepted evidence required');
    if (k === 'spa' && d.kind === 'mineral') {
      for (const side of ['buyer', 'seller', 'funds']) if (!verified(d, side, state).ok) out.push(verification[side].l + ' verification');
      for (const doc of ['ncnda', 'imfpa', 'poo', 'assay']) if (!documentOK(d, doc, state)) out.push(doc + ': accepted evidence required');
    }
    if (k === 'delivery') for (const doc of ['pod', 'tickets']) if (!documentOK(d, doc, state)) out.push(doc + ': accepted evidence required');
    return [...new Set(out)];
  }
  function wonMissing(d, state) {
    if (d.kind !== 'mineral') return [];
    const out = loadingMissing(d, state);
    for (const k of ['sellerPaid', 'commissionPaid']) if (!stepDone(d, k, state)) out.push(k === 'sellerPaid' ? 'Seller paid' : 'Commission paid');
    for (const doc of ['pod', 'tickets']) if (!documentOK(d, doc, state)) out.push(doc + ': accepted evidence required');
    return [...new Set(out)];
  }
  const api = { codes, criticalDocs, verification, bankMethods, key, trust, flags, documentOK, verified, secured, loadingMissing, stepMissing, wonMissing };
  root.DealControls = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
