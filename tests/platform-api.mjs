import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/platform/admins.js';
async function request(req){const result={headers:{},status:0,body:null};const res={setHeader:(name,value)=>result.headers[name]=value,status:code=>{result.status=code;return res;},json:body=>{result.body=body;return res;}};await handler(req,res);return result;}
test('platform API rejects unauthenticated and malformed requests before using credentials',async()=>{
 const get=await request({method:'GET',headers:{}});assert.equal(get.status,405);assert.equal(get.headers['Cache-Control'],'no-store');
 const injected=await request({method:'POST',headers:{'content-type':'application/json'},body:{token:'injected',action:'grant',targetUid:'target',reason:'Attempted bypass'}});assert.equal(injected.status,401);
 const wrongType=await request({method:'POST',headers:{'content-type':'text/plain',authorization:'Bearer invalid'},body:{}});assert.equal(wrongType.status,415);
 const invalid=await request({method:'POST',headers:{'content-type':'application/json',authorization:'Bearer invalid'},body:[]});assert.equal(invalid.status,400);
 const oversized=await request({method:'POST',headers:{'content-type':'application/json',authorization:'Bearer invalid'},body:{reason:'x'.repeat(5000)}});assert.equal(oversized.status,400);
});
