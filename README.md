# big-meaty-portfolio
Actual portfolio website made in a week.
https://david-lu.com/

# Deploy script
firebase deploy

# Dev script
firebase emulators:start

# Scroll regression check
Run `node tests/scroll-parallax.mjs` with Node 22+ and Chromium installed.
Set `CHROME_PATH` if the browser is outside a standard location.
The check compares CSS parallax with the GSAP fallback at desktop, portrait,
landscape, and tablet sizes. It checks both scroll directions, viewport rotation,
outro timing, screenshots, and the scroll buttons. Use `--viewport=390x844` to
check one size. Use `--baseline=<git revision>` only when that revision has the
same page content, so visual comparisons measure the scrolling implementation.

Run with `--profile-skills`, `--profile-outro`, or `--profile-hedra` to collect Chrome performance
traces with 4x CPU throttling. The trace paths are printed after each run.
