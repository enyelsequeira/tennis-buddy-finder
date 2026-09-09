import type { LisbonTime } from "~/composables/useLisbonTime";
import type { SlotPlayer, SlotSummary } from "~/types/slots";

/**
 * Sample players and slots for the landing page preview. Slots are laid out
 * relative to a base day so the preview always shows the coming week.
 */

const players = {
  ana: {
    id: "ana",
    displayName: "Ana Ferreira",
    ntrp: 3.5,
    age: 28,
    yearsPlaying: 6,
    formats: "singles",
    languages: ["pt", "en"],
  },
  rui: {
    id: "rui",
    displayName: "Rui Santos",
    ntrp: 4.0,
    age: 34,
    yearsPlaying: 12,
    formats: "both",
    languages: ["pt"],
  },
  sofia: {
    id: "sofia",
    displayName: "Sofia Neves",
    ntrp: 4.0,
    age: 31,
    yearsPlaying: 9,
    formats: "singles",
    languages: ["pt", "en"],
  },
  marta: {
    id: "marta",
    displayName: "Marta Lopes",
    ntrp: 3.0,
    age: 26,
    yearsPlaying: 3,
    formats: "singles",
    languages: ["pt", "en", "es"],
  },
  joao: {
    id: "joao",
    displayName: "João Almeida",
    ntrp: 3.5,
    age: 41,
    yearsPlaying: 15,
    formats: "doubles",
    languages: ["pt"],
  },
  ines: {
    id: "ines",
    displayName: "Inês Costa",
    ntrp: 4.5,
    age: 29,
    yearsPlaying: 10,
    formats: "singles",
    languages: ["pt", "en", "fr"],
  },
  pedro: {
    id: "pedro",
    displayName: "Pedro Martins",
    ntrp: 3.0,
    age: 37,
    yearsPlaying: 4,
    formats: "both",
    languages: ["pt"],
  },
} satisfies Record<string, SlotPlayer>;

export const DEMO_PLAYERS = players;

export const DEMO_VENUES = {
  clube: "Clube de Ténis da Figueira",
  abadias: "Parque das Abadias",
} as const;

interface DemoSlotSeed {
  dayOffset: number;
  start: [hour: number, minute: number];
  end: [hour: number, minute: number];
  player: SlotPlayer;
  venue?: string;
}

const seeds: DemoSlotSeed[] = [
  { dayOffset: 0, start: [19, 0], end: [20, 0], player: players.rui },
  { dayOffset: 0, start: [20, 0], end: [21, 30], player: players.marta },
  { dayOffset: 1, start: [18, 0], end: [19, 30], player: players.ana, venue: DEMO_VENUES.clube },
  {
    dayOffset: 1,
    start: [19, 30],
    end: [21, 0],
    player: players.sofia,
    venue: DEMO_VENUES.abadias,
  },
  { dayOffset: 2, start: [10, 0], end: [11, 30], player: players.joao, venue: DEMO_VENUES.clube },
  { dayOffset: 2, start: [18, 0], end: [19, 0], player: players.ines },
  {
    dayOffset: 4,
    start: [17, 30],
    end: [19, 0],
    player: players.pedro,
    venue: DEMO_VENUES.abadias,
  },
  { dayOffset: 4, start: [19, 0], end: [20, 30], player: players.ana, venue: DEMO_VENUES.clube },
  { dayOffset: 5, start: [9, 0], end: [10, 30], player: players.sofia, venue: DEMO_VENUES.clube },
  { dayOffset: 5, start: [11, 0], end: [12, 30], player: players.ines },
  { dayOffset: 5, start: [18, 0], end: [19, 0], player: players.marta },
  { dayOffset: 6, start: [10, 0], end: [11, 0], player: players.rui, venue: DEMO_VENUES.abadias },
];

export const DEMO_DAY_COUNT = 7;

export interface BuildDemoSlotsOptions {
  /** Start of the first preview day in Europe/Lisbon, milliseconds since epoch. */
  firstDayMs: number;
  /** Helpers from `useLisbonTime()`, obtained in the caller's setup. */
  time: Pick<LisbonTime, "addDays" | "atTime">;
}

/** Builds the preview slots for the seven days starting at `firstDayMs`. */
export function buildDemoSlots({ firstDayMs, time }: BuildDemoSlotsOptions): SlotSummary[] {
  return seeds.map((seed, index) => {
    const dayMs = time.addDays(firstDayMs, seed.dayOffset);
    return {
      id: `demo-${index}`,
      startAt: time.atTime({ dayMs, hour: seed.start[0], minute: seed.start[1] }),
      endAt: time.atTime({ dayMs, hour: seed.end[0], minute: seed.end[1] }),
      status: "open",
      venue: seed.venue,
      player: seed.player,
    };
  });
}
