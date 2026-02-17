import type { Interaction, InteractionGroup } from "../types";

/**
 * Cariloop Search — UI interactions to capture.
 * Add interactions specific to the Search interface here.
 */
export const interactionGroups: InteractionGroup[] = [];

export function getAllInteractions(): Interaction[] {
  return interactionGroups.flatMap((g) => g.interactions);
}
