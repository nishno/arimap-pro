import test from 'node:test';import assert from 'node:assert/strict';
import {createAiService} from '../server/ai-service.mjs';
test('Gemini gateway requires identity/config, forwards actual prompts, fixes the server model and limits caller config',async()=>{
 const unavailable=createAiService({apiKey:''});await assert.rejects(unavailable('',{contents:'hello'}),e=>e.status===401);await assert.rejects(unavailable('user',{contents:'hello'}),e=>e.status===503);
 const calls=[];const ai=createAiService({generate:async parameters=>{calls.push(parameters);return {text:parameters.contents};}});
 const a=await ai('user',{model:'attacker-model',contents:'How do I prune?',config:{maxOutputTokens:999999,httpOptions:{baseUrl:'https://evil.invalid'},tools:[{url:'evil'}]}}),b=await ai('user',{contents:'What did I earn?'});
 assert.notEqual(a.text,b.text);assert.equal(calls[0].model,'gemini-2.5-flash');assert.equal(calls[0].config.maxOutputTokens,8192);assert.equal(calls[0].config.httpOptions,undefined);assert.equal(calls[0].config.tools,undefined);
 for(let n=2;n<20;n++)await ai('user',{contents:'test'});await assert.rejects(ai('user',{contents:'test'}),e=>e.status===429);
 const failing=createAiService({generate:async()=>{throw Object.assign(Error('secret provider details'),{status:403});}});await assert.rejects(failing('user',{contents:'test'}),e=>e.status===502&&!e.message.includes('secret'));
});
