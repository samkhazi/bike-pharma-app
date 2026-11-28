// 24p: billing + sales scenarios on a throwaway server (port 3044, admin owner@bikepharma.test, server catalogues copied in). Run n1, n2, then n3..n9. PW = the playwright module, CHROME = its browser.
const { chromium } = await import(process.env.PW || 'playwright');
export const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
export const errs=[];
export const mk=async(w,h)=>{const p=await(await b.newContext({viewport:{width:w,height:h}})).newPage();p.on('pageerror',e=>errs.push(e.message));return p;};
export const boot=async p=>{await p.goto('http://127.0.0.1:3044/app.html');await p.waitForFunction(()=>typeof S!=='undefined'&&S.stack&&S.stack.length&&cur().s!=='boot',null,{timeout:20000});await p.waitForTimeout(2500);};
export const login=async(p,id,pw)=>{await boot(p);await p.fill('#loginId',id);await p.evaluate(()=>sendOtp());await p.waitForTimeout(700);await p.fill('#pw1',pw);await p.evaluate(()=>pwGo());await p.waitForTimeout(1500);await p.evaluate(()=>{if(cur().s==='roleok')reset(HOME[S.user.role]);});await p.waitForTimeout(500);};
export const T=p=>p.evaluate(()=>document.querySelector('#vp .screen:last-child').innerText);
export const shot=(p,n)=>p.screenshot({path:'shot/'+n+'.png'});
