// Generate a non-personal 64px PNG to exercise browser-local media upload.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
function crc32(b){let crc=0xffffffff;for(const byte of b){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return (crc^0xffffffff)>>>0}
function chunk(type,data){const t=Buffer.from(type),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([size,t,data,crc])}
const header=Buffer.alloc(13);header.writeUInt32BE(64,0);header.writeUInt32BE(64,4);header[8]=8;header[9]=2;
const rows=Buffer.alloc(64*(1+64*3));for(let y=0;y<64;y++)for(let x=0;x<64;x++){const p=y*193+1+x*3;rows[p]=120+x;rows[p+1]=170;rows[p+2]=75+y}
const fixtureDir=path.join(__dirname,'fixtures');fs.mkdirSync(fixtureDir,{recursive:true});const target=path.join(fixtureDir,'media-upload-demo.png');fs.writeFileSync(target,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]));console.log(target);
