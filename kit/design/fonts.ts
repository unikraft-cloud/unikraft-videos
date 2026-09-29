import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';

// Same families the site ships (rsms.me InterVariable + JetBrains Mono), bundled
// locally so renders never depend on a CDN. `loadFont` holds the render
// (delayRender) until both faces are ready.
loadFont({
  family: 'InterVariable',
  url: staticFile('fonts/InterVariable.woff2'),
  weight: '100 900',
  display: 'block',
});

loadFont({
  family: 'JetBrains Mono',
  url: staticFile('fonts/JetBrainsMono-Variable.ttf'),
  weight: '100 800',
  display: 'block',
});
