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
      y: '#nick',
      offsetY: vh(20),
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
      duration: 2,
      scrollTo: { y: target, autoKill: true },
      onComplete: () => button.disabled = false,
      onInterrupt: () => button.disabled = false
    });
  });
};
addJobScrollButton('#nick-scroll-button', '#hedra');
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
    // Keep the doodle motion on its original 130vh range while the longer
    // section gives the orange transition room to finish.
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

// JOB DESCRIPTIONS
// Cover 0 is section top at viewport bottom; cover 1 is section bottom at viewport top.
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
    const entryCompensation = (1 - speed) * (startSectionTop - entrySectionTop);
    content.style.top = `${height - entrySectionTop - entryCompensation}px`;
    content.dataset.jobLayout = JSON.stringify({ height, sectionHeight, startCover, endCover, speed });
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

createJobScroll({
  sectionSelector: '#nick',
  entryViewportFraction: 1.15, // Text enters at the viewport bottom when Nick's top reaches it.
  startCover: -0.15,
  endCover: 1,
  speed: 1
});
createJobScroll({
  sectionSelector: '#hedra',
  entryViewportFraction: 0.7, // Text enters at the viewport bottom when black dots begin.
  startCover: -0.15,
  endCover: 1,
  speed: 1
});

// HALFTONE TRANSITIONS
// Both color fields live in fixed canvases. Orange stays behind the black
// transition, so the white section backgrounds never form a visible edge.
const halftoneDotRows = 30;
const halftoneColumnOffset = 4;
// Both transitions travel 55vh; a 10vh growth span gives them the same dot band.
const halftoneGrowthDistance = 0.1;
const googleDotOrigin = 0.7;
const createHalftone = (canvasSelector, sectionSelector, startRows = null) => {
  const canvas = $(canvasSelector);
  const context = canvas.getContext('2d');
  const section = $(sectionSelector);
  const skillsHeader = $('#skills-header');
  const startViewportFraction = 0.8;
  let anchorGap = startRows ? undefined : 0;
  let size;
  let lastProgress;

  const measureAnchor = () => {
    const rowBottom = Math.max(...startRows.map(row => row.getBoundingClientRect().bottom));
    anchorGap = section.getBoundingClientRect().bottom - rowBottom;
    return rowBottom;
  };

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
    const rowPitch = height * 0.48 / halftoneDotRows;
    // Adjacent rows shift by half a column. Equal horizontal and vertical
    // legs between their centers make a square grid turned 45 degrees.
    const pitch = 2 * rowPitch;
    const columns = Math.ceil(width / pitch) + 2;
    size = {
      width, height, dpr, color, pitch, rowPitch,
      // The rotated grid's covering radius is one row pitch. One device
      // pixel of overlap closes raster gaps where four full dots meet.
      radius: rowPitch + 1 / dpr,
      offsets: Array.from({ length: columns }, (_, i) => columns > 1 ? halftoneColumnOffset * i / (columns - 1) : 0)
    };
    lastProgress = undefined;
  };

  const update = () => {
    const height = window.innerHeight;
    if (anchorGap === undefined) measureAnchor();
    const anchorBottom = section.getBoundingClientRect().bottom - anchorGap;
    const travel = (startViewportFraction - 0.25) * height;
    const distance = startViewportFraction * height - anchorBottom;
    const progress = gsap.utils.clamp(0, 1, distance / travel);
    const skillsTop = skillsHeader.getBoundingClientRect().top;
    const pastSkills = skillsTop <= 0;
    if (distance <= 0 || pastSkills) {
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

    // Every dot grows over the same scroll distance. Rows begin at the bottom
    // one by one, including the rows below Google's doodles. Completed rows
    // overlap to make the solid color without a separate fill edge.
    const originY = height * (startRows ? googleDotOrigin : 1) - 0.5 * rowPitch;
    const lowerRowSpan = startRows ? (height - googleDotOrigin * height) / rowPitch : 0;
    // Google's grid needs one row below the viewport for complete coverage;
    // its visible stagger still begins at the first row inside the viewport.
    const lowerRows = Math.ceil(lowerRowSpan);
    const delayBase = Math.floor(lowerRowSpan);
    const lastCell = Math.ceil(originY / rowPitch + radius / rowPitch + 0.5);
    const growthDistance = halftoneGrowthDistance * height;
    const rowDelay = (travel - growthDistance) / (lastCell + delayBase + halftoneColumnOffset);
    context.beginPath();
    offsets.forEach((offset, i) => {
      for (let cell = -lowerRows; cell <= lastCell; cell++) {
        const x = ((i - 0.5) * pitch + (cell & 1) * rowPitch) * dpr;
        const growth = gsap.utils.clamp(0, 1,
          (distance - (cell + delayBase + offset) * rowDelay) / growthDistance);
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
    start: startRows
      ? () => {
        const rowBottom = measureAnchor();
        return rowBottom + window.scrollY - startViewportFraction * window.innerHeight;
      }
      : 'bottom 80%',
    end: () => skillsHeader.getBoundingClientRect().top + window.scrollY,
    onUpdate: update,
    onRefresh: update,
    onEnter: update,
    onEnterBack: update,
    onLeave: update,
    onLeaveBack: update
  });

};

createHalftone('#google-halftone', '#google', googleSections);
createHalftone('#nick-halftone', '#nick');

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
