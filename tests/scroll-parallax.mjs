// Run with Node 22+: node tests/scroll-parallax.mjs
// Set CHROME_PATH when Chromium is not installed in a standard location.
// No dependencies: drive headless Chromium through its DevTools protocol.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chromePath = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync);
assert.ok(chromePath, 'Set CHROME_PATH to a Chromium browser executable.');

const baselineOption = process.argv.find(arg => arg.startsWith('--baseline='));
const baselineRef = baselineOption?.slice(11);
const compareHead = Boolean(baselineRef);
const control = process.argv.includes('--control');
const profileSkills = process.argv.includes('--profile-skills');
const profileOutro = process.argv.includes('--profile-outro');
const profileSection = profileOutro ? 'outro' : profileSkills ? 'skills' : undefined;
const viewportOption = process.argv.find(arg => arg.startsWith('--viewport='));
const viewports = viewportOption ? [viewportOption.slice(11).split('x').map(Number)]
  : profileSection ? [[1440, 900], [390, 844]]
  : [[1440, 900], [390, 844], [844, 390], [768, 1024]];
const baseline = compareHead ? Object.fromEntries(
  ['index.html', 'styles.css', 'scripts/scripts.js'].map(file => [file,
    execFileSync('git', ['show', `${baselineRef}:public/${file}`], { cwd: root, encoding: 'utf8' }),
  ])
) : {};
const server = http.createServer(async (req, res) => {
  try {
    const [, variant, ...parts] = new URL(req.url, 'http://localhost').pathname.split('/');
    const file = parts.join('/') || 'index.html';
    const resolved = path.resolve(root, 'public', file);
    assert.ok(resolved.startsWith(path.join(root, 'public') + path.sep));
    let body = variant === 'baseline' && baseline[file] !== undefined
      ? baseline[file] : await readFile(resolved);
    if (file === 'scripts/logging.js') body = ''; // Keep analytics out of local tests.
    if (file === 'index.html') {
      body = body.toString().replace(/<script async src="https:[^>]+><\/script>/, '');
    }
    // Simulate a browser without CSS timelines, exercising the actual GSAP fallback.
    if ((variant === 'fallback' || control) && file === 'styles.css') {
      body = body.toString().replace(/^@supports .*--parallax.*\{$/m,
        '@supports (unsupported-parallax: yes) {');
    }
    if ((variant === 'fallback' || control) && file === 'scripts/scripts.js') {
      body = 'const CSS = { supports: () => false };\n' + body;
    }
    const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
      '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif', '.ttf': 'font/ttf' };
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const profile = await mkdtemp(path.join(os.tmpdir(), 'portfolio-parallax-'));
const chrome = spawn(chromePath, [
  '--headless', '--no-first-run', '--no-default-browser-check',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', 'about:blank',
], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
const endpoint = await new Promise((resolve, reject) => {
  let stderr = '';
  chrome.stderr.on('data', chunk => {
    stderr += chunk;
    const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
    if (match) resolve(match[1]);
  });
  chrome.once('error', reject);
  chrome.once('exit', code => reject(new Error(`Chromium exited: ${code}\n${stderr}`)));
});
const ws = new WebSocket(endpoint);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});
let nextId = 0;
let traceState;
let layerState;
const pending = new Map();
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Tracing.dataCollected' && traceState) traceState.events.push(...message.params.value);
  if (message.method === 'Tracing.tracingComplete' && traceState) traceState.complete();
  if (message.sessionId === layerState?.session) {
    if (message.method === 'LayerTree.layerTreeDidChange') {
      layerState.maxLayers = Math.max(layerState.maxLayers, message.params.layers?.length || 0);
    }
  }
  const promise = pending.get(message.id);
  if (!promise) return;
  pending.delete(message.id);
  clearTimeout(promise.timer);
  if (message.error) promise.reject(new Error(JSON.stringify(message.error)));
  else promise.resolve(message.result);
});
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out: ${method} ${params.expression || ''}`));
    }, 20000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}
async function evaluate(session, expression) {
  const result = await send('Runtime.evaluate', {
    expression, awaitPromise: true, returnByValue: true,
  }, session);
  assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const sessions = {};
const variants = ['native', ...(!profileSection ? ['fallback'] : []), ...(compareHead ? ['baseline'] : [])];
const selector = '#fg, #intro .parallax-bg, #map-path, #map-info, #map-path svg, ' +
  '.pin, #google-pin-expand, .google-section, .skill-section, ' +
  '#outro .parallax-bg, #outro-info, #outro-sun, #outro-socials, .scroll-button';
const snapshot = `JSON.stringify({
  scroll: scrollY, height: document.documentElement.scrollHeight,
  background: getComputedStyle(document.documentElement).backgroundColor,
  elements: [...document.querySelectorAll(${JSON.stringify(selector)})].map(el => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const section = el.closest('.parallax-section').getBoundingClientRect();
    return { id: el.id || el.getAttribute('src') || el.className,
      visibleSection: section.top < innerHeight && section.bottom > 0,
      x: rect.x, y: rect.y, width: rect.width, height: rect.height,
      opacity: style.opacity, visibility: style.visibility,
      dash: style.strokeDashoffset, classes: el.className, disabled: el.disabled };
  })
})`;
let checks = 0;
let visualChecks = 0;
let worstVisualDifference = 0;
function compare(actual, expected, label) {
  assert.equal(actual.scroll, expected.scroll, `${label}: scroll`);
  assert.equal(actual.height, expected.height, `${label}: document height`);
  assert.equal(actual.background, expected.background, `${label}: background`);
  actual.elements.forEach((element, i) => {
    const other = expected.elements[i];
    // GSAP can defer initializing transforms until first entry. Compare positions
    // whenever the containing section can be seen; always compare reveal states.
    for (const property of ['x', 'y', 'width', 'height']) {
      if (!element.visibleSection && !other.visibleSection) continue;
      // ScrollTrigger rounds scroll ranges; the outro sun can differ by one
      // quarter CSS pixel at a newly sampled section entry.
      const tolerance = element.id === 'outro-sun' && property === 'y' ? 0.25 : 0.15;
      assert.ok(Math.abs(element[property] - other[property]) < tolerance,
        `${label}: ${element.id} ${property}: ${element[property]} vs ${other[property]}`);
    }
    for (const property of ['id', 'opacity', 'visibility', 'dash', 'classes', 'disabled']) {
      assert.deepEqual(element[property], other[property], `${label}: ${element.id} ${property}`);
    }
  });
  checks++;
}
async function compareScreenshots(label, reference = 'fallback') {
  const images = [];
  for (const variant of ['native', reference]) {
    await send('Page.bringToFront', {}, sessions[variant]);
    await evaluate(sessions[variant], 'ScrollTrigger.getAll().forEach(t => { const tween = t.getTween(); if (tween) tween.pause().progress(1); });');
    await evaluate(sessions[variant], 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    images.push(await send('Page.captureScreenshot', { format: 'png', fromSurface: false }, sessions[variant]));
  }
  await send('Page.bringToFront', {}, sessions.native);
  const visual = await evaluate(sessions.native, `(async () => {
    const sources = ${JSON.stringify(images.map(image => `data:image/png;base64,${image.data}`))};
    const sizes = [];
    const pixels = await Promise.all(sources.map(async src => {
      const img = new Image(); img.src = src; await img.decode();
      sizes.push([img.width, img.height]);
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
      return ctx.getImageData(0, 0, img.width, img.height).data;
    }));
    let changed = 0;
    for (let i = 0; i < pixels[0].length; i += 4) {
      if (Math.max(...[0, 1, 2].map(c => Math.abs(pixels[0][i+c] - pixels[1][i+c]))) > 12) changed++;
    }
    return { difference: changed / (pixels[0].length / 4), sizes };
  })()`);
  const expectedSize = await evaluate(sessions.native, '[innerWidth, innerHeight]');
  for (const size of visual.sizes) assert.deepEqual(size, expectedSize, `${label}: screenshot size`);
  const { difference } = visual;
  worstVisualDifference = Math.max(worstVisualDifference, difference);
  if (difference >= 0.005) {
    for (const variant of ['native', reference]) {
      console.log(variant, await evaluate(sessions[variant], `JSON.stringify({scroll:scrollY, map:document.getElementById('map-path').getBoundingClientRect().toJSON(), transform:getComputedStyle(document.getElementById('map-path')).transform, dash:getComputedStyle(document.querySelector('#map-path svg')).strokeDashoffset})`));
    }
    for (const [index, variant] of ['native', reference].entries()) {
      const file = path.join(os.tmpdir(), `portfolio-parallax-${variant}.png`);
      await writeFile(file, Buffer.from(images[index].data, 'base64'));
      console.log(`Mismatch screenshot: ${file}`);
    }
  }
  assert.ok(difference < 0.005, `${label}: screenshot difference ${(difference * 100).toFixed(3)}%`);
  visualChecks++;
}

async function checkSectionHalftone(session, variant, sectionId, canvasId, expectedColor) {
  await send('Page.bringToFront', {}, session);
  const result = await evaluate(session, `(async () => {
    const section = document.getElementById(${JSON.stringify(sectionId)});
    const canvas = document.getElementById(${JSON.stringify(canvasId)});
    const context = canvas.getContext('2d');
    const height = innerHeight, width = innerWidth, dpr = devicePixelRatio;
    const sectionEnd = section.getBoundingClientRect().bottom + scrollY;
    const startsAtDoodles = section.id === 'google';
    const doodleEnd = startsAtDoodles
      ? Math.max(...[...section.querySelectorAll('.google-section .doodle-img')]
        .map(image => image.getBoundingClientRect().bottom + scrollY))
      : null;
    const startEnd = startsAtDoodles ? doodleEnd : sectionEnd;
    const startFraction = 0.8;
    const backdrop = startsAtDoodles ? null : document.getElementById('google-halftone').getContext('2d');
    const countIncoming = () => {
      if (getComputedStyle(canvas).visibility !== 'visible') return 0;
      const top = Math.floor(0.7 * height * dpr);
      const data = context.getImageData(0, top, canvas.width, canvas.height - top).data;
      const color = ${JSON.stringify(expectedColor)};
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] === color[0] && data[i + 1] === color[1] && data[i + 2] === color[2] && data[i + 3] > 0) count++;
      }
      return count;
    };
    const topHoles = () => {
      const rows = Math.ceil(0.1 * height * dpr);
      const data = context.getImageData(0, 0, canvas.width, rows).data;
      let count = 0;
      for (let i = 3; i < data.length; i += 4) count += data[i] < 255;
      return count;
    };
    const pixelRow = fraction => {
      const y = Math.min(canvas.height - 1, Math.round(fraction * height * dpr));
      const data = context.getImageData(0, y, canvas.width, 1).data;
      let ink = 0, opaque = 0, hash = 2166136261;
      for (let i = 3; i < data.length; i += 4) {
        ink += data[i] > 0;
        opaque += data[i] === 255;
        hash = Math.imul(hash ^ data[i], 16777619);
      }
      return {ink, opaque, hash: hash >>> 0};
    };
    const compositeOpaqueRow = fraction => {
      const y = Math.min(canvas.height - 1, Math.round(fraction * height * dpr));
      const foreground = context.getImageData(0, y, canvas.width, 1).data;
      const background = backdrop?.getImageData(0, y, canvas.width, 1).data;
      let opaque = 0;
      for (let i = 3; i < foreground.length; i += 4) {
        opaque += foreground[i] === 255 || (background && background[i] === 255);
      }
      return opaque;
    };
    const state = () => ({
      bottom: section.getBoundingClientRect().bottom,
      doodleBottom: startsAtDoodles
        ? Math.max(...[...section.querySelectorAll('.google-section .doodle-img')]
          .map(image => image.getBoundingClientRect().bottom)) : null,
      incoming: countIncoming(),
      topHoles: startsAtDoodles ? topHoles() : null,
      visible: getComputedStyle(canvas).visibility === 'visible',
      top: canvas.getBoundingClientRect().top,
      left: canvas.getBoundingClientRect().left,
      nearTop: pixelRow(0.006), sectionArea: pixelRow(0.2),
      overlapRows: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7].map(pixelRow),
      belowEdge: pixelRow(Math.min(0.99, section.getBoundingClientRect().bottom / height + 0.01)),
      belowEdgeComposite: compositeOpaqueRow(Math.min(0.99,
        section.getBoundingClientRect().bottom / height + 0.01))
    });
    const move = bottom => {
      scrollTo({top: Math.round(sectionEnd - bottom), behavior: 'instant'});
      ScrollTrigger.update();
      return state();
    };
    const moveStart = fraction => {
      scrollTo({top: Math.round(startEnd - fraction * height), behavior: 'instant'});
      ScrollTrigger.update();
      return state();
    };
    let draws = 0;
    const originalClear = context.clearRect, originalFill = context.fill, originalFillRect = context.fillRect;
    context.clearRect = function(...args) { draws++; return originalClear.apply(this, args); };
    context.fill = function(...args) { draws++; return originalFill.apply(this, args); };
    context.fillRect = function(...args) { draws++; return originalFillRect.apply(this, args); };
    try {
      const beforeFar = moveStart(0.9);
      const beforeNear = moveStart(0.85);
      const before = moveStart(startFraction + 3 / height);
      const entered = moveStart(startFraction - 0.02);
      const middle = startsAtDoodles ? moveStart(0.5) : move(0.5 * height);
      const hit = document.elementFromPoint(width / 2, height * 0.2);
      const almostComplete = startsAtDoodles ? moveStart(0.3) : move(0.3 * height);
      const complete = startsAtDoodles ? moveStart(0.25 - 3 / height) : move(0.25 * height - 3);
      const colorPixel = [...context.getImageData(0, 0, 1, 1).data];
      const reverseMiddle = startsAtDoodles ? moveStart(0.5) : move(0.5 * height);
      const reverseBefore = moveStart(startFraction + 3 / height);
      const directMiddle = startsAtDoodles ? moveStart(0.5) : move(0.5 * height);
      const stationaryDraws = draws;
      await new Promise(resolve => setTimeout(resolve, 200));
      await new Promise(resolve => requestAnimationFrame(resolve));
      const settledMiddle = state(), settledDraws = draws;
      const pastSection = move(-3);
      const skillsHeader = document.getElementById('skills-header');
      const skillsTop = skillsHeader.getBoundingClientRect().top + scrollY;
      scrollTo({top:Math.round(skillsTop + 3), behavior:'instant'});
      ScrollTrigger.update();
      const pastSkillsHeader = state();
      const style = getComputedStyle(canvas);
      return {beforeFar, beforeNear, before, entered, middle, almostComplete, complete, reverseMiddle,
        reverseBefore, directMiddle, settledMiddle, pastSection, pastSkillsHeader, stationaryDraws,
        settledDraws, width, height, dpr, startsAtDoodles, canvasWidth:canvas.width,
        canvasHeight:canvas.height, canvasCssWidth:canvas.getBoundingClientRect().width,
        parentIsSection:section.contains(canvas),
        pointerEvents:style.pointerEvents, position:style.position,
        decorative:canvas.getAttribute('aria-hidden'), color:style.color,
        colorPixel, hitIsSection:section.contains(hit)};
    } finally {
      context.clearRect = originalClear;
      context.fill = originalFill;
      context.fillRect = originalFillRect;
    }
  })()`);
  const label = `${variant}: ${sectionId} halftone`;
  assert.equal(result.parentIsSection, false, `${label}: canvas must escape the section's clip`);
  assert.equal(result.position, 'fixed', `${label}: viewport anchored canvas`);
  assert.equal(result.pointerEvents, 'none', `${label}: clicks pass through the canvas`);
  assert.equal(result.hitIsSection, true, `${label}: section remains interactive under the overlay`);
  assert.equal(result.decorative, 'true', `${label}: decorative canvas`);
  assert.equal(result.canvasWidth, Math.ceil(result.width * result.dpr), `${label}: sharp canvas width`);
  assert.equal(result.canvasHeight, Math.ceil(result.height * result.dpr), `${label}: sharp canvas height`);
  assert.equal(result.canvasCssWidth, result.width, `${label}: canvas bitmap must not be scaled by the scrollbar`);
  if (result.startsAtDoodles) {
    assert.ok(Math.abs(result.before.doodleBottom - 0.8 * result.height - 3) <= 1,
      `${label}: lowest doodle image sets the 20%-from-bottom start`);
    assert.ok(Math.abs(result.entered.doodleBottom - 0.78 * result.height) <= 1,
      `${label}: first dots follow the lowest doodle image's 20%-from-bottom crossing`);
  } else {
    assert.ok(Math.abs(result.before.bottom - 0.8 * result.height - 3) <= 1, `${label}: start position`);
  }
  if (result.startsAtDoodles) {
    assert.ok(Math.abs(result.middle.doodleBottom - 0.5 * result.height) <= 0.5,
      `${label}: midpoint follows the doodles`);
  } else {
    assert.ok(Math.abs(result.middle.bottom - 0.5 * result.height) <= 0.5, `${label}: midpoint position`);
  }
  assert.ok(Math.abs((result.startsAtDoodles ? result.complete.doodleBottom : result.complete.bottom) -
    (0.25 * result.height - 3)) <= 1, `${label}: completion position`);
  if (result.startsAtDoodles) {
    for (const state of [result.beforeFar, result.beforeNear, result.before]) {
      assert.equal(state.incoming, 0, `${label}: no orange dots before doodles reach 20% from the bottom`);
    }
    assert.ok(result.entered.incoming > 0,
      `${label}: orange dots appear after doodles pass 20% from the bottom`);
  } else {
    for (const state of [result.beforeFar, result.beforeNear, result.before]) {
      assert.equal(state.incoming, 0, `${label}: no black dots before the 80vh start`);
    }
    assert.ok(result.entered.incoming > 0,
      `${label}: black dots appear after Nick's 80vh start`);
  }
  for (const state of [result.middle, result.reverseMiddle]) {
    if (state.bottom >= result.height) continue;
    assert.equal(state.belowEdgeComposite, result.canvasWidth,
      `${label}: orange and black canvases cover the moving section edge`);
  }
  assert.equal(result.entered.visible, true, `${label}: dots become visible after the start threshold`);
  assert.equal(result.entered.sectionArea.ink, 0, `${label}: first dots stay near the lower viewport`);
  assert.equal(result.middle.visible, true, `${label}: visible over its section at midpoint`);
  assert.ok(result.middle.overlapRows.slice(0, 4).some(row => row.ink > 0 && row.ink < result.canvasWidth),
    `${label}: midpoint dots overlap the still visible section: ${JSON.stringify(result.middle.overlapRows)}`);
  if (result.startsAtDoodles) {
    assert.equal(result.complete.topHoles, 0,
      `${label}: transition fills the viewport when the section's bottom passes 25%`);
  } else {
    assert.equal(result.complete.nearTop.opaque, result.canvasWidth,
      `${label}: transition is solid when the section's bottom passes 25%`);
  }
  assert.deepEqual([...result.color.matchAll(/\d+/g)].slice(0, 3).map(match => Number(match[0])), expectedColor,
    `${label}: incoming color`);
  assert.deepEqual(result.colorPixel, expectedColor.concat(255), `${label}: solid fill matches the incoming color`);
  if (result.startsAtDoodles) {
    assert.equal(result.reverseBefore.incoming, 0, `${label}: reverse scroll removes dots before the image threshold`);
  } else {
    assert.equal(result.reverseBefore.incoming, 0, `${label}: reverse scroll removes dots before the section edge`);
  }
  assert.equal(result.pastSection.visible, true,
    `${label}: solid color persists after its source section ends`);
  assert.equal(result.pastSection.nearTop.opaque, result.canvasWidth,
    `${label}: the persistent canvas remains solid after the section ends`);
  assert.equal(result.pastSkillsHeader.visible, false,
    `${label}: canvas retires after the skills header crosses the viewport top`);
  for (const state of [result.beforeFar, result.beforeNear, result.before, result.entered, result.middle, result.almostComplete,
    result.complete, result.reverseMiddle, result.reverseBefore, result.directMiddle, result.settledMiddle]) {
    assert.ok(Math.abs(state.top) < 0.01 && Math.abs(state.left) < 0.01,
      `${label}: canvas stays fixed to the viewport during either scroll direction`);
  }
  for (const state of [result.reverseMiddle, result.directMiddle, result.settledMiddle]) {
    assert.deepEqual(state.overlapRows, result.middle.overlapRows,
      `${label}: overlap responds immediately and identically after reverse jumps`);
    assert.deepEqual(state.nearTop, result.middle.nearTop,
      `${label}: reverse jumps do not leave a cropped top edge`);
  }
  assert.equal(result.settledDraws, result.stationaryDraws, `${label}: no drawing while scroll is stationary`);
}

async function checkSectionHalftoneComposite(session, variant, sectionId, canvasId, baseColor, expectedColor) {
  await send('Page.bringToFront', {}, session);
  const original = await evaluate(session, `(() => {
    const section = document.getElementById(${JSON.stringify(sectionId)});
    const content = section.querySelector('.parallax-container');
    const jobContent = [...document.querySelectorAll('.job-content')];
    const canvas = document.getElementById(${JSON.stringify(canvasId)});
    const startsAtDoodles = section.id === 'google';
    const startEnd = startsAtDoodles
      ? Math.max(...[...section.querySelectorAll('.google-section .doodle-img')]
        .map(image => image.getBoundingClientRect().bottom + scrollY))
      : section.getBoundingClientRect().bottom + scrollY;
    const original = {content:content?.style.visibility,
      jobContent:jobContent.map(item => item.style.visibility), canvas:canvas.style.visibility,
      color:getComputedStyle(canvas).color};
    // Hide moving section content so the screenshot measures the background layer.
    if (content) content.style.visibility = 'hidden';
    jobContent.forEach(item => item.style.visibility = 'hidden');
    scrollTo({top:Math.round(startEnd - innerHeight * 0.95), behavior:'instant'});
    ScrollTrigger.update();
    return original;
  })()`);
  try {
    await evaluate(session, 'new Promise(resolve => requestAnimationFrame(resolve))');
    const beforeDots = await send('Page.captureScreenshot', {format:'png', fromSurface:true}, session);
    await evaluate(session, `(() => {
      const section = document.getElementById(${JSON.stringify(sectionId)});
      const startsAtDoodles = section.id === 'google';
      const startEnd = startsAtDoodles
        ? Math.max(...[...section.querySelectorAll('.google-section .doodle-img')]
          .map(image => image.getBoundingClientRect().bottom + scrollY))
        : section.getBoundingClientRect().bottom + scrollY;
      scrollTo({top:Math.round(startEnd - innerHeight * 0.72), behavior:'instant'});
      ScrollTrigger.update();
    })()`);
    await evaluate(session, 'new Promise(resolve => requestAnimationFrame(resolve))');
    const early = await send('Page.captureScreenshot', {format:'png', fromSurface:true}, session);
    const earlyBottom = await evaluate(session, `document.getElementById(${JSON.stringify(sectionId)}).getBoundingClientRect().bottom`);
    await evaluate(session, `(() => {
      const section = document.getElementById(${JSON.stringify(sectionId)});
      const startsAtDoodles = section.id === 'google';
      const end = startsAtDoodles
        ? Math.max(...[...section.querySelectorAll('.google-section .doodle-img')]
          .map(image => image.getBoundingClientRect().bottom + scrollY))
        : section.getBoundingClientRect().bottom + scrollY;
      scrollTo({top:Math.round(end - innerHeight * 0.5), behavior:'instant'});
      ScrollTrigger.update();
    })()`);
    await evaluate(session, 'new Promise(resolve => requestAnimationFrame(resolve))');
    const midpoint = await send('Page.captureScreenshot', {format:'png', fromSurface:true}, session);
    const midpointBottom = await evaluate(session, `document.getElementById(${JSON.stringify(sectionId)}).getBoundingClientRect().bottom`);
    await evaluate(session, `document.getElementById(${JSON.stringify(canvasId)}).style.visibility = 'hidden'`);
    const withoutOverlay = await send('Page.captureScreenshot', {format:'png', fromSurface:true}, session);
    await evaluate(session, `(() => {
      const section = document.getElementById(${JSON.stringify(sectionId)});
      const startsAtDoodles = section.id === 'google';
      const end = startsAtDoodles
        ? Math.max(...[...section.querySelectorAll('.google-section .doodle-img')]
          .map(image => image.getBoundingClientRect().bottom + scrollY))
        : section.getBoundingClientRect().bottom + scrollY;
      scrollTo({top:Math.round(end - innerHeight * 0.25 + 3), behavior:'instant'});
      ScrollTrigger.update();
    })()`);
    await evaluate(session, 'new Promise(resolve => requestAnimationFrame(resolve))');
    const complete = await send('Page.captureScreenshot', {format:'png', fromSurface:true}, session);
    await evaluate(session, `(() => {
      const section = document.getElementById(${JSON.stringify(sectionId)});
      const startsAtDoodles = section.id === 'google';
      const end = startsAtDoodles
        ? Math.max(...[...section.querySelectorAll('.google-section .doodle-img')]
          .map(image => image.getBoundingClientRect().bottom + scrollY))
        : section.getBoundingClientRect().bottom + scrollY;
      scrollTo({top:Math.round(end - innerHeight * 0.5), behavior:'instant'});
      ScrollTrigger.update();
    })()`);
    await evaluate(session, 'new Promise(resolve => requestAnimationFrame(resolve))');
    const reverseMidpoint = await send('Page.captureScreenshot', {format:'png', fromSurface:true}, session);
    const sources = [beforeDots, early, midpoint, withoutOverlay, complete, reverseMidpoint]
      .map(image => `data:image/png;base64,${image.data}`);
    const pixels = await evaluate(session, `(async () => {
      const sources = ${JSON.stringify(sources)};
      const rgba = await Promise.all(sources.map(async source => {
        const image = new Image(); image.src = source; await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        return [...context.getImageData(0, 0, image.width, image.height).data];
      }));
      const width = innerWidth, height = innerHeight;
      const contentWidth = document.documentElement.clientWidth;
      const color = ${JSON.stringify(expectedColor)};
      const background = ${JSON.stringify(baseColor)};
      const earlyBottom = ${JSON.stringify(earlyBottom)};
      const midpointBottom = ${JSON.stringify(midpointBottom)};
      const differs = (a, b, index, tolerance = 12) =>
        [0, 1, 2].some(channel => Math.abs(a[index + channel] - b[index + channel]) > tolerance);
      const matches = (data, index, expected, tolerance = 2) =>
        [0, 1, 2].every(channel => Math.abs(data[index + channel] - expected[channel]) <= tolerance);
      let overlayOnSection = 0, reverseMismatch = 0, total = 0;
      for (let y = Math.round(height * 0.05); y < Math.round(height * 0.4); y++) {
        for (let x = 8; x < contentWidth - 8; x++) {
          const index = (y * width + x) * 4;
          total++;
          if (matches(rgba[3], index, background) && matches(rgba[2], index, color)) overlayOnSection++;
          if (differs(rgba[2], rgba[5], index)) reverseMismatch++;
        }
      }
      let preDotMismatch = 0;
      for (let x = 8; x < contentWidth - 8; x++) {
        const preDotIndex = (Math.round(height * 0.95) * width + x) * 4;
        if (!matches(rgba[0], preDotIndex, background)) preDotMismatch++;
      }
      const belowEdgeBad = [earlyBottom, midpointBottom].map((bottom, sample) => {
        let bad = 0;
        const image = rgba[sample + 1];
        for (let y = Math.max(0, Math.ceil(bottom + 2)); y < height - 8; y++) {
          for (let x = 8; x < contentWidth - 8; x++) {
            const index = (y * width + x) * 4;
            // Black dots are composited over the persistent orange canvas.
            // Either color may appear below Nick's white DOM boundary.
            if (background[2] > 200
              ? !matches(image, index, color, 3)
              : image[index + 2] > 5) bad++;
          }
        }
        return bad;
      });
      let endpointMismatch = 0;
      const endpointBad = [];
      const endpointY = Math.round(height * 0.2);
      for (let x = 8; x < contentWidth - 8; x++) {
        const index = (endpointY * width + x) * 4;
        if (!matches(rgba[4], index, color)) {
          endpointMismatch++;
          if (endpointBad.length < 20) endpointBad.push({x, rgb:rgba[4].slice(index, index + 3)});
        }
      }
      return {overlayOnSection, reverseMismatch, endpointMismatch, total,
        preDotMismatch, belowEdgeBad, earlyBottom, midpointBottom,
        endpointSamples:contentWidth - 16, endpointBad, color};
    })()`);
    const label = `${variant}: ${sectionId} halftone composite`;
    assert.equal(pixels.preDotMismatch, 0,
      `${label}: solid background has the correct color before dots begin`);
    assert.deepEqual(pixels.belowEdgeBad, [0, 0],
      `${label}: canvas colors cover every rendered pixel below the moving section edge`);
    assert.ok(pixels.overlayOnSection > 2 * (pixels.endpointSamples + 16),
      `${label}: incoming dots must visibly overlap the departing section`);
    assert.equal(pixels.endpointMismatch, 0,
      `${label}: 25% endpoint must be solid incoming color across the visible section: ${JSON.stringify(pixels.endpointBad)}, expected ${pixels.color}`);
    assert.ok(pixels.reverseMismatch / pixels.total < 0.001,
      `${label}: rapid reverse must reproduce the same uncut midpoint image`);
  } finally {
    await evaluate(session, `(() => {
      const content = document.getElementById(${JSON.stringify(sectionId)}).querySelector('.parallax-container');
      if (content) content.style.visibility = ${JSON.stringify(original.content)};
      const jobContentVisibility = ${JSON.stringify(original.jobContent)};
      [...document.querySelectorAll('.job-content')].forEach((item, index) =>
        item.style.visibility = jobContentVisibility[index]);
      document.getElementById(${JSON.stringify(canvasId)}).style.visibility = ${JSON.stringify(original.canvas)};
    })()`);
  }
}

async function checkHalftoneBoundaryCoverage(session, variant, sectionId, canvasId) {
  await send('Page.bringToFront', {}, session);
  const results = await evaluate(session, `(() => {
    const section = document.getElementById(${JSON.stringify(sectionId)});
    const canvas = document.getElementById(${JSON.stringify(canvasId)});
    const context = canvas.getContext('2d');
    const backdrop = section.id === 'nick'
      ? document.getElementById('google-halftone').getContext('2d') : null;
    const sectionEnd = section.getBoundingClientRect().bottom + scrollY;
    const dpr = devicePixelRatio;
    const visibleWidth = document.documentElement.clientWidth;
    const fractions = [];
    for (let percent = backdrop ? 78 : 99; percent >= 27; percent -= 3) fractions.push(percent / 100);
    fractions.push(0.25);
    return fractions.map(fraction => {
      scrollTo({top:Math.round(sectionEnd - fraction * innerHeight), behavior:'instant'});
      ScrollTrigger.update();
      const bottom = section.getBoundingClientRect().bottom;
      const firstY = Math.max(0, Math.ceil((bottom + 2) * dpr));
      const rows = Math.max(0, canvas.height - firstY);
      const pixels = rows ? context.getImageData(0, firstY, canvas.width, rows).data : [];
      const backdropPixels = rows && backdrop
        ? backdrop.getImageData(0, firstY, canvas.width, rows).data : null;
      let uncoveredBelow = 0;
      let firstLeak = null;
      const pixelStep = Math.max(1, Math.round(2 * dpr));
      for (let y = 0; y < rows; y += pixelStep) {
        for (let x = Math.round(8 * dpr); x < (visibleWidth - 8) * dpr; x += pixelStep) {
          const index = (y * canvas.width + x) * 4;
          if (pixels[index + 3] < 250 &&
            (!backdropPixels || backdropPixels[index + 3] < 250)) {
            uncoveredBelow++;
            firstLeak ??= {x:Math.round(x / dpr), y:Math.round(firstY / dpr + y / dpr)};
          }
        }
      }
      return {fraction, bottom, height:innerHeight, uncoveredBelow, firstLeak,
        visible:getComputedStyle(canvas).visibility === 'visible'};
    });
  })()`);
  const label = `${variant}: ${sectionId} background below halftone`;
  for (const result of results) {
    assert.ok(Math.abs(result.bottom - result.fraction * result.height) <= 0.5,
      `${label}: sampled section edge at ${result.fraction * 100}vh`);
    assert.equal(result.visible, true, `${label}: overlay follows the visible section edge`);
  }
  const leaks = results.filter(result => result.uncoveredBelow > 0);
  assert.deepEqual(leaks, [],
    `${label}: color canvases cover every pixel below the section edge; ${JSON.stringify(leaks)}`);
}

async function checkHalftoneLinearFlow(session, variant, sectionId, canvasId, incomingColor) {
  await send('Page.bringToFront', {}, session);
  const result = await evaluate(session, `(() => {
    const section = document.getElementById(${JSON.stringify(sectionId)});
    const canvas = document.getElementById(${JSON.stringify(canvasId)});
    const context = canvas.getContext('2d');
    const height = innerHeight, dpr = devicePixelRatio;
    const width = document.documentElement.clientWidth;
    const sectionEnd = section.getBoundingClientRect().bottom + scrollY;
    const rows = [...section.querySelectorAll('.google-section')];
    const anchorGap = rows.length
      ? section.getBoundingClientRect().bottom - Math.max(...rows.map(row => row.getBoundingClientRect().bottom))
      : 0;
    const startBottom = anchorGap + 0.8 * height;
    const endBottom = anchorGap + 0.25 * height;
    const pitch = 2 * height * 0.48 / 30;
    const color = ${JSON.stringify(incomingColor)};
    const samples = [0.4, 0.5, 0.6, 0.7, 0.8].map(progress => {
      scrollTo({top:Math.round(sectionEnd - (startBottom + (endBottom - startBottom) * progress)), behavior:'instant'});
      ScrollTrigger.update();
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const fronts = [];
      for (let column = 0; (column + 0.75) * pitch < width - 8; column++) {
        // Sample between the staggered row centers to follow the filled front.
        const x = Math.round((column + 0.75) * pitch * dpr);
        let y = canvas.height - 1;
        while (y >= 0) {
          const index = (y * canvas.width + x) * 4;
          const incoming = pixels[index + 3] >= 250 &&
            Math.abs(pixels[index] - color[0]) <= 2 &&
            Math.abs(pixels[index + 1] - color[1]) <= 2 &&
            Math.abs(pixels[index + 2] - color[2]) <= 2;
          if (!incoming) break;
          y--;
        }
        fronts.push((y + 1) / dpr);
      }
      const trailing = fronts.slice(Math.floor(fronts.length * 0.75));
      return {progress, bottom:section.getBoundingClientRect().bottom,
        trailingMean:trailing.reduce((sum, front) => sum + front, 0) / trailing.length,
        fronts};
    });
    return {samples, height};
  })()`);
  const label = `${variant}: ${sectionId} linear halftone flow`;
  const {samples, height} = result;
  // The left columns finish first by design. Measure rate on the trailing
  // quarter, which is still moving through all sampled progress positions.
  const advances = samples.slice(1).map((sample, i) => samples[i].trailingMean - sample.trailingMean);
  const average = advances.reduce((sum, advance) => sum + advance, 0) / advances.length;
  assert.ok(average > 0.06 * height,
    `${label}: visible front advances across equal scroll increments: ${JSON.stringify(samples.map(s => s.trailingMean))}`);
  for (const advance of advances) {
    assert.ok(Math.abs(advance - average) <= Math.max(0.02 * height, 0.16 * average),
      `${label}: equal scroll increments move the color front equally; advances ${JSON.stringify(advances)}, front samples ${JSON.stringify(samples.map(sample => ({p:sample.progress, left:sample.fronts[0], center:sample.fronts[Math.floor(sample.fronts.length / 2)], right:sample.fronts.at(-1)})))}`);
  }
  const fronts = samples[2].fronts;
  const rowPitch = height * 0.48 / 30;
  // A staggered row can fill a sampled gap one row sooner. The direct radius
  // check below separately verifies the continuous left-to-right dot delay.
  assert.ok(fronts.at(-1) - fronts[0] > 1.5 * rowPitch,
    `${label}: rightmost columns lag meaningfully behind the leftmost columns; spread=${fronts.at(-1) - fronts[0]}, rowPitch=${rowPitch}, fronts=${JSON.stringify(fronts)}`);
}

async function checkHalftoneDotGrowth(session, variant) {
  await send('Page.bringToFront', {}, session);
  const result = await evaluate(session, `(() => {
    const height = innerHeight, width = innerWidth, dpr = devicePixelRatio;
    const step = Math.max(4, Math.round(0.02 * height));
    const transitions = [];
    for (const [sectionId, canvasId, startFraction] of [
      ['google', 'google-halftone', 0.8], ['nick', 'nick-halftone', 0.8]
    ]) {
      const section = document.getElementById(sectionId);
      const canvas = document.getElementById(canvasId);
      const context = canvas.getContext('2d');
      const startElementEnd = sectionId === 'google'
        ? Math.max(...[...section.querySelectorAll('.google-section .doodle-img')]
          .map(image => image.getBoundingClientRect().bottom + scrollY))
        : section.getBoundingClientRect().bottom + scrollY;
      const firstScroll = startElementEnd - startFraction * height;
      const travel = (startFraction - 0.25) * height;
      const drawAt = targetScroll => {
        const arcs = [];
        const originalArc = context.arc;
        context.arc = function(x, y, radius, ...args) {
          arcs.push({x, y, radius});
          return originalArc.call(this, x, y, radius, ...args);
        };
        try {
          scrollTo({top:Math.round(targetScroll), behavior:'instant'});
          ScrollTrigger.update();
        } finally {
          context.arc = originalArc;
        }
        return {scroll:scrollY, arcs};
      };
      const scan = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map(progress => ({
        progress, ...drawAt(firstScroll + progress * travel)
      }));
      const maxRadius = Math.max(...scan.flatMap(frame => frame.arcs.map(arc => arc.radius)));
      const midpoint = scan.find(frame => frame.progress === 0.5);
      // Each staggered row has a different center x, so sample one dot near
      // the viewport center from every y row rather than one fixed x value.
      const centerColumn = frame => {
        const byRow = new Map();
        for (const arc of frame.arcs) {
          const key = arc.y.toFixed(3);
          const previous = byRow.get(key);
          if (!previous || Math.abs(arc.x - width * dpr / 2) <
            Math.abs(previous.x - width * dpr / 2)) byRow.set(key, arc);
        }
        return [...byRow.values()].filter(arc =>
          Math.abs(arc.x - width * dpr / 2) <= height * dpr * 0.48 / 30 * 2)
          .sort((a, b) => a.y - b.y);
      };
      const partialBands = scan.filter(frame => [0.4, 0.5, 0.6].includes(frame.progress))
        .map(frame => {
          const partial = centerColumn(frame).filter(arc =>
            arc.y > 0 && arc.y < height * dpr &&
            arc.radius > 0.001 * maxRadius && arc.radius < 0.999 * maxRadius);
          return {progress:frame.progress, rows:partial.length,
            height:partial.length > 1 ? (partial.at(-1).y - partial[0].y) / dpr : 0};
        });
      const partiallyGrownRows = partialBands[1].rows;
      const rowsByY = new Map();
      for (const arc of midpoint.arcs) {
        if (arc.y <= 0 || arc.y >= height * dpr) continue;
        const key = arc.y.toFixed(3);
        if (!rowsByY.has(key)) rowsByY.set(key, []);
        rowsByY.get(key).push(arc);
      }
      const horizontalRow = [...rowsByY.values()].map(row => row.sort((a, b) => a.x - b.x))
        .filter(row => row[0].x < 0.1 * width * dpr && row.at(-1).x > 0.9 * width * dpr &&
          row[0].radius < 0.98 * maxRadius && row.at(-1).radius > 0.02 * maxRadius)
        .sort((a, b) => Math.abs((a[0].radius + a.at(-1).radius) / (2 * maxRadius) - 0.5) -
          Math.abs((b[0].radius + b.at(-1).radius) / (2 * maxRadius) - 0.5))[0];
      const horizontalRadii = horizontalRow?.map(arc => arc.radius / maxRadius) || [];
      const median = numbers => {
        const ordered = numbers.slice().sort((a, b) => a - b);
        return ordered[Math.floor(ordered.length / 2)];
      };
      const latticeRows = [...rowsByY.values()]
        .map(row => row.slice().sort((a, b) => a.x - b.x))
        .filter(row => row.length >= 6 &&
          row.at(-1).x - row[0].x > 0.6 * width * dpr)
        .sort((a, b) => a[0].y - b[0].y);
      const pitchSamples = latticeRows.flatMap(row => row.slice(1)
        .map((arc, i) => arc.x - row[i].x));
      const horizontalPitch = median(pitchSamples);
      const diagonalPairs = [];
      for (let i = 1; i < latticeRows.length; i++) {
        const lower = latticeRows[i], upper = latticeRows[i - 1];
        const dy = lower[0].y - upper[0].y;
        if (dy > 0.75 * horizontalPitch) continue;
        const center = upper.reduce((closest, arc) =>
          Math.abs(arc.x - width * dpr / 2) < Math.abs(closest.x - width * dpr / 2)
            ? arc : closest);
        const left = lower.filter(arc => arc.x < center.x).at(-1);
        const right = lower.find(arc => arc.x > center.x);
        if (left && right) diagonalPairs.push({dy:dy / dpr,
          dxLeft:(center.x - left.x) / dpr,
          dxRight:(right.x - center.x) / dpr});
      }
      let lowerRowOnsets = null;
      if (sectionId === 'google') {
        const earlyFrames = Array.from({length:16}, (_, i) =>
          drawAt(firstScroll + (0.02 + i * 0.02) * travel));
        const samplesByRow = new Map();
        for (const frame of earlyFrames) {
          for (const arc of centerColumn(frame)) {
            if (arc.y / dpr <= 0.705 * height || arc.y / dpr >= height ||
              arc.radius <= 0 || arc.radius >= 0.999 * maxRadius) continue;
            const key = arc.y.toFixed(3);
            if (!samplesByRow.has(key)) samplesByRow.set(key, {y:arc.y / dpr, samples:[]});
            samplesByRow.get(key).samples.push({scroll:frame.scroll, radius:arc.radius});
          }
        }
        lowerRowOnsets = [...samplesByRow.values()].sort((a, b) => b.y - a.y)
          .map(row => {
            const [first, second] = row.samples;
            const slope = second && (second.radius - first.radius) /
              (second.scroll - first.scroll);
            return {y:row.y, start:slope > 0 ? first.scroll - first.radius / slope : null};
          });
      }
      const choose = (left, right, top, bottom) => scan.flatMap(frame =>
        frame.arcs.filter(arc => arc.x / dpr >= left * width && arc.x / dpr <= right * width &&
          arc.y / dpr >= top * height && arc.y / dpr <= bottom * height &&
          arc.radius >= 0.35 * maxRadius && arc.radius <= 0.65 * maxRadius)
          .map(arc => ({...arc, scroll:frame.scroll, progress:frame.progress})))
        .sort((a, b) => Math.abs(a.radius / maxRadius - 0.5) -
          Math.abs(b.radius / maxRadius - 0.5))[0] || null;
      const dots = [choose(0.08, 0.34, 0.52, 0.9), choose(0.66, 0.92, 0.08, 0.48)]
        .map(dot => dot && ({
          x:dot.x / dpr, y:dot.y / dpr, progress:dot.progress,
          samples:[-2, -1, 0, 1, 2].map(offset => {
            const frame = drawAt(dot.scroll + offset * step);
            const sameDot = frame.arcs.find(arc =>
              Math.abs(arc.x - dot.x) < 0.01 && Math.abs(arc.y - dot.y) < 0.01);
            return {scroll:frame.scroll, radius:sameDot ? sameDot.radius / dpr : null};
          })
        }));
      transitions.push({sectionId, maxRadius:maxRadius / dpr,
        partiallyGrownRows, partialBands, lowerRowOnsets, horizontalRadii, dots,
        lattice:{horizontalPitch:horizontalPitch / dpr, diagonalPairs}});
    }
    return {height, step, transitions};
  })()`);
  const label = `${variant}: constant dot scaling`;
  const slopes = [];
  for (const transition of result.transitions) {
    assert.ok(transition.maxRadius > 0,
      `${label}: ${transition.sectionId} draws full size dots`);
    assert.ok(transition.partiallyGrownRows >= 12,
      `${label}: ${transition.sectionId} midpoint shows at least 12 vertically growing rows in one column; found ${transition.partiallyGrownRows}`);
    const {horizontalPitch, diagonalPairs} = transition.lattice;
    assert.ok(Number.isFinite(horizontalPitch) && diagonalPairs.length >= 6,
      `${label}: ${transition.sectionId} draws several adjacent staggered rows: ${JSON.stringify(transition.lattice)}`);
    for (const {dy, dxLeft, dxRight} of diagonalPairs) {
      const tolerance = Math.max(1, 0.03 * horizontalPitch);
      assert.ok(Math.abs(dy - horizontalPitch / 2) <= tolerance &&
        Math.abs(dxLeft - dy) <= tolerance && Math.abs(dxRight - dy) <= tolerance,
      `${label}: ${transition.sectionId} left and right diagonal neighbors have equal x/y spacing and a 45-degree angle: ${JSON.stringify(transition.lattice)}`);
    }
    assert.ok(transition.horizontalRadii.length >= 8,
      `${label}: find a growing row across the viewport in ${transition.sectionId}`);
    assert.ok(transition.horizontalRadii[0] - transition.horizontalRadii.at(-1) > 0.05 &&
      transition.horizontalRadii.slice(1).every((radius, i) =>
        radius <= transition.horizontalRadii[i] + 1e-6),
    `${label}: ${transition.sectionId} dots start progressively later from left to right: ${JSON.stringify(transition.horizontalRadii)}`);
    if (transition.sectionId === 'google') {
      const onsets = transition.lowerRowOnsets;
      assert.ok(onsets.length >= 12,
        `${label}: observe at least 12 Google rows below the doodles as they grow: ${JSON.stringify(onsets)}`);
      assert.ok(onsets.every(row => Number.isFinite(row.start)),
        `${label}: measure the Google lower-row growth rate from a visible dot: ${JSON.stringify(onsets)}`);
      for (let i = 1; i < onsets.length; i++) {
        assert.ok(onsets[i].start - onsets[i - 1].start > 0.5,
          `${label}: Google lower rows begin one by one from bottom to top: ${JSON.stringify(onsets)}`);
      }
    }
    assert.ok(transition.dots.every(Boolean),
      `${label}: find growing dots at lower left and upper right in ${transition.sectionId}: ${JSON.stringify(transition.dots)}`);
    assert.ok(transition.dots[0].y - transition.dots[1].y > 0.2 * result.height,
      `${label}: sample vertically separated dots in ${transition.sectionId}`);
    for (const dot of transition.dots) {
      assert.ok(dot.samples.every(sample => sample.radius !== null),
        `${label}: same ${transition.sectionId} dot remains visible during equal scroll steps: ${JSON.stringify(dot)}`);
      const increments = dot.samples.slice(1).map((sample, i) =>
        (sample.radius - dot.samples[i].radius) / (sample.scroll - dot.samples[i].scroll));
      const mean = increments.reduce((sum, increment) => sum + increment, 0) / increments.length;
      assert.ok(mean > 0, `${label}: ${transition.sectionId} dot grows while scrolling: ${JSON.stringify(dot)}`);
      for (const increment of increments) {
        assert.ok(Math.abs(increment - mean) <= 0.02 * mean,
          `${label}: ${transition.sectionId} dot has one radius rate: ${JSON.stringify(increments)}, ${JSON.stringify(dot)}`);
      }
      slopes.push({sectionId:transition.sectionId, x:dot.x, y:dot.y, slope:mean});
    }
  }
  const averageSlope = slopes.reduce((sum, dot) => sum + dot.slope, 0) / slopes.length;
  for (const dot of slopes) {
    assert.ok(Math.abs(dot.slope - averageSlope) <= 0.02 * averageSlope,
      `${label}: growth rate matches across positions and both transitions: ${JSON.stringify(slopes)}`);
  }
  const [google, nick] = result.transitions;
  for (let i = 0; i < google.partialBands.length; i++) {
    const orangeBand = google.partialBands[i], blackBand = nick.partialBands[i];
    assert.equal(orangeBand.progress, blackBand.progress,
      `${label}: compare transition bands at equal scroll progress`);
    assert.ok(orangeBand.rows >= 12 && blackBand.rows >= 12,
      `${label}: at least 12 visible growing rows in both transitions at ${orangeBand.progress}: ${JSON.stringify([orangeBand, blackBand])}`);
    assert.ok(Math.abs(orangeBand.rows - blackBand.rows) <= 2 &&
      Math.abs(orangeBand.height - blackBand.height) <= 0.035 * result.height,
    `${label}: Google and black transition dot bands have matching vertical area at ${orangeBand.progress}: ${JSON.stringify([orangeBand, blackBand])}`);
  }
}

async function checkJobSections(session, variant) {
  const result = await evaluate(session, `(() => {
    const ids = ['google', 'nick', 'hedra', 'skills-header'];
    const sections = ids.map(id => document.getElementById(id));
    return {
      ids:sections.map(section => section?.id),
      edges:sections.map(section => {
        const rect = section.getBoundingClientRect();
        return {top:rect.top + scrollY, bottom:rect.bottom + scrollY, height:rect.height};
      }),
      nickJob:sections[1].classList.contains('job-section'),
      hedraJob:sections[2].classList.contains('job-section'),
      nickColor:getComputedStyle(sections[1]).backgroundColor,
      hedraColor:getComputedStyle(sections[2]).backgroundColor,
      googleCanvasOutside:!sections[0].contains(document.getElementById('google-halftone')),
      nickCanvasOutside:!sections[1].contains(document.getElementById('nick-halftone')),
      viewport:innerHeight
    };
  })()`);
  const label = `${variant}: restored job sections`;
  assert.deepEqual(result.ids, ['google', 'nick', 'hedra', 'skills-header'], `${label}: sections exist`);
  assert.ok(result.nickJob && result.hedraJob, `${label}: both job sections are restored`);
  for (let i = 0; i < result.edges.length - 1; i++) {
    assert.ok(Math.abs(result.edges[i].bottom - result.edges[i + 1].top) < 1,
      `${label}: ${result.ids[i]} joins ${result.ids[i + 1]} without a gap`);
  }
  assert.ok(Math.abs(result.edges[1].height - result.viewport * 0.7) <= 1,
    `${label}: orange section is 70% of the viewport tall`);
  assert.ok(Math.abs(result.edges[2].height - result.viewport) <= 1,
    `${label}: black section is one viewport tall`);
  assert.equal(result.nickColor, 'rgb(255, 255, 255)', `${label}: orange field is painted by the canvas`);
  assert.equal(result.hedraColor, 'rgb(255, 255, 255)', `${label}: black field is painted by the canvas`);
  assert.ok(result.googleCanvasOutside && result.nickCanvasOutside,
    `${label}: viewport overlays are outside the clipped sections`);
}

async function checkJobMotion(session, variant) {
  await send('Page.bringToFront', {}, session);
  const result = await evaluate(session, `(async () => {
    const sample = async (id, bottomFraction) => {
      const section = document.getElementById(id);
      const content = section.querySelector('.job-content');
      scrollTo({ top: section.getBoundingClientRect().bottom + scrollY - bottomFraction * innerHeight,
        behavior: 'instant' });
      ScrollTrigger.update();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const button = section.querySelector('.job-scroll-button');
      const rect = button.getBoundingClientRect();
      const style = getComputedStyle(content);
      return { scroll: scrollY, top: content.getBoundingClientRect().top,
        sectionTop: section.getBoundingClientRect().top, sectionHeight: section.getBoundingClientRect().height,
        cssTop: style.top, transform: style.transform, animationRange: style.animationRange,
        jobLayout: content.dataset.jobLayout,
        opacity: Number(style.opacity), position: style.position,
        buttonHit: document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)?.id };
    };
    const entry = {};
    for (const id of ['nick', 'hedra']) {
      const section = document.getElementById(id);
      const entryTop = id === 'nick' ? innerHeight : innerHeight * 0.8;
      entry[id] = await sample(id, (entryTop + section.getBoundingClientRect().height) / innerHeight);
    }
    const nick = [await sample('nick', 1), await sample('nick', 0.8), await sample('nick', 0.55)];
    const hedra = [await sample('hedra', 1), await sample('hedra', 0.8), await sample('hedra', 0.3)];
    const google = document.getElementById('google');
    const googleRowsBottom = Math.max(...[...google.querySelectorAll('.google-section')]
      .map(row => row.getBoundingClientRect().bottom + scrollY));
    scrollTo({ top: googleRowsBottom - innerHeight * 0.5, behavior: 'instant' });
    ScrollTrigger.update();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const nickEarlyOpacity = Number(getComputedStyle(document.querySelector('#nick .job-content')).opacity);
    const nickSection = document.getElementById('nick');
    scrollTo({ top: nickSection.getBoundingClientRect().bottom + scrollY - innerHeight * 0.5,
      behavior: 'instant' });
    ScrollTrigger.update();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const blackCanvas = document.getElementById('nick-halftone');
    const nickContent = document.querySelector('#nick .job-content');
    const hedraContent = document.querySelector('#hedra .job-content');
    const originalPointerEvents = [blackCanvas, nickContent, hedraContent]
      .map(element => element.style.pointerEvents);
    let layering;
    try {
      // Let the hit test observe paint order through the normally click-through canvas.
      [blackCanvas, nickContent, hedraContent].forEach(element => element.style.pointerEvents = 'auto');
      const centerHit = selector => {
        const rect = document.querySelector(selector).getBoundingClientRect();
        return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      };
      layering = { nick: centerHit('#nick .job-logo')?.id,
        hedra: hedraContent.contains(centerHit('#hedra .job-logo')) };
    } finally {
      [blackCanvas, nickContent, hedraContent].forEach((element, index) =>
        element.style.pointerEvents = originalPointerEvents[index]);
    }
    return {
      entry, nick, hedra, viewport: innerHeight,
      layering,
      nickEarlyOpacity,
      hedraEarlyOpacity: Number(getComputedStyle(document.querySelector('#hedra .job-content')).opacity),
      nickLogoColor: getComputedStyle(document.querySelector('#nick .job-logo')).backgroundColor,
      jobLayer: Number(getComputedStyle(document.querySelector('#hedra .job-content')).zIndex),
      skillsLayer: Number(getComputedStyle(document.getElementById('skills-header')).zIndex),
      skillsBodyLayer: Number(getComputedStyle(document.getElementById('skills')).zIndex)
    };
  })()`);
  for (const [id, samples] of [['nick', result.nick], ['hedra', result.hedra]]) {
    assert.ok(samples.every(sample => sample.position === 'absolute'), `${variant}: ${id} moves with its section`);
    const rate = (samples[0].top - samples[1].top) / (samples[1].scroll - samples[0].scroll);
    assert.ok(rate > 0.75 && rate < 0.85, `${variant}: ${id} scrolls at about 80% page speed (${rate}) ${JSON.stringify(samples)}`);
    assert.equal(samples[0].buttonHit, `${id}-scroll-button`, `${variant}: ${id} arrow receives pointer clicks`);
  }
  for (const id of ['nick', 'hedra']) {
    assert.ok(Math.abs(result.entry[id].top - result.viewport) < 25,
      `${variant}: ${id} enters from the bottom edge ${JSON.stringify(result.entry[id])}`);
  }
  assert.ok(result.nick[1].top > result.viewport * 0.2 && result.nick[1].top < result.viewport * 0.4,
    `${variant}: Nickelodeon reaches the upper-middle before black dots appear`);
  assert.ok(result.hedra[0].top > result.viewport * 0.3 && result.hedra[0].top < result.viewport * 0.4,
    `${variant}: Hedra reaches the upper-middle as Skills arrives`);
  assert.equal(result.nickEarlyOpacity, 1, `${variant}: Nickelodeon enters without a fade`);
  assert.equal(result.nick[2].opacity, 1, `${variant}: Nickelodeon exits without a fade`);
  assert.equal(result.hedraEarlyOpacity, 1, `${variant}: Hedra enters without a fade`);
  assert.equal(result.nickLogoColor, 'rgb(141, 198, 63)', `${variant}: Nickelodeon badge is green`);
  assert.equal(result.layering.nick, 'nick-halftone', `${variant}: black dots paint over Nickelodeon`);
  assert.equal(result.layering.hedra, true, `${variant}: Hedra paints over black dots`);
  assert.equal(result.hedra[2].opacity, 1, `${variant}: Hedra remains visible near Skills`);
  assert.ok(result.skillsLayer > result.jobLayer && result.skillsBodyLayer > result.jobLayer,
    `${variant}: Skills covers the Hedra content`);
}

async function checkGoogleDoodleLayering(session, variant) {
  await send('Page.bringToFront', {}, session);
  const candidates = await evaluate(session, `(async () => {
    const google = document.getElementById('google');
    const canvas = document.getElementById('google-halftone');
    const context = canvas.getContext('2d');
    const doodleEnd = Math.max(...[...google.querySelectorAll('.doodle-img')]
      .map(image => image.getBoundingClientRect().bottom + scrollY));
    const dpr = devicePixelRatio;
    let stats;
    const collect = () => {
      stats = {inside:0, opaque:0, hitImage:0, overlap:0};
      const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const points = [];
      for (const image of document.querySelectorAll('#google .doodle-img')) {
        const rect = image.getBoundingClientRect();
        const left = Math.max(2, Math.ceil(rect.left + 3));
        const right = Math.min(innerWidth - 2, Math.floor(rect.right - 3));
        const top = Math.max(2, Math.ceil(rect.top + 3));
        const bottom = Math.min(innerHeight - 2, Math.floor(rect.bottom - 3),
          Math.floor(google.getBoundingClientRect().bottom - 2));
        for (let y = top; y < bottom; y += 6) {
          for (let x = left; x < right; x += 6) {
            const index = (Math.round(y * dpr) * canvas.width + Math.round(x * dpr)) * 4 + 3;
            const opaque = rgba[index] >= 253;
            const hitImage = document.elementFromPoint(x, y) === image;
            stats.inside++;
            if (opaque) stats.opaque++;
            if (hitImage) stats.hitImage++;
            if (opaque && hitImage) stats.overlap++;
            if (!opaque || !hitImage) continue;
            points.push([x, y]);
            if (points.length >= 1200) return points;
          }
        }
      }
      return points;
    };
    let best = {scroll:0, count:0};
    const history = [];
    for (const fraction of [0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3]) {
      const targetScroll = Math.round(doodleEnd - fraction * innerHeight);
      scrollTo({top:targetScroll, behavior:'instant'});
      ScrollTrigger.update();
      const count = collect().length;
      history.push({fraction, ...stats});
      if (count > best.count) best = {scroll:targetScroll, doodleBottom:fraction * innerHeight, count};
    }
    scrollTo({top:best.scroll, behavior:'instant'});
    ScrollTrigger.update();
    await new Promise(resolve => setTimeout(resolve, 250));
    return {points:collect(), best, history};
  })()`);
  const label = `${variant}: halftone above Google doodles`;
  assert.ok(candidates.points.length > 5,
    `${label}: opaque dots must naturally overlap visible doodle images: ${JSON.stringify(candidates.best)}, ${JSON.stringify(candidates.history)}`);
  const shown = await send('Page.captureScreenshot', {format:'png', fromSurface:true}, session);
  await evaluate(session, `document.getElementById('google-halftone').style.visibility = 'hidden'`);
  let hidden;
  try {
    hidden = await send('Page.captureScreenshot', {format:'png', fromSurface:true}, session);
  } finally {
    await evaluate(session, `document.getElementById('google-halftone').style.visibility = 'visible'`);
  }
  const sources = [shown, hidden].map(image => `data:image/png;base64,${image.data}`);
  const result = await evaluate(session, `(async () => {
    const sources = ${JSON.stringify(sources)};
    const points = ${JSON.stringify(candidates.points)};
    const images = await Promise.all(sources.map(async source => {
      const image = new Image(); image.src = source; await image.decode();
      const bitmap = document.createElement('canvas');
      bitmap.width = image.width; bitmap.height = image.height;
      const context = bitmap.getContext('2d');
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, image.width, image.height).data;
    }));
    let doodlePixels = 0, covered = 0;
    const orange = [255, 121, 0], white = [255, 255, 255];
    const difference = (data, index, color) =>
      Math.max(...[0, 1, 2].map(channel => Math.abs(data[index + channel] - color[channel])));
    for (const [x, y] of points) {
      const index = (y * innerWidth + x) * 4;
      if (difference(images[1], index, white) < 25 || difference(images[1], index, orange) < 30) continue;
      doodlePixels++;
      if (difference(images[0], index, orange) <= 6) covered++;
    }
    return {doodlePixels, covered};
  })()`);
  assert.ok(result.doodlePixels > 5,
    `${label}: identify visible nonwhite doodle pixels under opaque dots: ${JSON.stringify(result)}`);
  assert.ok(result.covered >= 0.9 * result.doodlePixels,
    `${label}: orange pixels must cover the doodles while hit testing passes through: ${JSON.stringify(result)}`);
}

async function checkOutroSynchronization(session, variant) {
  await send('Page.bringToFront', {}, session);
  // Screenshot comparison pauses scrub tweens; measure the live behavior here.
  await evaluate(session, 'ScrollTrigger.getAll().forEach(trigger => trigger.getTween()?.play?.());');
  const result = await evaluate(session, `(async () => {
    const section = document.getElementById('outro');
    const top = section.getBoundingClientRect().top + scrollY;
    const height = section.getBoundingClientRect().height;
    const layers = [...section.querySelectorAll('.parallax-bg')].map((element, i) =>
      [element, (-5 - i * 7) * innerHeight / 100]);
    layers.push([document.getElementById('outro-sun'), -0.55 * innerHeight],
      [document.getElementById('outro-info'), -0.14 * innerHeight]);
    let maxError = 0, maxDrift = 0;
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
    const translations = () => layers.map(([element]) => {
      const transform = getComputedStyle(element).transform;
      return transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42;
    });
    // Rapid jumps and reversals, without forcing ScrollTrigger.update() or
    // completing scrub tweens: settled screenshots cannot detect catch-up lag.
    for (const fraction of [0.15, 0.8, 0.3, 0.95, 0.4, 1, 0.2]) {
      window.scrollTo({top: Math.round(top - innerHeight + fraction * height), behavior: 'instant'});
      await frame(); await frame();
      const progress = Math.max(0, Math.min(1, (scrollY - top + innerHeight) / height));
      const immediate = translations();
      layers.forEach(([, from], i) => {
        maxError = Math.max(maxError, Math.abs(immediate[i] - (from + (1 - from) * progress)));
      });
      await new Promise(resolve => setTimeout(resolve, 160));
      const settled = translations();
      maxDrift = Math.max(maxDrift, ...settled.map((value, i) => Math.abs(value - immediate[i])));
    }
    return {maxError, maxDrift};
  })()`);
  if (variant !== 'baseline') {
    const roundingTolerance = variant === 'fallback' ? 0.25 : 0.15;
    assert.ok(result.maxError < roundingTolerance, `${variant}: outro layers lag scroll by ${result.maxError}px`);
    assert.ok(result.maxDrift < 0.15, `${variant}: outro layers drift ${result.maxDrift}px after scroll stops`);
  }
  console.log(`${variant}: outro synchronization ${JSON.stringify(result)}`);
}

async function runScrollProfile(session, variant, width, height) {
  // Other comparison tabs must not compete with the measured page's animations.
  for (const candidate of variants) {
    await evaluate(sessions[candidate], `(() => {
      if (!document.getElementById('scroll-profile-isolation')) {
        const style = document.createElement('style'); style.id = 'scroll-profile-isolation';
        style.textContent = '.profile-inactive *, .profile-inactive *::before, .profile-inactive *::after { animation-play-state: paused !important; transition: none !important; }';
        document.head.append(style);
      }
      document.documentElement.classList.toggle('profile-inactive', ${candidate !== variant});
      gsap.ticker.${candidate === variant ? 'wake' : 'sleep'}();
    })()`);
  }
  await send('Page.bringToFront', {}, session);
  await send('Performance.enable', {}, session);
  await send('LayerTree.enable', {}, session);
  await send('Emulation.setCPUThrottlingRate', { rate: 4 }, session);
  await evaluate(session, `window.scrollTo({top: document.getElementById('${profileSection}').getBoundingClientRect().top + scrollY - innerHeight - 100, behavior: 'instant'});`);
  await delay(800);
  layerState = { session, maxLayers: 0 };
  const events = [];
  let complete;
  const completion = new Promise(resolve => { complete = resolve; });
  traceState = { events, complete };
  await send('Tracing.start', {
    categories: 'devtools.timeline,blink.user_timing,disabled-by-default-devtools.timeline',
    transferMode: 'ReportEvents',
  });
  const before = (await send('Performance.getMetrics', {}, session)).metrics;
  const frames = await evaluate(session, `new Promise(resolve => {
    const el = document.getElementById('${profileSection}');
    const top = el.getBoundingClientRect().top + scrollY;
    const start = top - innerHeight - 100;
    const end = Math.min(document.documentElement.scrollHeight - innerHeight, top + el.offsetHeight + 100);
    const intervals = [];
    const lag = { sun: [], info: [], skyline: [] };
    let first, previous;
    performance.mark('${profileSection}-profile-${variant}');
    function step(now) {
      first ??= now;
      if (previous !== undefined) intervals.push(now - previous);
      previous = now;
      if ('${profileSection}' === 'outro' && scrollY > top - innerHeight && scrollY < top) {
        const progress = Math.max(0, Math.min(1, (scrollY - top + innerHeight) / el.offsetHeight));
        for (const [name, selector, from] of [
          ['sun', '#outro-sun', -0.55 * innerHeight],
          ['info', '#outro-info', -0.14 * innerHeight],
          ['skyline', '#outro .parallax-bg', -0.05 * innerHeight],
        ]) {
          const transform = getComputedStyle(document.querySelector(selector)).transform;
          const actual = transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42;
          lag[name].push(Math.abs(actual - (from + (1 - from) * progress)));
        }
      }
      const progress = Math.min(1, (now - first) / 6000);
      const position = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
      window.scrollTo({top: start + (end - start) * position, behavior: 'instant'});
      if (progress < 1) requestAnimationFrame(step);
      else {
        intervals.sort((a,b) => a-b);
        resolve({frames:intervals.length, p95:intervals[Math.floor(intervals.length*.95)],
          max:intervals.at(-1), over33ms:intervals.filter(n => n>33.4).length,
          lagPixels: Object.fromEntries(Object.entries(lag).filter(([, values]) => values.length).map(([name, values]) => {
            values.sort((a,b) => a-b);
            return [name, {p95: +values[Math.floor(values.length*.95)].toFixed(3), max: +values.at(-1).toFixed(3)}];
          }))});
      }
    }
    requestAnimationFrame(step);
  })`);
  const after = (await send('Performance.getMetrics', {}, session)).metrics;
  await send('Tracing.end');
  await completion;
  const marker = events.find(event => event.name === `${profileSection}-profile-${variant}`);
  assert.ok(marker, 'The trace must include the measured page.');
  const frameId = (await send('Page.getFrameTree', {}, session)).frameTree.frame.id;
  const main = events.filter(event => {
    const eventFrame = event.args?.data?.frame || event.args?.beginData?.frame || event.args?.frame;
    return event.pid === marker.pid && event.tid === marker.tid && event.ph === 'X'
      && (!eventFrame || eventFrame === frameId);
  });
  const totals = {};
  for (const name of ['Layout', 'UpdateLayoutTree', 'Paint', 'PrePaint', 'FunctionCall', 'FireAnimationFrame']) {
    const matching = main.filter(event => event.name === name);
    totals[name] = { count: matching.length, ms: +(matching.reduce((sum, event) => sum + (event.dur || 0), 0) / 1000).toFixed(2),
      maxMs: +(Math.max(0, ...matching.map(event => event.dur || 0)) / 1000).toFixed(2) };
  }
  const delta = {};
  for (const name of ['LayoutCount', 'RecalcStyleCount', 'LayoutDuration', 'RecalcStyleDuration', 'ScriptDuration', 'TaskDuration']) {
    delta[name] = +((after.find(metric => metric.name === name)?.value || 0) - (before.find(metric => metric.name === name)?.value || 0)).toFixed(4);
  }
  const file = path.join(os.tmpdir(), `portfolio-${profileSection}-${variant}-${width}x${height}.json`);
  await writeFile(file, JSON.stringify({traceEvents:events}));
  console.log(JSON.stringify({variant, viewport:`${width}x${height}`, cpuThrottle:4,
    frames, metrics:delta, trace:totals, layers:{ maxLayers:layerState.maxLayers }, triggerCount:await evaluate(session, 'ScrollTrigger.getAll().length'), traceFile:file}));
  traceState = undefined;
  layerState = undefined;
  await send('Emulation.setCPUThrottlingRate', { rate: 1 }, session);
}

try {
  for (const variant of variants) {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    sessions[variant] = sessionId;
    await send('Page.enable', {}, sessionId);
    await send('Runtime.enable', {}, sessionId);
  }
  for (const [width, height] of viewports) {
    for (const variant of variants) {
      const session = sessions[variant];
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, session);
      await send('Page.navigate', { url: `${origin}/${variant}/` }, session);
      await send('Page.bringToFront', {}, session);
      for (let attempts = 0; attempts < 100; attempts++) {
        if (await evaluate(session, `document.readyState === 'complete' && typeof ScrollTrigger !== 'undefined' && ScrollTrigger.getAll().length > 0`)) break;
        await delay(50);
      }
      await evaluate(session, `document.fonts.ready.then(() => true)`);
      // Load lazy images before comparing so layout is independent of fetch timing.
      await evaluate(session, `Promise.all([...document.images].map(img => {
        img.loading = 'eager';
        return img.complete ? null : new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
      }))`);
      await evaluate(session, 'ScrollTrigger.refresh();');
      if (!profileSection) {
        await evaluate(session, `(() => { const style = document.createElement('style'); style.textContent = '*, *::before, *::after { transition: none !important; } #intro-scroll-button, #david-upper, #david-arm, #david-hand { animation-play-state: paused !important; }'; document.head.append(style); })()`);
        // Freeze unrelated looping character motion and button pulsing for visual comparisons.
        await evaluate(session, `document.getAnimations().filter(a => a.effect.getTiming().iterations === Infinity).forEach(a => { a.pause(); a.currentTime = 0; })`);
      }
    }
    await delay(1600);
    if (profileSection) {
      for (const variant of variants) await runScrollProfile(sessions[variant], variant, width, height);
      continue;
    }
      const counts = await Promise.all(variants.map(v => evaluate(sessions[v], 'ScrollTrigger.getAll().length')));
      const skillsActivated = await evaluate(sessions.native, `document.querySelector('#skills .parallax-container').classList.contains('parallax-active')`);
      assert.equal(counts[1] - counts[0], control ? 0 : 14 + Number(skillsActivated), 'CSS should replace imagery and job triggers and remove the skills activation trigger after entry.');
      const positions = await evaluate(sessions.fallback, `(() => {
        const top = id => document.getElementById(id).getBoundingClientRect().top + scrollY;
        const height = id => document.getElementById(id).offsetHeight;
        const points = [0];
        for (const f of [0.1, 0.25, 0.5, 0.75, 1]) points.push(f * height('intro'));
        for (const id of ['map', 'google', 'nick', 'hedra', 'skills']) {
          const start = top(id) - innerHeight;
          const range = height(id) + innerHeight;
          for (const f of [0, 0.2, 0.5, 0.8, 1]) points.push(start + f * range);
        }
        for (const f of [0, 0.2, 0.5, 0.8, 1]) points.push(top('outro') - innerHeight + f * height('outro'));
        return [...new Set(points.map(p => Math.round(Math.max(0, Math.min(document.documentElement.scrollHeight - innerHeight, p)))))].sort((a,b) => a-b);
      })()`);
      // Sample both directions; callbacks and staggered reveals must also match.
      const scrollPositions = [...positions, ...positions.toReversed()];
      for (let index = 0; index < scrollPositions.length; index++) {
        const y = scrollPositions[index];
        await Promise.all(variants.map(v => evaluate(sessions[v], `window.scrollTo({ top: ${y}, behavior: 'instant' }); ScrollTrigger.update();`)));
        await delay(60);
        const snapshots = [];
        for (const v of variants) {
          await send('Page.bringToFront', {}, sessions[v]);
          await evaluate(sessions[v], 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
          await evaluate(sessions[v], 'ScrollTrigger.getAll().forEach(trigger => trigger.getTween()?.progress?.(1));');
          snapshots.push(JSON.parse(await evaluate(sessions[v], snapshot)));
        }
        const label = `${width}x${height}, scroll=${y}, ${index < positions.length ? 'down' : 'up'}`;
        try { compare(snapshots[0], snapshots[1], label); } catch (error) {
          console.log(await evaluate(sessions.native, `JSON.stringify([...document.querySelectorAll('#intro, #fg, #map, #map-path, #skills, .skill-section, #outro')].map(el => { const s=getComputedStyle(el); return { id:el.id||el.className, transform:s.transform, animation:s.animation, timeline:s.animationTimeline, view:s.viewTimeline, range:s.animationRange, overflow:s.overflow, from:s.getPropertyValue('--parallax-from'), to:s.getPropertyValue('--parallax-to'), effects:el.getAnimations().map(a=>({time:a.currentTime,state:a.playState,timeline:a.timeline?.constructor.name,source:a.timeline?.source?.tagName})) }; }))`));
          throw error;
        }
        if (compareHead) compare(snapshots[1], snapshots[2], `${label}, original`);
        if (index < positions.length && index % 4 === 0) {
          await compareScreenshots(label);
          if (compareHead) await compareScreenshots(`${label}, baseline`, 'baseline');
        }
      }
      console.log(`${width}x${height}: matched geometry, reveal states, and screenshots; ${counts[1]} -> ${counts[0]} ScrollTriggers.`);
      for (const variant of variants) await checkOutroSynchronization(sessions[variant], variant);
      for (const variant of ['native', 'fallback']) {
        const label = `${width}x${height}, ${variant}`;
        await checkJobSections(sessions[variant], label);
        await checkJobMotion(sessions[variant], label);
        await checkSectionHalftone(sessions[variant], label, 'google', 'google-halftone', [255, 121, 0]);
        await checkSectionHalftoneComposite(sessions[variant], label, 'google', 'google-halftone',
          [255, 255, 255], [255, 121, 0]);
        await checkHalftoneBoundaryCoverage(sessions[variant], label, 'google', 'google-halftone');
        await checkSectionHalftone(sessions[variant], label, 'nick', 'nick-halftone', [0, 0, 0]);
        await checkSectionHalftoneComposite(sessions[variant], label, 'nick', 'nick-halftone',
          [255, 121, 0], [0, 0, 0]);
        await checkHalftoneBoundaryCoverage(sessions[variant], label, 'nick', 'nick-halftone');
        await checkHalftoneLinearFlow(sessions[variant], label, 'nick', 'nick-halftone', [0, 0, 0]);
        await checkHalftoneLinearFlow(sessions[variant], label, 'google', 'google-halftone', [255, 121, 0]);
        await checkHalftoneDotGrowth(sessions[variant], label);
        await checkGoogleDoodleLayering(sessions[variant], label);
      }
      console.log(`${width}x${height}: orange/black halftone thresholds, reversals, doodle overlap, and click-through passed.`);
    }
    if (!profileSection) {
    // Rotate an already loaded page. CSS units and GSAP's captured lengths can differ.
    await Promise.all(variants.map(v => send('Emulation.setDeviceMetricsOverride', {
      width: 1024, height: 768, deviceScaleFactor: 1, mobile: false,
    }, sessions[v])));
    await delay(400);
    await Promise.all(variants.map(v => evaluate(sessions[v], 'ScrollTrigger.refresh();')));
    for (const id of ['intro', 'map', 'google', 'nick', 'hedra', 'skills', 'outro']) {
      const y = await evaluate(sessions.fallback, `(() => { const el = document.getElementById('${id}'); return Math.max(0, Math.round(el.getBoundingClientRect().top + scrollY + el.offsetHeight / 2 - innerHeight / 2)); })()`);
      const snapshots = [];
      for (const v of variants) {
        await send('Page.bringToFront', {}, sessions[v]);
        await evaluate(sessions[v], `window.scrollTo({ top: ${y}, behavior: 'instant' }); ScrollTrigger.update(); ScrollTrigger.getAll().forEach(t => t.getTween()?.progress?.(1));`);
        await evaluate(sessions[v], 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
        snapshots.push(JSON.parse(await evaluate(sessions[v], snapshot)));
      }
      compare(snapshots[0], snapshots[1], `resized, ${id}`);
      if (compareHead) compare(snapshots[1], snapshots[2], `resized, ${id}, original`);
      await compareScreenshots(`resized, ${id}`);
    }
    console.log('Viewport rotation: geometry and screenshots matched.');
    for (const [id, duration, target, source] of [
      ['intro-scroll-button', 8, '#google'],
      ['map-scroll-button', 6, '#nick', 'map-info'],
      ['skills-scroll-button', 4, 'max'],
      ['nick-scroll-button', 2, '#hedra', 'nick'],
      ['hedra-scroll-button', 2, '#skills-header', 'hedra'],
    ]) {
      const destinations = [];
      for (const variant of variants) {
        const session = sessions[variant];
        await send('Page.bringToFront', {}, session);
        const hit = await evaluate(session, `(async () => {
          gsap.killTweensOf(window);
          const source = ${JSON.stringify(source ?? null)};
          const start = source ? document.getElementById(source).getBoundingClientRect().top + scrollY : 0;
          window.scrollTo({ top: start, behavior: 'instant' }); ScrollTrigger.update();
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const button = document.getElementById('${id}'); button.disabled = false;
          const rect = button.getBoundingClientRect();
          const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
          return { x, y, target: document.elementFromPoint(x, y)?.id, rect: rect.toJSON() };
        })()`);
        if (source) {
          assert.equal(hit.target, id, `${id}: pointer reaches the visible arrow ${JSON.stringify(hit)}`);
          await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: hit.x, y: hit.y,
            button: 'left', clickCount: 1 }, session);
          await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: hit.x, y: hit.y,
            button: 'left', clickCount: 1 }, session);
        } else {
          await evaluate(session, `document.getElementById('${id}').click()`);
        }
        const result = await evaluate(session, `(() => {
          const button = document.getElementById('${id}');
          const tween = gsap.getTweensOf(window).find(t => t.vars.scrollTo);
          tween.pause();
          const config = { disabled: button.disabled, duration: tween.duration(),
            target: tween.vars.scrollTo.y, autoKill: tween.vars.scrollTo.autoKill, ease: tween.vars.ease };
          tween.progress(1);
          const scroll = scrollY; tween.kill();
          return { ...config, scroll };
        })()`);
        assert.equal(result.disabled, true, `${id}: disabled on click`);
        assert.equal(result.duration, duration, `${id}: duration`);
        assert.equal(result.target, target, `${id}: destination`);
        assert.equal(result.autoKill, true, `${id}: user interruption`);
        assert.equal(result.ease, 'sine.inOut', `${id}: easing`);
        destinations.push(result.scroll);
      }
      assert.ok(destinations.every(y => y === destinations[0]), `${id}: final scroll position`);
    }
    console.log('Scroll buttons: durations, easing, interruption settings, and destinations matched.');
    console.log(`Passed ${checks} state comparisons and ${visualChecks} screenshot comparisons. Worst pixel difference: ${(worstVisualDifference * 100).toFixed(3)}%.`);
  }
} finally {
  await send('Browser.close').catch(() => {});
  ws.close();
  chrome.kill();
  server.close();
  await delay(500);
  assert.equal(path.dirname(profile), path.resolve(os.tmpdir()));
  assert.ok(path.basename(profile).startsWith('portfolio-parallax-'));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
