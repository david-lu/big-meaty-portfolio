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
const profileHedra = process.argv.includes('--profile-hedra');
const nickWipeOnly = process.argv.includes('--nick-wipe-only');
const hedraBackgroundOnly = process.argv.includes('--hedra-background-only');
const introLoadingOnly = process.argv.includes('--intro-loading-only');
const forceNoWebgl = process.argv.includes('--force-no-webgl');
const profileSection = profileHedra ? 'hedra' : profileOutro ? 'outro' : profileSkills ? 'skills' : undefined;
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
    if (introLoadingOnly && file === 'assets/intro-layer-tree.svg') {
      await new Promise(resolve => setTimeout(resolve, 2500));
    }
    if (file === 'scripts/logging.js') body = ''; // Keep analytics out of local tests.
    if (file === 'index.html') {
      body = body.toString().replace(/<script async src="https:[^>]+><\/script>/, '');
      if (forceNoWebgl) {
        body = body.replace('<script defer type=\'module\' src="scripts/scripts.js"></script>',
          `<script>const originalGetContext = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function(type, ...args) {
            if (this.id === 'nick-bubbles' && type === 'webgl2') return null;
            if (this.id === 'hedra-halftone') {
              if (type === 'webgl2') return null;
              if (type === '2d') window.halftone2dRequests =
                (window.halftone2dRequests || 0) + 1;
            }
            return originalGetContext.call(this, type, ...args);
          };</script><script defer type='module' src="scripts/scripts.js"></script>`);
      }
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
      '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
      '.gif': 'image/gif', '.ttf': 'font/ttf' };
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
  '#nick-scene-bg, #nick-scene-fg, #outro .parallax-bg, ' +
  '#outro-info, #outro-sun, #outro-socials, .scroll-button';
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
      // CSS timelines and ScrollTrigger can round moving art by a fraction
      // of a pixel at a newly sampled section entry.
      const parallaxImageY = property === 'y' &&
        (element.id === 'outro-sun' || element.id.startsWith('nick-scene-') ||
          element.id.startsWith('assets/outro-layer-') ||
          element.id.startsWith('assets/nick-outlines/'));
      const tolerance = parallaxImageY ? 0.4 : 0.15;
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
      nickDecorationCount:sections[1].querySelectorAll('.nick-decoration, .nick-decorations').length,
      nickColor:getComputedStyle(sections[1]).backgroundColor,
      hedraColor:getComputedStyle(sections[2]).backgroundColor,
      nickWipeOutside:!sections[1].contains(document.getElementById('nick-wipe')),
      hedraCanvasOutside:!sections[2].contains(document.getElementById('hedra-halftone')),
      horizontalOverflow:document.documentElement.scrollWidth - innerWidth,
      viewport:innerHeight,
      narrowDoodles:matchMedia('(max-aspect-ratio: 0.6)').matches
    };
  })()`);
  const label = `${variant}: restored job sections`;
  assert.deepEqual(result.ids, ['google', 'nick', 'hedra', 'skills-header'], `${label}: sections exist`);
  assert.ok(result.nickJob && result.hedraJob, `${label}: both job sections are restored`);
  assert.equal(result.nickDecorationCount, 0, `${label}: Nick has a plain orange background`);
  assert.ok(result.horizontalOverflow <= 1, `${label}: page has no horizontal overflow`);
  for (let i = 0; i < result.edges.length - 1; i++) {
    assert.ok(Math.abs(result.edges[i].bottom - result.edges[i + 1].top) < 1,
      `${label}: ${result.ids[i]} joins ${result.ids[i + 1]} without a gap`);
  }
  assert.ok(Math.abs(result.edges[0].height -
    result.viewport * (result.narrowDoodles ? 1.45 : 1.65)) <= 1,
    `${label}: Google doodles section has the extended height`);
  assert.ok(Math.abs(result.edges[1].height - result.viewport) <= 1,
    `${label}: Nick section is 100vh tall`);
  assert.ok(Math.abs(result.edges[2].height - result.viewport) <= 1,
    `${label}: black section is one viewport tall`);
  assert.equal(result.nickColor, 'rgb(255, 255, 255)',
    `${label}: Nick's section stays behind the orange wipe`);
  assert.equal(result.hedraColor, forceNoWebgl ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)',
    `${label}: black field has its expected background`);
  assert.ok(result.nickWipeOutside && result.hedraCanvasOutside,
    `${label}: viewport overlays are outside the clipped sections`);
}

async function checkAnchoredExperience(session, variant) {
  await send('Page.bringToFront', {}, session);
  if (forceNoWebgl) {
    const state = await evaluate(session, `(() => ({
      displays:['hedra-halftone']
        .map(id => getComputedStyle(document.getElementById(id)).display),
      fallbackRequests:window.halftone2dRequests || 0
    }))()`);
    assert.deepEqual(state.displays, ['none'],
      `${variant}: Hedra transition canvas hides without WebGL2`);
    assert.equal(state.fallbackRequests, 0,
      `${variant}: Hedra transition never requests Canvas 2D`);
    return;
  }
  const result = await evaluate(session, `(async () => {
    const height = innerHeight;
    const sample = async (sectionId, canvasId) => {
      const section = document.getElementById(sectionId);
      const canvas = document.getElementById(canvasId);
      const content = section.querySelector('.job-content');
      const entryFraction = JSON.parse(content.dataset.jobLayout).entryViewportFraction;
      const gl = canvas.getContext('webgl2');
      if (!gl) throw new Error(canvasId + ' did not initialize WebGL2.');
      const absoluteTop = section.getBoundingClientRect().top + scrollY;
      const move = async topFraction => {
        scrollTo({top:Math.round(absoluteTop - topFraction * height), behavior:'instant'});
        ScrollTrigger.update();
        await new Promise(resolve => requestAnimationFrame(resolve));
        const image = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, image);
        let ink = 0;
        for (let i = 3; i < image.length; i += 64) ink += image[i] > 0;
        return {
          sectionTop:section.getBoundingClientRect().top,
          contentTop:content.getBoundingClientRect().top,
          visible:getComputedStyle(canvas).visibility === 'visible',
          ink, color:[...image.slice(0, 4)]
        };
      };
      const before = await move(1 + 3 / height);
      const entered = await move(0.8);
      await move(0.49);
      const middle = await move(0.5);
      const program = gl.getParameter(gl.CURRENT_PROGRAM);
      const uniform = name => gl.getUniform(program, gl.getUniformLocation(program, name));
      const cells = uniform('u_cells');
      const offset = uniform('u_column_offset') / 2;
      const distance = uniform('u_distance');
      const rowDelay = uniform('u_row_delay');
      const growthPixels = uniform('u_growth_pixels');
      const partialRows = Array.from({length:cells}, (_, cell) =>
        (distance - (cell + offset) * rowDelay) / growthPixels)
        .filter(growth => growth > 0.01 && growth < 0.99).length;
      const reverse = await move(0.8);
      const middleAgain = await move(0.5);
      const complete = await move(-3 / height);
      const jobEntry = await move(entryFraction);
      const jobLater = await move(entryFraction - 0.15);
      const past = await move(-section.getBoundingClientRect().height / height - 3 / height);
      return {before, entered, middle, partialRows, reverse, middleAgain, complete, jobEntry, jobLater,
        entryFraction,
        past, viewportHeight:height, canvasPosition:getComputedStyle(canvas).position,
        canvasPointerEvents:getComputedStyle(canvas).pointerEvents,
        canvasWidth:canvas.width, canvasHeight:canvas.height,
        expectedWidth:Math.ceil(innerWidth * devicePixelRatio),
        expectedHeight:Math.ceil(innerHeight * devicePixelRatio),
        opacity:getComputedStyle(content).opacity,
        logoColor:getComputedStyle(section.querySelector('.job-logo')).backgroundColor};
    };
    const hedra = await sample('hedra', 'hedra-halftone');
    // At Hedra's midpoint, Nick's orange wipe stays behind black dots.
    const hedraTop = document.getElementById('hedra').getBoundingClientRect().top + scrollY;
    scrollTo({top:Math.round(hedraTop - 0.5 * height), behavior:'instant'});
    ScrollTrigger.update();
    const orange = document.getElementById('nick-wipe');
    return {hedra, orangeAtBlackEntry:{
      visible:getComputedStyle(orange).visibility,
      opacity:Number(getComputedStyle(orange).opacity),
      color:getComputedStyle(orange).backgroundColor
    }};
  })()`);
  for (const [id, expected] of [['hedra', [0, 0, 0, 255]]]) {
    const state = result[id];
    const label = `${variant}: ${id} section anchor`;
    assert.equal(state.canvasPosition, 'fixed', `${label}: canvas covers the viewport`);
    assert.equal(state.canvasPointerEvents, 'none', `${label}: canvas lets clicks through`);
    assert.equal(state.canvasWidth, state.expectedWidth, `${label}: canvas width`);
    assert.equal(state.canvasHeight, state.expectedHeight, `${label}: canvas height`);
    assert.equal(state.before.visible, false, `${label}: hidden before section top enters`);
    assert.equal(state.entered.visible, true, `${label}: appears as section top enters`);
    assert.ok(state.entered.ink > 0, `${label}: first dots appear`);
    assert.ok(state.middle.ink > state.entered.ink, `${label}: dots grow with scroll`);
    assert.ok(state.partialRows >= 12,
      `${label}: at least 12 rows grow at the transition midpoint (${state.partialRows})`);
    assert.equal(state.reverse.ink, state.entered.ink,
      `${label}: reversing to the same scroll position restores the same dots`);
    assert.equal(state.middle.ink, state.middleAgain.ink, `${label}: reverse scroll restores dots`);
    assert.ok(Math.abs(state.complete.sectionTop + 3) <= 1, `${label}: full at section top`);
    assert.deepEqual(state.complete.color, expected, `${label}: solid background color`);
    assert.equal(state.past.visible, false, `${label}: retires when section bottom leaves`);
    assert.ok(Math.abs(state.jobEntry.contentTop - state.viewportHeight) <= 2,
      `${label}: job enters at viewport bottom when section top is ${state.entryFraction} viewport heights`);
    const scrollDistance = state.jobEntry.sectionTop - state.jobLater.sectionTop;
    const contentDistance = state.jobEntry.contentTop - state.jobLater.contentTop;
    assert.ok(Math.abs(contentDistance - scrollDistance) <= 2,
      `${label}: job moves at configured page speed`);
    assert.equal(state.opacity, '1', `${label}: job does not fade`);
  }
  assert.deepEqual(result.orangeAtBlackEntry,
    {visible:'visible', opacity:1, color:'rgb(255, 121, 0)'},
    `${variant}: orange remains solid behind Hedra's black dots`);
}

async function checkHedraBackground(session, variant) {
  await send('Page.bringToFront', {}, session);
  const result = await evaluate(session, `(() => {
    const section = document.getElementById('hedra');
    scrollTo({top:section.getBoundingClientRect().top + scrollY, behavior:'instant'});
    ScrollTrigger.update();
    return {
      ambientCanvas:section.querySelector('#hedra-ambient'),
      ambientClip:section.querySelector('#hedra-ambient-clip'),
      jobDisplay:getComputedStyle(section.querySelector('.job-content')).display
    };
  })()`);
  assert.equal(result.ambientCanvas, null, `${variant}: Hedra has no dot background canvas`);
  assert.equal(result.ambientClip, null, `${variant}: Hedra has no dot background clip`);
  assert.notEqual(result.jobDisplay, 'none', `${variant}: Hedra job remains visible`);
}

async function checkOutroLayerIsolation(session, label) {
  await send('Page.bringToFront', {}, session);
  const layers = await evaluate(session, `(async () => {
    scrollTo({top:document.documentElement.scrollHeight - innerHeight, behavior:'instant'});
    ScrollTrigger.update();
    ScrollTrigger.getAll().forEach(trigger => trigger.getTween()?.progress?.(1));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const canvas = document.getElementById('hedra-halftone');
    return {canvas:Number(getComputedStyle(canvas).zIndex),
      header:Number(getComputedStyle(document.getElementById('outro-header')).zIndex),
      outro:Number(getComputedStyle(document.getElementById('outro')).zIndex),
      visibility:getComputedStyle(canvas).visibility};
  })()`);
  assert.equal(layers.visibility, 'hidden', `${label}: Hedra canvas hides after its section`);
  assert.ok(layers.header > layers.canvas && layers.outro > layers.canvas,
    `${label}: the end section stays above Hedra's fixed canvas`);

  const normal = await send('Page.captureScreenshot', {format:'png', fromSurface:true}, session);
  let forced;
  try {
    await evaluate(session, `document.getElementById('hedra-halftone').style.visibility = 'visible'`);
    await evaluate(session, 'new Promise(resolve => requestAnimationFrame(resolve))');
    forced = await send('Page.captureScreenshot', {format:'png', fromSurface:true}, session);
  } finally {
    await evaluate(session, `document.getElementById('hedra-halftone').style.visibility = 'hidden'`);
  }
  const difference = await evaluate(session, `(async () => {
    const sources = ${JSON.stringify([normal, forced].map(shot => `data:image/png;base64,${shot.data}`))};
    const images = await Promise.all(sources.map(async source => {
      const image = new Image(); image.src = source; await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, image.width, image.height).data;
    }));
    let changed = 0, samples = 0;
    for (let pixel = 0; pixel < images[0].length / 4; pixel += 64) {
      const index = pixel * 4;
      if (Math.max(...[0, 1, 2].map(channel =>
        Math.abs(images[0][index + channel] - images[1][index + channel]))) > 12) changed++;
      samples++;
    }
    return changed / samples;
  })()`);
  assert.ok(difference < 0.001,
    `${label}: a stale black Hedra canvas cannot obscure the end screen (${difference})`);
}


async function checkNickWipe(session, variant) {
  await send('Page.bringToFront', {}, session);
  const result = await evaluate(session, `(async () => {
    const section = document.getElementById('nick');
    const wipe = document.getElementById('nick-wipe');
    const bubbles = document.getElementById('nick-bubbles');
    const scene = document.getElementById('nick-scene');
    const sceneBg = document.getElementById('nick-scene-bg');
    const sceneFg = document.getElementById('nick-scene-fg');
    const content = section.querySelector('.job-content');
    const copy = content.querySelector('.nick-copy');
    const top = section.getBoundingClientRect().top + scrollY;
    const height = innerHeight;
    const bubbleGl = bubbles.getContext('webgl2');
    const bubbleContext = bubbleGl ? null : bubbles.getContext('2d');
    let bubbleDraws = 0;
    let bubbleFrames = 0;
    let particleUploads = 0;
    if (bubbleGl) {
      const originalDraw = bubbleGl.drawArraysInstanced;
      bubbleGl.drawArraysInstanced = function(...args) {
        bubbleDraws++;
        bubbleFrames++;
        return originalDraw.apply(this, args);
      };
      const originalBufferData = bubbleGl.bufferData;
      bubbleGl.bufferData = function(...args) {
        if (args[0] === this.ARRAY_BUFFER) particleUploads++;
        return originalBufferData.apply(this, args);
      };
      const originalBufferSubData = bubbleGl.bufferSubData;
      bubbleGl.bufferSubData = function(...args) {
        if (args[0] === this.ARRAY_BUFFER) particleUploads++;
        return originalBufferSubData.apply(this, args);
      };
    } else {
      const originalClear = bubbleContext.clearRect;
      bubbleContext.clearRect = function(...args) {
        bubbleFrames++;
        return originalClear.apply(this, args);
      };
      const originalDraw = bubbleContext.drawImage;
      bubbleContext.drawImage = function(...args) {
        bubbleDraws++;
        return originalDraw.apply(this, args);
      };
    }
    const imageStats = (includeAlphas = false) => {
      const {width, height} = bubbles;
      const pixels = bubbleGl ? new Uint8Array(width * height * 4) :
        bubbleContext.getImageData(0, 0, width, height).data;
      if (bubbleGl) {
        bubbleGl.readPixels(0, 0, width, height, bubbleGl.RGBA,
          bubbleGl.UNSIGNED_BYTE, pixels);
      }
      const ratioX = width / innerWidth;
      const ratioY = height / innerHeight;
      let covered = 0, sampled = 0, translucent = 0, alphaSum = 0;
      let hash = 2166136261;
      const alphas = [];
      const zones = Array.from({length:9}, () => ({covered:0, sampled:0}));
      for (let y = 6; y < innerHeight; y += 12) {
        for (let x = 6; x < innerWidth; x += 12) {
          const pixelX = Math.min(width - 1, Math.floor(x * ratioX));
          const pixelY = Math.min(height - 1, Math.floor(y * ratioY));
          const row = bubbleGl ? height - 1 - pixelY : pixelY;
          const alpha = pixels[(row * width + pixelX) * 4 + 3];
          const zone = zones[Math.min(2, Math.floor(y / innerHeight * 3)) * 3 +
            Math.min(2, Math.floor(x / innerWidth * 3))];
          sampled++;
          zone.sampled++;
          if (alpha) {
            covered++;
            alphaSum += alpha;
            zone.covered++;
            if (alpha < 255) translucent++;
          }
          hash = Math.imul(hash ^ alpha, 16777619) >>> 0;
          if (includeAlphas) alphas.push(alpha);
        }
      }
      return {
        coverage:covered / sampled,
        zoneCoverage:zones.map(zone => zone.covered / zone.sampled),
        translucent:translucent / Math.max(covered, 1),
        meanBubbleAlpha:alphaSum / Math.max(covered, 1),
        hash, alphas
      };
    };
    const move = async fraction => {
      scrollTo({top:Math.round(top - fraction * height), behavior:'instant'});
      ScrollTrigger.update();
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => requestAnimationFrame(resolve));
      const wipeStyle = getComputedStyle(wipe);
      const sceneBounds = scene.getBoundingClientRect();
      const fgBounds = sceneFg.getBoundingClientRect();
      return {
        sectionTop:section.getBoundingClientRect().top,
        sceneTop:sceneBounds.top,
        sceneHeight:sceneBounds.height,
        sceneOpacity:Number(getComputedStyle(scene).opacity),
        sceneVisibility:getComputedStyle(scene).visibility,
        bgRelativeTop:sceneBg.getBoundingClientRect().top - sceneBounds.top,
        bgHeight:sceneBg.getBoundingClientRect().height,
        fgRelativeTop:fgBounds.top - sceneBounds.top,
        fgHeight:fgBounds.height,
        fgArtworkBottom:fgBounds.bottom - parseFloat(getComputedStyle(sceneFg).paddingBottom),
        contentTop:content.getBoundingClientRect().top,
        contentHeight:content.getBoundingClientRect().height,
        copyTop:copy.getBoundingClientRect().top,
        copyHeight:copy.getBoundingClientRect().height,
        contentOpacity:Number(getComputedStyle(content).opacity),
        contentVisibility:getComputedStyle(content).visibility,
        wipeVisible:wipeStyle.visibility,
        wipeOpacity:Number(wipeStyle.opacity),
        clipPath:wipeStyle.clipPath,
        bubbleVisible:getComputedStyle(bubbles).visibility,
        bubblesActive:bubbles.classList.contains('is-active'),
        animation:getComputedStyle(bubbles).animationName
      };
    };
    const settle = async () => {
      let unchanged = 0;
      let previous = bubbleFrames;
      for (let frame = 0; frame < 45 && unchanged < 2; frame++) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        unchanged = bubbleFrames === previous ? unchanged + 1 : 0;
        previous = bubbleFrames;
      }
      if (unchanged < 2) throw new Error('Nick bubbles did not settle after scrolling');
    };
    const beforeBubbles = await move(1.45 + 3 / height);
    const start = await move(1.45);
    const preWipe = await move(1.4);
    const before = await move(1.05 + 3 / height);
    const entered = await move(1.03);
    await settle();
    const enteredImage = imageStats(true);
    const middle = await move(1);
    const bubbleCoverageByPosition = [];
    for (const position of [-4, -3, -1, 0, 0.5, 1, 2.5, 6, 8.5]) {
      await move(1.05 - position * 0.1);
      await settle();
      bubbleCoverageByPosition.push(imageStats().coverage);
    }
    const dense = await move(1);
    await settle();
    const denseImage = imageStats();
    const framesAtRest = bubbleFrames;
    await new Promise(resolve => setTimeout(resolve, 120));
    const idleImage = imageStats();
    const idleFrames = bubbleFrames;
    await move(0.99);
    const scrolledImage = imageStats();
    await settle();
    const settledScrolledImage = imageStats();
    const reverse = await move(1.03);
    await settle();
    const reverseImage = imageStats(true);
    const reverseDifference = reverseImage.alphas.reduce((sum, alpha, i) =>
      sum + Math.abs(alpha - enteredImage.alphas[i]), 0) / reverseImage.alphas.length;
    delete enteredImage.alphas;
    delete reverseImage.alphas;
    const complete = await move(0.95 - 2 / height);
    const settled = await move(0.25);
    const finished = await move(0.15 - 2 / height);
    const hedraMidpoint = await move(-0.5);
    const jobExit = await move(-0.85);
    const nearExit = await move(-0.98);
    const past = await move(-section.getBoundingClientRect().height / height - 3 / height);
    const jobCenter = await move(0.25);
    const jobLater = await move(-0.25);
    return {
      beforeBubbles, start, preWipe, before, entered, middle, dense, reverse,
      complete, settled, finished, hedraMidpoint, jobExit, nearExit,
      past, jobCenter, jobLater, enteredImage, denseImage, idleImage,
      scrolledImage, settledScrolledImage, reverseImage, reverseDifference,
      bubbleCoverageByPosition, framesAtRest, idleFrames,
      viewportHeight:height, viewportWidth:innerWidth,
      wipePosition:getComputedStyle(wipe).position,
      wipePointerEvents:getComputedStyle(wipe).pointerEvents,
      wipeColor:getComputedStyle(wipe).backgroundColor,
      wipeLayer:Number(getComputedStyle(wipe).zIndex),
      scenePosition:getComputedStyle(scene).position,
      sceneOverflow:getComputedStyle(scene).overflow,
      scenePointerEvents:getComputedStyle(scene).pointerEvents,
      sceneLayer:Number(getComputedStyle(scene).zIndex),
      sceneBgLoaded:sceneBg.naturalWidth > 0,
      sceneFgImage:getComputedStyle(sceneFg).backgroundImage,
      sceneFgFilter:getComputedStyle(sceneFg).filter,
      contentPosition:getComputedStyle(content).position,
      contentAnimation:getComputedStyle(content).animationName,
      contentScrollOffset:content.style.getPropertyValue('--job-scroll'),
      contentLayer:Number(getComputedStyle(content).zIndex),
      bubbleLayer:Number(getComputedStyle(bubbles).zIndex),
      bubbleTag:bubbles.tagName,
      bubbleBackend:bubbleGl ? 'webgl2' : '2d',
      bubbleChildren:bubbles.childElementCount,
      bubbleDraws,
      particleUploads,
      canvasWidth:bubbles.width,
      canvasHeight:bubbles.height,
      canvasCssWidth:bubbles.getBoundingClientRect().width,
      canvasCssHeight:bubbles.getBoundingClientRect().height,
      reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,
      logoColor:getComputedStyle(section.querySelector('.job-logo')).backgroundColor
    };
  })()`);
  const label = `${variant}: Nick bubble wipe`;
  assert.equal(result.beforeBubbles.bubbleVisible, 'hidden',
    `${label}: bubbles wait below the viewport before -40vh`);
  assert.ok(Math.abs(result.start.sectionTop - result.viewportHeight * 1.45) <= 2 &&
    result.preWipe.bubblesActive && result.preWipe.wipeVisible === 'hidden',
    `${label}: bubbles begin 40vh before the wipe`);
  assert.equal(result.before.wipeVisible, 'hidden', `${label}: hidden before Nick enters`);
  assert.equal(result.entered.wipeVisible, 'visible', `${label}: visible during entry`);
  assert.ok(Math.abs(result.entered.wipeOpacity - 0.2) < 0.02 &&
    Math.abs(result.middle.wipeOpacity - 0.5) < 0.02 &&
    Math.abs(result.reverse.wipeOpacity - 0.2) < 0.02,
    `${label}: orange fades over the last 5vh of Doodles and first 5vh of Nick (${JSON.stringify({entered:result.entered, middle:result.middle, reverse:result.reverse})})`);
  assert.ok(Math.abs(result.entered.sceneOpacity - result.entered.wipeOpacity) < 0.01 &&
    Math.abs(result.middle.sceneOpacity - result.middle.wipeOpacity) < 0.01 &&
    result.jobCenter.sceneOpacity === 1 &&
    result.entered.sceneVisibility === 'visible' &&
    result.past.sceneVisibility === 'hidden',
    `${label}: the SpongeBob scene enters with the orange fade`);
  assert.ok(result.scenePosition === 'fixed' && result.sceneOverflow === 'clip' &&
    result.scenePointerEvents === 'none' &&
    Math.abs(result.jobCenter.sceneTop) <= 1 &&
    Math.abs(result.jobCenter.sceneHeight - result.viewportHeight) <= 1,
    `${label}: the scene is clipped to the viewport`);
  for (const state of [result.entered, result.middle, result.jobCenter, result.jobLater, result.jobExit]) {
    assert.ok(state.bgRelativeTop <= 0 &&
      state.bgRelativeTop + state.bgHeight >= result.viewportHeight &&
      state.fgRelativeTop <= 0 &&
      state.fgRelativeTop + state.fgHeight >= result.viewportHeight,
      `${label}: oversized parallax layers cover the viewport (${JSON.stringify(state)})`);
  }
  assert.ok(result.sceneBgLoaded && result.sceneFgImage.includes('sponge/fg_blur.png'),
    `${label}: both SpongeBob image layers load`);
  assert.equal(result.sceneFgFilter, 'none', `${label}: foreground blur is baked into the image`);
  assert.ok(result.hedraMidpoint.fgArtworkBottom >= result.viewportHeight - 2,
    `${label}: foreground art still reaches the bottom while Hedra's dots grow`);
  const bgTravel = result.jobLater.bgRelativeTop - result.jobCenter.bgRelativeTop;
  const fgTravel = result.jobLater.fgRelativeTop - result.jobCenter.fgRelativeTop;
  assert.ok(bgTravel < -result.viewportHeight * 0.04 &&
    bgTravel > -result.viewportHeight * 0.05 &&
    fgTravel < bgTravel * 1.9 && fgTravel > -result.viewportHeight * 0.1,
    `${label}: scene layers drift at different rates (${bgTravel}, ${fgTravel})`);
  assert.ok(result.entered.contentVisibility === 'visible' &&
    result.middle.contentVisibility === 'visible' &&
    result.complete.contentVisibility === 'visible' &&
    result.jobExit.contentVisibility === 'visible' &&
    result.past.contentVisibility === 'hidden' &&
    Math.abs(result.entered.contentOpacity - result.entered.wipeOpacity) < 0.01 &&
    Math.abs(result.middle.contentOpacity - result.middle.wipeOpacity) < 0.01 &&
    result.jobCenter.contentOpacity === 1 && result.jobExit.contentOpacity === 1,
    `${label}: Nick's description shares the orange entry fade and stays opaque through Hedra's dots`);
  assert.ok(Math.abs(result.middle.sectionTop - result.viewportHeight) <= 2 &&
    Math.abs(result.complete.sectionTop - result.viewportHeight * 0.95) <= 3 &&
    result.complete.wipeOpacity === 1 && result.settled.wipeOpacity === 1,
    `${label}: orange reaches full opacity 5vh into Nick: ${JSON.stringify({complete:result.complete, settled:result.settled})}`);
  assert.equal(result.middle.clipPath, 'none', `${label}: orange fades without a wipe edge`);
  assert.equal(result.past.wipeVisible, 'hidden', `${label}: wipe retires after Nick`);
  assert.equal(result.wipePosition, 'fixed', `${label}: wipe covers the viewport`);
  assert.equal(result.wipePointerEvents, 'none', `${label}: doodles remain clickable`);
  assert.equal(result.wipeColor, 'rgb(255, 121, 0)', `${label}: wipe is Nick orange`);
  assert.ok(result.wipeLayer === result.sceneLayer &&
    result.sceneLayer < result.contentLayer &&
    result.contentLayer < result.bubbleLayer && result.bubbleLayer < 10,
    `${label}: the scene and text sit between the orange fade and bubbles`);
  assert.equal(result.bubbleTag, 'CANVAS', `${label}: bubbles use one canvas overlay`);
  assert.equal(result.bubbleBackend, forceNoWebgl ? '2d' : 'webgl2',
    `${label}: the bubble renderer selects the available backend`);
  assert.equal(result.bubbleChildren, 0, `${label}: no bubble divs are created`);
  assert.ok(result.bubbleDraws > 0, `${label}: canvas draws the PNG bubble sprite`);
  if (result.bubbleBackend === 'webgl2') {
    assert.ok(result.particleUploads <= 1,
      `${label}: scrolling changes uniforms without uploading particle positions (${result.particleUploads} uploads)`);
  }
  assert.ok(Math.max(result.canvasWidth, result.canvasHeight) <= 1600 &&
    Math.abs(result.canvasWidth / result.canvasHeight -
      result.viewportWidth / result.viewportHeight) < 0.002 &&
    Math.abs(result.canvasCssWidth - result.viewportWidth) <= 1 &&
    Math.abs(result.canvasCssHeight - result.viewportHeight) <= 1,
    `${label}: the canvas is capped at 1600 pixels and scales over the viewport`);
  assert.ok(result.denseImage.coverage > 0.85 && result.denseImage.coverage < 0.99,
    `${label}: denser bubbles fill the viewport at peak (${result.denseImage.coverage} covered)`);
  assert.ok(Math.min(...result.denseImage.zoneCoverage) > 0.55,
    `${label}: bubble coverage reaches every part of the viewport (${result.denseImage.zoneCoverage})`);
  assert.ok(result.bubbleCoverageByPosition[0] < result.bubbleCoverageByPosition[4] &&
    result.bubbleCoverageByPosition[1] < result.bubbleCoverageByPosition[4] &&
    result.bubbleCoverageByPosition[8] < result.bubbleCoverageByPosition[4],
    `${label}: bubble coverage rises across the wipe and tapers afterward: ${result.bubbleCoverageByPosition}`);
  assert.ok(result.denseImage.meanBubbleAlpha > 100,
    `${label}: bubble image retains its own visible opacity (${result.denseImage.meanBubbleAlpha})`);
  assert.ok(result.denseImage.translucent > 0.5,
    `${label}: most bubble pixels are translucent`);
  assert.equal(result.entered.bubblesActive, true, `${label}: bubbles animate during entry`);
  assert.equal(result.dense.bubbleVisible, result.reducedMotion ? 'hidden' : 'visible',
    `${label}: bubble visibility follows motion preference`);
  assert.equal(result.complete.bubblesActive, true,
    `${label}: bubbles keep rising after the wipe`);
  assert.ok(result.settled.bubblesActive &&
    Math.abs(result.finished.sectionTop - result.viewportHeight * 0.15) <= 3 &&
    !result.finished.bubblesActive && result.finished.bubbleVisible === 'hidden',
    `${label}: bubbles finish 90vh after the wipe begins: ${JSON.stringify({settled:result.settled, finished:result.finished})}`);
  assert.equal(result.middle.animation, 'none', `${label}: bubbles have no timed animation`);
  assert.equal(result.idleImage.hash, result.denseImage.hash,
    `${label}: bubbles stay still until the page scrolls`);
  assert.equal(result.idleFrames, result.framesAtRest,
    `${label}: the bubble renderer stops drawing after its short catch-up`);
  assert.notEqual(result.scrolledImage.hash, result.denseImage.hash,
    `${label}: scrolling changes bubble positions`);
  assert.notEqual(result.scrolledImage.hash, result.settledScrolledImage.hash,
    `${label}: bubbles briefly catch up after scrolling stops`);
  assert.ok(result.reverseDifference < 2,
    `${label}: reverse scrolling restores the bubble image (${result.reverseDifference} mean alpha difference)`);
  assert.equal(result.logoColor, 'rgb(141, 198, 63)', `${label}: Nick badge stays green`);
  assert.ok(result.contentPosition === 'sticky' && result.contentAnimation === 'none' &&
    result.contentScrollOffset === '',
    `${label}: Nick's description uses CSS sticky without a scroll transform`);
  for (const state of [result.entered, result.middle, result.jobCenter, result.jobLater,
    result.jobExit, result.nearExit]) {
    assert.ok(Math.abs(state.copyTop + state.copyHeight / 2 - result.viewportHeight / 2) <= 2,
      `${label}: Nick's description stays centered while sticky (${JSON.stringify(state)})`);
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
    const roundingTolerance = variant === 'fallback' ? 0.35 : 0.15;
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
    if (introLoadingOnly) {
      for (const variant of ['native', 'fallback']) {
        const session = sessions[variant];
        await send('Emulation.setDeviceMetricsOverride',
          { width, height, deviceScaleFactor: 1, mobile: false }, session);
        await send('Page.navigate', { url: `${origin}/${variant}/` }, session);
        await send('Page.bringToFront', {}, session);
        for (let attempts = 0; attempts < 100; attempts++) {
          if (await evaluate(session, `document.getElementById('intro') &&
            getComputedStyle(document.getElementById('intro'), '::after').content !== 'none'`)) break;
          await delay(20);
        }
        const before = await evaluate(session, `({
          loading:document.documentElement.classList.contains('intro-loading'),
          opacity:getComputedStyle(document.getElementById('intro'), '::after').opacity,
          menuOpacity:getComputedStyle(document.getElementById('nav-hamburger')).opacity,
          menuVisibility:getComputedStyle(document.getElementById('nav-hamburger')).visibility,
          titleHidden:document.getElementById('title').classList.contains('hidden'),
          buttonDisabled:document.getElementById('intro-scroll-button').disabled,
          assets:document.querySelectorAll('link[data-intro-asset]').length
        })`);
        assert.deepEqual(before, { loading:true, opacity:'1', menuOpacity:'0',
          menuVisibility:'hidden', titleHidden:true,
          buttonDisabled:true, assets:12 }, `${variant}: intro stays covered while an image loads`);
        for (let attempts = 0; attempts < 200; attempts++) {
          if (await evaluate(session, `!document.documentElement.classList.contains('intro-loading')`)) break;
          await delay(25);
        }
        const after = await evaluate(session, `({
          loading:document.documentElement.classList.contains('intro-loading'),
          titleHidden:document.getElementById('title').classList.contains('hidden'),
          buttonDisabled:document.getElementById('intro-scroll-button').disabled,
          imageReady:[...document.querySelectorAll('#intro img')].every(image => image.complete && image.naturalWidth > 0)
        })`);
        assert.deepEqual(after, { loading:false, titleHidden:false,
          buttonDisabled:false, imageReady:true }, `${variant}: intro reveals after its images load`);
        await delay(450);
        const during = Number(await evaluate(session,
          `getComputedStyle(document.getElementById('nav-hamburger')).opacity`));
        assert.ok(during > 0 && during < 1,
          `${variant}: menu button opacity animates during reveal (${during})`);
        await delay(900);
        const faded = await evaluate(session, `({
          overlay:getComputedStyle(document.getElementById('intro'), '::after').opacity,
          menu:getComputedStyle(document.getElementById('nav-hamburger')).opacity,
          menuVisibility:getComputedStyle(document.getElementById('nav-hamburger')).visibility
        })`);
        assert.deepEqual(faded, { overlay:'0', menu:'1', menuVisibility:'visible' },
          `${variant}: intro and menu button finish fading in`);
      }
      console.log(`${width}x${height}: intro images reveal together after loading.`);
      continue;
    }
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
    if (nickWipeOnly) {
      for (const variant of ['native', 'fallback']) {
        await checkNickWipe(sessions[variant], `${width}x${height}, ${variant}`);
      }
      console.log(`${width}x${height}: Nick bubble wipe passed.`);
      continue;
    }
    if (hedraBackgroundOnly) {
      for (const variant of ['native', 'fallback']) {
        await checkHedraBackground(sessions[variant], `${width}x${height}, ${variant}`);
      }
      console.log(`${width}x${height}: Hedra background passed.`);
      continue;
    }
    if (profileSection) {
      for (const variant of variants) await runScrollProfile(sessions[variant], variant, width, height);
      continue;
    }
      const counts = await Promise.all(variants.map(v => evaluate(sessions[v], 'ScrollTrigger.getAll().length')));
      const skillsActivated = await evaluate(sessions.native, `document.querySelector('#skills .parallax-container').classList.contains('parallax-active')`);
      assert.equal(counts[1] - counts[0], control ? 0 : 15 + Number(skillsActivated), 'CSS should replace imagery and job triggers and remove the skills activation trigger after entry.');
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
        await checkNickWipe(sessions[variant], label);
        await checkAnchoredExperience(sessions[variant], label);
        await checkHedraBackground(sessions[variant], label);
      }
      await checkOutroLayerIsolation(sessions.native, `${width}x${height}`);
      console.log(`${width}x${height}: Nick wipe, Hedra halftone, and job motion passed.`);
    }
    if (!profileSection && !nickWipeOnly && !hedraBackgroundOnly && !introLoadingOnly) {
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
      ['map-scroll-button', 6, '#nick .job-content', 'map-info'],
      ['skills-scroll-button', 4, 'max'],
      ['nick-scroll-button', 3, '#hedra .job-content', 'nick'],
      ['hedra-scroll-button', 3, '#skills-header', 'hedra'],
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
        const result = await evaluate(session, `(async () => {
          const button = document.getElementById('${id}');
          const tween = gsap.getTweensOf(window).find(t => t.vars.scrollTo);
          tween.pause();
          const config = { disabled: button.disabled, duration: tween.duration(),
            target: tween.vars.scrollTo.y, autoKill: tween.vars.scrollTo.autoKill, ease: tween.vars.ease };
          tween.progress(1);
          ScrollTrigger.update();
          await new Promise(resolve => requestAnimationFrame(resolve));
          const scroll = scrollY; tween.kill();
          const descriptionSelector = ${JSON.stringify(target.endsWith('.job-content') ? target : null)};
          const description = descriptionSelector ? document.querySelector(descriptionSelector) : null;
          const center = description ? description.getBoundingClientRect().top +
            description.getBoundingClientRect().height / 2 : null;
          const skillsTop = document.getElementById('skills-header').getBoundingClientRect().top;
          return { ...config, scroll, center, viewportCenter:innerHeight / 2,
            viewportHeight:innerHeight, skillsTop };
        })()`);
        assert.equal(result.disabled, true, `${id}: disabled on click`);
        assert.equal(result.duration, duration, `${id}: duration`);
        if (target.endsWith('.job-content')) {
          assert.equal(typeof result.target, 'number', `${id}: calculated destination`);
          if (id === 'nick-scroll-button') {
            assert.ok(result.skillsTop >= result.viewportHeight + 6,
              `${id}: Skills remains below the viewport (${result.skillsTop} vs ${result.viewportHeight})`);
            assert.ok(Math.abs(result.center - result.viewportCenter) <= 2 ||
              Math.abs(result.skillsTop - (result.viewportHeight + 8)) <= 2,
            `${id}: description is centered or stopped by Skills boundary`);
          } else {
            assert.ok(Math.abs(result.center - result.viewportCenter) <= 2,
              `${id}: job description centered (${result.center} vs ${result.viewportCenter})`);
          }
        } else {
          assert.equal(result.target, target, `${id}: destination`);
        }
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
