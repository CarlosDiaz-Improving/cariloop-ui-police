import type { Interaction, InteractionGroup } from "../types";

/**
 * Cariloop Employer — UI interactions to capture.
 * Add interactions specific to the Employer interface here.
 */
export const interactionGroups: InteractionGroup[] = [];

export function getAllInteractions(): Interaction[] {
  return interactionGroups.flatMap((g) => g.interactions);
}
