// Browser dry-run of the combined mockup. Serves the repo root, drives Chromium through
// every nav page and the key demo workflows, and fails on any uncaught page error.
// Usage: npm run dry-run   (set CHROMIUM_PATH to reuse an installed Chromium build)
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const path=require('node:path'),fs=require('node:fs');
const repo=path.resolve(__dirname,'../../..');
const port=Number(process.env.DRY_RUN_PORT||4196);
const shots=path.join(repo,'.dry-run');fs.mkdirSync(shots,{recursive:true});
const fixture=path.join(repo,'source/tests/fixtures/media-upload-demo.png');
const results=[];
const check=(name,ok,detail='')=>{results.push({name,ok:Boolean(ok),detail});console.log((ok?'PASS ':'FAIL ')+name+(detail?' :: '+detail:''))};
const expectedNav={
 ENGAGEMENT:['soc','inbox','listening'],
 'SOCIAL CHANNELS & CONTENT':['channels','content','calendar','media','assets'],
 ADVERTISING:['ads'],
 INSIGHTS:['analytics'],
 SETTINGS:['users','audit','preferences']
};

(async()=>{
 const srv=spawn(process.execPath,[path.join(repo,'serve.cjs'),String(port)]);
 await new Promise(r=>srv.stdout.once('data',r));
 const browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 const errors=[];
 try{
  const p=await browser.newPage({viewport:{width:1440,height:900}});
  p.on('pageerror',e=>errors.push(e.message));
  p.on('dialog',d=>d.accept());
  await p.goto(`http://127.0.0.1:${port}/`);await p.waitForTimeout(1200);

  // Required menu grouping (CLAUDE_HANDOFF.md "Required menu grouping")
  const nav=await p.$$eval('.nav .menu-section',els=>els.map(s=>({label:(s.querySelector('.menu-label,.menu-section-toggle')?.textContent||'').replace(/[^A-Z& ]/g,'').trim(),items:[...s.querySelectorAll('[data-go]')].map(x=>x.dataset.go)})));
  const navOk=Object.entries(expectedNav).every(([label,items],i)=>nav[i]&&nav[i].label===label&&JSON.stringify(nav[i].items)===JSON.stringify(items));
  check('menu grouping matches accepted IA',navOk,JSON.stringify(nav));

  for(const page of nav.flatMap(s=>s.items)){
   const before=errors.length;
   await p.click(`.nav [data-go="${page}"]`);await p.waitForTimeout(400);
   await p.screenshot({path:path.join(shots,`page-${page}.png`)});
   check(`page renders: ${page}`,errors.length===before,errors.slice(before).join(' | '));
  }

  // Media upload into IndexedDB (handoff open issue #2)
  await p.click('.nav [data-go="media"]');await p.waitForTimeout(400);
  await p.setInputFiles('#media-upload-input',fixture);await p.waitForTimeout(1500);
  const up=await p.evaluate(async()=>{const a=mediaData.assets.find(x=>x.name==='media-upload-demo.png');if(!a)return null;const blob=await getMediaBlob(a.blobId);return {status:a.status,width:a.width,height:a.height,blob:blob?blob.size:0}});
  check('media upload stores metadata and IndexedDB blob',up&&up.blob>0&&up.status==='Needs review',JSON.stringify(up));
  await p.reload();await p.waitForTimeout(1000);
  check('uploaded media survives reload',await p.evaluate(()=>mediaData.assets.some(x=>x.name==='media-upload-demo.png')));

  // Group-derived access (handoff open issue #1): a user with only a group creator role
  const setup=await p.evaluate(()=>{
   const g=assetsData.groups.find(g=>assetsData.channels.some(c=>c.assetGroup===g.id));
   const chs=assetsData.channels.filter(c=>c.assetGroup===g.id).map(c=>c.id);
   const u=accessUsers[1];u.channels=[];u.functions=[];saveAccessUsers();
   g.userAssignments=(g.userAssignments||[]).filter(a=>a.userId!==u.id);
   g.userAssignments.push({userId:u.id,role:'creator',channelIds:chs,adAccountIds:[]});persistAssets();
   return {user:u.id,channels:chs.length};
  });
  await p.selectOption('#preview-user',setup.user);await p.waitForTimeout(600);
  await p.click('.nav [data-go="content"]');await p.waitForTimeout(500);
  const empty=await p.$$eval('.ops-empty h3',e=>e.map(x=>x.textContent));
  const visible=await p.evaluate(()=>visiblePosts().length);
  check('group-only creator sees group content',visible>0&&!empty.includes('No channel access'),`visiblePosts=${visible}`);
  await p.click('[data-cmd="new-post"]');await p.waitForTimeout(500);
  await p.click('#choose-post-destinations');await p.waitForTimeout(300);
  const offered=await p.$$eval('input[name="composer-destination"]',e=>e.length);
  check('composer offers only the group channels',offered===setup.channels,`${offered} of ${setup.channels}`);
  await p.locator('[data-close]').first().click().catch(()=>{});
  await p.selectOption('#preview-user','admin');await p.waitForTimeout(500);

  // Composer: multi-channel submit for approval
  await p.click('.nav [data-go="content"]');await p.waitForTimeout(400);
  await p.click('[data-cmd="new-post"]');await p.waitForTimeout(500);
  await p.click('#choose-post-destinations');await p.waitForTimeout(300);
  const boxes=p.locator('input[name="composer-destination"]');
  for(let i=0;i<Math.min(3,await boxes.count());i++)await boxes.nth(i).check();
  await p.click('#composer-channels-form button[type=submit]');await p.waitForTimeout(400);
  await p.fill('#single-post-title','Dry-run: winter parking ban');
  await p.fill('#single-post-text','Overnight winter parking ban starts Dec 1.');
  await p.fill('#single-alt','Snow plow clearing a residential street');
  await p.click('#single-submit-review');await p.waitForTimeout(600);
  const made=await p.evaluate(()=>ops.posts.filter(x=>x.title==='Dry-run: winter parking ban'));
  check('composer submit creates linked in-review variations',made.length===3&&made.every(x=>x.status==='In review'&&x.batchId===made[0].batchId),`${made.length} posts`);

  // Emergency pause blocks the demo queue
  await p.click('.nav [data-go="soc"]');await p.waitForTimeout(400);
  await p.locator('button:has-text("Emergency pause")').first().click();await p.waitForTimeout(300);
  await p.locator('.modal textarea, [role=dialog] textarea, dialog[open] textarea').first().fill('Dry-run: severe weather hold');
  await p.locator('button:has-text("Confirm pause")').first().click();await p.waitForTimeout(400);
  const q=await p.evaluate(()=>{const n=ops.posts.filter(x=>x.status==='Scheduled').length;processQueue();return {paused:Boolean(ops.paused),before:n,after:ops.posts.filter(x=>x.status==='Scheduled').length}});
  check('emergency pause engages and blocks publishing',q.paused&&q.before===q.after,JSON.stringify(q));

  // Phone width: no horizontal page scroll
  await p.setViewportSize({width:390,height:844});
  for(const page of ['soc','inbox','content','media']){
   await p.evaluate(pg=>renderWorkspace(pg),page);await p.waitForTimeout(300);
   const w=await p.evaluate(()=>document.documentElement.scrollWidth);
   await p.screenshot({path:path.join(shots,`mobile-${page}.png`)});
   check(`390px width has no horizontal scroll: ${page}`,w<=390,`scrollWidth=${w}`);
  }

  check('no uncaught page errors',errors.length===0,errors.join(' | '));
 }finally{await browser.close();srv.kill()}
 const failed=results.filter(r=>!r.ok);
 fs.writeFileSync(path.join(shots,'results.json'),JSON.stringify({at:new Date().toISOString(),results},null,1));
 console.log(`\n${results.length-failed.length}/${results.length} passed. Screenshots: ${shots}`);
 process.exit(failed.length?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
