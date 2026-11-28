import {b,errs,mk,login,T,shot} from './lib.mjs';
const px='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';
const I=await mk(390,844);await login(I,'indu@test.test','Test@1234');
for(const [pn,q,bin] of [['17910KST940S','10','A-1-01'],['11394AAH00099S','5','A-1-02'],['38110KST900S','1','A-1-03'],['16450ACK000S','2','A-1-04']]){
 await I.evaluate(()=>{closeSheet();S.ui.ap=null;go('addproduct');});await I.waitForTimeout(700);
 await I.fill('#ap-pn',pn);await I.press('#ap-pn','Enter');await I.waitForTimeout(4000);
 await I.evaluate(p=>{S.ui.ap.photos=[p];refresh();},px);
 await I.fill('#ap-open',q);await I.fill('#ap-bin',bin);await I.locator('#ap-bin').blur();await I.waitForTimeout(500);
 await I.locator('#vp .screen:last-child .foot button',{hasText:/save product/i}).click();await I.waitForTimeout(2000);
 console.log(pn,JSON.stringify(await I.evaluate(()=>({n:PRODUCTS.length,sheet:(document.querySelector('.sheet')||{}).innerText,e:S.ui.apErr}))).slice(0,400));
}
console.log(JSON.stringify(await I.evaluate(()=>PRODUCTS.map(x=>[x.id,x.pn,x.mrp,x.price,x.mp,DB.stock[x.id],x.warDays,x.pending,x.hsn,x.gst,x.cost,itemCost({pid:x.id})]))));
await I.waitForTimeout(3000);
await I.waitForTimeout(2000);await b.close();