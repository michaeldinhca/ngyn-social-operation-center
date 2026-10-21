const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=name=>fs.readFileSync(path.join(__dirname,'../dist',name),'utf8');
const between=(text,start,end)=>text.slice(text.indexOf(start),text.indexOf(end,text.indexOf(start)));
test('function permission AND account assignment are required',()=>{
 const context=vm.createContext({});vm.runInContext(between(source('users.js'),'function hasAccountFunction(','const accessExample='),context);
 const u={functions:['content.create','ads.create'],channels:['channel-a'],adAccounts:[]};
 assert.equal(context.hasAccountFunction(u,'content.create','channels','channel-a'),true);
 assert.equal(context.hasAccountFunction(u,'content.create','channels','channel-b'),false);
 assert.equal(context.hasAccountFunction(u,'content.publish','channels','channel-a'),false);
 assert.equal(context.hasAccountFunction(u,'ads.create','adAccounts','ad-a'),false);
 assert.equal(context.hasAccountFunction(undefined,'content.create','channels','channel-a'),false);
});
test('master guardrails are retained separately from guideline additions',()=>{
 const context=vm.createContext({commonSizes:[['Square',1080,1080]]});vm.runInContext(between(source('operations.js'),'function compiledBrand(','function decorateBrand('),context);
 const board={master:{dos:'Use verified facts',donts:'No personal data'}};
 const result=context.compiledBrand(board,{dos:'Include next steps',donts:'Avoid jargon'});
 assert.equal(result.master.donts,'No personal data');assert.equal(result.guideline.donts,'Avoid jargon');
 assert.equal(result.precedence[0],'Master asset-group guardrails (mandatory)');assert.equal(result.externalPublishing,false);assert.equal(result.humanReviewRequired,true);
});
test('emergency pause prevents a demo queue job from being processed',()=>{
 const post={id:'p1',status:'Scheduled',history:[]};let logs=0;
 const context=vm.createContext({ops:{paused:true},can:()=>true,isAdmin:()=>true,visiblePosts:()=>[post],toast:()=>{},logOps:()=>logs++,renderWorkspace:()=>{},currentPage:'soc',nowISO:()=>new Date().toISOString()});
 vm.runInContext(between(source('operations.js'),'function processQueue(','function postMarkup('),context);
 context.processQueue();assert.equal(post.status,'Scheduled');assert.equal(logs,0);
 context.ops.paused=false;context.processQueue();assert.equal(post.status,'Published');assert.equal(logs,1);
});
test('lack of publishing permission blocks queue processing',()=>{
 const post={id:'p1',status:'Scheduled',history:[]};
 const context=vm.createContext({ops:{paused:false},can:()=>false,visiblePosts:()=>[post]});
 vm.runInContext(between(source('operations.js'),'function processQueue(','function postMarkup('),context);
 context.processQueue();assert.equal(post.status,'Scheduled');
});
test('preferences have separate storage keys for every user',()=>{
 const context=vm.createContext({viewUser:'admin'});vm.runInContext(between(source('operations.js'),'function preferenceKey(','function getPreferences('),context);
 const admin=context.preferenceKey();context.viewUser='user-a';const a=context.preferenceKey();context.viewUser='user-b';const b=context.preferenceKey();
 assert.notEqual(admin,a);assert.notEqual(a,b);
});
