/**
 * TEMPLATE — copy with `npm run new-video -- <id> "Title"`, then edit here.
 *
 * Three scenes showing the three ways to build one:
 *   1. a recipe with no code (`statement`)
 *   2. a custom scene (`scenes/Flow.tsx`) whose marks, cues, reads and props live here
 *   3. a recipe closing the video (`endCard`)
 *
 * Pace comes from the preset (`explainer`: 100 BPM, 1 beat = 0.6 s = 36 frames).
 * Recipes size themselves so the copy is readable; `npm run check -- <id>` proves it.
 */
import { endCard } from '../../kit/recipes/endCard/plan.ts';
import { statement } from '../../kit/recipes/statement/plan.ts';
import { defineVideo } from '../../kit/timeline/define.ts';

const FLOW = {
  headline: 'Requests [wake] your app on demand.',
  caption: 'Idle to serving in under 10 ms',
};

export const video = defineVideo({
  id: 'template',
  title: 'Template — explainer',
  preset: 'explainer',
  chapters: ['The tension', 'How it works'],
  scenes: [
    statement('hook', { lines: ['Fast.', 'Safe.', '[Cheap.]'], kicker: '// pick all three.' }, { chapter: 1 }),
    {
      id: 'flow',
      beats: 12,
      chapter: 2,
      // Beats from the scene start. Flow.tsx animates on these via useScene().at('<mark>').
      marks: { headline: 0.5, nodes: 1.5, pulse: 3, wake: 4, caption: 5 },
      cues: [
        { at: 0, kind: 'whoosh' },
        { at: 'nodes', kind: 'blip' },
        { at: 'wake', kind: 'hit' },
        { at: 'caption', kind: 'blip' },
      ],
      reads: [
        { text: FLOW.headline.replace(/[[\]]/g, ''), at: 'headline+0.5' },
        { text: FLOW.caption, at: 'caption+1' },
      ],
      props: FLOW,
    },
    // Default CTAs and url (see kit/recipes/endCard/plan.ts); add `recap` / `stats` for a bigger close.
    endCard('end', {}),
  ],
  music: [{ name: 'intro', until: 'flow' }, { name: 'groove', until: 'end' }, { name: 'finale' }],
});
