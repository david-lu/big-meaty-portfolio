gsap.registerPlugin(ScrollToPlugin, ScrollTrigger);
SmoothScroll({});

// HELPERS
const $ = document.querySelector.bind(document)
const getAspectRatio = () => window.innerHeight / window.innerWidth;
const vh = (x) => window.innerHeight * (x / 100);
const vw = (y) => window.innerWidth * (y / 100);
const rem = (val) => parseFloat(getComputedStyle(document.documentElement).fontSize) * val;

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
  gsap.to(window, { ease: 'sine.inOut', duration: 6, scrollTo: vh(225) + rem(4) });
});
ScrollTrigger.create({
  trigger: '#intro', start: "top bottom", end: "bottom top",
  onEnterBack: (self) => $('#intro-scroll-button').disabled = false
});

$('#map-scroll-button').addEventListener('click', () => {
  $('#map-scroll-button').disabled = true;
  gsap.to(window, { ease: 'sine.inOut', duration: 6, scrollTo: vh(460) + rem(8) });
});
ScrollTrigger.create({
  trigger: '#map', start: "top bottom", end: "bottom top",
  onEnterBack: (self) => $('#map-scroll-button').disabled = false
});

$('#skills-scroll-button').addEventListener('click', () => {
  $('#skills-scroll-button').disabled = true;
  gsap.to(window, { ease: 'sine.inOut', duration: 4, scrollTo: 'max' });
});
ScrollTrigger.create({
  trigger: '#skills', start: "top bottom", end: "bottom top",
  onEnterBack: (self) => $('#skills-scroll-button').disabled = false
});

// INTRO
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

// MAP
gsap.fromTo(
  '#map-path',
  { y: '-2vh' },
  {
    y: '40vh',
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
    strokeDasharray: '210%',
    strokeDashoffset: '210%',
  },
  {
    strokeDashoffset: 0,
    ease: 'none',
    scrollTrigger: {
      trigger: '#map',
      start: "-5% center",
      end: "35% top",
      scrub: 0.5,
    },
  }
);

ScrollTrigger.create({
  trigger: '#map',
  start: "7% center",
  end: "35% top",
  onEnter: (self) => $('#school-pin').classList.remove('inactive'),
  onLeaveBack: (self) => $('#school-pin').classList.add('inactive')
});

ScrollTrigger.create({
  trigger: '#map',
  start: "24% center",
  end: "35% top",
  onEnter: (self) => $('#samsung-pin').classList.remove('inactive'),
  onLeaveBack: (self) => $('#samsung-pin').classList.add('inactive')
});

ScrollTrigger.create({
  trigger: '#map',
  start: "41% center",
  end: "35% top",
  onEnter: (self) => $('#ads-pin').classList.remove('inactive'),
  onLeaveBack: (self) => $('#ads-pin').classList.add('inactive')
});

ScrollTrigger.create({
  trigger: '#map',
  start: "55% center",
  end: "35% top",
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
      start: "57% center",
      end: "54% top",
      scrub: 0.3,
      // markers: true,
    }
  }
);

gsap.fromTo(
  '#map-info',
  { y: '-15vh' },
  {
    y: '50vh',
    ease: 'none',
    scrollTrigger: {
      trigger: '#map',
      start: "top bottom",
      end: "bottom top",
      scrub: 0,
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

// SKILLS
const skillSections = gsap.utils.toArray('.skill-section');
skillSections.forEach((skillSection, i) => {
  const top = 110 - (17 * (i + 1));

  gsap.fromTo(
    skillSection,
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
const outroBgs = gsap.utils.toArray('#outro .parallax-bg').sort(
  (a, b) => a.style.zIndex - b.style.zIndex
);
outroBgs.forEach(
  (elem, i) => {
    gsap.fromTo(elem,
      { y: `${-62 + (i * 10)}vh` },
      {
        y: 2,
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

gsap.fromTo('#outro-sun',
  { y: '12vh' },
  {
    y: '1px',
    ease: 'power2.out',
    scrollTrigger: {
      trigger: "#outro",
      start: "top bottom",
      end: "bottom bottom",
      scrub: 0.8,
    },
  }
);

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
