import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';

assert.ok(existsSync('dist/index.html'), 'Export the web app before running this test.');
const snapshot = JSON.parse(readFileSync('src/data/properties.json', 'utf8'));
const property = snapshot.properties.find(p => p.status === 'available');
assert.ok(property);
const port = Number(process.env.CONTACT_SMOKE_PORT || 8766);
const origin = 'http://127.0.0.1:' + port;
const server = spawn('python3', ['-m','http.server',String(port),'--bind','127.0.0.1','--directory','dist'], {stdio:'ignore'});
let browser;
try {
  let ready=false;
  for(let i=0;i<50;i++) {
    try { if((await fetch(origin)).ok){ready=true;break;} } catch {}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.ok(ready,'Static server must start.');
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH || (existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
  for(const scenario of ['corrupt','read-error','write-error','clear-error']) {
    const context=await browser.newContext({viewport:{width:390,height:844}});
    const page=await context.newPage(), errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
    await page.addInitScript(({scenario, origin})=>{
      // Init scripts also run in blocked map frames and opaque documents.
      if (window !== window.top || location.origin !== origin) return;
      const key='am-buyer-agent-v1';
      if(scenario==='corrupt') localStorage.setItem(key,'invalid');
      if(scenario==='clear-error') localStorage.setItem(key,JSON.stringify({version:1,name:'Test agent',phone:'+13045550123'}));
      window.__failAgentStorage=true;
      for(const method of ['getItem','setItem','removeItem']) {
        const original=Storage.prototype[method];
        Storage.prototype[method]=function(name,...args) {
          const target=scenario==='read-error'?'getItem':scenario==='write-error'?'setItem':scenario==='clear-error'?'removeItem':null;
          if(name===key && method===target && window.__failAgentStorage) throw new Error('Test-only storage failure');
          return original.call(this,name,...args);
        };
      }
      window.open=()=>{throw new Error('This test must not contact anyone');};
    },{scenario,origin});
    await page.goto(origin+'/?property='+encodeURIComponent(property.id));
    const details=page.getByRole('dialog');
    await details.waitFor();
    if(scenario==='corrupt'||scenario==='read-error') {
      await details.getByText('Could not read your saved agent. Try saving it again, or clear the saved contact.',{exact:true}).waitFor();
      assert.equal(await details.getByRole('button',{name:'Call your agent',exact:true}).count(),0);
      await details.getByRole('button',{name:'Clear saved contact',exact:true}).click();
      await details.getByText('Saved agent cleared from this app.',{exact:true}).waitFor();
    } else if(scenario==='write-error') {
      await details.getByRole('button',{name:'Add your agent',exact:true}).click();
      await details.getByRole('textbox',{name:'Your agent name (optional)',exact:true}).fill('Test agent');
      await details.getByRole('textbox',{name:'Your agent US or Canada phone number',exact:true}).fill('3045550123');
      await details.getByRole('button',{name:'Save agent on this device',exact:true}).click();
      await details.getByText('Could not save your agent. Check device storage and try again.',{exact:true}).waitFor();
      assert.equal(await details.getByRole('button',{name:'Call your agent',exact:true}).count(),0);
      await page.evaluate(()=>{window.__failAgentStorage=false;});
      await details.getByRole('button',{name:'Save agent on this device',exact:true}).click();
      await details.getByText('Test agent · +13045550123',{exact:true}).waitFor();
    } else {
      await details.getByText('Test agent · +13045550123',{exact:true}).waitFor();
      await details.getByRole('button',{name:'Clear your agent',exact:true}).click();
      await details.getByText('Could not clear the saved agent. Try again before leaving this device.',{exact:true}).waitFor();
      await details.getByText('Test agent · +13045550123',{exact:true}).waitFor();
      await page.evaluate(()=>{window.__failAgentStorage=false;});
      await details.getByRole('button',{name:'Clear your agent',exact:true}).click();
      await details.getByRole('button',{name:'Add your agent',exact:true}).waitFor();
    }
    assert.deepEqual(errors,[]);
    console.log('PASS contact storage UI: '+scenario);
    await context.close();
  }
} finally { await browser?.close(); server.kill(); }
