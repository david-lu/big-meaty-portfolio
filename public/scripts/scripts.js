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

$('#nav-hamburger').addEventListener('click', () => {
  $('#nav-github').disabled = !$('#nav-github').disabled;
  $('#nav-linkedin').disabled = !$('#nav-linkedin').disabled;
  $('#nav-instagram').disabled = !$('#nav-instagram').disabled;
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
      y: '#skills',
      offsetY: vh(-5),
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
    end: "bottom top",
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

// HALFTONE JOB BACKGROUNDS
// Incoming-color circles grow continuously on a fixed grid. Every column
// is offset progressively toward the right in scroll distance, not time.
const halftoneDotRows = 14;
const halftoneMaxOffset = 2; // Dot rows of additional scrolling at the right edge.
// Keep the entire diagonal transition inside the original half-screen band.
const halftoneGrowthRows = halftoneDotRows - halftoneMaxOffset;
document.querySelectorAll('.job-section').forEach(section => {
  const canvas = document.createElement('canvas');
  canvas.className = 'halftone-background';
  canvas.setAttribute('aria-hidden', 'true');
  section.prepend(canvas);
  const context = canvas.getContext('2d', {alpha: false});
  let top, height, pitch, rowPitch, viewport, dpr, background, incoming, maxRadius;
  let columns = [], cacheKey;
  const render = (column, row, force = false) => {
    if (force || row !== column.row) {
      column.row = row;
      column.dirty = true;
    }
  };
  const paint = () => {
    if (!columns.some(column => column.dirty)) return;
    // Repaint overlapping circles together so antialiased edges never accumulate.
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = incoming;
    const solidTops = columns.map(column => Math.max(0,
      (viewport + (halftoneGrowthRows - column.row) * rowPitch) * dpr));
    columns.forEach((column, index) => {
      column.dirty = false;
      const solidTop = solidTops[index];
      if (solidTop < canvas.height) {
        const cellLeft = Math.floor(index * pitch * dpr);
        context.fillRect(cellLeft, solidTop,
          Math.ceil((index + 1) * pitch * dpr) - cellLeft, canvas.height - solidTop);
      }
    });
    // Batch visible circles into one path; solid color already covers the rest.
    const lastCell = Math.ceil(viewport / rowPitch + maxRadius / rowPitch + 0.5);
    context.beginPath();
    let circles = false;
    columns.forEach((column, index) => {
      const x = (index + 0.5) * pitch * dpr;
      // A full-size circle reaches at most the two adjacent column cells.
      const coveredTop = Math.max(solidTops[index],
        solidTops[Math.max(0, index - 1)], solidTops[Math.min(columns.length - 1, index + 1)]);
      for (let cell = 0; cell <= lastCell; cell++) {
        const progress = Math.min(1, Math.max(0, (column.row - cell) / (halftoneGrowthRows - 1)));
        const radius = maxRadius * progress * dpr;
        const y = (viewport + (0.5 - cell) * rowPitch) * dpr;
        if (radius > 0 && y + radius > 0 && y - radius < canvas.height && y - radius < coveredTop + 1) {
          context.moveTo(x + radius, y);
          context.arc(x, y, radius, 0, 2 * Math.PI);
          circles = true;
        }
      }
    });
    if (circles) context.fill();
  };
  const update = (force = false) => {
    const travel = gsap.utils.clamp(0, height, window.scrollY - top + window.innerHeight);
    const row = travel / rowPitch;
    // Draw the actual scroll position directly, without a time-based tween.
    columns.forEach(column => render(column, row - column.offset, force));
    paint();
  };
  const rebuild = width => {
    canvas.width = Math.ceil(width * dpr);
    canvas.height = Math.ceil(viewport * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = viewport + 'px';
    maxRadius = Math.hypot(pitch, rowPitch) / 2;
    const count = Math.ceil(width / pitch);
    columns = Array.from({length: count}, (_, index) => ({
      offset: count > 1 ? halftoneMaxOffset * index / (count - 1) : 0,
      row: 0, dirty: true
    }));
  };
  ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom bottom',
    onRefresh: () => {
      const rect = section.getBoundingClientRect();
      const style = getComputedStyle(section);
      top = rect.top + window.scrollY;
      height = rect.height;
      pitch = height / 1.48 / 45;
      rowPitch = height / 1.48 * 0.48 / halftoneDotRows;
      viewport = window.innerHeight;
      dpr = window.devicePixelRatio || 1;
      background = style.getPropertyValue('--job-from').trim();
      incoming = style.getPropertyValue('--job-to').trim();
      const key = [rect.width, viewport, dpr, pitch, rowPitch, incoming, background].join(':');
      if (key !== cacheKey) {
        rebuild(rect.width);
        cacheKey = key;
      }
      update(true);
    },
    onUpdate: () => { if (pitch) update(); }
  });
});


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
