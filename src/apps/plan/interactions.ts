import type { Interaction, InteractionGroup } from "../types";

/**
 * Plan-specific UI interactions to capture.
 * Add interactions specific to the member-facing Plan interface here.
 */
export const interactionGroups: InteractionGroup[] = [
  // ============================================
  // NAVIGATION MENU
  // ============================================
  {
    name: "navigation",
    description: "Main navigation interactions",
    interactions: [
      {
        id: "user-menu",
        description: "Click user profile menu to reveal options",
        selector: ".user-menu-trigger, [data-testid='user-menu']",
        action: "click",
        waitForSelector: ".mat-menu-panel, .dropdown-menu",
        settleDelay: 400,
        closeAfter: "escape",
      },
    ],
  },

  // ============================================
  // CARE CONCIERGE
  // ============================================
  {
    name: "care-concierge",
    description: "Care concierge page interactions",
    interactions: [
      {
        id: "start-chat",
        description: "Click to start a new chat",
        selector: "button.start-chat, [data-testid='start-chat']",
        action: "click",
        waitForSelector: ".chat-container, .chat-dialog",
        settleDelay: 500,
        closeAfter: "escape",
        pageFilter: /\/care-concierge$/,
      },
    ],
  },

  // ============================================
  // RESOURCES
  // ============================================
  {
    name: "resources",
    description: "Resources page interactions",
    interactions: [
      {
        id: "resource-category",
        description: "Expand a resource category",
        selector: ".resource-category:first-child, .category-header:first-child",
        action: "click",
        waitForSelector: ".resource-list, .category-content",
        settleDelay: 400,
        closeAfter: "none",
        pageFilter: /\/resources$/,
      },
    ],
  },
];

/**
 * Get all plan interactions flattened
 */
export function getAllInteractions(): Interaction[] {
  return interactionGroups.flatMap((g) => g.interactions);
}
