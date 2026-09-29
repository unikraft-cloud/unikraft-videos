import { statement } from './plan.ts';

/** The promo's hook: three words, one accent, a dev-voice kicker. */
export const demo = statement(
  'statementDemo',
  { lines: ['Fast.', 'Safe.', '[Cheap.]'], kicker: '// pick all three.' },
  { chapter: 1 },
);
