import * as THREE from 'three';

gsap.registerPlugin(ScrollToPlugin, ScrollTrigger);

const vh = (x) => window.innerHeight * (x / 100);
const vw = (y) => window.innerWidth * (y / 100);

document.querySelector('#nav-hamburger').addEventListener('click', () => {
  document.querySelector('#nav-art').classList.toggle('hidden');
  document.querySelector('#nav-contact').classList.toggle('hidden');
});

document.querySelector('#nav-art').addEventListener('click', () => {
  window.open('http://luguowei.com');
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

gsap.to("#david",
  {
    yPercent: 25,
    scrollTrigger: {
      trigger: "#intro",
      start: "top top",
      end: "bottom top",
      scrub: 0.3,
    },
  }
);

// MAP
gsap.fromTo(
  '#map-path',
  { y: vh(-30) },
  {
    y: vh(10),
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
  { strokeDasharray: '170%',
    strokeDashoffset: '170%',
   },
  {
    strokeDashoffset: 0,
    ease: 'none',
    scrollTrigger: {
      trigger: '#map',
      start: "35% bottom",
      end: "10% top",
      scrub: 0.5,
      // markers: true,
    },
  }
);

ScrollTrigger.create({
  trigger: '#map',
  start: "46% bottom",
  end: "bottom top",
  // markers: true,
  onToggle: (self) => {
    document.querySelector('#school-pin').classList.toggle('inactive');
  }
});

ScrollTrigger.create({
  trigger: '#map',
  start: "63% bottom",
  end: "bottom top",
  // markers: true,
  onToggle: (self) => {
    document.querySelector('#samsung-pin').classList.toggle('inactive');
  }
});

const googlePinExpand = document.querySelector('#google-pin-expand');

gsap.fromTo(
  googlePinExpand,
  { scale: 1,
    opacity: 0,
   },
  {
    scale: 20,
    opacity: 50,
    ease: 'power1.in',
    scrollTrigger: {
      trigger: '#map',
      start: "76% bottom",
      end: "50% top",
      scrub: 0.5,
      markers: true,
    }
  }
);

ScrollTrigger.create({
  trigger: '#map',
  start: "45% center",
  end: "bottom top",
  // markers: true,
  onToggle: (self) => {
    document.querySelector('#google-pin').classList.toggle('inactive');
  }
});


// GOOGLE

gsap.fromTo(
  '#google-page',
  { y: vh(-55) },
  {
    y: vh(70),
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
    search: 'Halloween 2018 Doodle',
    link: ''
  },
  {
    search: 'Fourth of July 2019 Doodle',
    link: ''
  },
  {
    search: '47th Anniversary of Hip hop',
    link: ''
  },
  {
    search: 'Doodle Champion Island',
    link: ''
  },
  {
    search: 'Celebrating Kid\'s Coding',
    link: ''
  },
];
const doodleElem = document.querySelector('#google-doodle');
const searchBar = document.querySelector('#google-search-bar');
const doodles = gsap.utils.toArray('#google-doodle > div');
for (let i = 0; i < doodles.length - 1; i++) {
  const a = doodles[i];
  const b = doodles[i + 1];
  const start = 20 - ((i / doodles.length) * 150);
  const end = 35 - (((i + 1) / doodles.length) * 150);

  gsap.fromTo(b, 
    {'--clip': '0%'},
    {'--clip': '100%',
      ease: 'none',
      scrollTrigger: {
        trigger: "#google",
        start: `0% ${start}%`,
        end: `0% ${end}%`,
        scrub: 0.3,
        // markers: true,
      },
    }
  )
}

// SKILLS
gsap.fromTo(
  '#skills .parallax-container',
  { y: vh(-75) },
  {
    y: vh(80),
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
  const negative = (i % 2 == 0) ? -1 : 1;
  gsap.fromTo(element,
    { x: -vh(350) },
    {
      x: -vh(350) + (vh(350) * negative),
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
  element.innerHTML += ` ${text} ${text} ${text} ${text} ${text} ${text} ${text}`;
});

// document.querySelector('#splash-scroll-button').addEventListener('click', () => {
//   gsap.to(window, { duration: 1, scrollTo: vh(100) });
// });

// ScrollTrigger.scrollerProxy(".parallax-section", {	pinType: "fixed" });
