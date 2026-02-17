import type { Interaction, InteractionGroup } from "../types";

/**
 * Cariloop Facilitator — UI interactions to capture.
 * Add interactions specific to the Facilitator interface here.
 */
export const interactionGroups: InteractionGroup[] = [];

export function getAllInteractions(): Interaction[] {
  return interactionGroups.flatMap((g) => g.interactions);
}
