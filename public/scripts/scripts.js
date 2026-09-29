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

document.addEventListener('mousemove', (e) => {
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
});

// INTRO ANIMATION
window.onload = () => {
  $('#title').classList.remove('hidden');
  $('#subtitle').classList.remove('hidden');
  $('#intro-scroll-button').disabled = false;
};

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
  const { entryViewportFraction, speed } = experienceSettings.sections
    .find(settings => settings.sectionSelector === sectionSelector).job;
  const height = window.innerHeight;
  const sectionTop = section.getBoundingClientRect().top + scrollY;
  const centeredY = sectionTop - entryViewportFraction * height +
    (height + content.getBoundingClientRect().height) / (2 * speed);
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
ScrollTrigger.create({
  trigger: '#intro', start: "top bottom", end: "bottom top",
  // The box-shadow pulse otherwise repaints even while the intro is off-screen.
  onToggle: (self) => $('#intro-scroll-button').style.animationPlayState = self.isActive ? 'running' : 'paused',
  onEnterBack: (self) => $('#intro-scroll-button').disabled = false
});

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
// The canvas named by canvasSelector paints that section's background during entry.
const experienceSettings = {
  halftone: {
    startTop: 1,       // Start when the new section's top reaches the viewport bottom.
    endTop: 0,         // Finish when that top reaches the viewport top.
    growthDistance: 0.25, // Each dot grows over this fraction of viewport-height scrolling.
    dotRows: 30,       // Grid density: this many rows fit in 48% of the viewport height.
    columnOffset: 4    // Rightmost dots start this many row delays after leftmost dots.
  },
  ambient: {
    startProgress: 0.72, // Begin Hedra's waves after most black transition dots have grown.
    maxDpr: 1.5,       // The soft background does not need a full high-density bitmap.
    scrollPhase: 1.3,  // Scrolling advances the wave field by this many seconds.
    timePhase: 0.001,  // Convert animation timestamps from milliseconds to seconds.
    scrollEaseMs: 90,  // Smooth wheel steps without delaying the section transition.
    pointerEaseMs: 85, // Time for the dot field to follow and release the cursor.
    pointerRadius: 0.28, // Cursor ripple radius relative to the section's shorter side.
    pointerGain: 0.48  // Maximum extra dot intensity at the cursor.
  },
  sections: [
    {
      sectionSelector: '#nick',
      canvasSelector: '#nick-halftone',
      job: { entryViewportFraction: 0.7, startCover: -0.15, endCover: 1, speed: 1 }
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
// startCover/endCover: parallax range measured over the section crossing the
// viewport (0 = top at bottom; 1 = bottom at top). -0.15 begins before entry.
// speed: text scroll speed divided by page scroll speed (1 = normal; 0.8 = 80%).

// JOB DESCRIPTIONS
const createJobScroll = ({ sectionSelector, entryViewportFraction, startCover, endCover, speed }) => {
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
    const entrySectionTop = entryViewportFraction * height;
    // Offset the starting position when speed changes so entry stays at the
    // same viewport edge while the text moves more slowly or quickly afterward.
    const entryCompensation = (1 - speed) * (startSectionTop - entrySectionTop);
    content.style.top = `${height - entrySectionTop - entryCompensation}px`;
    content.dataset.jobLayout = JSON.stringify({ height, sectionHeight, entryViewportFraction,
      startCover, endCover, speed });
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

experienceSettings.sections.forEach(({ sectionSelector, job }) => {
  createJobScroll({ sectionSelector, ...job });
});

// HALFTONE TRANSITIONS
// Each canvas is fixed so its dots can cover the previous section. Orange stays
// under black; the DOM sections are white, so no hard color edge can show.
// The ambient dots use this same spacing so their lattice matches the transition.
const halftoneRowPitch = (viewportHeight) =>
  viewportHeight * 0.48 / experienceSettings.halftone.dotRows;

const createHedraAmbient = (section) => {
  const canvas = section.querySelector('#hedra-ambient');
  if (!canvas) return null;
  const context = canvas.getContext('2d');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const { maxDpr, scrollPhase, timePhase, scrollEaseMs, pointerEaseMs,
    pointerRadius, pointerGain } = experienceSettings.ambient;
  let width = 0, height = 0, dpr = 0, frame = 0, lastFrame = 0;
  let active = false, sectionProgress = 0, targetProgress = 0;
  let pointerClientX = NaN, pointerClientY = NaN;
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, strength: 0, targetStrength: 0 };
  let rowPitch = 0, maxRadius = 0, dots = [];
  const tones = ['#929292', '#a4a4a4', '#b6b6b6', '#c8c8c8', '#dadada', '#ececec', '#fff'];

  const resize = () => {
    const nextWidth = section.clientWidth;
    const nextHeight = section.clientHeight;
    const nextDpr = Math.min(devicePixelRatio || 1, maxDpr);
    const nextRowPitch = halftoneRowPitch(innerHeight);
    if (width === nextWidth && height === nextHeight && dpr === nextDpr && rowPitch === nextRowPitch) return;
    width = nextWidth;
    height = nextHeight;
    dpr = nextDpr;
    canvas.width = Math.ceil(width * dpr);
    canvas.height = Math.ceil(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    rowPitch = nextRowPitch;
    // The nearest neighbors in the rotated grid are rowPitch * sqrt(2) apart.
    maxRadius = rowPitch * Math.SQRT2 * 0.45;
    dots = [];
    if (!width || !height) return;

    // TinkerFX's travelling diagonal wave and center ripple are sampled at every dot.
    // https://tinkerfx.com/effects/halftone-waves
    // Their spatial phases change only when the canvas dimensions change.
    for (let row = 0, y = 0; y < height + rowPitch; row++, y += rowPitch) {
      for (let x = (row & 1) * rowPitch; x < width + rowPitch; x += rowPitch * 2) {
        dots.push({ x, y,
          diagonal: x * 0.018 + y * 0.012,
          ripple: Math.hypot(x - width / 2, y - height / 2) * 0.03 });
      }
    }
  };

  const render = (time) => {
    resize();
    context.clearRect(0, 0, width, height);
    if (!width || !height) return;
    const waveTime = reducedMotion.matches ? 1.5 : time * timePhase + sectionProgress * scrollPhase;
    const diagonalPhase = waveTime * 2, ripplePhase = waveTime * 2.4;
    const paths = tones.map(() => new Path2D());
    const cursorRadius = Math.min(width, height) * pointerRadius;
    const cursorActive = pointer.strength > 0.001 && cursorRadius > 0;

    // Like the reference, the wave field controls dot radius across the entire
    // canvas. Keep our existing 45-degree lattice and grayscale palette.
    for (const dot of dots) {
      let intensity = (Math.sin(dot.diagonal - diagonalPhase)
        + Math.sin(dot.ripple - ripplePhase) + 2) * 0.25;
      if (cursorActive) {
        const dx = (dot.x - pointer.x) / cursorRadius;
        const dy = (dot.y - pointer.y) / cursorRadius;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < 1) {
          const falloff = (1 - distanceSquared) ** 2;
          intensity += pointer.strength * pointerGain * falloff
            * (0.7 + 0.3 * Math.sin(Math.sqrt(distanceSquared) * cursorRadius * 0.05 - waveTime * 3));
        }
      }
      intensity = Math.min(1, intensity);
      const radius = maxRadius * intensity;
      if (radius < 0.4) continue;
      const path = paths[Math.min(tones.length - 1, Math.floor(intensity * tones.length))];
      path.moveTo(dot.x + radius, dot.y);
      path.arc(dot.x, dot.y, radius, 0, 2 * Math.PI);
    }
    tones.forEach((color, index) => {
      context.fillStyle = color;
      context.fill(paths[index]);
    });
  };

  const tick = (time) => {
    frame = 0;
    if (!active || document.hidden || reducedMotion.matches) return;
    const elapsed = Math.min(64, Math.max(0, time - lastFrame));
    lastFrame = time;
    const scrollBlend = 1 - Math.exp(-elapsed / scrollEaseMs);
    const pointerBlend = 1 - Math.exp(-elapsed / pointerEaseMs);
    sectionProgress += (targetProgress - sectionProgress) * scrollBlend;
    pointer.x += (pointer.targetX - pointer.x) * pointerBlend;
    pointer.y += (pointer.targetY - pointer.y) * pointerBlend;
    pointer.strength += (pointer.targetStrength - pointer.strength) * pointerBlend;
    render(time);
    frame = requestAnimationFrame(tick);
  };

  const updatePointer = (bounds) => {
    const inside = pointerClientX >= bounds.left && pointerClientX <= bounds.right
      && pointerClientY >= bounds.top && pointerClientY <= bounds.bottom;
    pointer.targetStrength = inside ? 1 : 0;
    if (!inside) return;
    pointer.targetX = pointerClientX - bounds.left;
    pointer.targetY = pointerClientY - bounds.top;
    if (pointer.strength < 0.001) {
      pointer.x = pointer.targetX;
      pointer.y = pointer.targetY;
    }
  };

  const setState = (visible, progress, bounds) => {
    targetProgress = progress;
    if (visible && !reducedMotion.matches) updatePointer(bounds);
    if (visible === active) return;
    active = visible;
    section.classList.toggle('ambient-active', active);
    if (active) {
      sectionProgress = progress;
      render(performance.now());
      lastFrame = performance.now();
      if (!reducedMotion.matches && !document.hidden) frame = requestAnimationFrame(tick);
    } else {
      pointer.strength = pointer.targetStrength = 0;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    }
  };

  window.addEventListener('pointermove', (event) => {
    if (!active || reducedMotion.matches || event.pointerType === 'touch') return;
    pointerClientX = event.clientX;
    pointerClientY = event.clientY;
    updatePointer(section.getBoundingClientRect());
  }, { passive: true });
  section.addEventListener('pointerleave', () => { pointer.targetStrength = 0; });
  window.addEventListener('blur', () => {
    pointerClientX = pointerClientY = NaN;
    pointer.targetStrength = 0;
  });
  reducedMotion.addEventListener('change', () => {
    pointer.strength = pointer.targetStrength = 0;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (!active) return;
    sectionProgress = targetProgress;
    render(performance.now());
    lastFrame = performance.now();
    if (!reducedMotion.matches && !document.hidden) frame = requestAnimationFrame(tick);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else if (!document.hidden && active && !reducedMotion.matches && !frame) {
      frame = requestAnimationFrame(tick);
    }
  });
  window.addEventListener('resize', () => {
    if (active) render(performance.now());
  });
  return { setState };
};

const createHalftone = ({ canvasSelector, sectionSelector }) => {
  const canvas = $(canvasSelector);
  const context = canvas.getContext('2d');
  const section = $(sectionSelector);
  const ambient = createHedraAmbient(section);
  const { startTop, endTop, growthDistance, columnOffset } = experienceSettings.halftone;
  let size;
  let lastProgress;

  const resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
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
    size = {
      width, height, dpr, color, pitch, rowPitch,
      // The rotated grid's covering radius is one row pitch. One device
      // pixel of overlap closes raster gaps where four full dots meet.
      radius: rowPitch + 1 / dpr,
      offsets: Array.from({ length: columns }, (_, i) => columns > 1 ? columnOffset * i / (columns - 1) : 0)
    };
    lastProgress = undefined;
  };

  const update = () => {
    const height = window.innerHeight;
    const bounds = section.getBoundingClientRect();
    const travel = (startTop - endTop) * height;
    const distance = startTop * height - bounds.top;
    const progress = gsap.utils.clamp(0, 1, distance / travel);
    // The ambient canvas runs only while Hedra is visible and mostly black.
    ambient?.setState(progress >= experienceSettings.ambient.startProgress && bounds.bottom > 0,
      gsap.utils.clamp(0, 1, (height - bounds.top) / (height + bounds.height)), bounds);
    // Stop at this section's bottom; the next background or header takes over.
    if (distance <= 0 || bounds.bottom <= 0) {
      if (canvas.style.visibility !== 'hidden') canvas.style.visibility = 'hidden';
      lastProgress = undefined;
      return;
    }

    resize();
    const { dpr, color, pitch, rowPitch, radius, offsets } = size;
    if (canvas.style.visibility !== 'visible') canvas.style.visibility = 'visible';
    if (progress === lastProgress) return;
    lastProgress = progress;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = color;
    if (progress >= 1) {
      context.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    // Every row grows at the same rate. Delay each row, including the ones
    // nearest the bottom; completed dots overlap into a solid color.
    const originY = height - 0.5 * rowPitch;
    const lastCell = Math.ceil(originY / rowPitch + radius / rowPitch + 0.5);
    const growthPixels = growthDistance * height;
    const rowDelay = (travel - growthPixels) / (lastCell + columnOffset);
    context.beginPath();
    offsets.forEach((offset, i) => {
      for (let cell = 0; cell <= lastCell; cell++) {
        const x = ((i - 0.5) * pitch + (cell & 1) * rowPitch) * dpr;
        const growth = gsap.utils.clamp(0, 1,
          (distance - (cell + offset) * rowDelay) / growthPixels);
        const y = (originY + (0.5 - cell) * rowPitch) * dpr;
        const dotRadius = radius * growth * dpr;
        if (dotRadius > 0 && y + dotRadius > 0 && y - dotRadius < canvas.height) {
          context.moveTo(x + dotRadius, y);
          context.arc(x, y, dotRadius, 0, 2 * Math.PI);
        }
      }
    });
    context.fill();
  };

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

};

experienceSettings.sections.forEach(createHalftone);

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
