import type { Interaction, InteractionGroup } from "../types";

/**
 * Cariloop Enterprise — UI interactions to capture.
 * Add interactions specific to the Enterprise interface here.
 */
export const interactionGroups: InteractionGroup[] = [];

export function getAllInteractions(): Interaction[] {
  return interactionGroups.flatMap((g) => g.interactions);
}
