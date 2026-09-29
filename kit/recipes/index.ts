import type React from 'react';

/**
 * Recipe components by name. A scene whose timeline entry has `recipe: '<name>'`
 * (set by the recipe's planner in `<name>/plan.ts`) renders with this component.
 */
export const RECIPES: Record<string, React.FC> = {};
