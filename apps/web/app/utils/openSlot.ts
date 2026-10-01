import type { Doc, Id } from "@tennis-buddy-finder/backend/convex/_generated/dataModel";
import type { OpenSlot, SlotPlayer } from "~/types/slots";

type PlayerSource = Omit<SlotPlayer, "id"> & { userId: Id<"users"> };

export function toSlotPlayer(player: PlayerSource): SlotPlayer {
  return { id: player.userId, ...player };
}

export interface OpenSlotSource {
  slot: Doc<"availabilitySlots">;
  player: PlayerSource;
  venues?: Doc<"venues">[];
}

export function toOpenSlot({ slot, player, venues }: OpenSlotSource): OpenSlot {
  return {
    id: slot._id,
    startAt: slot.startAt,
    endAt: slot.endAt,
    status: "open",
    venue: venues?.find((venue) => venue._id === slot.venueId)?.name,
    player: toSlotPlayer(player),
  };
}
