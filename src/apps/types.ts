/**
 * Shared types for app configurations and interactions.
 *
 * All canonical type definitions live in src/types/config.ts.
 * This file re-exports them so existing interaction modules continue to work.
 */

export type {
  Interaction,
  InteractionGroup,
  AppConfig,
  AppDefinition,
  CustomScript,
} from "../types/config";
