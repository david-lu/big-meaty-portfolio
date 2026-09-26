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
The check compares CSS parallax with the GSAP fallback at desktop and portrait
sizes, scrolling in both directions and rotating an already loaded page. It also
checks the scroll buttons. Use `--baseline=<git revision>` to compare with the
original page, or `--viewport=390x844` to check one viewport.
The outro check also makes rapid scroll jumps and reversals, verifying that all
seven scene layers follow scroll without continuing to drift after it stops.

Run `node tests/scroll-parallax.mjs --profile-skills` to profile a six-second
scroll through skills in both directions with live reveal transitions and 4× CPU
throttling. It reports frame intervals, layout, scripting, and paint costs, and
saves Chrome performance traces in the temporary directory. Add
`--baseline=a8aa26a237c4d3481c6cecece32c11898699eeb1` to compare with the original
implementation. Import the reported JSON files into Chrome DevTools Performance.

Use `--profile-outro` instead of `--profile-skills` to measure the skyline scene,
including the sun and text's distance from their expected scroll positions.
Add `--baseline=d5cf859` to compare with the version before the outro timing fix.
