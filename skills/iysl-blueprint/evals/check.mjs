// Validate a story against its source manuscript, then build it with the production renderer.
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { build, validateStory, resolveStory, deckCategories } from '../scripts/pptx.js';
import { isFigure, figureText, figureVisibleText } from '../scripts/figure.js';
import { normalize, numbers, found, calculations, calculationPattern } from './numbers.mjs';
import { isMain, rerunForMode } from '../scripts/main.js';
import { prepare, delta, formatValue, shownDigits } from '../scripts/core.js';

// Stage-layer audit/disclaimer boilerplate that belongs in sources.more, footnotes, or speaker notes.
const AUDIT_TONE_RE = /(?:惟仍須|惟仍需|惟須視|惟應視|僅供內部參考|僅供參考|實際仍依[^，。；]{0,16}為準|不含(?:豁免|團體|轉換|附約)[^，。；]*等|排除[^，。；]{1,12}後之|\(\s*[nN]\s*=\s*[\d,]+\s*\))/;

function panelCellKind(cell) {
  const v = cell?.visual;
  if (typeof v === 'string') return 'text';
  if (isFigure(v)) return 'figure';
  if (v && typeof v === 'object' && v.kind) return v.kind;
  if (v && typeof v === 'object' && Array.isArray(v.points)) return 'points';
  return 'list';
}

function visualSignature(page) {
  if (page.type === 'evidence') return isFigure(page.visual) ? 'evidence:figure' : `evidence:${page.visual?.kind ?? ''}`;
  if (page.type === 'panels') return `panels:${(page.visual?.items ?? []).map(panelCellKind).join('+')}`;
  if (page.type === 'flow') return page.visual?.pairs ? 'flow:bridge' : 'flow:nodes';
  return page.type;
}

function isPureTextPage(page) {
  if (page.type === 'statement' || page.type === 'list') return true;
  if (page.type === 'columns') {
    return !(page.visual?.items ?? []).some((it) => typeof it?.value === 'number' || (typeof it?.value === 'string' && it.value.trim().length > 0));
  }
  return false;
}

function stageProseEntries(page) {
  const out = [];
  for (const field of ['claim', 'note', 'takeaway', 'points']) {
    if (page[field] != null) out.push(...visibleText(page[field], field));
  }
  const v = page.visual;
  if (!v || typeof v !== 'object') return out;
  for (const field of ['lead', 'body']) if (v[field] != null) out.push(...visibleText(v[field], `visual.${field}`));
  if (page.type === 'panels' && Array.isArray(v.items)) {
    v.items.forEach((cell, idx) => {
      if (!cell || typeof cell !== 'object') return;
      if (cell.title != null) out.push(...visibleText(cell.title, `visual.items[${idx}].title`));
      if (cell.note != null) out.push(...visibleText(cell.note, `visual.items[${idx}].note`));
      const cv = cell.visual;
      if (typeof cv === 'string') out.push(...visibleText(cv, `visual.items[${idx}].visual`));
      else if (cv && typeof cv === 'object') {
        if (Array.isArray(cv.points)) out.push(...visibleText(cv.points, `visual.items[${idx}].visual.points`));
        if (Array.isArray(cv.items)) cv.items.forEach((it, k) => {
          if (!it || typeof it !== 'object') return;
          for (const f of ['heading', 'body']) if (it[f] != null) out.push(...visibleText(it[f], `visual.items[${idx}].visual.items[${k}].${f}`));
        });
      }
    });
    return out;
  }
  for (const [listKey, fields] of [['items', ['heading', 'body']], ['cards', ['heading', 'body']], ['nodes', ['heading', 'body']], ['pairs', ['from', 'to']], ['steps', ['heading', 'body']]]) {
    if (!Array.isArray(v[listKey])) continue;
    v[listKey].forEach((item, idx) => {
      if (!item || typeof item !== 'object') return;
      for (const f of fields) if (item[f] != null) out.push(...visibleText(item[f], `visual.${listKey}[${idx}].${f}`));
    });
  }
  return out;
}

function modelPictureNumbers(spec, categoryOrder) {
  const model = prepare(spec, { categoryOrder });
  const labels = visibleText(model, 'visual').filter(({ path }) => /\.(?:text|texts|\w*Text|label|name|x|periods|rowLabels|colLabels|xLabel|yLabel)(?:\[\d+\])?$/.test(path)
    && !(spec.kind === 'slope' && spec.native !== false && path.endsWith('.delta.text')));
  const out = labels.flatMap(({ text }) => numbers(text));
  if (model.kind === 'funnel') for (const step of model.steps) {
    if (step.lossText !== null) out.push(...numbers(step.loss));
  }
  return out;
}

function formattedVisualForClaim(page) {
  const v = page.visual;
  if (!v || typeof v !== 'object') return v;
  const formatItem = (it) => {
    if (!it || typeof it !== 'object') return it;
    if (typeof it.value !== 'number') return it;
    return { ...it, value: formatValue(it.value, { digits: shownDigits(it.digits, it.value) }) ?? '' };
  };
  if (page.type === 'numbers' || page.type === 'summary' || page.type === 'columns') {
    return { ...v, items: (v.items ?? []).map(formatItem) };
  }
  if (page.type === 'scorecard') {
    return { ...v, metrics: (v.metrics ?? []).map(formatItem) };
  }
  if (page.type === 'kpi') {
    return {
      ...v,
      main: v.main ? { ...formatItem(v.main), benchmarks: (v.main.benchmarks ?? []).map(formatItem) } : v.main,
      secondary: v.secondary?.map(formatItem),
    };
  }
  return v;
}

function visibleText(value, path) {
  if (typeof value === 'number' || typeof value === 'string') return [{ text: String(value), path }];
  if (Array.isArray(value)) return value.flatMap((v, i) => visibleText(v, `${path}[${i}]`));
  if (!value || typeof value !== 'object') return [];
  // A figure shows the text inside its SVG; its file name and markup are not on screen.
  if (isFigure(value)) return [{ text: figureText(value.figure.svg), path: `${path}.figure` }];
  // digits and numeric focus indices control rendering; neither is a visible measurement.
  return Object.entries(value).flatMap(([key, v]) => key === 'digits' || key === 'focus' && typeof v === 'number' ? [] : visibleText(v, `${path}.${key}`));
}

export async function check(story, script, { baseDir = '.' } = {}) {
  validateStory(story);
  story = resolveStory(story, { baseDir });
  if (typeof script !== 'string' || !script.trim()) throw new Error('script.md 必須是非空文字稿；請提供原始內容。');
  const original = numbers(script);
  const warnings = [];
  const categoryOrder = deckCategories(story);
  if (original.some((n) => !n.valid)) throw new Error('原稿含無法以有限數字精確表示的數值；請核對科學記號或調整單位，保留原始資料。');
  for (const field of ['title', 'date']) {
    for (const { text, path } of visibleText(story[field], field)) {
      for (const value of numbers(text)) {
        if (!found(value, original)) throw new Error(`根層 ${path}：原稿找不到數字 ${value.text}；請改回原稿數字，未提供日期時省略 date。`);
      }
    }
  }
  for (const [i, page] of story.pages.entries()) {
    const n = i + 1;
    if (typeof page.sources?.source !== 'string' || !page.sources.source.trim()) {
      throw new Error(`第 ${n} 頁 sources.source 缺少資料來源；請填文字稿名稱，虛構稿也要註明。`);
    }
    if (!original.length && page.type === 'evidence' && page.visual.kind !== 'table' && !isFigure(page.visual)) {
      throw new Error(`第 ${n} 頁：文字稿沒有可核對的數字，不能放量化圖表；請改用 statement、compare、close 或純文字 table。`);
    }
    if (!original.length && page.type === 'panels' && page.visual.items.some((cell) => cell.visual && typeof cell.visual === 'object' && cell.visual.kind && cell.visual.kind !== 'table')) {
      throw new Error(`第 ${n} 頁：文字稿沒有可核對的數字，panels 內不能放量化圖表；請改用文字、清單、重點、自畫圖或純文字 table。`);
    }
    const allowed = [...original, ...calculations(page, original, n)];
    // panels' split is a width ratio, not a measurement.
    const shown = (field) => field === 'visual' && page.type === 'panels' ? { ...page.visual, split: undefined } : page[field];
    // Footnote markers (1)…(N) are references, not measurements; a marker past the page's footnote count is still checked.
    const marks = page.footnotes?.length ?? 0;
    const unmark = (text) => normalize(text).replace(/\((\d+)\)/g, (m, d) => Number(d) >= 1 && Number(d) <= marks ? ' ' : m);
    const visible = [
      ...['claim', 'kicker', 'lede', 'note', 'takeaway', 'points', 'footnotes'].map((field) => [field, page[field]]),
      ...['value', 'label', 'unit'].map((field) => [`metric.${field}`, page.metric?.[field]]),
      // period holds date ranges such as 2025.01–2025.12; dates are reviewed by hand, not as measured values.
      ...['source', 'unit', 'more'].map((field) => [`sources.${field}`, page.sources[field]]),
      ['visual', shown('visual')],
    ].flatMap(([path, value]) => visibleText(value, path));
    for (const { text, path } of visible) {
      // 已驗算的片段由算式語法處理正負號，避免將減號誤認為原稿負數。
      const unverified = path.startsWith('sources.more[') ? unmark(text).replace(calculationPattern, '') : unmark(text);
      for (const value of numbers(unverified)) {
        if (!found(value, allowed)) {
          throw new Error(`第 ${n} 頁 ${path}：原稿找不到數字 ${value.text}；請改回原稿數字，或在當頁 notes／sources.more 寫出可核對的加減算式（如「計算：1200 + 800 = 2000」）。`);
        }
      }
    }
    const fields = ['visual', 'lede', 'takeaway', 'points', 'footnotes'];
    if (page.type === 'evidence') fields.push('metric');
    if (['cover', 'section', 'statement', 'evidence'].includes(page.type)) fields.push('note');
    const customVisual = page.type === 'evidence' || page.type === 'panels';
    const picture = fields.filter((field) => field !== 'visual' || !customVisual)
      .flatMap((field) => {
        if (field === 'visual') return visibleText(formattedVisualForClaim(page), 'visual');
        if (field === 'metric' && typeof page.metric?.value === 'number') {
          return visibleText({ ...page.metric, value: formatValue(page.metric.value, { digits: shownDigits(page.metric.digits, page.metric.value) }) ?? '' }, 'metric');
        }
        return visibleText(shown(field), field);
      })
      .filter(({ path }) => !/\.(?:focus|digits|source|period|prev)(?:[.\[]|$)/.test(path))
      .flatMap(({ text }) => numbers(text));
    if (page.type === 'evidence') {
      if (isFigure(page.visual)) picture.push(...numbers(figureVisibleText(page.visual.figure.svg)));
      else picture.push(...modelPictureNumbers(page.visual, categoryOrder));
    } else if (page.type === 'panels') {
      for (const cell of page.visual.items) {
        for (const f of ['title', 'note']) if (cell[f] != null) picture.push(...numbers(String(cell[f])));
        const cv = cell.visual;
        if (isFigure(cv)) picture.push(...numbers(figureVisibleText(cv.figure.svg)));
        else if (cv && typeof cv === 'object' && cv.kind) picture.push(...modelPictureNumbers(cv, categoryOrder));
        else picture.push(...visibleText(cv, 'visual').filter(({ path }) => !/\.(?:focus|digits|source|period|prev)(?:[.\[]|$)/.test(path)).flatMap(({ text }) => numbers(text)));
      }
    }
    if (page.type === 'numbers' || page.type === 'summary' || page.type === 'scorecard') for (const item of (page.type === 'scorecard' ? page.visual.metrics : page.visual.items)) {
      if (typeof item.value !== 'number' || typeof item.prev !== 'number') continue;
      const change = delta(item.prev, item.value, { better: item.better ?? 'higher', mode: item.mode ?? 'abs', digits: shownDigits(item.digits, item.prev, item.value), suffix: item.deltaSuffix ?? '' });
      const labels = numbers(change?.text ?? '');
      picture.push(...labels, ...labels.map((n) => ({ ...n, value: Math.abs(n.value) })));
    }
    for (const value of numbers(unmark(page.claim))) {
      if (!found(value, picture)) warnings.push(`第 ${n} 頁 claim：數字 ${value.text} 未出現在當頁畫面；請補入 visual／metric／lede／body，讓主張與畫面可核對。`);
    }
    // Soft warning: keep audit / legal boilerplate off stage prose (belongs in sources.more, footnotes, or speaker notes).
    for (const { text, path } of stageProseEntries(page)) {
      const m = normalize(text).match(AUDIT_TONE_RE);
      if (m) warnings.push(`第 ${n} 頁 ${path}：偵測到口徑／免責語氣「${m[0]}」，建議移至 sources.more、footnotes 或 notes，讓舞台正文維持主管決策語氣。`);
    }
    const noteLines = (Array.isArray(page.notes) ? page.notes : [page.notes ?? '']).flatMap((text) => normalize(text).split(/\r\n|\r|\n/));
    // A read deck has no presenter: the build warns when an evidence page's right column is blank instead of asking for speaker notes.
    if (story.mode !== 'read' && page.type !== 'cover' && !noteLines.some((line) => line.trim() && !/^(?:計算|算法)\s*:/.test(line.trim()))) {
      warnings.push(`第 ${n} 頁 notes：缺少講稿或只有計算行；請另寫 1～3 句要說的話與資料限制。`);
    }
  }
  // Visual-first & layout-rhythm soft checks across contiguous content slides; structural dividers reset streaks.
  let prevContent = null, textRun = [];
  for (let i = 0; i < story.pages.length; i++) {
    const page = story.pages[i], n = i + 1;
    if (['cover', 'section', 'close'].includes(page.type)) {
      prevContent = null;
      textRun = [];
      continue;
    }
    const curSig = visualSignature(page);
    if (prevContent && curSig === prevContent.sig) {
      warnings.push(`第 ${prevContent.n}、${n} 頁連續使用相同版型（${curSig}）：建議交錯搭配圖表、panels、scorecard 或 flow 拉開視覺節奏。`);
    }
    prevContent = { n, sig: curSig };
    if (isPureTextPage(page)) {
      textRun.push(n);
      if (textRun.length === 3) {
        warnings.push(`第 ${textRun[0]}～${textRun[2]} 頁連續 3 頁為純文字版型：建議至少將一頁轉為圖表、panels、scorecard 或結構視覺，讓重點一眼可見。`);
      }
    } else {
      textRun = [];
    }
  }
  const result = await build(story);
  return { ...result, warnings: [...result.warnings, ...warnings], pages: story.pages.length };
}

if (isMain(import.meta.url)) {
  const [storyFile, scriptFile] = process.argv.slice(2);
  if (!storyFile || !scriptFile) {
    console.error('用法：node evals/check.mjs story.json script.md');
    process.exitCode = 2;
  } else {
    try {
      let story;
      try { story = JSON.parse(readFileSync(storyFile, 'utf8')); }
      catch { throw new Error(`無法讀取 ${storyFile} 為 JSON；請確認路徑、雙引號與逗號。`); }
      if (rerunForMode(story)) process.exit();
      let script;
      try { script = readFileSync(scriptFile, 'utf8'); }
      catch { throw new Error(`無法讀取文字稿 ${scriptFile}；請確認檔案路徑。`); }
      const result = await check(story, script, { baseDir: dirname(storyFile) });
      for (const warning of result.warnings) console.error(`警告：${warning}`);
      console.log(`通過：${result.pages} 頁，PowerPoint 建檔成功；${result.warnings.length} 項警告。請再逐頁核對語意與預覽。`);
    } catch (error) {
      console.error(`驗收失敗：${error.message}`);
      process.exitCode = 1;
    }
  }
}
