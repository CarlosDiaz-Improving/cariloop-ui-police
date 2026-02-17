import type { Interaction, InteractionGroup } from "../types";

/**
 * Cariloop Engagement — UI interactions to capture.
 * Add interactions specific to the Engagement interface here.
 */
export const interactionGroups: InteractionGroup[] = [];

export function getAllInteractions(): Interaction[] {
  return interactionGroups.flatMap((g) => g.interactions);
}
