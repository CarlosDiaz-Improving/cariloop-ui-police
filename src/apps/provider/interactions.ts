import type { Interaction, InteractionGroup } from "../types";

/**
 * Cariloop Provider — UI interactions to capture.
 * Add interactions specific to the Provider interface here.
 */
export const interactionGroups: InteractionGroup[] = [];

export function getAllInteractions(): Interaction[] {
  return interactionGroups.flatMap((g) => g.interactions);
}
