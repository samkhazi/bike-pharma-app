import {createRequire} from 'module';const {chromium}=createRequire('/')('playwright')   // 23q: Yamaha scanned books (YPEC's PDF-only old models): the build lists them, Find Part shows their pages (own server on 3034);
import { spawn } from 'node:child_process'; import fs from 'node:fs';
let fails=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c)fails++;};
const R='/home/user/bike-pharma-app', T='/tmp/claude-0/bptest-ys'; fs.rmSync(T,{recursive:true,force:true});
const D=T+'/pf/catalogues/yamaha', YP=T+'/pf/catalogues/hero-sync/yamaha/ypec'; fs.mkdirSync(D,{recursive:true}); fs.mkdirSync(YP+'/models',{recursive:true}); fs.mkdirSync(YP+'/pdf',{recursive:true});
const NEW="DM49 YZF155D-A (2026-09-12).pdf"; fs.writeFileSync(D+'/'+NEW,'%PDF-1.4 test');
fs.writeFileSync(D+'/yamaha_build.json',JSON.stringify({v:1,books:[{file:NEW,size:13,date:'2026-09-12',title:'YZF155D-A',codes:['DM49'],figs:[{fig:'1',name:'CYLINDER HEAD',page:7,crop:'0,0,0.48,1',codes:['DM49'],rows:[['1','B0T-E1102-10','CYLINDER HEAD ASSY',{DM49:'1'},'']]}]}],
 names:{DM49:'R15 V4'},mrp:{B0TE11021000:5290},sup:[],kits:[],colours:{}}));
fs.writeFileSync(YP+'/coords.json','{}');
const b0=await chromium.launch();{const p=await b0.newPage();
 for(const [n,k] of [['1436L470E1',3],['1036L470E1',2],['104TL470E1',2]]){await p.setContent(Array.from({length:k},(_,i)=>'<div style="page-break-after:always;font:40px sans-serif"><h1>BOOK '+n+' PAGE '+(i+1)+'</h1><p>1 36L-11111-00 CYLINDER HEAD</p></div>').join(''));await p.pdf({path:YP+'/pdf/'+n+'.PDF',format:'A4'});}await p.close();}
const sz=n=>fs.statSync(YP+'/pdf/'+n+'.PDF').size;
fs.writeFileSync(YP+'/pdfbooks.json',JSON.stringify({books:{'1436L470E1':{file:'1436L470E1.PDF',size:sz('1436L470E1'),pages:3},'1036L470E1':{file:'1036L470E1.PDF',size:sz('1036L470E1'),pages:2},'104TL470E1':{file:'104TL470E1.PDF',size:sz('104TL470E1'),pages:2},GONE:{file:'GONE.PDF',size:5,pages:9}},
 models:{'36L0':{name:'RX100',year:'1986',cats:['1436L470E1','1036L470E1']},'4TL1':{name:'RX135',year:'1998',cats:['104TL470E1']},'DM4X':{name:'r15  v4',year:'2001',cats:['104TL470E1']},'5KA1':{name:'CRUX',year:'2004',cats:['GONE']}}}));
await new Promise(r=>{const a=spawn('node',['--no-warnings','admin.mjs','add-admin','sam@bikepharma.com','Sam','--password','Test@1234'],{cwd:R,env:{...process.env,DATA_DIR:T+'/data'}});a.on('exit',r);});
const srv=spawn('node',['--no-warnings','server.mjs'],{cwd:R,env:{...process.env,PORT:'3034',DATA_DIR:T+'/data',FILES_DIR:T+'/pf',PHOTO_AI:'off',CAT_ROWS_DAY_PCT:'100000',CAT_DAY_MB:'100000',CAT_FILES_DAY_MB:'100000'},stdio:['ignore','pipe','pipe']});
let log='';srv.stdout.on('data',d=>log+=d);srv.stderr.on('data',d=>log+=d);
try{
 for(let i=0;i<120&&!/yamaha build \(start\) ended/.test(log);i++)await new Promise(r=>setTimeout(r,500));
 const d=JSON.parse(fs.readFileSync(T+'/data/cat/yamaha.json','utf8')),bi=JSON.parse(fs.readFileSync(T+'/data/cat/yamaha-build.json','utf8'));
 ok(Array.isArray(d.scan)&&d.scan.length===3&&d.scan.find(s=>s[1]==='DM4X')[0]==='R15 V4'&&d.scan[0][0]==='RX100'&&d.scan[0][1]==='36L0'&&d.scan[0][4].length===2&&d.scan[0][4][0][3]===3&&d.scan.find(s=>s[1]==='4TL1')[0]==='RX135'&&!d.scan.some(s=>s[1]==='5KA1'),'build: the scanned books of 36L0 (2 books) and 4TL1 are listed, a book whose file is missing is left out '+JSON.stringify(d.scan).slice(0,300));
 ok(d.models.includes('RX100')&&d.models.includes('RX135')&&bi.scan&&bi.scan.models===3&&bi.scan.books===3&&bi.scan.pages===9,'build: the bikes are in the model list; counts '+JSON.stringify(bi.scan));
 const errs=[];
 for(const vp of [{width:1300,height:900},{width:390,height:800}]){
 const cx=await b0.newContext({viewport:vp});const pg=await cx.newPage();pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto('http://127.0.0.1:3034/#login');await pg.waitForTimeout(2500);
 const p=pg.frames().find(f=>f!==pg.mainFrame())||pg;
 console.log(await p.evaluate(()=>api('POST','/api/login',{id:'sam@bikepharma.com',password:'Test@1234'}).then(r=>{if(r.error)return r.error;srvLogin(r);return 'in '+S.user.role;})));
 await p.waitForTimeout(1000);await p.evaluate(()=>{catLoad('Yamaha');});await p.waitForFunction(()=>CAT_ALL.find(e=>e.vb==='Yamaha').st>=2,null,{timeout:60000});
 const W=vp.width+'px: ',TX=()=>p.evaluate(()=>document.querySelector('#vp').textContent);
 ok(await p.evaluate(()=>BRANDS_V.Yamaha.includes('RX135')&&BRANDS_V.Yamaha.includes('RX100')),W+'RX100 and RX135 are in the Yamaha model list');
 // RX135: one scanned book, nothing else: it opens straight away
 await p.evaluate(()=>{reset(HOME[S.user.role]);go('findpart',{v:'year',vb:'Yamaha',vm:'RX135',yr:'Any'});});await p.waitForTimeout(1500);
 let t=await TX();
 ok(/Scanned book/.test(t)&&/Page 1 of 2/.test(t)&&/4TL1/.test(t)&&/type it in search to see its MRP/.test(t),W+'RX135 opens its scanned book: tag, note, page 1 of 2');
 await p.waitForFunction(()=>{const e=document.querySelector('#vp .ysb-view .dg');return e&&e.classList.contains('on');},null,{timeout:60000}).then(()=>ok(true,W+'the page is drawn from the PDF'),()=>ok(false,W+'the page is drawn from the PDF'));
 const ar=await p.evaluate(()=>+getComputedStyle(document.querySelector('#vp .ysb-view .dg')).getPropertyValue('--ar'));
 ok(ar>0.6&&ar<0.8,W+'the whole A4 page is shown (ratio '+ar+')');
 // RX100: two books: a list to choose from, then the book; pages, next, zoom
 await p.evaluate(()=>{reset(HOME[S.user.role]);go('findpart',{v:'year',vb:'Yamaha',vm:'RX100',yr:'Any'});});await p.waitForTimeout(1500);
 t=await TX();
 ok(/choose a book/.test(t)&&/1436L470E1/.test(t)&&/3 pages/.test(t)&&/1036L470E1/.test(t)&&/Scanned book/.test(t),W+'RX100 lists its two scanned books');
 await p.evaluate(()=>{[...document.querySelectorAll('#vp .m2-row')].find(x=>/1436L470E1/.test(x.textContent)).click();});await p.waitForTimeout(1500);
 t=await TX(); ok(/Page 1 of 3/.test(t)&&/Pages \(3\)/.test(t)&&/Book/.test(t),W+'the first book opens on page 1 of 3, with the other book as a button');
 await p.evaluate(()=>{document.querySelector('#vp .ysb-pl [data-p="3"]').click();});await p.waitForTimeout(300);
 let st=await p.evaluate(()=>({no:document.querySelector('#vp .ysb-no').textContent,on:document.querySelector('#vp .ysb-pl .on').textContent,dg:document.querySelector('#vp .ysb-view .dg').dataset.dg}));
 ok(st.no==='Page 3 of 3'&&st.on==='Page 3'&&/:3:0,0,1,1$/.test(st.dg),W+'picking page 3 shows page 3 '+JSON.stringify(st).slice(0,200));
 await p.waitForFunction(()=>{const e=document.querySelector('#vp .ysb-view .dg');return e&&e.classList.contains('on');},null,{timeout:60000}).catch(()=>{});
 await p.evaluate(()=>{ysGo(-1,1);});await p.waitForTimeout(300);
 st=await p.evaluate(()=>document.querySelector('#vp .ysb-no').textContent); ok(st==='Page 2 of 3',W+'previous goes to page 2');
 await p.evaluate(()=>{ysGo(1,1);ysGo(1,1);ysGo(1,1);});await p.waitForTimeout(300);
 st=await p.evaluate(()=>document.querySelector('#vp .ysb-no').textContent); ok(st==='Page 3 of 3',W+'next stops at the last page');
 if(vp.width>900){const w0=await p.evaluate(()=>document.querySelector('#vp .ysb-view .dg-wrap').getBoundingClientRect().width);await p.evaluate(()=>{ysZoom(1);ysZoom(1);});const w1=await p.evaluate(()=>document.querySelector('#vp .ysb-view .dg-wrap').getBoundingClientRect().width);await p.evaluate(()=>ysZoom(0));const w2=await p.evaluate(()=>document.querySelector('#vp .ysb-view .dg-wrap').getBoundingClientRect().width);
  ok(w1>w0*1.9&&Math.abs(w2-w0)<2,W+'+ makes the page bigger, Fit puts it back ('+Math.round(w0)+' > '+Math.round(w1)+' > '+Math.round(w2)+')');}
 else ok(await p.evaluate(()=>{const l=document.querySelector('#vp .ysb-pl');return getComputedStyle(l).flexDirection==='row'&&document.documentElement.scrollWidth<=innerWidth+1;}),W+'phone: pages are a row of chips, the screen does not scroll sideways');
 await p.waitForFunction(()=>{const e=document.querySelector('#vp .ysb-view .dg');return e&&e.classList.contains('on');},null,{timeout:60000}).catch(()=>{});
 await pg.screenshot({path:T+'/ys-'+vp.width+'.png'});
 // the other book, and a bike with a part list is as before
 await p.evaluate(()=>{[...document.querySelectorAll('#vp .yc-bar .chip')].find(x=>/1036L470E1/.test(x.textContent)).click();});await p.waitForTimeout(1200);
 t=await TX(); ok(/Page 1 of 2/.test(t)&&/book 1036L470E1/.test(t),W+'the other book opens from its button');
 await p.evaluate(()=>{reset(HOME[S.user.role]);go('findpart',{v:'year',vb:'Yamaha',vm:'R15 V4',yr:'Any'});});await p.waitForTimeout(1500);
 t=await TX(); ok(/choose a book/.test(t)&&/Part list/.test(t)&&/DM4X \(2001\)/.test(t),W+'a bike with a part list and a scanned book lists both');
 await p.evaluate(()=>{[...document.querySelectorAll('#vp .m2-row')].find(x=>/Part list/.test(x.textContent)).click();});await p.waitForTimeout(1500);
 t=await TX(); ok(!/Scanned book/.test(t)&&/1 sections? · 1 parts?/.test(t),W+'its part list opens as before');
 await cx.close();}
 ok(!errs.length,'no page errors '+errs.slice(0,3).join(' | '));
}catch(e){ok(false,'error '+e.stack);}finally{srv.kill();await b0.close();}
if(fails)console.log(log.slice(-1500));process.exit(fails?1:0);
