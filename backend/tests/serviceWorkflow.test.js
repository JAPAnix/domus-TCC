import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createReviewSchema } from '../src/validators/reviewValidator.js';
const uuid = '11111111-1111-4111-8111-111111111111';
const proposalUuid = '22222222-2222-4222-8222-222222222222';
const bytes = value => Buffer.from(value.replaceAll('-', ''),'hex');
let state;
const client = { id:1n, uuid:bytes(uuid),firstName:'Cliente',lastName:'Teste' };
const professional = { id:2n,uuid:bytes(proposalUuid),firstName:'Profissional',lastName:'Teste' };
function reset() { state={status:'open',proposals:[],notifications:[],reviews:[],failNotification:false}; }
const tx={
  $queryRaw:async()=>[],
  user:{findFirst:async()=>({id:1n})},
  service:{
    findFirst:async()=>({id:10n,uuid:bytes(uuid),clientId:1n,client,title:'Pintura',status:state.status,proposals:state.proposals.filter(p=>p.status==='accepted').map(p=>({...p,professional:{user:professional}}))}),
    update:async({data})=>{state.status=data.status;return data;}
  },
  proposal:{
    create:async({data})=>{const p={...data,id:20n};state.proposals.push(p);return p;},
    findFirst:async()=>state.proposals[0]?{...state.proposals[0],service:{uuid:bytes(uuid)}}:null,
    findUnique:async()=>state.proposals[0],
    update:async({data})=>Object.assign(state.proposals[0],data),
    updateMany:async()=>({count:0})
  },
  notification:{create:async({data})=>{if(state.failNotification)throw Error('notification failed');state.notifications.push(data);return data;}},
  review:{
    findFirst:async({where})=>state.reviews.find(r=>r.reviewerId===where.reviewerId),
    create:async({data})=>{if(state.reviews.some(r=>r.reviewerId===data.reviewerId))throw Object.assign(Error('duplicate'),{code:'P2002'});state.reviews.push(data);return data;},
    aggregate:async()=>({_avg:{rating:5},_count:{rating:1}})
  },
  professionalProfile:{update:async()=>({})}
};
globalThis.workflowTestPrisma={$transaction:async(fn,options)=>{
  assert.equal(options.isolationLevel,'ReadCommitted');
  const snapshot=structuredClone(state);
  try{return await fn(tx);}catch(e){state=snapshot;throw e;}
}};
let source=fs.readFileSync(new URL('../src/services/serviceWorkflow.js',import.meta.url),'utf8');
source=source.replace("import { prisma } from '../config/prisma.js';","const prisma=globalThis.workflowTestPrisma;");
source=source.replace("'../utils/uuid.js'",JSON.stringify(pathToFileURL(resolve('src/utils/uuid.js')).href));
const flow=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('proposal -> client notification -> acceptance -> professional notification -> completion -> both reviews',async()=>{
  reset();
  await flow.submitProposal(uuid,2n,{proposed_price:100});
  assert.equal(state.notifications[0].userId,1n);
  assert.equal(state.notifications[0].href,'/servicos/'+uuid+'/propostas');
  await flow.decideProposal(proposalUuid,1n,'accepted');
  assert.equal(state.status,'in_progress');
  assert.equal(state.notifications[1].userId,2n);
  await assert.rejects(()=>flow.submitReview(uuid,2n,{rating:5}),e=>e.status===409);
  await flow.changeServiceStatus(uuid,1n,'completed');
  assert.deepEqual(state.notifications.slice(2).map(n=>n.userId),[1n,2n]);
  await flow.submitReview(uuid,1n,{rating:5});
  await flow.submitReview(uuid,2n,{rating:4});
  assert.deepEqual(state.reviews.map(r=>[r.reviewerId,r.reviewedId]),[[1n,2n],[2n,1n]]);
  await assert.rejects(()=>flow.submitReview(uuid,1n,{rating:5}),e=>e.code==='P2002');
  assert.equal((await flow.getReviewContext(uuid,1n)).alreadyReviewed,true);
  const reviewNotifications = state.notifications.filter(n => n.eventKey.startsWith('review:'));
  assert.deepEqual(reviewNotifications.map(n => n.userId), [2n, 1n]);
  assert.equal(reviewNotifications.length, 2);
  assert.ok(reviewNotifications.every(n => n.href === '/perfil/avaliacoes'));
  assert.ok(reviewNotifications[0].message.includes('5/5'));
});
test('outsiders and professionals cannot accept or complete on behalf of client',async()=>{
  reset();await flow.submitProposal(uuid,2n,{proposed_price:100});
  await assert.rejects(()=>flow.decideProposal(proposalUuid,3n,'accepted'),e=>e.status===403);
  await assert.rejects(()=>flow.decideProposal(proposalUuid,2n,'accepted'),e=>e.status===403);
  await flow.decideProposal(proposalUuid,1n,'accepted');
  await assert.rejects(()=>flow.changeServiceStatus(uuid,2n,'completed'),e=>e.status===403);
  await assert.rejects(()=>flow.getReviewContext(uuid,3n),e=>e.status===403);
});
test('repeated acceptance and completion do not duplicate notifications',async()=>{
  reset();await flow.submitProposal(uuid,2n,{proposed_price:100});await flow.decideProposal(proposalUuid,1n,'accepted');
  await assert.rejects(()=>flow.decideProposal(proposalUuid,1n,'accepted'),e=>e.status===409);
  await flow.changeServiceStatus(uuid,1n,'completed');
  await assert.rejects(()=>flow.changeServiceStatus(uuid,1n,'completed'),e=>e.status===409);
  assert.equal(state.notifications.length,4);
});
test('cancelled services cannot be accepted; notification failure rolls back proposal',async()=>{
  reset();state.failNotification=true;
  await assert.rejects(()=>flow.submitProposal(uuid,2n,{proposed_price:100}));
  assert.equal(state.proposals.length,0);
  reset();await flow.submitProposal(uuid,2n,{proposed_price:100});state.status='cancelled';
  await assert.rejects(()=>flow.decideProposal(proposalUuid,1n,'accepted'),e=>e.status===409);
});
test('ratings are validated and reviewed user is not required from browser',()=>{
  assert.equal(createReviewSchema.safeParse({rating:5}).success,true);
  for(const rating of [0,6,1.5,'5'])assert.equal(createReviewSchema.safeParse({rating}).success,false);
});

test('notification failure rolls back review so it can be retried',async()=>{
  reset();await flow.submitProposal(uuid,2n,{proposed_price:100});
  await flow.decideProposal(proposalUuid,1n,'accepted');
  await flow.changeServiceStatus(uuid,1n,'completed');
  state.failNotification=true;
  await assert.rejects(()=>flow.submitReview(uuid,2n,{rating:4}));
  assert.equal(state.reviews.length,0);
  assert.equal(state.notifications.length,4);
  state.failNotification=false;
  await flow.submitReview(uuid,2n,{rating:4});
  assert.equal(state.reviews.length,1);
  assert.equal(state.notifications.at(-1).userId,1n);
});
