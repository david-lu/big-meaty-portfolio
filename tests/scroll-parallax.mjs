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
const profileHalftone = process.argv.includes('--profile-halftone');
const profileSection = profileHalftone ? 'nick' : profileOutro ? 'outro' : profileSkills ? 'skills' : undefined;
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
    // GSAP rounds timeline boundaries to whole pixels; CSS keeps fractions.
    // Bound the sun's resulting position difference from those exact ranges.
    const start = section.top + scrollY - innerHeight, end = start + section.height;
    const clamp = value => Math.max(0, Math.min(1, value));
    const rangeRounding = el.id === 'outro-sun' ? Math.abs(
      clamp((scrollY - start) / (end - start)) -
      clamp((scrollY - Math.round(start)) / (Math.round(end) - Math.round(start)))
    ) * (0.55 * innerHeight + 1) : 0;
    return { id: el.id || el.getAttribute('src') || el.className,
      visibleSection: section.top < innerHeight && section.bottom > 0,
      rangeRounding,
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
      const rounding = property === 'y' ? Math.max(element.rangeRounding, other.rangeRounding) : 0;
      assert.ok(Math.abs(element[property] - other[property]) < 0.15 + rounding,
        `${label}: ${element.id} ${property}: ${element[property]} vs ${other[property]}`);
    }
    for (const property of ['id', 'opacity', 'visibility', 'dash', 'classes', 'disabled']) {
      assert.deepEqual(element[property], other[property], `${label}: ${element.id} ${property}`);
    }
  });
  checks++;
}
async function compareScreenshots(label, reference = 'fallback', fromSurface = false) {
  const images = [];
  for (const variant of ['native', reference]) {
    await send('Page.bringToFront', {}, sessions[variant]);
    await evaluate(sessions[variant], 'ScrollTrigger.getAll().forEach(t => { const tween = t.getTween(); if (tween) tween.pause().progress(1); });');
    await evaluate(sessions[variant], 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    images.push(await send('Page.captureScreenshot', { format: 'png', fromSurface }, sessions[variant]));
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

async function checkHalftoneGrowth(session, variant) {
  await send('Page.bringToFront', {}, session);
  const sections = [];
  // Keep each readback sequence within its own DevTools command timeout.
  for (const sectionId of ['nick', 'hedra']) {
    sections.push(...await evaluate(session, `(async () => {
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const results = [];
    for (const section of document.querySelectorAll('#${sectionId}.job-section')) {
      const rect = section.getBoundingClientRect(), top = rect.top + scrollY;
      const pitch = rect.height / 1.48 / 45, rowPitch = rect.height / 1.48 * 0.48 / 14, dpr = devicePixelRatio;
      const canvas = section.querySelector('canvas.halftone-background');
      const context = canvas.getContext('2d');
      const count = Math.ceil(rect.width / pitch);
      const channel = section.id === 'nick' ? 2 : 0;
      const probeY = (innerHeight - 23.5 * rowPitch) * dpr;
      const radii = [];
      let draws = 0;
      const originalFill = context.fill, originalFillRect = context.fillRect, originalArc = context.arc;
      context.fill = function(...args) { draws++; return originalFill.apply(this, args); };
      context.fillRect = function(...args) {
        draws++;
        if (args[0]===0&&args[1]===0&&args[2]===canvas.width&&args[3]===canvas.height) radii.fill(0);
        return originalFillRect.apply(this, args);
      };
      context.arc = function(...args) {
        if (Math.abs(args[1] - probeY) < 0.01) {
          radii[Math.round(args[0] / (pitch * dpr) - 0.5)] = args[2] / dpr;
        }
        return originalArc.apply(this, args);
      };
      const read = () => {
        // Read one isolated row of dots. Reading a large canvas every frame
        // can stall Chrome's GPU and distort the timing being measured.
        const firstY = Math.floor(probeY - rowPitch * dpr / 2);
        const lastY = Math.ceil(probeY + rowPitch * dpr / 2);
        const image = context.getImageData(0, firstY, canvas.width, lastY - firstY);
        return Array.from({length:count}, (_, index) => {
          const left = Math.round(index * pitch * dpr);
          const right = Math.min(image.width, Math.round((index + 1) * pitch * dpr));
          let ink = 0, cellInk = 0, xSum = 0, ySum = 0;
          for (let y = 0; y < image.height; y++) {
            for (let x = left; x < right; x++) {
              const value = 255 - image.data[(y * image.width + x) * 4 + channel];
              ink += value;
              if (Math.abs(firstY + y + 0.5 - probeY) < rowPitch * dpr / 2) {
                cellInk += value;
                xSum += (x + 0.5) * value;
                ySum += (firstY + y + 0.5) * value;
              }
            }
          }
          return {ink,cellInk,radius:radii[index],pixels:(right-left)*image.height,x:xSum/cellInk/dpr,y:ySum/cellInk/dpr};
        });
      };
      const move = rows => {
        scrollTo({top:Math.round(top - innerHeight + rows * rowPitch), behavior:'instant'});
        ScrollTrigger.update();
      };
      const settledMove = async rows => {
        move(rows); await frame(); return read();
      };
      const measure = rows => {
        move(rows);
        return {rows:(scrollY-top+innerHeight)/rowPitch,columns:read()};
      };
      const anchors = [];
      let solidCapHasSeams = false;
      for (const rows of [-5.15, 0.15, 25.35, 50.1, 50.3, 80.15, 79.8, 105.25]) {
        scrollTo({top:Math.round(top - innerHeight + rows * rowPitch), behavior:'instant'});
        anchors.push(canvas.getBoundingClientRect().top);
        await frame(); anchors.push(canvas.getBoundingClientRect().top);
        if (rows === 0.15) {
          const line = context.getImageData(0, Math.round((innerHeight - 4 * rowPitch) * dpr), canvas.width, 1).data;
          for (let x = 0; x < canvas.width; x++) {
            solidCapHasSeams ||= line[x * 4 + channel] < 254;
          }
        }
      }
      const before = await settledMove(27.15), beforeRows = (scrollY-top+innerHeight)/rowPitch;
      const content = document.createElement('button');
      content.textContent = 'Background content probe';
      content.style.cssText = 'position:absolute;left:30px;top:' + (-section.getBoundingClientRect().top + innerHeight * 0.3) + 'px';
      section.append(content);
      const buttonRect = content.getBoundingClientRect();
      const contentInteractive = document.elementFromPoint(buttonRect.left + buttonRect.width/2, buttonRect.top + buttonRect.height/2) === content;
      content.remove();
      // Inspect each small scroll change immediately, before another frame.
      const single = [{rows:beforeRows,columns:before}];
      for (let step=1;step<=10;step++) {
        single.push(measure(27.15+0.07*step));
        await frame();
      }
      const settled = read(), settledDraws = draws;
      await wait(200); await frame();
      const stopped = read(), stoppedDraws = draws;
      const reverse = [measure(27.15)], reversed = read();
      const multiple = [measure(29.15)];
      const returned = await settledMove(27.15);
      // Rapid forward and backward changes cannot leave queued catch-up motion.
      const direct = [27.3,28.2,27.65,29.15,27.15].map(measure);
      // At the section's top, the lower half must already be the next color.
      await settledMove(innerHeight / rowPitch);
      const lowerHalf = context.getImageData(0, Math.ceil(innerHeight * 0.52 * dpr), canvas.width, 1).data;
      let lowerHalfIsSolid = true;
      for (let x = 0; x < canvas.width; x++) {
        lowerHalfIsSolid &&= lowerHalf[x * 4 + channel] === 0;
      }
      // Exercise large, overlapping circles after staggered column updates.
      // Their incremental repaint must match a complete redraw at the same scroll.
      await settledMove(36.15);
      await settledMove(36.85);
      const incremental = context.getImageData(0, 0, canvas.width, canvas.height).data;
      ScrollTrigger.refresh();
      await frame();
      const complete = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let overlapMismatches = 0;
      for (let pixel = 0; pixel < incremental.length; pixel += 4) {
        if (Math.abs(incremental[pixel + channel] - complete[pixel + channel]) > 3) overlapMismatches++;
      }
      const jump = measure(150.85).columns;
      context.fill = originalFill;
      context.fillRect = originalFillRect;
      context.arc = originalArc;
      results.push({id:section.id,pitch,rowPitch,height:rect.height,viewport:innerHeight,dpr,
        width:rect.width,count,canvasWidth:canvas.width,canvasHeight:canvas.height,
        canvasCount:section.querySelectorAll('canvas').length,
        columnNodes:section.querySelectorAll('.halftone-column').length,
        text:section.textContent.trim(),decorative:canvas.getAttribute('aria-hidden'),
        pointerEvents:getComputedStyle(canvas).pointerEvents,
        backgroundZIndex:getComputedStyle(canvas).zIndex,contentInteractive,
        contentCount:[...section.children].filter(child=>child!==canvas).length,
        anchors,solidCapHasSeams,before,beforeRows,single,settled,stopped,reverse,reversed,multiple,returned,direct,jump,overlapMismatches,lowerHalfIsSolid,
        settledDraws,stoppedDraws});
    }
    return results;
    })()`));
  }
  assert.equal(sections.length, 2, `${variant}: two job pages`);
  for (const section of sections) {
    const label = `${variant}: ${section.id}`;
    assert.equal(section.canvasCount, 1, `${label}: one background canvas`);
    assert.equal(section.columnNodes, 0, `${label}: no individual DOM columns`);
    assert.equal(section.contentCount, 0, `${label}: no job content added`);
    assert.equal(section.text, '', `${label}: no text added`);
    assert.equal(section.decorative, 'true', `${label}: decorative background`);
    assert.equal(section.pointerEvents, 'none', `${label}: background cannot intercept content interaction`);
    assert.equal(section.backgroundZIndex, '-1', `${label}: canvas stays behind HTML content`);
    assert.equal(section.contentInteractive, true, `${label}: normal HTML remains interactive`);
    assert.equal(section.canvasWidth, Math.ceil(section.width * section.dpr), `${label}: sharp canvas width`);
    assert.equal(section.canvasHeight, Math.ceil(section.viewport * section.dpr), `${label}: sharp canvas height`);
    assert.ok(Math.abs(section.pitch-section.viewport/45)<0.02, `${label}: larger dot size`);
    assert.ok(Math.abs(14*section.rowPitch-section.viewport*0.48)<0.02, `${label}: dot growth spans half a viewport`);
    assert.ok(Math.abs(section.height-1.48*section.viewport)<0.02, `${label}: full solid viewport`);
    assert.ok(section.anchors.every(top=>Math.abs(top)<0.01), `${label}: fixed viewport anchor`);
    assert.equal(section.solidCapHasSeams, false, `${label}: no seams between background columns`);
    assert.equal(section.stoppedDraws, section.settledDraws, `${label}: no idle drawing`);
    assert.equal(section.overlapMismatches, 0, `${label}: overlapping circles repaint without cut edges or trails`);
    assert.equal(section.lowerHalfIsSolid, true, `${label}: transition finishes in the upper half of the viewport`);
    const maximumRadius = Math.hypot(section.pitch,section.rowPitch)/2;
    const columnStep = maximumRadius/11*2/(section.count-1);
    // A scroll offset remains visible at rest, including after reversing.
    // Equal differences between adjacent radii rule out random phases.
    for (const state of [section.before,section.settled,section.reversed,section.returned]) {
      for (let i=1;i<section.count;i++) {
        assert.ok(Math.abs(state[i-1].radius-state[i].radius-columnStep)<1e-9,
          `${label}: linear left-to-right scroll offset remains after settling`);
      }
    }
    for (let i=0;i<section.count;i++) {
      const previous = section.before[i], column = section.settled[i];
      assert.ok(column.radius>previous.radius, `${label}: incoming-color dots expand when scrolling forward`);
      if (i<section.count-1) assert.ok(column.ink>previous.ink, `${label}: larger circles are visibly rendered`);
      assert.equal(column.radius,section.single.at(-1).columns[i].radius,
        `${label}: next frame cannot change the size without scrolling`);
    }
    // Every rendered size must already match the new scroll position when the
    // scroll update returns. Waiting to catch up, even for one frame, fails.
    for (const sample of [...section.single,...section.reverse,...section.multiple,...section.direct]) {
      const radiusChange = (sample.rows-section.beforeRows)*maximumRadius/11;
      for (let i=0;i<section.count;i++) {
        assert.ok(Math.abs(sample.columns[i].radius-section.before[i].radius-radiusChange)<1e-9,
          `${label}: dot size follows scroll immediately and linearly, column=${i}`);
      }
    }
    assert.ok(new Set(section.single.map(sample=>sample.columns[0].radius)).size>=8,
      `${label}: small scroll changes render fine intermediate circle sizes`);
    for (const samples of [section.single,section.reverse]) {
      for (const sample of samples) {
        for (let i=1;i<section.count;i++) {
          assert.ok(Math.abs(sample.columns[i-1].radius-sample.columns[i].radius-columnStep)<1e-9,
            `${label}: scroll-relative stagger stays constant while moving in either direction`);
        }
      }
    }
    for (let i=0;i<section.count;i++) {
      for (const samples of [section.single,section.multiple]) {
        for (const sample of samples) {
          const column = sample.columns[i];
          // Inspect a small isolated dot's pixel centroid. Size may change,
          // but the center must stay in its original viewport grid cell.
          if (column.cellInk>50 && i<section.count-1) {
            assert.ok(Math.abs(column.x-(i+0.5)*section.pitch)<0.8/section.dpr, `${label}: fixed horizontal dot centers`);
            assert.ok(Math.abs(column.y-(section.viewport-23.5*section.rowPitch))<0.8/section.dpr, `${label}: fixed vertical dot centers`);
          }
        }
      }
      assert.equal(section.stopped[i].ink, section.settled[i].ink, `${label}: no continuing drift`);
      // Readback can switch Chrome's canvas rasterizer; allow tiny differences
      // in edge coverage while checking the same size and fixed dot centers.
      const edgeTolerance = Math.max(32 * section.dpr * section.dpr, section.before[i].ink * 0.001);
      assert.ok(Math.abs(section.reversed[i].ink-section.before[i].ink)<=edgeTolerance, `${label}: reversal restores the rendered sizes`);
      assert.ok(Math.abs(section.returned[i].ink-section.before[i].ink)<=edgeTolerance, `${label}: multi-row reversal column=${i}, expected=${section.before[i].ink}, actual=${section.returned[i].ink}, tolerance=${edgeTolerance}`);
      assert.equal(section.jump[i].ink, section.jump[i].pixels * 255, `${label}: fast jumps settle to the incoming color`);
    }
  }
}


async function checkOutroSynchronization(session, variant) {
  await send('Page.bringToFront', {}, session);
  // Screenshot comparison pauses scrub tweens; measure the live behavior here.
  await evaluate(session, 'ScrollTrigger.getAll().forEach(trigger => trigger.getTween()?.play?.());');
  const result = await evaluate(session, `(async () => {
    const section = document.getElementById('outro');
    const top = section.getBoundingClientRect().top + scrollY;
    const height = section.getBoundingClientRect().height;
    const css = getComputedStyle(document.getElementById('outro-sun')).animationTimeline === '--outro-parallax';
    const start = css ? top - innerHeight : Math.round(top - innerHeight);
    const end = css ? top + height - innerHeight : Math.round(top + height - innerHeight);
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
      const progress = Math.max(0, Math.min(1, (scrollY - start) / (end - start)));
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
    assert.ok(result.maxError < 0.15, `${variant}: outro layers lag scroll by ${result.maxError}px`);
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
    const last = ${profileHalftone} ? document.getElementById('hedra') : el;
    const end = Math.min(document.documentElement.scrollHeight - innerHeight, last.getBoundingClientRect().top + scrollY + last.offsetHeight + 100);
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
    if (!profileSection) {
      // Pixel assertions read the canvas every frame. Keep those test canvases
      // on the CPU so GPU readbacks cannot stall the animation being measured.
      // Performance profiles use the production renderer without this override.
      await send('Page.addScriptToEvaluateOnNewDocument', {source: `(() => {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type, options) {
          return getContext.call(this, type, type === '2d'
            ? {...options, willReadFrequently:true} : options);
        };
      })()`}, sessionId);
    }
  }
  for (const [width, height] of viewports) {
    await Promise.all(variants.map(async variant => {
      const session = sessions[variant];
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, session);
      await send('Page.navigate', { url: `${origin}/${variant}/` }, session);
      for (let attempts = 0; attempts < 100; attempts++) {
        if (await evaluate(session, `document.readyState === 'complete' && typeof ScrollTrigger !== 'undefined' && ScrollTrigger.getAll().length > 0`)) break;
        await delay(50);
      }
      await evaluate(session, `document.fonts.ready`);
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
      }));
      await delay(1600);
      if (profileSection) {
        for (const variant of variants) await runScrollProfile(sessions[variant], variant, width, height);
        continue;
      }
      const counts = await Promise.all(variants.map(v => evaluate(sessions[v], 'ScrollTrigger.getAll().length')));
      const skillsActivated = await evaluate(sessions.native, `document.querySelector('#skills .parallax-container').classList.contains('parallax-active')`);
      assert.equal(counts[1] - counts[0], control ? 0 : 12 + Number(skillsActivated), 'CSS should replace imagery triggers and remove the skills activation trigger after entry.');
      const positions = await evaluate(sessions.fallback, `(() => {
        const top = id => document.getElementById(id).getBoundingClientRect().top + scrollY;
        const height = id => document.getElementById(id).offsetHeight;
        const points = [0];
        for (const f of [0.1, 0.25, 0.5, 0.75, 1]) points.push(f * height('intro'));
        for (const id of ['map', 'google', 'skills']) {
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
      for (const variant of ['native', 'fallback']) await checkHalftoneGrowth(sessions[variant], variant);
      for (const id of ['nick', 'hedra']) {
        const y = await evaluate(sessions.native, `document.getElementById('${id}').getBoundingClientRect().top + scrollY`);
        await Promise.all(['native', 'fallback'].map(v => evaluate(sessions[v], `scrollTo({top:${y}, behavior:'instant'});`)));
        await delay(500);
        await compareScreenshots(`${width}x${height}, ${id} halftone`, 'fallback', true);
      }
      console.log('Halftones: continuous linear growth and left-to-right scroll offsets passed; immediate response, fixed centers, reversals, and idle drawing matched.');
    }
    if (!profileSection) {
    // Rotate an already loaded page. CSS units and GSAP's captured lengths can differ.
    await Promise.all(variants.map(v => send('Emulation.setDeviceMetricsOverride', {
      width: 1024, height: 768, deviceScaleFactor: 1, mobile: false,
    }, sessions[v])));
    await delay(400);
    await Promise.all(variants.map(v => evaluate(sessions[v], 'ScrollTrigger.refresh();')));
    for (const id of ['intro', 'map', 'google', 'skills', 'outro']) {
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
    for (const variant of ['native', 'fallback']) await checkHalftoneGrowth(sessions[variant], `${variant}, rotated`);
    console.log('Halftone growth and stagger remained correct after viewport rotation.');
    await Promise.all(variants.map(v => send('Emulation.setDeviceMetricsOverride', {
      width: 390, height: 844, deviceScaleFactor: 2, mobile: false,
    }, sessions[v])));
    await delay(400);
    await Promise.all(variants.map(v => evaluate(sessions[v], 'ScrollTrigger.refresh();')));
    for (const variant of ['native', 'fallback']) await checkHalftoneGrowth(sessions[variant], `${variant}, high DPI`);
    console.log('Canvas sharpness, dot centers, and timing matched at 2x device pixel ratio.');
    await Promise.all(variants.map(v => send('Emulation.setDeviceMetricsOverride', {
      width: 1024, height: 768, deviceScaleFactor: 1, mobile: false,
    }, sessions[v])));
    await delay(400);
    await Promise.all(variants.map(v => evaluate(sessions[v], 'ScrollTrigger.refresh();')));
    for (const [id, duration, target] of [
      ['intro-scroll-button', 8, '#google'],
      ['map-scroll-button', 6, '#skills'],
      ['skills-scroll-button', 4, 'max'],
    ]) {
      const destinations = [];
      for (const variant of variants) {
        const session = sessions[variant];
        await send('Page.bringToFront', {}, session);
        const result = await evaluate(session, `(() => {
          gsap.killTweensOf(window);
          window.scrollTo({ top: 0, behavior: 'instant' }); ScrollTrigger.update();
          const button = document.getElementById('${id}'); button.disabled = false; button.click();
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
