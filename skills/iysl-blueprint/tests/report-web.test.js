import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { buildReport } from '../scripts/report.js';
const report = JSON.parse(readFileSync('examples/report.json'));
test('web layout preserves report output and rejects invalid layout', () => {
 const baseline = buildReport(report, {baseDir:'examples'}).html;
 assert.equal(baseline, buildReport({...report,layout:'report'}, {baseDir:'examples'}).html);
 assert.equal(baseline, readFileSync('examples/report.html','utf8'));
 assert.throws(()=>buildReport({...report,layout:'bad'}), /layout/);
});
test('web hero, summary and sections retain strict chart verification', () => {
 const {html,sections} = buildReport({...report,layout:'web'}, {baseDir:'examples'});
 assert.match(html, /data-layout="web"/);
 assert.ok(html.includes(`<h1>${report.message}</h1>`));
 assert.doesNotMatch(html,/class="(?:report-cover|report-front|toc)"/);
 assert.match(html,/class="summary-metrics"/);
 assert.equal((html.match(/<section\b/g)||[]).length,sections);
});

import { checkReport } from '../evals/check-report.mjs';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
test('web checker rejects tampered numbers and PDF exits 2', () => {
 const {html} = buildReport({...report,layout:'web'}, {baseDir:'examples'});
 const script = readFileSync('evals/fixtures/explain-script.md','utf8');
 const options = {report: {...report,layout:'web'}, baseDir:'examples'};
 const dir = mkdtempSync(path.join(tmpdir(),'blueprint-web-test-'));
 try {
  const file = path.join(dir,'report.html');
  writeFileSync(file,html);
  const check = () => spawnSync(process.execPath,['evals/check-report.mjs',file,'evals/fixtures/explain-script.md','examples/report-web.json'],{encoding:'utf8'});
  assert.equal(check().status,0);
  writeFileSync(file,html.replace('</h1>',' 987654321</h1>'));
  assert.notEqual(check().status,0);
  writeFileSync(file,html);
  const pdf = spawnSync(process.execPath,['scripts/pdf.js',file,path.join(dir,'pdf')],{encoding:'utf8'});
  assert.equal(pdf.status,2);
  assert.match(pdf.stderr,/網頁型不供列印/);
 } finally { rmSync(dir,{recursive:true,force:true}); }
});
