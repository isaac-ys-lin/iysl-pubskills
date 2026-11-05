import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { build } from '../scripts/pptx.js';
import { buildReport } from '../scripts/report.js';
import { render } from '../scripts/svg.js';
import { loadTokens } from '../scripts/tokens.js';
import { themeCss } from '../scripts/theme-css.js';

test('全球藍保留白封面、深藍章節與展示字型', async () => {
  const t = loadTokens();
  assert.equal(t.type.conclusionNumber.color, '#28317B');
  assert.equal(t.type.title.color, '#000099');
  const { buffer } = await build({ title: '全球藍驗收', pages: [
    { type: 'cover', claim: '全球藍 Blueprint' },
    { type: 'section', kicker: '設計', claim: '設計 Design' },
    { type: 'statement', claim: '內文 Body' },
  ] });
  const zip = await JSZip.loadAsync(buffer);
  const slides = await Promise.all([1, 2, 3].map(n => zip.file(`ppt/slides/slide${n}.xml`).async('string')));
  assert.match(slides[0], /<p:bg>[\s\S]*?val="FFFFFF"/);
  assert.match(slides[0], /val="000066"/);
  assert.match(slides[1], /<p:bg>[\s\S]*?val="142979"/);
  for (const s of slides.slice(0, 2)) {
    assert.match(s, /<a:latin typeface="Cambria"/);
    assert.match(s, /<a:ea typeface="PMingLiU"/);
  }
  assert.match(slides[2], /<a:ea typeface="Microsoft JhengHei"/);
  assert.doesNotMatch(slides[2], /typeface="PMingLiU"/);
  const css = themeCss();
  assert.match(css, /--cp-cover: #000066/);
  assert.match(css, /--cp-display-font: "Cambria", "PMingLiU", "Songti TC"/);
});

test('全球藍原色經過圖表、HTML 數表與 PowerPoint 原生輸出', async () => {
  const { color } = loadTokens();
  assert.deepEqual(color.categorical, ['#28317B', '#04696C', '#4A8F5B', '#D09FE2']);
  assert.deepEqual(color.ordered, ['#D1DDF7', '#9DB1D9', '#7285BB', '#4B5A9C', '#28317B']);
  const { tableRule, ...legacy } = color;
  assert.match(themeCss({ ...loadTokens(), color: legacy }), /--cp-table-rule: #28317B;/);

  const share = { kind: 'share', categories: ['甲', '乙', '丙', '丁'], rows: [{ label: '本期', values: [35, 25, 25, 15] }], source: '虛構資料' };
  const table = {
    kind: 'table', columns: [{ name: '項目' }, { name: '變化', type: 'delta', better: 'lower' }],
    rows: [['甲', -2], ['乙', 3], ['丙', 0], ['丁', null]], emphasis: '甲', total: ['合計', 1],
  };
  const { html } = buildReport({ title: '配色', message: '比較', sections: [{ claim: '本期結果', blocks: [
    { type: 'chart', title: '四類比較', chart: share }, { ...table, type: 'table' },
  ] }] });
  assert.match(html, /fill="#4A8F5B"/);
  assert.match(html, /fill="#D09FE2"/);
  assert.match(html, /style="color:#015224">−2<\/td>/);
  assert.match(html, /style="color:#9D2324">＋3<\/td>/);
  assert.match(html, /style="color:#4A4A4A">±0<\/td>/);
  assert.match(html, /<td class="num"><span class="missing">未提供<\/span><\/td>/);
  assert.match(html, /tr\.total > \* \{ border-top: 1px solid var\(--cp-ink\); \}/);

  const svg = render(table).svg;
  assert.match(svg, /fill="#28317B"[^>]*>甲<\/text>/);
  assert.match(svg, /fill="#015224"[^>]*>−2<\/text>/);
  const { buffer } = await build({ title: '配色', pages: [share, table].map((visual) => ({
    type: 'evidence', claim: '本期結果', visual, sources: { source: '虛構資料' },
  })) });
  const zip = await JSZip.loadAsync(buffer);
  const chart = await zip.file('ppt/charts/chart1.xml').async('string');
  const slide = await zip.file('ppt/slides/slide2.xml').async('string');
  for (const hex of ['4A8F5B', 'D09FE2']) assert.match(chart, new RegExp(`val="${hex}"`));
  for (const hex of ['28317B', '015224', '9D2324', 'F6F7FA']) assert.match(slide, new RegExp(`val="${hex}"`));
});
