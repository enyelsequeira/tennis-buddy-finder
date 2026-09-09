/**
 * View-model shapes for the slot chip components (SlotCard, SlotRow, DayRail).
 *
 * These mirror the search result returned by the backend once
 * `api.availability.search` lands; until then the landing page feeds them
 * with sample data from `utils/landingDemo.ts`.
 */

export type SlotStatus = "open" | "matched";

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

export interface RailDay {
  /** Start of the day in Europe/Lisbon, milliseconds since epoch. */
  startAt: number;
  hasOpen: boolean;
}
