import {createRequire} from 'module';const {chromium}=createRequire('/')('playwright')   // 23p: Yamaha colour types: buttons, hidden parts of other colours, the chassis search picks the colour (own server on 3033);
import { spawn } from 'node:child_process'; import fs from 'node:fs';
let fails=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c)fails++;};
const R='/home/user/bike-pharma-app', T='/tmp/claude-0/bptest-yc'; fs.rmSync(T,{recursive:true,force:true});
const D=T+'/pf/catalogues/yamaha', YP=T+'/pf/catalogues/hero-sync/yamaha/ypec'; fs.mkdirSync(D,{recursive:true}); fs.mkdirSync(YP+'/models',{recursive:true}); fs.mkdirSync(YP+'/img',{recursive:true});
const NEW="DM49 YZF155D-A (2026-09-12).pdf"; fs.writeFileSync(D+'/'+NEW,'%PDF-1.4 test');
const fig=(n,name,page,codes,rows)=>({fig:n,name,page,crop:'0,0,0.48,1',codes,rows});
fs.writeFileSync(D+'/yamaha_build.json',JSON.stringify({v:1,books:[{file:NEW,size:13,date:'2026-09-12',title:'YZF155D-A',codes:['DM49'],figs:[
 fig('1','CYLINDER HEAD',7,['DM49'],[['1','B0T-E1102-10','CYLINDER HEAD ASSY',{DM49:'1'},'']]),
 fig('25','FRONT WHEEL',40,['DM49'],[['1','B9E-F5168-01-33','CAST WHEEL, FRONT',{DM49:'1'},'UR FOR MYWP1'],['1','B9E-F5168-01-8L','CAST WHEEL, FRONT',{DM49:'1'},''],['2','90105-10003','BOLT',{DM49:'4'},'']])]}],
 names:{DM49:'R15 V4'},mrp:{B0TE11021000:5290,B9EF5168018L:4100,B9EF51680133:4200},sup:[],kits:[],colours:{MYWP1:'Matte White Pearl'}}));
fs.writeFileSync(YP+'/coords.json','{}');
fs.writeFileSync(YP+'/models/DM49.json',JSON.stringify({code:'DM49',year:'2026',name:'YZF155D-A',catalogNo:'X',color:'A',figs:[{no:'1',br:'1',name:'CYLINDER HEAD',ill:'',parts:[['1','B0T-E1102-10','CYLINDER HEAD ASSY',1,'','']]},{no:'25',br:'1',name:'FRONT WHEEL',ill:'',parts:[['1','B9E-F5168-01-33','CAST WHEEL, FRONT',1,'',''],['2','90105-10003','BOLT',4,'','']]}],
 colors:[{t:'A',name:'MATTE WHITE PEARL',base:true,products:['010']},{t:'B',name:'RACING BLUE',products:['010'],figs:{'25/1':[['1','B9E-F5168-01-8L','CAST WHEEL, FRONT',1,'',''],['2','90105-10003','BOLT',4,'','']]}}]}));
await new Promise(r=>{const a=spawn('node',['--no-warnings','admin.mjs','add-admin','sam@bikepharma.com','Sam','--password','Test@1234'],{cwd:R,env:{...process.env,DATA_DIR:T+'/data'}});a.on('exit',r);});
const srv=spawn('node',['--no-warnings','server.mjs'],{cwd:R,env:{...process.env,PORT:'3033',DATA_DIR:T+'/data',FILES_DIR:T+'/pf',PHOTO_AI:'off',CAT_ROWS_DAY_PCT:'100000',CAT_DAY_MB:'100000',CAT_FILES_DAY_MB:'100000'},stdio:['ignore','pipe','pipe']});
let log='';srv.stdout.on('data',d=>log+=d);srv.stderr.on('data',d=>log+=d);
try{
 for(let i=0;i<120&&!/yamaha build \(start\) ended/.test(log);i++)await new Promise(r=>setTimeout(r,500));
 const d=JSON.parse(fs.readFileSync(T+'/data/cat/yamaha.json','utf8'));console.log('vcol',JSON.stringify(d.vcol),d.vars);
 const b=await chromium.launch();const errs=[];
 for(const vp of [{width:1300,height:900},{width:390,height:800}]){
 const cx=await b.newContext({viewport:vp});const pg=await cx.newPage();pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto('http://127.0.0.1:3033/#login');await pg.waitForTimeout(2500);
 const p=pg.frames().find(f=>f!==pg.mainFrame())||pg;
 console.log(await p.evaluate(()=>api('POST','/api/login',{id:'sam@bikepharma.com',password:'Test@1234'}).then(r=>{if(r.error)return r.error;srvLogin(r);return 'in '+S.user.role;})));
 await p.waitForTimeout(1000);await p.evaluate(()=>{catLoad('Yamaha');});await p.waitForFunction(()=>CAT_ALL.find(e=>e.vb==='Yamaha').st>=2,null,{timeout:60000});
 const W=vp.width+'px: ';
 await p.evaluate(()=>{reset(HOME[S.user.role]);go('findpart',{v:'year',vb:'Yamaha',vm:'R15 V4',yr:'Any'});});await p.waitForTimeout(2500);
 const TX=()=>p.evaluate(()=>document.querySelector('#vp').textContent);let t=await TX();
 ok(/Colour/.test(t)&&/All colours/.test(t)&&/A · Matte White Pearl/i.test(t)&&/B · Racing Blue/i.test(t),W+'the bike page shows the colour buttons');
 await p.evaluate(()=>{const s=m2Secs(catScope(m2A(cur().p)).rows).find(s=>/WHEEL/.test(s.asm));m2Sec(s.pg);});await p.waitForTimeout(2500);
 t=await TX();
 ok(/01-33/.test(t)&&/01-8L/.test(t)&&/All colours/.test(t),W+'no colour picked: both wheels listed, buttons on the diagram page');
 await p.evaluate(()=>{[...document.querySelectorAll('#vp .yc-bar .chip')].find(x=>/^B ·/.test(x.textContent)).click();});await p.waitForTimeout(1500);
 t=await TX();
 ok(!/01-33/.test(t)&&/01-8L/.test(t)&&/Colour part/.test(t)&&/90105-10003/.test(t),W+'colour B: only its wheel, marked Colour part; common bolt stays');if(vp.width>500)console.log(t.slice(300,1500).replace(/\n/g,' / '));
 await pg.screenshot({path:'/tmp/claude-0/bptest-yc/yc-'+vp.width+'.png'});
 await p.evaluate(()=>{[...document.querySelectorAll('#vp .yc-bar .chip')].find(x=>/^A ·/.test(x.textContent)).click();});await p.waitForTimeout(1500);
 t=await TX();
 ok(/01-33/.test(t)&&!/01-8L/.test(t),W+'colour A: only its wheel');
 // chassis search result: model code + colour type open the book with the colour picked
 await p.evaluate(()=>{S.ui.ycol={};S.ui.ycv='';reset(HOME[S.user.role]);go('findpart',{v:'year',vb:'Yamaha',vm:'R15 V4',yr:'Any',vin:'ME1XXXXXXXXXXXXXX',vmc:'DM49',vct:'B'});});await p.waitForTimeout(2000);
 const st=await p.evaluate(()=>({v:cur().p.v,ed:cur().p.ed,col:S.ui.ycol,on:(document.querySelector('#vp .yc-bar .chip.on')||{}).textContent,n:catScope(m2A(cur().p)).rows.filter(r=>/01-33/.test(r.part)).length}));
 ok(st.v==='secs'&&/^B ·/.test(st.on||'')&&st.n===0,W+'chassis search: the code\'s book opens with colour B picked '+JSON.stringify(st));
 await cx.close();}
 ok(!errs.length,'no page errors '+errs.slice(0,3).join(' | '));
 await b.close();
}catch(e){ok(false,'error '+e.stack);}finally{srv.kill();}
if(fails)console.log(log.slice(-1500));process.exit(fails?1:0);
