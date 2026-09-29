import type React from 'react';
import { Chips } from './chips/Chips';
import { EndCard } from './endCard/EndCard';
import { Layers } from './layers/Layers';
import { LogoSting } from './logoSting/LogoSting';
import { Race } from './race/Race';
import { Rotator } from './rotator/Rotator';
import { Stat } from './stat/Stat';
import { Statement } from './statement/Statement';
import { Terminal } from './terminal/Terminal';

/**
 * Recipe components by name. A scene whose timeline entry has `recipe: '<name>'`
 * (set by the recipe's planner in `<name>/plan.ts`) renders with this component.
 */
export const RECIPES: Record<string, React.FC> = {
  statement: Statement,
  logoSting: LogoSting,
  terminal: Terminal,
  race: Race,
  stat: Stat,
  layers: Layers,
  chips: Chips,
  rotator: Rotator,
  endCard: EndCard,
};
