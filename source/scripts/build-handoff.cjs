const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const out=path.resolve(root,'../../handoff/ngyn-municipal-2026-10-21');
const dist=path.join(root,'dist');
fs.mkdirSync(out,{recursive:true});
const embedded=[];
let html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
html=html.replace(/<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?\s*>/g,(_,file)=>{
 const target=path.resolve(dist,file);
 if(!target.startsWith(dist+path.sep))throw new Error('Unexpected stylesheet path');
 const source=fs.readFileSync(target,'utf8');
 if(/<\/style/i.test(source))throw new Error('Unsafe inline stylesheet boundary');
 embedded.push({file,kind:'css',sha256:crypto.createHash('sha256').update(source).digest('hex')});
 return '<style data-source="'+file+'">\n'+source+'\n</style>';
});
html=html.replace(/<script\s+src="([^"]+)"\s*>\s*<\/script>/g,(_,file)=>{
 const target=path.resolve(dist,file);
 if(!target.startsWith(dist+path.sep))throw new Error('Unexpected script path');
 const source=fs.readFileSync(target,'utf8');
 if(/<\/script/i.test(source))throw new Error('Unsafe inline script boundary');
 new vm.Script(source,{filename:file});
 embedded.push({file,kind:'js',sha256:crypto.createHash('sha256').update(source).digest('hex')});
 // Keep individual script boundaries: merging globals into one script changes hoisting.
 return '<script data-source="'+file+'">\n'+source+'\n</script>';
});
if(/<script\s+src=|<link\s+rel="stylesheet"/i.test(html))throw new Error('A source dependency was not embedded');
const output=path.join(out,'NGYN_Municipal_Social_Platform.html');
fs.writeFileSync(output,html,'utf8');
fs.mkdirSync(path.join(out,'source'),{recursive:true});
for(const item of ['dist','tests','scripts','DEMO-NOTES.md','REVIEW-CHECKLIST.md']){
 if(fs.existsSync(path.join(root,item)))fs.cpSync(path.join(root,item),path.join(out,'source',item),{recursive:true});
}
const brief='C:/Users/doquy/.codex/attachments/06d61863-402a-428e-8f4f-5ce5484de7b9/Pasted text.txt';
if(fs.existsSync(brief))fs.copyFileSync(brief,path.join(out,'NGYN_Municipal_Social_Platform_Codex_Build_Brief.md'));
const manifest={product:'NGYN Municipal Social Platform',snapshotDate:'2026-10-21',baseCommit:'1f07ce2e890ec8b1fe1e96a56da371e23809f17a',includesUncommittedGroupVisibilityFix:true,entry:'NGYN_Municipal_Social_Platform.html',bytes:Buffer.byteLength(html),sha256:crypto.createHash('sha256').update(html).digest('hex'),externalDependencies:['Unsplash image URLs only; no social API or AI calls'],embedded};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({output,bytes:manifest.bytes,scripts:embedded.filter(f=>f.kind==='js').length,stylesheets:embedded.filter(f=>f.kind==='css').length,sha256:manifest.sha256},null,2));
