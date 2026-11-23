import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import JSZip from 'jszip';
import { build, validateStory } from '../scripts/pptx.js';
import { check } from '../evals/check.mjs';
import { loadTokens } from '../scripts/tokens.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixtures = join(root, 'tests', 'fixtures');
const sources = { source: '虛構策略原稿' };

test('簡報字級採標準商務階層且嚴格遞減：40/36/24/18/16/14/12/11 pt', () => {
  const { type } = loadTokens();
  const pt = (k) => (typeof type[k] === 'number' ? type[k] : type[k].px) / 2;
  assert.deepEqual(
    [pt('display'), pt('section'), pt('title'), pt('sub'), pt('body'), pt('chart'), pt('tableBody'), pt('label'), pt('source'), pt('minimum')],
    [40, 36, 24, 18, 16, 14, 14, 12, 11, 11],
  );
  assert.ok(pt('sub') > pt('body'), '次標題大於內文');
  assert.ok(pt('body') > pt('chart'), '內文大於圖表字級');
  assert.ok(pt('label') > pt('source'), '標籤大於頁底來源註解');
});

test('用色紀律：標題深海藍、內文近黑不染藍、focus 欄位改用柔和暖底與頂部色條', async () => {
  const story = {
    title: '用色測試',
    pages: [
      { type: 'process', claim: '流程步驟', sources, notes: '說明步驟。', visual: { focus: 1, steps: [{ heading: '準備', body: '盤點資料' }, { heading: '執行', body: '專注核心正文' }, { heading: '覆盤', body: '確認成效' }] } },
      { type: 'columns', claim: '三支柱定位', sources, notes: '說明定位。', visual: { focus: 1, items: [{ heading: '左欄', body: '左說明' }, { kicker: '核心', heading: '焦點中欄', body: '中欄說明' }, { heading: '右欄', body: '右說明' }] } },
      { type: 'list', claim: '三項優先工作', sources, notes: '說明清單。', visual: { focus: 0, items: [{ tag: '先', heading: '焦點項目', body: '重點說明' }, { heading: '次項', body: '補充' }, { heading: '末項', body: '收尾' }] } },
    ],
  };
  const { buffer, warnings } = await build(story);
  assert.deepEqual(warnings, []);
  const zip = await JSZip.loadAsync(buffer);
  const s1 = await zip.file('ppt/slides/slide1.xml').async('string');
  const s2 = await zip.file('ppt/slides/slide2.xml').async('string');
  const s3 = await zip.file('ppt/slides/slide3.xml').async('string');
  const shapeOf = (xml, text) => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map((m) => m[0]).find((sp) => sp.includes(`<a:t>${text}</a:t>`));
  // Process focus body uses dark ink (0D1330), never focus blue (1E3A7A).
  assert.match(shapeOf(s1, '專注核心正文'), /val="0D1330"/);
  assert.doesNotMatch(shapeOf(s1, '專注核心正文'), /val="1E3A7A"/);
  // Columns focus uses warm surface fill (F6F5F1) + dark heading, not blue heading wall.
  assert.match(s2, /val="F6F5F1"/);
  assert.match(shapeOf(s2, '焦點中欄'), /val="0D1330"/);
  // List focus uses dark heading with left focus bar.
  assert.match(shapeOf(s3, '焦點項目'), /val="0D1330"/);
  assert.match(s3, /val="1E3A7A"/);
});

test('高階主管混合模式：present 支援雙層重點、panels（含 figure 與 points）、scorecard、雙層遞進 flow 與 0.25s build 動畫', async () => {
  const story = {
    title: '2027 策略簡報',
    pages: [
      {
        type: 'scorecard',
        kicker: '市場座標',
        claim: '核心規模達 600 億，三條商品線分工明確',
        build: true,
        sources,
        notes: '先看座標數字，再帶下方三張策略判讀卡。',
        visual: {
          focus: 1,
          metrics: [
            { label: '總保費', value: 600, unit: '億', prev: 500, mode: 'pct', better: 'higher' },
            { label: '新契約件數', value: 120, unit: '萬件', note: '較前期成長' },
            { label: '缺值指標', value: null },
          ],
          cards: [
            { kicker: '基石', heading: '既有客群深耕', body: '穩定續保動能。' },
            { kicker: '主力', heading: '核心保障升級', body: '補齊缺口擴大價值。' },
            { kicker: '布局', heading: '退休現金流', body: '提前銜接長尾需求。' },
          ],
        },
      },
      {
        type: 'evidence',
        kicker: '結構分析',
        claim: '新單搭售占 97%，成為主要動能',
        build: true,
        sources,
        notes: '圖表先出現，再逐點淡入右欄重點。',
        visual: { kind: 'rank', rows: [{ label: '新單', value: 97 }, { label: '舊單', value: 3 }], focus: '新單' },
        takeaway: '關鍵在成交當下搭售，而非回頭加保。',
        points: [
          { lead: '新單成交搭售占絕對大宗', body: '97% 來自新單當下配置，效率最高。' },
          { lead: '舊保單加保比例偏低', body: '僅占 3%，不宜作為主要增長來源。' },
        ],
      },
      {
        type: 'panels',
        kicker: '雙視角',
        claim: '流程圖與執行重點並排對照',
        build: true,
        sources,
        notes: '左邊先顯示自畫圖，右邊再逐項呈現重點。',
        visual: {
          split: [3, 2],
          items: [
            { title: '作業流程', visual: { figure: 'figure.svg' }, note: '收件 12 件，審核後剩 8 件。' },
            {
              title: '執行抓手',
              visual: {
                points: [
                  { lead: '第一關卡先收斂', body: '把 12 件收件直接標準化。' },
                  { lead: '審核後保留 8 件', body: '縮短交接等待時間。' },
                ],
              },
            },
          ],
        },
      },
      {
        type: 'flow',
        kicker: '延伸方向',
        claim: '從現有基礎往明年方向延伸',
        build: true,
        sources,
        notes: '上層放現有基礎，箭頭指向明年延伸。',
        visual: {
          fromLabel: '現有基礎',
          toLabel: '2027 延伸',
          focus: 1,
          pairs: [
            { label: '醫療', from: '既有實支與日額組合', to: '銜接自費醫材與長照缺口' },
            { label: '資產', from: '美元利變累積基礎', to: '台幣補位與穩健配息並行' },
            { label: '通路', from: '單一商品銷售話術', to: '生命週期保障藍圖配置' },
          ],
        },
      },
    ],
  };
  const manuscript = '總保費 600 億，去年 500 億（成長 20%），新契約 120 萬件。新單 97%、舊單 3%。收件 12 件，審核後剩 8 件。2027 年三線延伸。';
  const checked = await check(story, manuscript, { baseDir: fixtures });
  assert.deepEqual(checked.warnings, []);
  const zip = await JSZip.loadAsync(checked.buffer);
  for (let n = 1; n <= 4; n++) {
    const xml = await zip.file(`ppt/slides/slide${n}.xml`).async('string');
    assert.match(xml, /dur="250"/, `第 ${n} 頁應為 250ms 淡入`);
  }
  const s1 = await zip.file('ppt/slides/slide1.xml').async('string');
  assert.ok(s1.includes('未提供：缺值指標'), 'scorecard 缺值進來源列');
  assert.match(s1, /val="F6F5F1"/, 'scorecard 頂部座標帶用暖底');
  const s4 = await zip.file('ppt/slides/slide4.xml').async('string');
  assert.ok(s4.includes('↓') && s4.includes('現有基礎') && s4.includes('2027 延伸'));
});

test('CLI --variants 一次產出動畫版、無動畫備援版與無備忘散發版（Notes=0）', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'blueprint-variants-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const storyFile = join(dir, 'story.json');
  const outFile = join(dir, 'deck.pptx');
  writeFileSync(storyFile, JSON.stringify({
    title: '三版測試',
    pages: [
      { type: 'list', claim: '重點清單', build: true, sources, notes: '講者私下提醒事項。', visual: { items: [{ heading: '甲' }, { heading: '乙' }, { heading: '丙' }] } },
    ],
  }));
  const run = spawnSync(process.execPath, ['scripts/pptx.js', storyFile, outFile, '--variants'], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const noAnim = join(dir, 'deck_無動畫.pptx');
  const noNotes = join(dir, 'deck_無備忘稿.pptx');
  assert.ok(existsSync(outFile) && existsSync(noAnim) && existsSync(noNotes));

  const mainZip = await JSZip.loadAsync(readFileSync(outFile));
  const noAnimZip = await JSZip.loadAsync(readFileSync(noAnim));
  const noNotesZip = await JSZip.loadAsync(readFileSync(noNotes));
  assert.match(await mainZip.file('ppt/slides/slide1.xml').async('string'), /<p:timing>/);
  assert.doesNotMatch(await noAnimZip.file('ppt/slides/slide1.xml').async('string'), /<p:timing>/);
  assert.ok(Object.keys(mainZip.files).some((n) => /^ppt\/notesSlides\//.test(n)));
  assert.equal(Object.keys(noNotesZip.files).filter((n) => /^ppt\/notesSlides\//.test(n)).length, 0, '無備忘稿版不可含 notesSlides');
  assert.doesNotMatch(await noNotesZip.file('ppt/slides/_rels/slide1.xml.rels').async('string'), /notesSlides/);
  assert.doesNotMatch(await noNotesZip.file('[Content_Types].xml').async('string'), /notesSlides/);
  assert.match(await noNotesZip.file('docProps/app.xml').async('string'), /<Notes>0<\/Notes>/);
});

test('驗收器軟警告：偵測舞台正文稽核腔（放行口徑層）、相鄰重複版型與連續三頁純文字', async () => {
  const manuscript = '甲 12 件，乙 8 件，樣本 20 件。';
  // 1. Audit tone on stage warns; same boilerplate in sources.more / footnotes / notes does NOT warn.
  const auditOnStage = {
    pages: [{
      type: 'statement',
      claim: '甲高於乙，惟仍須視實際核保結果為準',
      note: '不含豁免與團體保單等項目，僅供內部參考(n=20)。',
      sources,
      notes: '說明重點。',
    }],
  };
  const w1 = (await check(auditOnStage, manuscript)).warnings;
  assert.ok(w1.some((w) => /第 1 頁 claim.*口徑／免責語氣/.test(w)), w1.join('\n'));
  assert.ok(w1.some((w) => /第 1 頁 note.*口徑／免責語氣/.test(w)), w1.join('\n'));

  const auditInFooters = {
    pages: [{
      type: 'statement',
      claim: '甲明顯領先乙',
      footnotes: ['不含豁免與團體保單等項目(n=20)。'],
      sources: { ...sources, more: ['惟仍須視核保規則調整'] },
      notes: '僅供內部參考，被問到再補充。',
    }],
  };
  const wClean = (await check(auditInFooters, manuscript)).warnings;
  assert.ok(!wClean.some((w) => /口徑／免責語氣/.test(w)), wClean.join('\n'));

  // 2. Adjacent identical layout + 3 consecutive pure-text pages warn.
  const repetitive = {
    pages: [
      { type: 'list', claim: '第一頁清單', sources, notes: '講稿。', visual: { items: [{ heading: '甲' }, { heading: '乙' }, { heading: '丙' }] } },
      { type: 'list', claim: '第二頁清單', sources, notes: '講稿。', visual: { items: [{ heading: '甲' }, { heading: '乙' }, { heading: '丙' }] } },
      { type: 'statement', claim: '第三頁還是純文字', sources, notes: '講稿。' },
    ],
  };
  const w2 = (await check(repetitive, manuscript)).warnings;
  assert.ok(w2.some((w) => /第 1、2 頁連續使用相同版型（list）/.test(w)), w2.join('\n'));
  assert.ok(w2.some((w) => /第 1～3 頁連續 3 頁為純文字版型/.test(w)), w2.join('\n'));
});

test('scorecard 與 flow pairs 驗證錯誤指出精確路徑', () => {
  assert.throws(() => validateStory({ pages: [{ type: 'flow', claim: '衝突', visual: { nodes: [{ heading: '甲' }], pairs: [{ from: '舊', to: '新' }] } }] }), /兩者擇一/);
  assert.throws(() => validateStory({ pages: [{ type: 'flow', claim: '缺 to', visual: { pairs: [{ from: '舊' }] } }] }), /visual\.pairs\[0\]\.to/);
  assert.throws(() => validateStory({ pages: [{ type: 'scorecard', claim: '缺卡片', visual: { metrics: [{ label: '指標', value: 1 }], cards: [] } }] }), /visual\.cards/);
});

test('P1-1 回歸：evidence 原生表格與 build 動畫共用投影片時，所有 cNvPr id 唯一且動畫目標只指 build 形狀', async () => {
  const story = {
    title: '動畫防撞測試',
    pages: [{
      type: 'evidence',
      claim: '甲高於乙',
      build: true,
      sources,
      notes: '先看表再看重點。',
      visual: { kind: 'table', columns: [{ name: '項目', type: 'text' }, { name: '件數', type: 'number' }], rows: [['甲', 12], ['乙', 8]] },
      takeaway: '甲領先。',
      points: [{ lead: '甲達 12 件', body: '居首位。' }, { lead: '乙為 8 件', body: '次之。' }],
    }],
  };
  const { buffer } = await build(story);
  const zip = await JSZip.loadAsync(buffer);
  const slide = await zip.file('ppt/slides/slide1.xml').async('string');
  const allIds = [...slide.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g)].map((m) => m[1]);
  assert.equal(new Set(allIds).size, allIds.length, `出現重複 cNvPr id：${allIds.join(', ')}`);
  const buildIds = new Set([...slide.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"[^>]*\bname="build-\d+"/g)].map((m) => m[1]));
  const targets = [...slide.matchAll(/<p:spTgt spid="(\d+)"\/>/g)].map((m) => m[1]);
  assert.ok(targets.length > 0 && targets.every((id) => buildIds.has(id)), '動畫目標必須全部指向 build 形狀');
  const tableId = slide.match(/<p:graphicFrame>[\s\S]*?<p:cNvPr\b[^>]*\bid="(\d+)"/)?.[1];
  assert.ok(tableId && !targets.includes(tableId), '原生表格不應被當成動畫目標');
});

test('P1-2 回歸：evidence 右欄溢出警告、columns 焦點有效欄寬不重疊 takeaway、高註腳不產生負 cy', async () => {
  const manyFootnotes = Array.from({ length: 22 }, (_, i) => `註解說明第 ${i + 1} 條：這裡交代資料口徑與計算範圍。`);
  // 1. evidence right column overflow warns.
  const ev = await build({
    pages: [{
      type: 'evidence',
      claim: '右欄溢出測試',
      sources,
      visual: { kind: 'rank', rows: [{ label: '甲', value: 12 }, { label: '乙', value: 8 }] },
      takeaway: '這是一段跨兩行的結論摘要文字，佔用右欄上方高度。',
      points: Array.from({ length: 4 }, (_, i) => ({ lead: `第${i + 1}點核心領頭句夠長會換行`, body: '這裡有兩到三行詳細說明文字，用來確保四個重點總高度超出右欄可用區間。' })),
      footnotes: ['口徑備註一。', '口徑備註二。'],
    }],
  });
  assert.ok(ev.warnings.some((w) => /第 1 頁右欄內容超出可用高度/.test(w)), ev.warnings.join('\n'));

  // 2. columns focused heading wraps with effective width -> takeaway sits below body without overlap.
  const col = await build({
    pages: [{
      type: 'columns',
      claim: '焦點欄寬測試',
      sources,
      takeaway: '頁底收斂重點句。',
      visual: {
        focus: 1,
        items: [
          { heading: '左欄', body: '短說明' },
          { heading: '十四個中文字的焦點標題剛好換行', body: '中欄第一行說明\n中欄第二行說明' },
          { heading: '右欄', body: '短說明' },
        ],
      },
    }],
  });
  const colZip = await JSZip.loadAsync(col.buffer);
  const colSlide = await colZip.file('ppt/slides/slide1.xml').async('string');
  const boxes = colSlide.split('<p:sp>').slice(1).map((sp) => ({
    y: Number(sp.match(/<a:off x="\d+" y="(-?\d+)"\/>/)?.[1]),
    h: Number(sp.match(/<a:ext cx="\d+" cy="(-?\d+)"\/>/)?.[1]),
    text: [...sp.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join(''),
  }));
  const bodyBox = boxes.find((b) => b.text.includes('中欄第一行說明'));
  const takeawayBox = boxes.find((b) => b.text === '頁底收斂重點句。');
  assert.ok(takeawayBox.y >= bodyBox.y + bodyBox.h, `takeaway (${takeawayBox.y}) 不應壓到焦點欄正文底 (${bodyBox.y + bodyBox.h})`);

  // 3. Heavy footnotes on scorecard and panels warn and never write negative cy into XML.
  const tight = await build({
    pages: [
      {
        type: 'scorecard',
        claim: '極端註腳測試',
        sources,
        footnotes: manyFootnotes,
        takeaway: '收斂句。',
        visual: { metrics: [{ label: '甲', value: 1 }, { label: '乙', value: 2 }], cards: [{ heading: '卡一', body: '文一' }, { heading: '卡二', body: '文二' }] },
      },
      {
        type: 'panels',
        claim: '極端註腳雙格',
        sources,
        footnotes: manyFootnotes,
        visual: { items: [{ title: '左', visual: { kind: 'rank', rows: [{ label: '甲', value: 1 }] } }, { title: '右', visual: '說明文字。' }] },
      },
    ],
  });
  assert.ok(tight.warnings.some((w) => /第 1 頁.*高度不足/.test(w)), tight.warnings.join('\n'));
  assert.ok(tight.warnings.some((w) => /第 2 頁.*高度不足/.test(w)), tight.warnings.join('\n'));
  const tightZip = await JSZip.loadAsync(tight.buffer);
  for (const n of [1, 2]) {
    const xml = await tightZip.file(`ppt/slides/slide${n}.xml`).async('string');
    assert.doesNotMatch(xml, /cy="-/, `第 ${n} 頁不可含負高度 cy`);
  }
});

test('P1-3 回歸：claim 核對對齊實際顯示值（四捨五入、panels share 比例、SVG title 不可見、互斥格型報錯）', async (t) => {
  // 1. scorecard digits: 0 rounds 12.8 -> 13; claim "12.8" warns while "13" passes.
  const sc = (claim) => ({
    pages: [{
      type: 'scorecard', claim, sources, notes: '說明。',
      visual: { metrics: [{ label: '指標', value: 12.8, digits: 0 }, { label: '次要', value: 5 }], cards: [{ heading: '甲', body: '文' }, { heading: '乙', body: '文' }] },
    }],
  });
  const wRaw = (await check(sc('指標為 12.8'), '指標 12.8（約 13），次要 5。')).warnings;
  assert.ok(wRaw.some((w) => /claim.*12\.8/.test(w)), wRaw.join('\n'));
  const wDisp = (await check(sc('指標為 13'), '指標 12.8（約 13），次要 5。')).warnings;
  assert.ok(!wDisp.some((w) => /claim/.test(w)), wDisp.join('\n'));

  // 2. panels share chart computes 33% from 1 and 2 -> claim "33%" passes without warning.
  const pShare = await check({
    pages: [{
      type: 'panels', claim: '甲占 33%', sources, notes: '說明比例。',
      visual: { items: [{ title: '組成', visual: { kind: 'share', categories: ['甲', '乙'], rows: [{ label: '本期', values: [1, 2] }] } }, { title: '說明', visual: '兩類合計。' }] },
    }],
  }, '甲 1 件、乙 2 件，甲占 33%。');
  assert.ok(!pShare.warnings.some((w) => /claim/.test(w)), pShare.warnings.join('\n'));

  // 3. panels rejects mixing kind + points.
  assert.throws(() => validateStory({
    pages: [{ type: 'panels', claim: '混填', sources, visual: { items: [{ title: '左', visual: { kind: 'rank', rows: [{ label: '甲', value: 1 }], points: ['重疊'] } }, { title: '右', visual: '文' }] } }],
  }), /擇一填寫/);

  // 4. SVG <title> alone does NOT satisfy visible claim number (still checked against manuscript).
  const dir = mkdtempSync(join(tmpdir(), 'blueprint-svg-title-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'title-only.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><title>12</title><text x="10" y="50">僅文字</text></svg>');
  const wTitle = (await check({
    pages: [{ type: 'evidence', claim: '共 12 件', sources, notes: '說明。', visual: { figure: 'title-only.svg' } }],
  }, '共 12 件。', { baseDir: dir })).warnings;
  assert.ok(wTitle.some((w) => /claim.*12/.test(w)), wTitle.join('\n'));
});

test('P2 回歸：prev:null 回退 note、delta 溢位不產 ＋null、軟警告覆蓋 panels/全形/章節重置、含點路徑 --variants、暖底全字色對比與舊 cover 層相容', async (t) => {
  const { delta } = await import('../scripts/core.js');
  const { checkDesign } = await import('../scripts/check-design.js');

  // 1. delta overflow returns null; scorecard prev: null shows note without better warning.
  assert.equal(delta(1e308, -1e308), null);
  const scNull = await build({
    pages: [{
      type: 'scorecard', claim: '前期缺值回退', sources,
      visual: { metrics: [{ label: '新指標', value: 10, prev: null, note: '今年首度統計' }, { label: '基準', value: 5 }], cards: [{ heading: '甲', body: '文' }, { heading: '乙', body: '文' }] },
    }],
  });
  assert.deepEqual(scNull.warnings, []);
  const scXml = await (await JSZip.loadAsync(scNull.buffer)).file('ppt/slides/slide1.xml').async('string');
  assert.ok(scXml.includes('今年首度統計'));

  // 2. Soft warnings: fullwidth audit tone + panels audit tone; section breaks reset rhythm & pure-text streak; string KPI columns not pure text.
  const pAudit = (await check({
    pages: [{
      type: 'panels', claim: '雙視角', sources, notes: '講稿。',
      visual: { items: [{ title: '說明', visual: '結果如下（ｎ＝２０）。' }, { title: '重點', visual: { points: [{ lead: '提醒', body: '僅供內部參考。' }] } }] },
    }],
  }, '樣本 20 件。')).warnings;
  assert.ok(pAudit.some((w) => /visual\.items\[0\]\.visual.*口徑／免責語氣/.test(w)), pAudit.join('\n'));
  assert.ok(pAudit.some((w) => /visual\.items\[1\]\.visual\.points.*口徑／免責語氣/.test(w)), pAudit.join('\n'));

  const resetDeck = (await check({
    pages: [
      { type: 'list', kicker: '章一', claim: '清單一', sources, notes: '講稿。', visual: { items: [{ heading: '甲' }, { heading: '乙' }, { heading: '丙' }] } },
      { type: 'section', kicker: '章二', claim: '第二章', sources, notes: '過場。' },
      { type: 'list', kicker: '章二', claim: '清單二', sources, notes: '講稿。', visual: { items: [{ heading: '甲' }, { heading: '乙' }, { heading: '丙' }] } },
      { type: 'columns', kicker: '章二', claim: '大字 KPI 並列', sources, notes: '講稿。', visual: { items: [{ value: '1,200 件', heading: '甲' }, { value: '800 件', heading: '乙' }] } },
      { type: 'statement', kicker: '章二', claim: '收斂判斷', sources, notes: '講稿。' },
    ],
  }, '甲 1,200 件，乙 800 件。')).warnings;
  assert.ok(!resetDeck.some((w) => /連續使用相同版型|連續 3 頁為純文字/.test(w)), resetDeck.join('\n'));

  // 3. --variants with dot-containing directory and extensionless filename + multi-page Notes=0 check.
  const baseDir = mkdtempSync(join(tmpdir(), 'blueprint-v1.2-'));
  t.after(() => rmSync(baseDir, { recursive: true, force: true }));
  const dotDir = join(baseDir, 'release.2026');
  const storyFile = join(baseDir, 'story.json');
  writeFileSync(storyFile, JSON.stringify({
    title: '多頁變體',
    pages: [
      { type: 'list', claim: '第一頁', build: true, sources, notes: '備忘一', visual: { items: [{ heading: '甲' }, { heading: '乙' }, { heading: '丙' }] } },
      { type: 'statement', claim: '第二頁', sources, notes: '備忘二' },
    ],
  }));
  const outNoExt = join(dotDir, 'deck');
  const r = spawnSync(process.execPath, ['scripts/pptx.js', storyFile, outNoExt, '--variants'], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(outNoExt) && existsSync(join(dotDir, 'deck_無動畫.pptx')) && existsSync(join(dotDir, 'deck_無備忘稿.pptx')));
  const noNotesZip = await JSZip.loadAsync(readFileSync(join(dotDir, 'deck_無備忘稿.pptx')));
  for (const n of [1, 2]) assert.doesNotMatch(await noNotesZip.file(`ppt/slides/_rels/slide${n}.xml.rels`).async('string'), /notesSlides/);
  assert.doesNotMatch(await noNotesZip.file('[Content_Types].xml').async('string'), /notesSlides/);

  // 4. checkDesign catches low-contrast surfaceWarm on textSecondary/focus.
  const badWarm = structuredClone(loadTokens());
  badWarm.color.surfaceWarm = '#888888';
  const checked = checkDesign(badWarm);
  assert.ok(checked.failures.some((f) => /textSecondary.*surfaceWarm/.test(f)), checked.failures.join('\n'));
  assert.ok(checked.failures.some((f) => /focus.*surfaceWarm/.test(f)), checked.failures.join('\n'));

  // 5. Legacy custom layer with color.cover (no sectionPaper) keeps dark section slide.
  const legacyDir = mkdtempSync(join(tmpdir(), 'blueprint-legacy-sec-'));
  t.after(() => rmSync(legacyDir, { recursive: true, force: true }));
  const legacyTokens = structuredClone(loadTokens());
  delete legacyTokens.color.sectionPaper;
  const legacyFile = join(legacyDir, 'legacy.json');
  writeFileSync(legacyFile, JSON.stringify(legacyTokens));
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import JSZip from 'jszip';
    import { build } from './scripts/pptx.js';
    const { buffer } = await build({ title: '舊層', pages: [{ type: 'section', kicker: '甲', claim: '章節甲' }] });
    const zip = await JSZip.loadAsync(buffer);
    console.log(await zip.file('ppt/slides/slide1.xml').async('string'));
  `], { cwd: root, env: { ...process.env, BLUEPRINT_TOKENS: legacyFile }, encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, new RegExp(`<p:bg>[\\s\\S]*?val="${legacyTokens.color.dark.slice(1).toUpperCase()}"`));
});
