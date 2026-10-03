const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../prototype/controls.js');
function fixture() {
 const d={id:'d',kind:'mineral',params:{_trust:{version:2,buyer:{},seller:{},funds:{how:{v:C.bankMethods[0]}}},_payment_security:{type:'escrow',confirmed:true,reference:'SPA lot 1'}}};
 for(const side of ['buyer','seller']) for(const [k,,must] of C.verification[side].items) if(must)d.params._trust[side][k]={by:'Chris'};
 const state={steps:[{id:'paid',deal_id:'d',code:'v2.14',status:'done'},{id:'commission',deal_id:'d',code:'v2.15',status:'done'}],docs:[],atts:[]};
 for(const doc of C.criticalDocs){state.docs.push({deal_id:'d',doc,status:['ncnda','imfpa','spa'].includes(doc)?'signed':'received',att_id:doc});state.atts.push({id:doc,target_type:'deal',target_id:'d',path:doc+'.pdf'});}
 return {d,state};
}
test('safe deal may load and close',()=>{const{d,state}=fixture();assert.deepEqual(C.loadingMissing(d,state),[]);assert.deepEqual(C.wonMissing(d,state),[]);});
for(const type of ['escrow','tt','lc','equivalent'])test('security '+type,()=>{const{d,state}=fixture();d.params._payment_security.type=type;d.params._payment_security.terms='SPA clause 7: covers lot 1';assert.equal(C.secured(d,state),true);d.params._payment_security.confirmed=false;assert.equal(C.secured(d,state),false);});
for(const type of ['', 'draft LC','MT799','SBLC','grade-test cash'])test('reject '+type,()=>{const{d,state}=fixture();d.params._payment_security.type=type;assert.equal(C.secured(d,state),false);});
test('equivalent requires contract-specific terms',()=>{const{d,state}=fixture();d.params._payment_security.type='equivalent';assert.equal(C.secured(d,state),false);});
for(const doc of C.criticalDocs)test(doc+' needs a valid attached file; deliberate evidence override is explicit',()=>{const{d,state}=fixture();state.atts=state.atts.filter(a=>a.id!==doc);assert.equal(C.documentOK(d,doc,state),false);state.docs.find(r=>r.doc===doc).override_reason='Attorney holds original pending upload';assert.equal(C.documentOK(d,doc,state),true);if(doc==='security')assert.equal(C.secured(d,state),false);});
test('foreign and deleted evidence is rejected; draft SPA is not signed',()=>{const{d,state}=fixture();state.atts[0].target_id='other';assert.equal(C.documentOK(d,'ncnda',state),false);state.docs.find(r=>r.doc==='spa').status='draft';assert.equal(C.documentOK(d,'spa',state),false);});
test('legacy bank/site ticks preserved without inventing new identity checks',()=>{const d={params:{_trust:{buyer:{bank:{by:'Chris'}},seller:{seen:{by:'Chris'}}}}};const t=C.trust(d);assert.ok(t.seller.photos);assert.ok(t.seller.loc);assert.equal(t.funds.how.v,C.bankMethods[0]);assert.equal(t.buyer.dirid,undefined);delete t.seller.loc;d.params._trust=t;assert.equal(C.trust(d).seller.loc,undefined);assert.ok(d.params._trust.seller.seen);});
test('only seeing a letter never verifies funds',()=>{const{d,state}=fixture();d.params._trust.funds.how={v:'Only saw the letter – not confirmed'};assert.equal(C.verified(d,'funds',state).ok,false);});
for(const code of ['v2.13','8.1','8.2','10.1','10.2','10.3','10.4','10.5'])test(code+' loading cannot use test payment or skipped security',()=>{const{d,state}=fixture();delete d.params._payment_security;state.steps.push({code:'v2.05',deal_id:'d',status:'done'},{code:'v2.18',deal_id:'d',status:'na'});assert.ok(C.stepMissing(d,{code,title:'Custom words'},state).some(s=>s.includes('Payment Secured')));});
test('labels cannot bypass SPA gate',()=>{const{d,state}=fixture();state.docs=state.docs.filter(r=>r.doc!=='assay');assert.ok(C.stepMissing(d,{code:'6.7',title:'Any custom words'},state).length);});
test('red flags block critical progression and closure',()=>{const{d,state}=fixture();d.params._trust.flags={docs:{by:'Chris'}};for(const code of ['v2.12','v2.18','v2.13','v2.14','v2.15'])assert.ok(C.stepMissing(d,{code},state).some(x=>x.includes('Review Required')));assert.ok(C.wonMissing(d,state).length);});
for(const code of ['v2.14','v2.15'])test(code+' paid must be done, not skipped',()=>{const{d,state}=fixture();state.steps.find(s=>s.code===code).status='na';assert.ok(C.wonMissing(d,state).length);});
test('missing prerequisite rows fail closed',()=>{const{d,state}=fixture();state.steps=[];assert.ok(C.wonMissing(d,state).includes('Seller paid'));state.docs=[];assert.ok(C.loadingMissing(d,state).length);});
test('transport does not inherit mineral payment stop',()=>{const{d,state}=fixture();d.kind='transport';delete d.params._payment_security;assert.deepEqual(C.loadingMissing(d,state),[]);});
