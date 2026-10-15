import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { build } from '../scripts/pptx.js';
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
