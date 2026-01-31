import type { Interaction, InteractionGroup } from "../types";

/**
 * Coach-specific UI interactions to capture.
 * Add interactions specific to the Care Coach dashboard here.
 */
export const interactionGroups: InteractionGroup[] = [
  // ============================================
  // QUEUE MANAGEMENT
  // ============================================
  {
    name: "queue",
    description: "Queue management interactions",
    interactions: [
      {
        id: "queue-filter",
        description: "Open queue filter dropdown",
        selector: ".queue-filter-trigger, [data-testid='queue-filter']",
        action: "click",
        waitForSelector: ".mat-menu-panel, .filter-dropdown",
        settleDelay: 400,
        closeAfter: "escape",
        pageFilter: /\/queue$/,
      },
    ],
  },

  // ============================================
  // MEMBER DETAILS
  // ============================================
  {
    name: "member-actions",
    description: "Member detail page actions",
    interactions: [
      {
        id: "member-menu",
        description: "Click member actions menu",
        selector: "button.member-actions, [data-testid='member-actions']",
        action: "click",
        waitForSelector: ".mat-menu-panel",
        settleDelay: 400,
        closeAfter: "escape",
        pageFilter: /\/members\/\d+$/,
      },
    ],
  },

  // ============================================
  // SCHEDULE
  // ============================================
  {
    name: "schedule",
    description: "Schedule management interactions",
    interactions: [
      {
        id: "schedule-view-toggle",
        description: "Toggle schedule view (day/week/month)",
        selector: ".view-toggle button:first-child, [data-testid='view-toggle']",
        action: "click",
        settleDelay: 300,
        closeAfter: "none",
        pageFilter: /\/schedule$/,
      },
    ],
  },
];

/**
 * Get all coach interactions flattened
 */
export function getAllInteractions(): Interaction[] {
  return interactionGroups.flatMap((g) => g.interactions);
}
