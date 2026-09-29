import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';

// Inter (rsms.me InterVariable, as on the site) + IBM Plex Mono, bundled
// locally so renders never depend on a CDN. `loadFont` holds the render
// (delayRender) until every face is ready. Plex Mono is static-only: we ship the
// weights the kit uses (400–700); italics are synthesized. Add a face here before
// using another weight.
loadFont({
  family: 'InterVariable',
  url: staticFile('fonts/InterVariable.woff2'),
  weight: '100 900',
  display: 'block',
});

const PLEX_MONO = [
  ['Regular', '400'],
  ['Medium', '500'],
  ['SemiBold', '600'],
  ['Bold', '700'],
] as const;

for (const [name, weight] of PLEX_MONO) {
  loadFont({
    family: 'IBM Plex Mono',
    url: staticFile(`fonts/IBMPlexMono-${name}.woff2`),
    weight,
    display: 'block',
  });
}
