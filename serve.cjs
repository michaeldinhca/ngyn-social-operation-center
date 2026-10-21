const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=__dirname;
const port=Number(process.argv[2]||4173);
http.createServer((req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400);return res.end('Bad request')}
 const file=path.resolve(root,'.'+(pathname==='/'?'/NGYN_Municipal_Social_Platform.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end('Forbidden')}
 fs.readFile(file,(err,bytes)=>{if(err){res.writeHead(404);return res.end('Not found')}res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')||file.endsWith('.cjs')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.json')?'application/json; charset=utf-8':'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(bytes)});
}).listen(port,'127.0.0.1',()=>console.log('Open http://127.0.0.1:'+port+'/'));
