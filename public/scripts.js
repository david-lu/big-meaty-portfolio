import * as THREE from 'three';

gsap.registerPlugin(ScrollToPlugin, ScrollTrigger);

const vh = (x) => window.innerHeight * (x / 100);
const vw = (y) => window.innerWidth * (y / 100);

document.querySelector('#nav-hamburger').addEventListener('click', () => {
  document.querySelector('#nav-art').classList.toggle('hidden');
  document.querySelector('#nav-linkedin').classList.toggle('hidden');
  document.querySelector('#nav-instagram').classList.toggle('hidden');
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
    yPercent: 15,
    scrollTrigger: {
      trigger: "#intro",
      start: "top top",
      end: "bottom top",
      scrub: 0.3,
    },
  }
);

gsap.to('#intro-layer-0',
  {
    yPercent: 30,
    scrollTrigger: {
      trigger: "#intro",
      start: "top top",
      end: "bottom top",
      scrub: 0.3,
    },
  }
);

gsap.to('#intro-layer-1',
  {
    yPercent: 45,
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
  { strokeDasharray: '170%',
    strokeDashoffset: '170%',
   },
  {
    strokeDashoffset: 0,
    ease: 'none',
    scrollTrigger: {
      trigger: '#map',
      start: "-10% center",
      end: "20% top",
      scrub: 0.5,
      markers: true,
    },
  }
);

ScrollTrigger.create({
  trigger: '#map',
  start: "14% center",
  end: "20% top",
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
  start: "45% center",
  end: "20% top",
  // markers: true,
  onEnter: (self) => {
    document.querySelector('#samsung-pin').classList.remove('inactive');
  },
  onLeaveBack: (self) => {
    document.querySelector('#samsung-pin').classList.add('inactive');
  }
});

const googlePinExpand = document.querySelector('#google-pin-expand');
gsap.fromTo(
  googlePinExpand,
  { scale: 1,
    opacity: 0,
   },
  {
    scale: 30,
    opacity: 50,
    ease: 'power2.in',
    scrollTrigger: {
      trigger: '#map',
      start: "68% center",
      end: "55% top",
      scrub: 0.3,
      // markers: true,
    }
  }
);

ScrollTrigger.create({
  trigger: '#map',
  start: "68% center",
  end: "20% top",
  // markers: true,
  onEnter: (self) => {
    document.querySelector('#google-pin').classList.remove('inactive');
  },
  onLeaveBack: (self) => {
    document.querySelector('#google-pin').classList.add('inactive');
  }
});

gsap.fromTo(
  '#map-info',
  { y: vh(-10) },
  {
    y: vh(60),
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
  { y: vh(-50) },
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

// OUTRO
gsap.fromTo('#outro-layer-0',
  {y: -vh(30)},
  {
    y: 0,
    scrollTrigger: {
      ease: 'power1.out',
      trigger: "#outro",
      start: "top bottom",
      end: "bottom bottom",
      scrub: 0.2,
      // markers: true,
    },
  }
);

gsap.fromTo('#outro-layer-1',
  {y: -vh(20)},
  {
    y: 0,
    scrollTrigger: {
      ease: 'power1.out',
      trigger: "#outro",
      start: "top bottom",
      end: "bottom bottom",
      scrub: 0.2,
    },
  }
);

gsap.fromTo("#outro-sun",
  {y: -vh(10)},
  {
    y: 0,
    scrollTrigger: {
      ease: 'power1.out',
      trigger: "#outro",
      start: "top bottom",
      end: "bottom bottom",
      scrub: 0.2,
    },
  }
);

gsap.fromTo("#outro-socials",
  {y: -vh(50)},
  {
    y: 0,
    scrollTrigger: {
      ease: 'power2.out',
      trigger: "#outro",
      start: "top bottom",
      end: "bottom bottom",
      scrub: 0.2,
    },
  }
);