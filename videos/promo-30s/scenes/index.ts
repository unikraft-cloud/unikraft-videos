import type React from 'react';
import { Hook } from './Hook';
import { LogoSting } from './LogoSting';
import { ColdStart } from './ColdStart';
import { Race } from './Race';
import { ScaleToZero } from './ScaleToZero';
import { Fork } from './Fork';
import { Isolation } from './Isolation';
import { Trust } from './Trust';
import { Density } from './Density';
import { Economics } from './Economics';
import { Dockerfile } from './Dockerfile';
import { Rotator } from './Rotator';
import { Deploy } from './Deploy';
import { EndCard } from './EndCard';

/** Scene components by timeline id. Each renders full-frame, scene-local frames start at 0. */
export const SCENE_COMPONENTS: Record<string, React.FC> = {
  hook: Hook,
  logo: LogoSting,
  coldStart: ColdStart,
  race: Race,
  scaleToZero: ScaleToZero,
  fork: Fork,
  isolation: Isolation,
  trust: Trust,
  density: Density,
  economics: Economics,
  dockerfile: Dockerfile,
  rotator: Rotator,
  deploy: Deploy,
  end: EndCard,
};
