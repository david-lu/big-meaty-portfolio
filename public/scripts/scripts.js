import { createHalftoneGpuRenderer } from './halftone-transition-gl.js';
import { createNickBubbleRenderer } from './nick-bubble-renderer.js';

gsap.registerPlugin(ScrollToPlugin, ScrollTrigger);
SmoothScroll({});

// HELPERS
const $ = document.querySelector.bind(document)
const getAspectRatio = () => window.innerHeight / window.innerWidth;
const vh = (x) => window.innerHeight * (x / 100);
const vw = (y) => window.innerWidth * (y / 100);
const rem = (val) => parseFloat(getComputedStyle(document.documentElement).fontSize) * val;
const magnitude = (x, y) => Math.sqrt((x * x) + (y * y));

// Keep the original tweens on browsers without the complete CSS timeline support.
// This condition also gates the parallax rules in styles.css.
const supportsCssParallax = CSS.supports(
  '(animation-timeline: --parallax) and (view-timeline: --parallax block) and ' +
  '(animation-range: entry-crossing 0% exit-crossing 100%)'
);

const updateIntroEyes = (e) => {
  const x = e.clientX / window.innerWidth;
  const y = e.clientY / window.innerHeight;
  let cx = 2 * (x - 0.5);
  let cy = 2 * (y - 0.5);
  const r = 1 / Math.max(1, magnitude(cx, cy));
  cx *= r;
  cy *= r;
  const transformX = cx * 100;
  const transformY = cy * 100;
  gsap.set('#david-left-eye', { x: `${transformX}%`, y: `${transformY}%` });
  gsap.set('#david-right-eye', { x: `${transformX}%`, y: `${transformY}%` });
};

// INTRO ANIMATION
const revealIntro = () => {
  document.documentElement.classList.remove('intro-loading');
  $('#title').classList.remove('hidden');
  $('#subtitle').classList.remove('hidden');
  $('#intro-scroll-button').disabled = false;
};

// Preloaded SVGs can still finish decoding on different frames. Keep the
// gradient over the intro until all its art is ready, then reveal it at once.
const introLoadStarted = performance.now();
const introImages = [...document.querySelectorAll('link[data-intro-asset]')].map(link => {
  const image = new Image();
  image.src = link.href;
  return image;
});
const whenImageReady = image => image.decode?.() ?? new Promise(resolve => {
  if (image.complete) return resolve();
  image.addEventListener('load', resolve, { once: true });
  image.addEventListener('error', resolve, { once: true });
});
let introTimeout;
Promise.race([
  Promise.allSettled([...introImages, ...$('#intro').querySelectorAll('img')]
    .map(whenImageReady)),
  new Promise(resolve => { introTimeout = setTimeout(resolve, 10000); })
]).then(() => {
  clearTimeout(introTimeout);
  // Cache hits can finish before the first visible frame. Leave a short
  // painted loading state so the intro and menu fades can actually be seen.
  const remaining = Math.max(0, 350 - (performance.now() - introLoadStarted));
  setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(revealIntro)), remaining);
});

const navHamburger = $('#nav-hamburger');
const navOptions = ['#nav-resume', '#nav-github', '#nav-linkedin', '#nav-instagram'].map(selector => $(selector));
let navMenuOpen = false;

const setNavMenuOpen = (open) => {
  navMenuOpen = open;
  navOptions.forEach(option => option.disabled = !open);
  navHamburger.setAttribute('aria-expanded', String(open));
};

navHamburger.addEventListener('click', () => setNavMenuOpen(!navMenuOpen));

document.addEventListener('click', (event) => {
  if (navMenuOpen && !navHamburger.contains(event.target)) setNavMenuOpen(false);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && navMenuOpen) {
    setNavMenuOpen(false);
    navHamburger.focus();
  }
});

// SCROLL BUTTONS
// Center a job description, including its parallax movement. If a following
// section is supplied, stop before that section can enter the viewport.
// The job settings live below; using them keeps the target aligned when changed.
const centeredJobScrollY = (sectionSelector, followingSectionSelector) => {
  const section = $(sectionSelector);
  const content = section.querySelector('.job-content');
  const { entryViewportFraction, centerAtSectionTop, speed } = experienceSettings.sections
    .find(settings => settings.sectionSelector === sectionSelector).job;
  const height = window.innerHeight;
  const sectionTop = section.getBoundingClientRect().top + scrollY;
  const centeredY = centerAtSectionTop === undefined ?
    sectionTop - entryViewportFraction * height +
      (height + content.getBoundingClientRect().height) / (2 * speed) :
    sectionTop - centerAtSectionTop * height;
  if (!followingSectionSelector) return centeredY;
  const followingTop = $(followingSectionSelector).getBoundingClientRect().top + scrollY;
  // Leave a small buffer so scroll rounding cannot reveal the next section.
  return Math.min(centeredY, followingTop - height - 8);
};

$('#intro-scroll-button').addEventListener('click', () => {
  $('#intro-scroll-button').disabled = true;
  gsap.to(window, {
    ease: 'sine.inOut',
    duration: 8,
    scrollTo: { y: '#google', offsetY: vh(95), autoKill: true }
  });
});
const setIntroActive = (active) => {
  for (const selector of ['#intro-scroll-button', '#david-upper', '#david-arm', '#david-hand']) {
    $(selector).style.animationPlayState = active ? 'running' : 'paused';
  }
  if (active) document.addEventListener('mousemove', updateIntroEyes, { passive: true });
  else document.removeEventListener('mousemove', updateIntroEyes);
};
ScrollTrigger.create({
  trigger: '#intro', start: "top bottom", end: "bottom top",
  // The box-shadow pulse otherwise repaints even while the intro is off-screen.
  onToggle: (self) => setIntroActive(self.isActive),
  onEnterBack: (self) => $('#intro-scroll-button').disabled = false
});
const introBounds = $('#intro').getBoundingClientRect();
setIntroActive(introBounds.bottom > 0 && introBounds.top < innerHeight);

$('#map-scroll-button').addEventListener('click', () => {
  $('#map-scroll-button').disabled = true;
  gsap.to(window, {
    ease: 'sine.inOut', duration: 6, scrollTo: {
      y: centeredJobScrollY('#nick'),
      autoKill: true
    }
  });
});
ScrollTrigger.create({
  trigger: '#map', start: "top bottom", end: "bottom top",
  onEnterBack: (self) => $('#map-scroll-button').disabled = false
});

$('#skills-scroll-button').addEventListener('click', () => {
  $('#skills-scroll-button').disabled = true;
  gsap.to(window, {
    ease: 'sine.inOut', duration: 4, scrollTo: {
      y: 'max',
      autoKill: true
    }
  });
});
ScrollTrigger.create({
  trigger: '#skills', start: "top bottom", end: "bottom top",
  onEnterBack: (self) => $('#skills-scroll-button').disabled = false
});

const addJobScrollButton = (buttonSelector, target) => {
  const button = $(buttonSelector);
  button.addEventListener('click', () => {
    button.disabled = true;
    gsap.to(window, {
      ease: 'sine.inOut',
      duration: 3,
      scrollTo: { y: typeof target === 'function' ? target() : target, autoKill: true },
      onComplete: () => button.disabled = false,
      onInterrupt: () => button.disabled = false
    });
  });
};
addJobScrollButton('#nick-scroll-button', () => centeredJobScrollY('#hedra', '#skills-header'));
addJobScrollButton('#hedra-scroll-button', '#skills-header');

// INTRO
if (!supportsCssParallax) {
  gsap.to("#fg",
    {
      yPercent: 15,
      scrollTrigger: {
        trigger: "#intro",
        start: "top top",
        end: "bottom top",
        scrub: 0,
      },
    }
  );

  const introBgs = gsap.utils.toArray('#intro .parallax-bg').sort(
    (a, b) => b.style.zIndex - a.style.zIndex
  );
  introBgs.forEach(
    (elem, i) => {
      gsap.to(elem,
        {
          yPercent: (i + 1) * 7,
          scrollTrigger: {
            trigger: "#intro",
            start: "top top",
            end: "bottom top",
            scrub: 0,
          },
        }
      );
    }
  );
}

// MAP
gsap.fromTo(
  '#map-path',
  { y: '-2%' },
  {
    y: '37%',
    ease: 'none',
    scrollTrigger: {
      trigger: '#map',
      start: "top bottom",
      end: "bottom top",
      scrub: 0,
    }
  }
);

gsap.fromTo(
  '#map-info',
  { y: '6%' },
  {
    y: '62%',
    ease: 'none',
    scrollTrigger: {
      trigger: '#map',
      start: "top bottom",
      end: "bottom top",
      scrub: 0,
    }
  }
);

gsap.fromTo(
  '#map-path svg',
  {
    strokeDasharray: '250%',
    strokeDashoffset: '250%',
  },
  {
    strokeDashoffset: 0,
    ease: 'none',
    scrollTrigger: {
      trigger: '#map',
      start: "-5% center",
      end: "65% center",
      scrub: 0.5,
    },
  }
);

ScrollTrigger.create({
  trigger: '#map',
  start: "6% center",
  end: "65% center",
  onEnter: (self) => $('#school-pin').classList.remove('inactive'),
  onLeaveBack: (self) => $('#school-pin').classList.add('inactive')
});

ScrollTrigger.create({
  trigger: '#map',
  start: "20% center",
  end: "65% center",
  onEnter: (self) => $('#samsung-pin').classList.remove('inactive'),
  onLeaveBack: (self) => $('#samsung-pin').classList.add('inactive')
});

ScrollTrigger.create({
  trigger: '#map',
  start: "34% center",
  end: "65% center",
  onEnter: (self) => $('#ads-pin').classList.remove('inactive'),
  onLeaveBack: (self) => $('#ads-pin').classList.add('inactive')
});

ScrollTrigger.create({
  trigger: '#map',
  start: "60% center",
  end: "65% center",
  onEnter: (self) => $('#google-pin').classList.remove('inactive'),
  onLeaveBack: (self) => $('#google-pin').classList.add('inactive')
});

const googlePinExpand = $('#google-pin-expand');
gsap.fromTo(
  googlePinExpand,
  {
    scale: 1,
    opacity: 0,
  },
  {
    scale: 30,
    opacity: 50,
    ease: 'power2.in',
    scrollTrigger: {
      trigger: '#map',
      start: "63% center",
      end: "75% center",
      scrub: 0.3,
      // markers: true,
    }
  }
);

// GOOGLE
const googleSections = gsap.utils.toArray('.google-section');
ScrollTrigger.create(
  {
    trigger: "#google",
    start: "top bottom",
    // Keep the doodles' horizontal motion on its original scroll range.
    end: "top -130%",
    scrub: 0.2,
    // markers: true,
    onUpdate: (self) => {
      const factor = gsap.utils.clamp(0.3, 2.4, Math.pow(getAspectRatio(), 2));

      googleSections.forEach((element, i) => {
        const isEven = (i % 2 == 0);
        const fromX = isEven ? -30 * factor : 15 * factor;
        const toX = isEven ? 15 * factor : -30 * factor;

        gsap.set(element,
          {
            x: `${gsap.utils.interpolate(fromX, toX, self.progress)}%`,
            force3D: true
          }
        );
      });
    }
  },
);
googleSections.forEach((element, i) => {
  const text = element.innerHTML;
  element.innerHTML += `${text} ${text}`;
});

// EXPERIENCE SECTIONS
// All positions below use the section named by sectionSelector as their anchor.
const experienceSettings = {
  halftone: {
    startTop: 1,       // Start when the new section's top reaches the viewport bottom.
    endTop: 0,         // Finish when that top reaches the viewport top.
    growthDistance: 0.25, // Each dot grows over this fraction of viewport-height scrolling.
    dotRows: 30,       // Grid density: this many rows fit in 48% of the viewport height.
    columnOffset: 4    // Rightmost dots start this many row delays after leftmost dots.
  },
  sections: [
    {
      sectionSelector: '#nick',
      job: { centerAtSectionTop: 0.25 }
    },
    {
      sectionSelector: '#hedra',
      canvasSelector: '#hedra-halftone',
      job: { entryViewportFraction: 0.7, startCover: -0.15, endCover: 1, speed: 1 }
    }
  ]
};
// Job controls, in each section's job object:
// entryViewportFraction: where the section top is when the text first reaches
// the viewport bottom (1 = viewport bottom; 0.7 = 70% down the viewport).
// centerAtSectionTop: section-top viewport fraction where the text is centered.
// startCover/endCover: parallax range measured over the section crossing the
// viewport (0 = top at bottom; 1 = bottom at top). -0.15 begins before entry.
// speed: text scroll speed divided by page scroll speed (1 = normal; 0.45 = 45%).

// JOB DESCRIPTIONS
const createJobScroll = ({ sectionSelector, entryViewportFraction, centerAtSectionTop,
  startCover, endCover, speed }) => {
  const section = $(sectionSelector);
  const content = section.querySelector('.job-content');
  let range;

  content.style.setProperty('--job-cover-start', `${startCover * 100}%`);
  content.style.setProperty('--job-cover-end', `${endCover * 100}%`);

  const layout = () => {
    const height = window.innerHeight;
    const sectionHeight = section.getBoundingClientRect().height;
    const coverDistance = height + sectionHeight;
    const sectionScroll = section.getBoundingClientRect().top + scrollY;
    const startSectionTop = height - startCover * coverDistance;
    const endSectionTop = height - endCover * coverDistance;
    const startScroll = sectionScroll - startSectionTop;
    const endScroll = sectionScroll - endSectionTop;
    if (centerAtSectionTop === undefined) {
      const entrySectionTop = entryViewportFraction * height;
      // Offset the starting position when speed changes so entry stays at the
      // same viewport edge while the text moves more slowly afterward.
      const entryCompensation = (1 - speed) * (startSectionTop - entrySectionTop);
      content.style.top = `${height - entrySectionTop - entryCompensation}px`;
    } else {
      const centeredSectionTop = centerAtSectionTop * height;
      content.style.top = `${(height - content.getBoundingClientRect().height) / 2 -
        (1 - speed) * startSectionTop - speed * centeredSectionTop}px`;
    }
    content.dataset.jobLayout = JSON.stringify({ height, sectionHeight, entryViewportFraction,
      centerAtSectionTop, startCover, endCover, speed });
    content.style.setProperty('--job-parallax-distance', `${(1 - speed) * (endScroll - startScroll)}px`);
    range = { startScroll, endScroll };
  };

  layout();
  if (supportsCssParallax) {
    ScrollTrigger.addEventListener('refresh', layout);
    return;
  }

  const update = () => {
    const elapsed = gsap.utils.clamp(0, range.endScroll - range.startScroll, scrollY - range.startScroll);
    const scrollStyle = `${(1 - speed) * elapsed}px`;
    if (content.style.getPropertyValue('--job-scroll') !== scrollStyle) {
      content.style.setProperty('--job-scroll', scrollStyle);
    }
  };
  ScrollTrigger.create({
    trigger: section,
    start: () => { layout(); return range.startScroll; },
    end: () => range.endScroll,
    onUpdate: update,
    onRefresh: update,
    onEnter: update,
    onEnterBack: update,
    onLeave: update,
    onLeaveBack: update
  });
  update();
};

experienceSettings.sections.filter(({ sectionSelector }) => sectionSelector !== '#nick').forEach(({ sectionSelector, job }) => {
  createJobScroll({ sectionSelector, ...job });
});

if (!supportsCssParallax) {
  for (const [layer, travel] of [['#nick-scene-bg', 9], ['#nick-scene-fg', 18]]) {
    gsap.fromTo(layer, { y: `${travel}vh` }, {
      y: `-${travel}vh`, ease: 'none',
      scrollTrigger: { trigger: '#nick', start: 'top bottom', end: 'bottom top', scrub: 0 }
    });
  }
}

// NICKELODEON TRANSITION
// The orange fade and every bubble position follow Nick's scroll progress.
const createNickWipe = () => {
  const section = $('#nick');
  const content = section.querySelector('.job-content');
  const scene = $('#nick-scene');
  const wipe = $('#nick-wipe');
  const bubbles = $('#nick-bubbles');
  let bubbleRenderer;
  const fadeStartTop = 1.05;
  const wipeScrollRange = 0.1;
  const bubbleLead = 4;
  const bubbleTail = 8;
  const bubblePreload = 2;
  const bubbleCanvasMaxSide = 1600;
  // A bubble still takes 20vh of scroll to cross the viewport.
  const bubbleFlight = 2;
  const latestLaunch = 1 + bubbleTail - bubbleFlight;
  const launchCenter = 0.5 - bubbleFlight / 2;
  let particles = [];
  let particleWidth = 0;
  let particleHeight = 0;
  let particleOverscan = 0;
  let drawnWidth = 0;
  let drawnHeight = 0;
  let bubblePosition = -bubbleLead;
  let targetBubblePosition = -bubbleLead;
  let lastDrawnPosition;
  let lastFrameTime = 0;
  let pendingFrame = 0;
  let bubbleSprite;
  let bubbleLoadStarted = false;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const buildParticles = (width, height) => {
    const peakSize = Math.min(240, Math.max(135, width * 0.22)) * 0.7;
    const sizeVariation = 0.4;
    const horizontalOverscan = peakSize * (1 + sizeVariation);
    const launchRange = latestLaunch + bubbleLead;
    const spread = 1.1;
    let seed = 27183;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const bell = (distance) => Math.exp(-0.5 * (distance / spread) ** 2);
    const sizeAt = (launch) => Math.round(peakSize *
      (0.2 + 0.8 * bell(launch + bubbleFlight / 2 - 0.5)));
    // Estimate how much of each bubble's circular face is on screen at the
    // wipe midpoint. The launch bell and edge clipping are included, so the
    // count responds to both viewport area and actual bubble pixel size.
    const calculateBubbleCount = (viewportWidth, viewportHeight, bubblePixelSize) => {
      const samples = 256;
      let weightedArea = 0;
      let totalWeight = 0;
      const circleIntegral = (radius, y) => 0.5 * (y *
        Math.sqrt(Math.max(0, radius * radius - y * y)) +
        radius * radius * Math.asin(y / radius));
      for (let i = 0; i < samples; i++) {
        const launch = -bubbleLead + (i + 0.5) / samples * launchRange;
        const weight = bell(launch - launchCenter);
        const phase = (0.5 - launch) / bubbleFlight;
        totalWeight += weight;
        if (phase <= 0 || phase >= 1) continue;
        const size = Math.round(bubblePixelSize *
          (0.2 + 0.8 * bell(launch + bubbleFlight / 2 - 0.5)));
        const radius = size / 2;
        const top = viewportHeight + size - phase * (viewportHeight + 2 * size);
        const center = top + radius;
        const lower = Math.max(-radius, -center);
        const upper = Math.min(radius, viewportHeight - center);
        if (upper > lower) {
          weightedArea += weight * 2 *
            (circleIntegral(radius, upper) - circleIntegral(radius, lower));
        }
      }
      const horizontalFraction = viewportWidth /
        (viewportWidth + 2 * bubblePixelSize * (1 + sizeVariation));
      // Uniform variation of ±40% increases the average bubble face area.
      const sizeAreaFactor = 1 + sizeVariation * sizeVariation / 3;
      // Stratified launch times and horizontal lanes cover gaps more
      // efficiently than unrestricted random overlap; account for that here.
      const spacingEfficiency = 1.2;
      const visibleAreaPerBubble = weightedArea / totalWeight *
        horizontalFraction * sizeAreaFactor * spacingEfficiency;
      const targetCoverage = 0.85;
      return Math.max(24, Math.ceil(-Math.log1p(-targetCoverage) *
        viewportWidth * viewportHeight / visibleAreaPerBubble));
    };
    const bubbleCount = Math.ceil(calculateBubbleCount(width, height, peakSize) * 1.5);
    // One bubble per bell-curve interval keeps the rise and fall smooth;
    // seeded jitter prevents the launches from looking evenly spaced.
    const steps = 256;
    const cumulative = new Float64Array(steps + 1);
    for (let step = 1; step <= steps; step++) {
      const launch = -bubbleLead + (step - 0.5) / steps * launchRange;
      cumulative[step] = cumulative[step - 1] + bell(launch - launchCenter);
    }
    const launchAt = (fraction) => {
      const target = fraction * cumulative[steps];
      let low = 0;
      let high = steps;
      while (low + 1 < high) {
        const middle = (low + high) >> 1;
        if (cumulative[middle] < target) low = middle;
        else high = middle;
      }
      const withinStep = (target - cumulative[low]) /
        (cumulative[high] - cumulative[low]);
      return -bubbleLead + (low + withinStep) / steps * launchRange;
    };
    const nextParticles = [];
    for (let i = 0; i < bubbleCount; i++) {
      const launch = i === 0 ? -bubbleLead : i === bubbleCount - 1 ? latestLaunch :
        launchAt((i - 1 + random()) / (bubbleCount - 2));
      // Size peaks when this bubble crosses the screen at the wipe midpoint.
      const size = Math.round(sizeAt(launch) *
        (1 + sizeVariation * (random() * 2 - 1)));
      nextParticles.push({
        size,
        sway: 8 + random() * 21,
        launch,
        waveOffset: random() * Math.PI * 2,
        angle: (random() * 2 - 1) * Math.PI / 6
      });
    }
    // Shuffle screen-wide lanes for each small launch group, then jitter
    // within each lane. The seed keeps the pattern stable while scrolling.
    const laneCount = Math.max(6, Math.round(
      (width + 2 * horizontalOverscan) / peakSize));
    for (let start = 0; start < bubbleCount; start += laneCount) {
      const lanes = Array.from({ length: laneCount }, (_, lane) => lane);
      for (let lane = laneCount - 1; lane > 0; lane--) {
        const swap = Math.floor(random() * (lane + 1));
        [lanes[lane], lanes[swap]] = [lanes[swap], lanes[lane]];
      }
      for (let i = 0; i < Math.min(laneCount, bubbleCount - start); i++) {
        nextParticles[start + i].x = (lanes[i] + random()) / laneCount;
      }
    }
    particles = nextParticles;
    particleOverscan = horizontalOverscan;
    if (bubbleRenderer) bubbleRenderer.setParticles(particles, particleOverscan);
    particleWidth = width;
    particleHeight = height;
  };
  if (!reducedMotion.matches) buildParticles(innerWidth, innerHeight);

  const drawBubbles = (now) => {
    pendingFrame = 0;
    if (!bubbleSprite || !bubbles.classList.contains('is-active')) {
      lastFrameTime = 0;
      return;
    }
    // A short, bounded lag gives scroll changes some weight without letting
    // the bubbles drift far from the current scroll position.
    const elapsed = lastFrameTime ? now - lastFrameTime : 1000 / 60;
    lastFrameTime = now;
    const difference = targetBubblePosition - bubblePosition;
    bubblePosition = Math.abs(difference) < 0.002 ? targetBubblePosition :
      bubblePosition + difference * (1 - Math.exp(-elapsed / 87.5));
    const width = innerWidth;
    const height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.5,
      bubbleCanvasMaxSide / Math.max(width, height));
    if (width !== particleWidth || height !== particleHeight) buildParticles(width, height);
    bubbleRenderer.draw(particles, bubblePosition, bubbleFlight, width, height, ratio);
    drawnWidth = width;
    drawnHeight = height;
    lastDrawnPosition = bubblePosition;
    if (bubblePosition !== targetBubblePosition) {
      pendingFrame = requestAnimationFrame(drawBubbles);
    } else {
      lastFrameTime = 0;
    }
  };

  const update = () => {
    const bounds = section.getBoundingClientRect();
    const visible = bounds.top < fadeStartTop * innerHeight && bounds.bottom > 0;
    const wipePosition = (fadeStartTop - bounds.top / innerHeight) / wipeScrollRange;
    const progress = gsap.utils.clamp(0, 1, wipePosition);
    // Bubbles span -40vh to +90vh around the start of the 10vh opacity fade.
    targetBubblePosition = gsap.utils.clamp(-bubbleLead, 1 + bubbleTail, wipePosition);
    // Prepare the sprite shortly before the first bubble reaches the screen.
    if (wipePosition > -bubbleLead - bubblePreload &&
        wipePosition < 1 + bubbleTail) loadBubbles();
    const bubbleWindow = bubbleRenderer && bubbleRenderer.kind !== 'none' &&
      Boolean(bubbleSprite) &&
      !reducedMotion.matches &&
      wipePosition > -bubbleLead && wipePosition < 1 + bubbleTail;
    const wasActive = bubbles.classList.contains('is-active');
    wipe.style.visibility = visible ? 'visible' : 'hidden';
    scene.style.visibility = visible ? 'visible' : 'hidden';
    bubbles.style.visibility = bubbleWindow ? 'visible' : 'hidden';
    bubbles.classList.toggle('is-active', bubbleWindow);
    wipe.style.opacity = progress;
    scene.style.opacity = progress;
    // The description shares the orange entry fade; it stays opaque while
    // Hedra's dots cover it on the way out.
    content.style.visibility = visible ? 'visible' : 'hidden';
    content.style.opacity = progress;
    if (bubbleWindow) {
      if (!wasActive) {
        bubblePosition = targetBubblePosition;
        lastDrawnPosition = undefined;
        lastFrameTime = 0;
      } else {
        bubblePosition = gsap.utils.clamp(targetBubblePosition - 0.32,
          targetBubblePosition + 0.32, bubblePosition);
      }
      if (!pendingFrame && (targetBubblePosition !== lastDrawnPosition ||
          innerWidth !== drawnWidth || innerHeight !== drawnHeight)) {
        pendingFrame = requestAnimationFrame(drawBubbles);
      }
    } else {
      if (pendingFrame) cancelAnimationFrame(pendingFrame);
      pendingFrame = 0;
      lastFrameTime = 0;
    }
  };

  const loadBubbles = () => {
    if (bubbleLoadStarted || reducedMotion.matches) return;
    bubbleLoadStarted = true;
    const bubbleImage = new Image();
    bubbleImage.onload = () => {
      bubbleImage.onload = null;
      // Cache a compact sprite so each scroll frame samples a small bitmap.
      const sprite = document.createElement('canvas');
      sprite.width = 384;
      sprite.height = 384;
      const spriteContext = sprite.getContext('2d');
      if (!spriteContext) return;
      spriteContext.drawImage(bubbleImage, 140, 137, 974, 974, 0, 0, 384, 384);
      bubbleSprite = sprite;
      bubbleRenderer = createNickBubbleRenderer(bubbles);
      bubbleRenderer.setSprite(sprite);
      bubbleRenderer.setParticles(particles, particleOverscan);
      lastDrawnPosition = undefined;
      update();
    };
    bubbleImage.src = 'assets/nick-bubble.png';
  };
  reducedMotion.addEventListener('change', update);

  ScrollTrigger.create({
    trigger: section,
    start: () => section.getBoundingClientRect().top + scrollY -
      (fadeStartTop + (bubbleLead + bubblePreload) * wipeScrollRange) * innerHeight,
    end: () => section.getBoundingClientRect().bottom + scrollY,
    onUpdate: update,
    onRefresh: update,
    onEnter: update,
    onEnterBack: update,
    onLeave: update,
    onLeaveBack: update
  });
  update();
};

createNickWipe();

// HEDRA HALFTONE TRANSITION
// Hedra's fixed canvas covers the orange wipe with black dots.
const halftoneRowPitch = (viewportHeight) =>
  viewportHeight * 0.48 / experienceSettings.halftone.dotRows;

const createHalftone = ({ canvasSelector, sectionSelector }) => {
  const canvas = $(canvasSelector);
  const section = $(sectionSelector);
  const { startTop, endTop, growthDistance, columnOffset } = experienceSettings.halftone;
  let size;
  let lastProgress;
  let renderer;
  let initialized = false;

  const initialize = () => {
    initialized = true;
    try {
      renderer = createHalftoneGpuRenderer(canvas);
    } catch (error) {
      console.warn('Halftone WebGL renderer unavailable.', error);
    }
    // Keep the job text legible if WebGL2 cannot paint its section background.
    canvas.style.display = renderer ? '' : 'none';
    section.style.backgroundColor = renderer ? '' : getComputedStyle(canvas).color;
    size = undefined;
    lastProgress = undefined;
  };

  const resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1,
      renderer.maxSize / Math.max(width, height));
    if (size && width === size.width && height === size.height && dpr === size.dpr) return;

    canvas.width = Math.ceil(width * dpr);
    canvas.height = Math.ceil(height * dpr);
    // 100% excludes the scrollbar in some browsers, scaling the bitmap.
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const color = getComputedStyle(canvas).color;
    const rowPitch = halftoneRowPitch(height);
    // Adjacent rows shift by half a column. Equal horizontal and vertical
    // legs between their centers make a square grid turned 45 degrees.
    const pitch = 2 * rowPitch;
    const columns = Math.ceil(width / pitch) + 2;
    const radius = rowPitch + 1 / dpr;
    const originY = height - 0.5 * rowPitch;
    const lastCell = Math.ceil(originY / rowPitch + radius / rowPitch + 0.5);
    size = {
      width, height, dpr, color: color.match(/\d+/g).slice(0, 3).map(value => Number(value) / 255),
      rowPitch, columns, cells: lastCell + 1,
      // The rotated grid's covering radius is one row pitch. One device
      // pixel of overlap closes raster gaps where four full dots meet.
      radius
    };
    renderer.resize();
    lastProgress = undefined;
  };

  const update = () => {
    const height = window.innerHeight;
    const bounds = section.getBoundingClientRect();
    const travel = (startTop - endTop) * height;
    const distance = startTop * height - bounds.top;
    const progress = gsap.utils.clamp(0, 1, distance / travel);
    // Stop at this section's bottom; the next background or header takes over.
    if (distance <= 0 || bounds.bottom <= 0) {
      if (canvas.style.visibility !== 'hidden') canvas.style.visibility = 'hidden';
      lastProgress = undefined;
      return;
    }
    if (!initialized) initialize();
    if (!renderer) {
      // With no canvas, the solid section color itself is the reveal edge.
      return;
    }

    resize();
    const { cells } = size;
    if (canvas.style.visibility !== 'visible') canvas.style.visibility = 'visible';
    // Every row grows at the same rate. Delay each row, including the ones
    // nearest the bottom; completed dots overlap into a solid color.
    const growthPixels = growthDistance * height;
    const rowDelay = (travel - growthPixels) / (cells - 1 + columnOffset);
    if (progress === lastProgress) return;
    lastProgress = progress;
    renderer.render({ ...size, distance, growthPixels, rowDelay,
      columnOffset, complete: progress >= 1 });
  };

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    renderer = null;
    canvas.style.display = 'none';
    section.style.backgroundColor = getComputedStyle(canvas).color;
    update();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    initialized = false;
    update();
  });

  ScrollTrigger.create({
    trigger: section,
    start: () => section.getBoundingClientRect().top + scrollY - startTop * innerHeight,
    end: () => section.getBoundingClientRect().bottom + scrollY,
    onUpdate: update,
    onRefresh: update,
    onEnter: update,
    onEnterBack: update,
    onLeave: update,
    onLeaveBack: update
  });
  update();
};

experienceSettings.sections.filter(({ canvasSelector }) => canvasSelector).forEach(createHalftone);

// SKILLS
// All rows travel the same distance. Animate their shared container
// while keeping each row's existing reveal threshold and staggered transitions.
const skillsContainer = $('#skills .parallax-container');
if (supportsCssParallax) {
  ScrollTrigger.create({
    trigger: '#skills',
    start: "top bottom",
    end: "bottom top",
    onUpdate: (self) => {
      // Preserve immediateRender:false: the original starts at y=0 until the
      // first positive scroll progress, then retains its start value on return.
      if (self.progress > 0) {
        skillsContainer.classList.add('parallax-active');
        self.kill();
      }
    }
  });
} else {
  gsap.fromTo(
    skillsContainer,
    { y: '-35vh' },
    {
      y: '30vh',
      ease: 'none',
      immediateRender: false,
      scrollTrigger: {
        trigger: '#skills',
        start: "top bottom",
        end: "bottom top",
        scrub: 0,
      }
    }
  );
}

const skillSections = gsap.utils.toArray('.skill-section');
skillSections.forEach((skillSection, i) => {
  const top = 110 - (17 * (i + 1));

  ScrollTrigger.create({
    trigger: "#skills",
    start: `top ${top}%`,
    end: "bottom bottom",
    scrub: 0,
    onEnter: (self) => skillSection.classList.remove('hidden'),
    onLeaveBack: (self) => skillSection.classList.add('hidden')
  });
});

// OUTRO
if (!supportsCssParallax) {
  const outroBgs = gsap.utils.toArray('#outro .parallax-bg').sort(
    (a, b) => a.style.zIndex - b.style.zIndex
  );
  outroBgs.reverse().forEach(
    (elem, i) => {
      gsap.fromTo(elem,
        { y: `${-5 - (i * 7)}vh` },
        {
          y: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: "#outro",
            start: "top bottom",
            end: "bottom bottom",
            scrub: 0,
          },
        }
      );
    }
  );

  // Match the CSS timeline directly; a numeric scrub makes the sun and text
  // lag behind the skyline, especially when changing scroll direction.
  for (const [target, from] of [['#outro-info', '-14vh'], ['#outro-sun', '-55vh']]) {
    gsap.fromTo(target,
      { y: from },
      {
        y: '1px',
        ease: 'none',
        scrollTrigger: {
          trigger: "#outro",
          start: "top bottom",
          end: "bottom bottom",
          scrub: true,
        },
      }
    );
  }
}

ScrollTrigger.create(
  {
    trigger: "#outro",
    start: "80% bottom",
    end: "bottom bottom",
    scrub: 0,
    onEnter: (self) => {
      $('#outro-socials').classList.remove('hidden');
      $('html').style.setProperty('background-color', 'var(--bg-outro-color)');
    },
    onLeaveBack: (self) => {
      $('#outro-socials').classList.add('hidden');
      $('html').style.removeProperty('background-color');
    }
  }
);
