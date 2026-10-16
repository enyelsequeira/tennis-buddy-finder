import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { ageOn } from "./time";
import { formatsValidator } from "./validators";

export const playerCard = v.object({
  userId: v.id("users"),
  displayName: v.string(),
  age: v.number(),
  ntrp: v.number(),
  yearsPlaying: v.number(),
  formats: formatsValidator,
  languages: v.array(v.string()),
  avatarStorageId: v.optional(v.id("_storage")),
});

export function toPlayerCard(profile: Doc<"profiles">) {
  return {
    userId: profile.userId,
    displayName: profile.displayName,
    age: ageOn(profile.birthDate, Date.now()),
    ntrp: profile.ntrp,
    yearsPlaying: profile.yearsPlaying,
    formats: profile.formats,
    languages: profile.languages,
    avatarStorageId: profile.avatarStorageId,
  };
}
