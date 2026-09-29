import { terminal } from './plan.ts';

/** The promo's cold start: deploy from the CLI, curl it, dive into the 8.4 ms. */
export const demo = terminal(
  'terminalDemo',
  {
    title: 'Built for [milliseconds],\nnot minutes.',
    commands: [
      {
        // The site's hero command — keep CLI examples to real `unikraft` syntax.
        cmd: 'unikraft instance create --set scale-to-zero.policy=on --set name=openclaw --metro fra0 --memory 8G',
        output: [
          { kind: 'comment', text: 'packaging Dockerfile → microVM image' },
          { kind: 'success', text: 'deployed openclaw.fra0.unikraft.host' },
        ],
        step: { label: 'Deploy', caption: 'Dockerfile → microVM' },
      },
      {
        cmd: 'curl https://openclaw.fra0.unikraft.host',
        output: [{ kind: 'success', text: 'replied in', value: '8.4 ms' }],
        step: { label: 'Serve', caption: 'first byte, from idle' },
      },
    ],
    result: { label: 'idle → first byte', value: 8.4, unit: 'ms', decimals: 1, max: 10 },
  },
  { chapter: 1 },
);
