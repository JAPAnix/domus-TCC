import zlib from 'node:zlib';
const A='http://localhost:3100/api';
let pass=0,fail=0; const ok=(n,c,x='')=>{c?pass++:fail++;console.log((c?'ok  ':'FAIL')+' '+n+(c?'':' '+JSON.stringify(x)))};
const j=async(m,p,b,t)=>{const r=await fetch(A+p,{method:m,headers:{...(b?{'content-type':'application/json'}:{}),...(t?{authorization:'Bearer '+t}:{})},body:b?JSON.stringify(b):undefined});let d=null;try{d=await r.json()}catch{}return{s:r.status,d}};
// PNG 1x1 real
function png(){const sig=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);const crcT=[...Array(256)].map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});const crc=b=>{let c=~0;for(const x of b)c=crcT[(c^x)&255]^(c>>>8);return(~c)>>>0};const ch=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c])};const ih=Buffer.from([0,0,0,1,0,0,0,1,8,2,0,0,0]);return Buffer.concat([sig,ch('IHDR',ih),ch('IDAT',zlib.deflateSync(Buffer.from([0,120,60,200]))),ch('IEND',Buffer.alloc(0))])}
const up=async(t,buf,type='image/png',name='a.png',purpose='avatar')=>{const f=new FormData();f.set('purpose',purpose);f.set('file',new Blob([buf],{type}),name);const r=await fetch(A+'/uploads',{method:'POST',headers:t?{authorization:'Bearer '+t}:{},body:f});return{s:r.status,d:await r.json().catch(()=>null)}};
const stamp=Date.now();
const reg=async(n)=>{const email=`${n}${stamp}@teste.invalid`;await j('POST','/auth/register',{first_name:'Teste',last_name:n,email,password:'senha-forte-1'});const l=await j('POST','/auth/login',{email,password:'senha-forte-1'});return{t:l.d.token,u:l.d.user}};
const c=await reg('cliente'), p=await reg('pro'), o=await reg('outro');
ok('login devolve profilePictureUrl','profilePictureUrl' in c.u,c.u);
// upload
ok('upload sem token 401',(await up(null,png())).s===401);
const u1=await up(c.t,png()); ok('upload png 201',u1.s===201&&u1.d.url,u1);
ok('url com pasta do dono',u1.d.key.startsWith(c.u.uuid+'/avatar/'),u1.d);
const g=await fetch(u1.d.url); ok('arquivo servido',g.status===200&&g.headers.get('x-content-type-options')==='nosniff',g.status);
ok('svg disfarçado de png 415',(await up(c.t,Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),'image/png','x.png')).s===415);
ok('php disfarçado 415',(await up(c.t,Buffer.from('<?php echo 1;?>'),'image/jpeg','x.jpg')).s===415);
const big=Buffer.concat([png(),Buffer.alloc(5*1024*1024+10)]); const rb=await up(c.t,big); ok('acima de 5 MB 413',rb.s===413&&/5 MB/.test(rb.d.message),rb);
ok('purpose inválido 400',(await up(c.t,png(),'image/png','a.png','xxx')).s===400);
ok('remover de outro usuário 403',(await j('DELETE','/uploads',{key:u1.d.key},o.t)).s===403);
ok('path traversal 403',(await j('DELETE','/uploads',{key:`${c.u.uuid}/../../../etc/passwd`},c.t)).s===403);
const u2=await up(c.t,png()); ok('remover o próprio 204',(await j('DELETE','/uploads',{key:u2.d.key},c.t)).s===204);
ok('removido some',(await fetch(u2.d.url)).status===404);
// avatar
ok('salva avatar',(await j('PATCH','/profile/me',{profile_picture_url:u1.d.url},c.t)).s===200);
ok('me mostra avatar',(await j('GET','/auth/me',null,c.t)).d.profilePictureUrl===u1.d.url);
const nul=await j('PATCH','/profile/me',{profile_picture_url:null},c.t); ok('remove avatar vira null e não "null"',nul.d.profilePictureUrl===null,nul);
ok('url javascript: recusada',(await j('PATCH','/profile/me',{profile_picture_url:'javascript:alert(1)'},c.t)).s===400);
// pedido com fotos
const cats=(await j('GET','/categories')).d; const u3=await up(c.t,png(),'image/png','a.png','service'); const u4=await up(c.t,png(),'image/png','a.png','service');
const sv=await j('POST','/services',{title:'Trocar chuveiro elétrico',description:'Preciso trocar o chuveiro do banheiro social.',category_id:cats[0].id,budget_min:100,budget_max:300,deadline:'2030-01-10',city:'Curitiba',state:'PR',image_urls:[u3.d.url,u4.d.url]},c.t);
ok('cria pedido com fotos',sv.s===201&&sv.d.images?.length===2,sv);
const det=await j('GET','/services/'+sv.d.uuid); ok('detalhe mantém ordem (capa primeiro)',det.d.images[0]===u3.d.url,det.d.images);
const list=await j('GET','/services'); ok('lista traz só a capa',list.d.data.find(s=>s.uuid===sv.d.uuid)?.images.length===1,list.d);
ok('11 fotos recusado',(await j('POST','/services',{title:'Trocar chuveiro elétrico',description:'Preciso trocar o chuveiro do banheiro social.',category_id:cats[0].id,image_urls:Array(11).fill(u3.d.url)},c.t)).s===400);
// meus pedidos
ok('mine exige login',(await j('GET','/services/mine')).s===401);
for(let i=0;i<22;i++)await j('POST','/services',{title:'Pedido de outro usuario '+i,description:'Descricao longa o bastante para passar.',category_id:cats[0].id,budget_min:1,budget_max:2},o.t);
const mine=await j('GET','/services/mine',null,c.t); ok('mine traz o pedido mesmo com 22 mais novos de terceiros',mine.d.data.some(s=>s.uuid===sv.d.uuid)&&mine.d.data.every(s=>s.client===undefined),mine.d.meta);
ok('mine conta propostas',mine.d.data[0]._count?.proposals===0,mine.d.data[0]);
const can=await j('POST','/services',{title:'Pedido para cancelar',description:'Descricao longa o bastante para passar.',category_id:cats[0].id},c.t);
await j('PATCH',`/services/${can.d.uuid}/status`,{status:'cancelled'},c.t);
ok('all=true não expõe cancelados',!(await j('GET','/services?all=true&limit=48')).d.data.some(s=>s.uuid===can.d.uuid));
// (a busca de profissionais foi substituída pela busca de serviços: veja catalogo-favoritos.mjs)
// A72
for(const path of ['/services/nao-e-uuid','/listings/nao-e-uuid']){const r=await j('GET',path);console.log('info uuid invalido',path,r.s)}
// sessao
ok('token inválido 401',(await j('GET','/services/mine',null,'lixo')).s===401);
console.log(JSON.stringify({pass,fail,cliente:c.u.email,pro:p.u.email,senha:'senha-forte-1',servico:sv.d.uuid}));
