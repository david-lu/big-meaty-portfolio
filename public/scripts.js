gsap.registerPlugin(ScrollToPlugin, ScrollTrigger);
SmoothScroll({});

const vh = (x) => window.innerHeight * (x / 100);
const vw = (y) => window.innerWidth * (y / 100);
const rem = (val) => parseFloat(getComputedStyle(document.documentElement).fontSize) * val;

// ScrollTrigger.normalizeScroll(true);

document.querySelector('#nav-hamburger').addEventListener('click', () => {
  document.querySelector('#nav-github').classList.toggle('hidden');
  document.querySelector('#nav-linkedin').classList.toggle('hidden');
  document.querySelector('#nav-instagram').classList.toggle('hidden');
});

// SCROLL BUTTONS
document.querySelector('#intro-scroll-button').addEventListener('click', () => {
  gsap.to(window, { ease: 'sine.inOut', duration: 6, scrollTo: vh(217) + rem(4) });
});

document.querySelector('#map-scroll-button').addEventListener('click', () => {
  gsap.to(window, { ease: 'sine.inOut', duration: 6, scrollTo: vh(525) + rem(8) });
});

document.querySelector('#skills-scroll-button').addEventListener('click', () => {
  gsap.to(window, { ease: 'sine.inOut', duration: 4, scrollTo: 'max' });
});

// DOODLE BUTTONS
document.querySelector('#google-button-search').addEventListener('click', () => {
  window.open('http://www.google.com/search?q=' + (searchBar.innerHTML || 'Google Doodles'), '_blank');
});

document.querySelector('#google-button-lucky').addEventListener('click', () => {
  window.open('http://www.google.com/search?q=' + (searchBar.innerHTML || 'Google Doodles'), '_blank');
});


// INTRO
gsap.to("#title",
  {
    yPercent: -10,
    scrollTrigger: {
      trigger: "#intro",
      start: "top top",
      end: "bottom top",
      scrub: 0.5,
    },
  }
);

gsap.to("#subtitle",
  {
    yPercent: -30,
    scrollTrigger: {
      trigger: "#intro",
      start: "top top",
      end: "bottom top",
      scrub: 0.45,
    },
  }
);

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

const introBgs = gsap.utils.toArray('#intro .parallax-bg').sort((a, b) =>
  b.style.zIndex - a.style.zIndex
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
      // markers: true,
    },
  }
);

ScrollTrigger.create({
  trigger: '#map',
  start: "7% center",
  end: "35% top",
  // markers: true,
  onEnter: (self) => {
    document.querySelector('#school-pin').classList.remove('inactive');
  },
  onLeaveBack: (self) => {
    document.querySelector('#school-pin').classList.add('inactive');
  }
});

ScrollTrigger.create({
  trigger: '#map',
  start: "24% center",
  end: "35% top",
  // markers: true,
  onEnter: (self) => {
    document.querySelector('#samsung-pin').classList.remove('inactive');
  },
  onLeaveBack: (self) => {
    document.querySelector('#samsung-pin').classList.add('inactive');
  }
});

ScrollTrigger.create({
  trigger: '#map',
  start: "41% center",
  end: "35% top",
  // markers: true,
  onEnter: (self) => {
    document.querySelector('#ads-pin').classList.remove('inactive');
  },
  onLeaveBack: (self) => {
    document.querySelector('#ads-pin').classList.add('inactive');
  }
});

ScrollTrigger.create({
  trigger: '#map',
  start: "57% center",
  end: "35% top",
  // markers: true,
  onEnter: (self) => {
    document.querySelector('#google-pin').classList.remove('inactive');
  },
  onLeaveBack: (self) => {
    document.querySelector('#google-pin').classList.add('inactive');
  }
});

const googlePinExpand = document.querySelector('#google-pin-expand');
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

gsap.fromTo(
  '#google-page',
  { y: '-65vh' },
  {
    y: '75vh',
    ease: 'none',
    scrollTrigger: {
      trigger: '#google',
      start: "top bottom",
      end: "bottom top",
      scrub: 0,
      // markers: true,
    }
  }
);

const doodleInfos = [
  {
    search: 'Celebrating the Dachshund Bobblehead',
    link: ''
  },
  {
    search: '44th Anniversary of the Birth of Hip Hop',
    link: ''
  },
  {
    search: 'Doodle Champion Island Games Begin!',
    link: ''
  },
  {
    search: 'Celebrating 50 years of Kids Coding',
    link: ''
  },
];
const doodleElem = document.querySelector('#google-doodle');
const searchBar = document.querySelector('#google-search-bar');
const doodles = gsap.utils.toArray('#google-doodle > div');
for (let i = 0; i < doodles.length - 1; i++) {
  const a = doodles[i];
  const b = doodles[i + 1];
  const start = - ((i / doodles.length) * 140);
  const end = 20 - (((i + 1) / doodles.length) * 140);

  ScrollTrigger.create(
    {
      trigger: "#google",
      start: `0% ${start}%`,
      end: `0% ${end}%`,
      onEnter: (self) => {
        b.classList.remove('hidden');
        const info = doodleInfos[i];
        searchBar.innerHTML = info ? info['search'] : '';
      },
      onLeaveBack: (self) => {
        b.classList.add('hidden');
        const info = doodleInfos[i - 1];
        searchBar.innerHTML = info ? info['search'] : '';
      }
    }
  );
}

// SKILLS
gsap.fromTo(
  '#skills .parallax-container',
  { y: '-65vh' },
  {
    y: '70vh',
    ease: 'none',
    scrollTrigger: {
      trigger: '#skills',
      start: "top bottom",
      end: "bottom top",
      scrub: 0,
    }
  }
);

gsap.utils.toArray('.skill-section').forEach((element, i) => {
  const isEven = (i % 2 == 0);
  const fromX = isEven ? '-350px' : 0;
  const toX = isEven ? 0 : '-350px';

  gsap.fromTo(element,
    { x: fromX },
    {
      x: toX,
      ease: "none",
      scrollTrigger: {
        trigger: "#skills",
        start: "top bottom",
        end: "bottom top",
        scrub: 0,
        // markers: true,
      },
    }
  );
  const text = element.innerHTML;
  element.innerHTML += `${text} ${text}`;
});

const outroBgs = gsap.utils.toArray('#outro .parallax-bg').sort((a, b) =>
  a.style.zIndex - b.style.zIndex
);
outroBgs.forEach(
  (elem, i) => {
    gsap.fromTo(elem,
      { y: `-${60 + (i * 10)}vh` },
      {
        y: 0,
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

gsap.fromTo('#outro-info',
  { y: `-10vh` },
  {
    y: 0,
    ease: 'none',
    scrollTrigger: {
      trigger: "#outro",
      start: "top bottom",
      end: "bottom bottom",
      scrub: 0,
    },
  }
);

gsap.fromTo('#outro-sun',
  { y: `-15vh` },
  {
    y: 0,
    ease: 'none',
    scrollTrigger: {
      trigger: "#outro",
      start: "top bottom",
      end: "bottom bottom",
      scrub: 0,
    },
  }
);

ScrollTrigger.create(
  {
    trigger: "#outro",
    start: "90% bottom",
    end: "bottom bottom",
    scrub: 0,
    onEnter: (self) => {
      document.querySelector('#outro-socials').classList.remove('hidden');
    },
    onLeaveBack: (self) => {
      document.querySelector('#outro-socials').classList.add('hidden');
    }
  }
);
