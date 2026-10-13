import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const c=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('../own-ai.js',import.meta.url),'utf8'),c);
const parse=raw=>c.parseOwnTerms(raw);
test('external AI supports pipe, tab and fenced JSON words',()=>{assert.equal(parse('privacy | 隐私')[0].en,'privacy');assert.equal(parse('privacy\t隐私')[0].zh,'隐私');assert.equal(parse('```json\n{"terms":[{"english":"privacy","chinese":"隐私"}]}\n```').length,1)});
test('external AI rejects malformed or incomplete rows instead of silently dropping them',()=>{assert.throws(()=>parse('privacy | 隐私\nbad row'));assert.throws(()=>parse('[{"english":"privacy"}]'));assert.throws(()=>parse('privacy | '));assert.throws(()=>parse('word | 中文 | extra'));assert.throws(()=>parse(Array(1501).fill('a | 词').join('\n')))});
