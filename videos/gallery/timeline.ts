/**
 * Recipe gallery: every kit recipe's `demo.ts`, back to back, at the default
 * (explainer) pace. Render it or scrub it in the Studio to see what each recipe
 * does before choosing one. `npm run review -- gallery` for the contact sheet.
 */
import { demo as chips } from '../../kit/recipes/chips/demo.ts';
import { demo as endCard } from '../../kit/recipes/endCard/demo.ts';
import { demo as layers } from '../../kit/recipes/layers/demo.ts';
import { demo as logoSting } from '../../kit/recipes/logoSting/demo.ts';
import { demo as race } from '../../kit/recipes/race/demo.ts';
import { demo as rotator } from '../../kit/recipes/rotator/demo.ts';
import { demo as stat } from '../../kit/recipes/stat/demo.ts';
import { demo as statement } from '../../kit/recipes/statement/demo.ts';
import { demo as terminal } from '../../kit/recipes/terminal/demo.ts';
import { defineVideo } from '../../kit/timeline/define.ts';

export const video = defineVideo({
  id: 'gallery',
  title: 'Recipe gallery',
  preset: 'explainer',
  chapters: ['Recipes'],
  scenes: [statement, logoSting, terminal, race, stat, layers, chips, rotator, endCard],
  music: [
    { name: 'intro', until: 'logoStingDemo' },
    { name: 'sting', until: 'terminalDemo' },
    { name: 'groove', until: 'layersDemo' },
    { name: 'dark', until: 'chipsDemo' },
    { name: 'build', until: 'endCardDemo' },
    { name: 'finale' },
  ],
});
