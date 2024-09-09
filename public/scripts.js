gsap.registerPlugin(CustomEase, ScrollToPlugin, ScrollTrigger);

const vh = (x) => window.innerHeight * (x / 100);
const vw = (y) => window.innerWidth * (y / 100);

document.querySelector('#nav-hamburger').addEventListener('click', () => {
  document.querySelector('#nav-github').classList.toggle('hidden');
  document.querySelector('#nav-linkedin').classList.toggle('hidden');
  document.querySelector('#nav-instagram').classList.toggle('hidden');
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
      scrub: 0.3,
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
          scrub: 0.3,
        },
      }
    );
  }
);

// MAP
gsap.fromTo(
  '#map-path',
  { y: vh(-2) },
  {
    y: vh(40),
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
  { y: vh(-10) },
  {
    y: vh(55),
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
  { y: vh(-55) },
  {
    y: vh(65),
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
  const start = 25 - ((i / doodles.length) * 165);
  const end = 40 - (((i + 1) / doodles.length) * 165);

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

document.querySelector('#google-button-search').addEventListener('click', () => {
  window.open('http://www.google.com/search?q=' + (searchBar.innerHTML || 'Google Doodles'), '_blank');
});

document.querySelector('#google-button-lucky').addEventListener('click', () => {
  window.open('http://www.google.com/search?q=' + (searchBar.innerHTML || 'Google Doodles'), '_blank');
});

// SKILLS
gsap.fromTo(
  '#skills .parallax-container',
  { y: vh(-75) },
  {
    y: vh(75),
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
  const negativeFactor = isEven ? 1 : -1;
  const threshold = 150;

  const width = element.scrollWidth || 400;
  const fromX = isEven ? -width * 1 : -width / 2;
  const toX = fromX + (negativeFactor * vh(100));

  gsap.fromTo(element,
    { x: fromX },
    {
      x: toX,
      ease: "none",
      scrollTrigger: {
        trigger: "#skills",
        start: "top bottom",
        end: "bottom top",
        scrub: 0.5,
        // markers: true,
      },
    }
  );
  const text = element.innerHTML;
  element.innerHTML += ` ${text} ${text} ${text}`;
});

const outroBgs = gsap.utils.toArray('#outro .parallax-bg').sort((a, b) =>
  a.style.zIndex - b.style.zIndex
);
outroBgs.forEach(
  (elem, i) => {
    gsap.fromTo(elem,
      {yPercent: (i + 1) * -25},
      {
        yPercent: 0,
        ease: 'power1.out',
        scrollTrigger: {
          trigger: "#outro",
          start: "top bottom",
          end: "bottom bottom",
          scrub: 0.3,
          marker: true
        },
      }
    );
  }
);

gsap.fromTo('#outro-sun',
  {yPercent: -40},
  {
    yPercent: 0,
    ease: 'power1.out',
    scrollTrigger: {
      trigger: "#outro",
      start: "top bottom",
      end: "bottom bottom",
      scrub: 0.3,
    },
  }
);

ScrollTrigger.create(
  {
    ease: 'power2.out',
    trigger: "#outro",
    start: "85% bottom",
    end: "bottom bottom",
    scrub: 0.2,
    onEnter: (self) => {
      document.querySelector('#outro-socials').classList.remove('hidden');
    },
    onLeaveBack: (self) => {
      document.querySelector('#outro-socials').classList.add('hidden');
    }
  }
);
