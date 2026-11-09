// Local-only synthetic UI export. Never changes the app entrypoint or inventory.
// Run: node scripts/smoke-listing-agent.mjs (installed dependencies + Chromium).
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, copyFileSync, symlinkSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright';
const root = resolve('.');
const dir = mkdtempSync(join(root, '.listing-agent-ui-'));
let server, browser;
try {
  mkdirSync(join(dir, 'src'));
  for (const file of ['ListingAgentContact.tsx', 'listingAgent.ts', 'buyerAgent.ts', 'properties.ts', 'sharing.ts', 'styles.ts']) copyFileSync(join(root, 'src', file), join(dir, 'src', file));
  symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir');
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({name:'listing-agent-ui-test', private:true, main:'index.ts', dependencies:pkg.dependencies, devDependencies:pkg.devDependencies}));
  writeFileSync(join(dir, 'app.json'), JSON.stringify({expo:{name:'Listing Contact Test',slug:'listing-contact-test',web:{bundler:'metro'}}}));
  writeFileSync(join(dir, 'index.ts'), "import { registerRootComponent } from 'expo'; import App from './App'; registerRootComponent(App);\n");
  writeFileSync(join(dir, 'App.tsx'), readFileSync('tests/fixtures/listing-agent-ui.tsx','utf8').replaceAll('../../src/', './src/'));
  const build = spawnSync(join(root,'node_modules','.bin','expo'), ['export','--platform','web','--max-workers','2'], {
    cwd:dir, stdio:'inherit', env:{...process.env, EXPO_NO_TELEMETRY:'1', EXPO_OFFLINE:'1', __UNSAFE_EXPO_HOME_DIRECTORY:join(dir,'.expo-home'), XDG_CACHE_HOME:join(dir,'.cache')},
  });
  assert.equal(build.status,0,'Synthetic web fixture must export successfully');
  const port = Number(process.env.LISTING_AGENT_SMOKE_PORT || 8768), origin = `http://127.0.0.1:${port}`;
  server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',join(dir,'dist')],{stdio:'ignore'});
  let ready=false;
  for(let i=0;i<50;i++){try{if((await fetch(origin)).ok){ready=true;break;}}catch{} await new Promise(r=>setTimeout(r,100));}
  assert.ok(ready);
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH || (existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
  for(const scenario of ['missing','call','text']) {
    const context=await browser.newContext({viewport:{width:390,height:844}}), page=await context.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
    await page.addInitScript(()=>{window.open=()=>{throw new Error('External handler forbidden in fixture');};});
    await page.goto(`${origin}/?scenario=${scenario}`);
    await page.getByRole('heading',{name:'Listing agent',exact:true}).waitFor();
    if(scenario==='missing') {
      await page.getByText('A verified listing-agent contact is not available for this property.',{exact:false}).waitFor();
      assert.equal(await page.getByRole('button').count(),0);
    } else {
      await page.getByText('Example Agent · +13045550123',{exact:true}).waitFor();
      const call=page.getByRole('button',{name:'Call listing agent',exact:true});
      const text=page.getByRole('button',{name:'Text listing agent about this property',exact:true});
      assert.equal(await text.count(),scenario==='text'?1:0);
      await page.getByText(`Status in saved inventory: ${scenario==='text'?'Sold':'Under Contract'}.`,{exact:false}).waitFor();
      // Same-turn repeated clicks must not open two external composers.
      await call.evaluate(element => { element.click(); element.click(); });
      await page.getByText('Complete or cancel the call in your phone app.',{exact:true}).waitFor();
      assert.deepEqual(await page.evaluate(()=>window.__contactAttempts),['tel:+13045550123']);
      if(scenario==='text') {
        await text.click();
        await page.getByText('Complete or cancel the message in your messaging app.',{exact:true}).waitFor();
        const attempts=await page.evaluate(()=>window.__contactAttempts);
        assert.match(attempts[1],/^sms:\+13045550123\?body=/);
        assert.match(decodeURIComponent(attempts[1]),/Status in saved inventory: Sold/);
      }
      await page.evaluate(()=>{window.__failContact=true;});
      await call.click();
      await page.getByText('Could not open a phone app. The published contact number is +13045550123.',{exact:true}).waitFor();
      if(scenario==='text') {
        await text.click();
        await page.getByText('Could not open a messaging app. The published contact number is +13045550123.',{exact:true}).waitFor();
      }
    }
    assert.deepEqual(errors,[]);
    mkdirSync(join(root, 'test-results'), {recursive:true});
    await page.screenshot({path:join(root, 'test-results', `listing-agent-${scenario}.png`), fullPage:true});
    console.log(`PASS listing-agent UI: ${scenario}, synthetic handoffs only`);
    await context.close();
  }
} finally { await browser?.close(); server?.kill(); rmSync(dir,{recursive:true,force:true}); }
