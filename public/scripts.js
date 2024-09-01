import * as THREE from 'three';

gsap.registerPlugin(ScrollToPlugin, ScrollTrigger);

const vh = (x) => window.innerHeight * (x / 100);
const vw = (y) => window.innerWidth * (y / 100);

const makeParallaxScroll = (elementStr, trigger, markers = false) => {
  gsap.fromTo(
    elementStr,
    { y: vh(-50) },
    {
      y: vh(90),
      ease: 'none',
      scrollTrigger: {
        trigger: trigger,
        start: "top bottom",
        end: "bottom top",
        scrub: 0,
        markers: markers
      }
    }
  );
};

gsap.to("#title", {
  yPercent: -10,
  scrollTrigger: {
    trigger: "#intro",
    start: "top top",
    end: "bottom top",
    scrub: 0.5,
    // markers: true,
  },
});


gsap.to("#subtitle", {
  yPercent: -30,
  scrollTrigger: {
    trigger: "#intro",
    start: "top top",
    end: "bottom top",
    scrub: 0.5,
    // markers: true,
  },
});

gsap.to("#david", {
  yPercent: 25,
  scrollTrigger: {
    trigger: "#intro",
    start: "top top",
    end: "bottom top",
    scrub: 0.3,
    // markers: true,
  },
});

// makeParallaxScroll('#school .parallax-container', '#school');

gsap.to("#school-circle", {
  scale: 20,
  ease: "power2.in",
  scrollTrigger: {
    trigger: "#school",
    start: "20% center",
    end: "50% top",
    scrub: 0,
    markers: true,
  },
});

makeParallaxScroll('#google-page', '#google');

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

// document.querySelector('#splash-scroll-button').addEventListener('click', () => {
//   gsap.to(window, { duration: 1, scrollTo: vh(100) });
// });