import type { Id } from "@tennis-buddy-finder/backend/convex/_generated/dataModel";
import type { TimeOfDay } from "~/composables/useLisbonTime";

/**
 * View-model shapes for the slot components (SlotCard, SlotRow, DayRail) and the
 * Find page filters. Backend slots are mapped by `utils/openSlot.ts`; the landing
 * page uses sample data from `utils/landingDemo.ts`.
 */

export type SlotStatus = "open" | "matched" | "closed";

export type PlayFormat = "singles" | "doubles" | "both";

export interface SlotPlayer {
  id: string;
  displayName: string;
  /** NTRP rating, 1.0 to 7.0 in 0.5 steps. */
  ntrp: number;
  age: number;
  yearsPlaying: number;
  formats: PlayFormat;
  /** ISO 639-1 codes, e.g. `["pt", "en"]`. */
  languages: string[];
  avatarUrl?: string;
}

export interface SlotSummary {
  id: string;
  /** Milliseconds since epoch, UTC. */
  startAt: number;
  endAt: number;
  status: SlotStatus;
  venue?: string;
  player: SlotPlayer;
}

/** A slot read from the backend; the landing page's sample slots have no real id. */
export interface OpenSlot extends SlotSummary {
  id: Id<"availabilitySlots">;
}

export interface RailDay {
  /** Start of the day in Europe/Lisbon, milliseconds since epoch. */
  startAt: number;
  hasOpen: boolean;
}

export interface SearchFilterValues {
  timeOfDay: TimeOfDay | "any";
  ntrp: [min: number, max: number];
  /** Empty or both means any format. */
  formats: Exclude<PlayFormat, "both">[];
  venue: Id<"venues"> | "any";
}
