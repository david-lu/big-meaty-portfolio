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
      scrub: 0.5,
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

// SCHOOL

// gsap.fromTo(
//   '#school .parallax-container',
//   { y: vh(-50) },
//   {
//     y: vh(90),
//     ease: 'none',
//     scrollTrigger: {
//       trigger: '#school',
//       start: "top bottom",
//       end: "bottom top",
//       scrub: 0,
//     }
//   }
// );

// gsap.fromTo("#school-circle",
//   { scale: 20 },
//   {
//     scale: 1,
//     ease: "power2.out",
//     scrollTrigger: {
//       trigger: "#school",
//       start: "0 center",
//       end: "30% top",
//       scrub: 0,
//       markers: true,
//     },
//   }
// );

// GOOGLE

gsap.fromTo(
  '#google-page',
  { y: vh(-50) },
  {
    y: vh(120),
    ease: 'none',
    scrollTrigger: {
      trigger: '#google',
      start: "top bottom",
      end: "bottom top",
      scrub: 0,
    }
  }
);

ScrollTrigger.create({
  trigger: "#google",
  start: "top bottom",
  end: "bottom top",
  scrub: 0,
  // markers: true,
  onUpdate: (progress) => {
    const i = Math.round(progress * 7);
    const bar = document.querySelector('.google-search-bar');
    switch (i) {
      case 2:
      case 6:
        bar.innerHTML = 'Yes';
        break;
      case 3:
      case 7:
        bar.innerHTML = 'No';
        break;
      case 4:
        bar.innerHTML = 'WEWE';
        break;
      case 5:
        bar.innerHTML = 'dfzs';
        break;
      default:
        bar.innerHTML = '';
    }
  }
});

// SKILLS

gsap.fromTo(
  '#skills .parallax-container',
  { y: vh(-45) },
  {
    y: vh(150),
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
        scrub: 0,
        markers: true,
      },
    }
  );
  const text = element.innerHTML;
  element.innerHTML += ` ${text} ${text} ${text} ${text} ${text} ${text} ${text}`;
});

// document.querySelector('#splash-scroll-button').addEventListener('click', () => {
//   gsap.to(window, { duration: 1, scrollTo: vh(100) });
// });