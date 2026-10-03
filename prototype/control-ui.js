// The same policy is used by every presentation and mutation path.
window.controlState = () => ({ steps: window._steps || [], docs: window._docs || [], atts: window._atts || [] });
window.controlStatus = d => d.kind === 'mineral' && DealControls.flags(d).length ? 'Review Required' : d.status;
function controlHistory(d, field, reason) {
  (window._hist ||= []).unshift({ id: 'control' + Date.now(), deal_id: d.id, field, new_value: reason, changed_by: me, changed_at: new Date().toISOString() });
}
window.controlDocOverride = async function (d, key, status, reason) {
  if (!String(reason || '').trim()) return false;
  if (!DEMO) {
    const { error } = await sb.rpc('control_document_override', { p_deal: d.id, p_doc: key, p_status: status, p_reason: reason });
    if (error) { toast('Could not record override: ' + error.message, 6000); return false; }
  }
  let r = docRow(d.id, key);
  if (!r) { r = { id: 'override' + Date.now(), deal_id: d.id, doc: key }; (window._docs ||= []).push(r); }
  Object.assign(r, { status, override_reason: reason, updated_at: new Date().toISOString() });
  controlHistory(d, 'control:document:' + key, reason); return true;
};
window.controlStepOverride = async function (d, s, reason) {
  if (d.kind === 'mineral' && (DealControls.flags(d).length || ['security', 'delivery', 'loading'].includes(DealControls.key(s)))) {
    toast('Clear red flags and satisfy payment/loading controls. These steps cannot be skipped.', 6000); return false;
  }
  reason = String(reason || prompt('Deliberate step override: record why this control is not needed.') || '').trim();
  if (!reason) { toast('An override needs a reason.'); return false; }
  if (!DEMO) {
    const { error } = await sb.rpc('control_step_override', { p_id: s.id, p_reason: reason });
    if (error) { toast('Could not record override: ' + error.message, 6000); return false; }
  }
  Object.assign(s, { status: 'na', override_reason: reason, evidence: 'Override: ' + reason, done_by: me, done_at: new Date().toISOString() });
  controlHistory(d, 'control:step:' + s.code, reason); return true;
};
window.controlWon = async function (d) {
  const miss = DealControls.wonMissing(d, controlState());
  const reason = miss.length ? String(prompt('Cannot mark Won: ' + miss.join(', ') + '.\nDeliberate close override: enter the reason, or Cancel.') || '').trim() : '';
  if (miss.length && !reason) return false;
  if (!DEMO) {
    const { error } = await sb.rpc('control_close_deal', { p_deal: d.id, p_reason: reason || null });
    if (error) { toast('Could not close deal: ' + error.message, 6000); return false; }
  }
  d.status = 'Won'; controlHistory(d, reason ? 'control:won_override' : 'status', reason || 'Won'); return true;
};
function securityHtml(d) {
  const p = (d.params || {})._payment_security || {};
  return `<div class="trow"><div class="k"><b>Payment Secured</b><span>${DealControls.secured(d, controlState()) ? 'confirmed' : 'hard stop before loading'}</span></div>
    <label class="fld"><span>Contract security</span><select data-security="type" data-security-deal="${d.id}">${[['','Choose security'],['escrow','Escrow funded'],['tt','TT received'],['lc','Operational LC'],['equivalent','Contract-specific equivalent']].map(([v,l]) => `<option value="${v}"${p.type === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="fld"><span>Contract / lot reference</span><input data-security="reference" data-security-deal="${d.id}" value="${esc(p.reference || '')}" maxlength="500"></label>
    <label class="fld"><span>Security terms / validity / lot covered</span><input data-security="terms" data-security-deal="${d.id}" value="${esc(p.terms || '')}" maxlength="1000"></label>
    <button type="button" class="tck${p.confirmed ? ' on' : ''}" data-secconfirm="${d.id}" aria-pressed="${!!p.confirmed}"><i>${p.confirmed ? '✓' : ''}</i><span>Confirmed funded / received / operational with the bank or escrow</span></button>
    <div class="tnote">Attach payment-security evidence in Docs. Paying for a grade test does not secure the loading lot.</div></div>`;
}
window.trustHtml = function (d) {
  if (d.kind !== 'mineral') return '';
  const t = DealControls.trust(d);
  return (DealControls.flags(d).length ? `<div class="tnote gate">Review Required — clear each red flag with a reason before critical progression.</div>` : '') +
    Object.entries(DealControls.verification).map(([side, def]) => {
      const v = DealControls.verified(d, side, controlState());
      return `<div class="trow trust"><div class="k"><b>${def.l}</b><span>${v.ok ? 'verified' : `${v.done} of ${v.all}`}</span></div><div class="tlist">` + def.items.map(([k, l, must]) => {
        if (k === 'how') return FUND_HOW.map((method, n) => `<button type="button" class="tck${(t.funds.how || {}).v === method ? ' on' : ''}" data-gfund="${d.id}:${n}"><i>${(t.funds.how || {}).v === method ? '✓' : ''}</i><span>${esc(method)}</span></button>`).join('');
        const on = side === 'funds' ? DealControls.documentOK(d, 'pof', controlState()) : !!t[side][k];
        return `<button type="button" class="tck${on ? ' on' : ''}" data-trust="${d.id}:${side}:${k}" aria-pressed="${on}"><i>${on ? '✓' : ''}</i><span>${esc(l)}${must ? '' : ' <small>(if you can)</small>'}</span></button>`;
      }).join('') + '</div></div>';
    }).join('') + `<div class="trow trust flags"><div class="k"><b>Red flags</b><span>${DealControls.flags(d).length || 'none'}</span></div><div class="tlist">${FLAGS.map(([k,l]) => `<button type="button" class="tck flag${(t.flags || {})[k] ? ' on' : ''}" data-trust="${d.id}:flags:${k}" aria-pressed="${!!(t.flags || {})[k]}"><i>${(t.flags || {})[k] ? '!' : ''}</i><span>${esc(l)}</span></button>`).join('')}</div></div>` + securityHtml(d);
};
document.addEventListener('change', async e => {
  const i = e.target.closest('[data-security]'); if (!i) return;
  const d = dealById(i.dataset.securityDeal); if (!d) return;
  const p = { ...leanP(d), _payment_security: { ...(leanP(d)._payment_security || {}), [i.dataset.security]: i.value, confirmed: false } };
  await leanSaveParams(d, p, 'Security changed; confirm it again.');
});
document.addEventListener('click', async e => {
  const b = e.target.closest('button[data-trust],button[data-gtick],button[data-gfund],button[data-secconfirm]'); if (!b) return;
  if (b.dataset.secconfirm) {
    const d = dealById(b.dataset.secconfirm), p = { ...leanP(d) };
    p._payment_security = { ...(p._payment_security || {}), confirmed: !(p._payment_security || {}).confirmed, by: me, on: new Date().toISOString() };
    await leanSaveParams(d, p, 'Security confirmation recorded.'); return;
  }
  const [id, side, k] = (b.dataset.trust || b.dataset.gtick || b.dataset.gfund).split(':'), d = dealById(id); if (!d) return;
  const t = DealControls.trust(d), stamp = { by: me, on: saDayPlus(0) };
  if (b.dataset.gfund) {
    const method = FUND_HOW[+side]; if (!method) return;
    if ((t.funds.how || {}).v === method) delete t.funds.how; else t.funds.how = { ...stamp, v: method };
  } else if (side === 'funds' && k === 'pof') { toast('Attach and accept proof of funds in Docs.'); return; }
  else {
    t[side] ||= {};
    if (t[side][k]) {
      if (side === 'flags') {
        const reason = String(prompt('Reason this red flag is explicitly cleared:') || '').trim(); if (!reason) return;
        t.clearances ||= {}; t.clearances[k] = { ...stamp, on: new Date().toISOString(), reason }; controlHistory(d, 'control:flag_clear:' + k, reason);
      }
      delete t[side][k];
    } else t[side][k] = stamp;
  }
  if (!(await leanSaveParams(d, { ...leanP(d), _trust: t }, 'Verification saved.'))) return;
  for (const s of stepsOf(d.id)) if (s.status === 'open' && ['buyer', 'stock', 'pof'].includes(DealControls.key(s)) && !stepGateMissing(d, s.id).length) {
    if (DEMO) { Object.assign(s, { status: 'done', evidence: 'Unified verification', done_by: me, done_at: new Date().toISOString() }); controlHistory(d, 'step', s.title + ' — done'); }
    else { const { error } = await sb.rpc('set_step', { p_id: s.id, p_status: 'done', p_evidence: 'Unified verification' }); if (error) toast(error.message, 6000); }
  }
  render();
});

// Invisible hit boxes retain the locked visual rectangles. When expanded boxes overlap,
// dispatch to the closest visual control rather than whichever was painted last.
const hitStyle = document.createElement('style');
hitStyle.textContent = '@media (max-width: 600px) { button, a[href], summary { position: relative; } db-hit { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); width: max(100%,44px); height: max(100%,44px); pointer-events: auto; background: transparent; } }';
document.head.append(hitStyle);
function controlHitAreas() {
  document.querySelectorAll('button,a[href],summary').forEach(b => { if (!b.querySelector(':scope > db-hit')) { const hit = document.createElement('db-hit'); hit.setAttribute('aria-hidden', 'true'); b.append(hit); } });
}
new MutationObserver(controlHitAreas).observe(document.body, { childList: true, subtree: true });
controlHitAreas();
document.addEventListener('click', e => {
  if (!e.isTrusted || innerWidth > 600 || !e.target.closest('db-hit')) return;
  const dialog = e.target.closest('dialog');
  const candidates = [...document.querySelectorAll('button:not(:disabled),a[href],summary')].filter(b => b.getBoundingClientRect().width && b.closest('dialog') === dialog);
  const ranked = candidates.map(b => { const r = b.getBoundingClientRect(), x = r.left + r.width/2, y = r.top + r.height/2;
    return { b, dist: Math.hypot(e.clientX-x, e.clientY-y), inside: Math.abs(e.clientX-x) <= Math.max(r.width,44)/2 && Math.abs(e.clientY-y) <= Math.max(r.height,44)/2 }; }).filter(x => x.inside).sort((a,b) => a.dist-b.dist);
  if (ranked.length) { e.preventDefault(); e.stopImmediatePropagation(); ranked[0].b.click(); }
}, true);

// Native selects and inputs keep their visual height; the adjoining 44px region activates them.
document.addEventListener('click', e => {
  if (!e.isTrusted || innerWidth > 600 || e.target.closest('button,input,select,textarea,a,summary,db-hit')) return;
  const dialog = e.target.closest('dialog');
  const candidates = [...document.querySelectorAll('input:not(:disabled),select:not(:disabled)')].filter(el => el.closest('dialog') === dialog).map(el => {
    const r=el.getBoundingClientRect(); return {el,r,dist:Math.hypot(e.clientX-r.left-r.width/2,e.clientY-r.top-r.height/2)};
  }).filter(({el,r}) => r.width && Math.abs(e.clientX-r.left-r.width/2)<=Math.max(44,r.width)/2 && Math.abs(e.clientY-r.top-r.height/2)<=Math.max(44,r.height)/2 && (!el.closest('dialog') || el.closest('dialog').open)).sort((a,b)=>a.dist-b.dist);
  if (candidates.length) { const el=candidates[0].el; e.preventDefault(); el.focus(); if (el.tagName==='INPUT' && ['checkbox','radio'].includes(el.type)) el.click(); if (el.tagName==='SELECT' && el.showPicker) { try {el.showPicker();} catch (_) {} } }
}, true);
