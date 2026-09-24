import { doc } from "convex-helpers/validators";
import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { getCurrentProfile, getCurrentUser, getProfileForUser } from "./model/auth";
import { isBlockedEitherWay } from "./model/blocks";
import { fail } from "./model/errors";
import { ageOn, MIN_AGE, parseIsoDate } from "./model/time";
import { formatsValidator, genderValidator, handednessValidator } from "./model/validators";
import schema from "./schema";

/** Launch scope: one municipality. Widen when the picker ships. */
const LAUNCH_DISTRICT = "Coimbra";
const LAUNCH_MUNICIPALITY = "Figueira da Foz";

const profileInputFields = {
  displayName: v.string(),
  bio: v.optional(v.string()),
  avatarStorageId: v.optional(v.id("_storage")),
  birthDate: v.string(),
  gender: v.optional(genderValidator),
  ntrp: v.number(),
  yearsPlaying: v.number(),
  formats: formatsValidator,
  handedness: v.optional(handednessValidator),
  languages: v.array(v.string()),
};

type ProfileInput = {
  displayName: string;
  bio?: string;
  avatarStorageId?: Doc<"profiles">["avatarStorageId"];
  birthDate: string;
  gender?: Doc<"profiles">["gender"];
  ntrp: number;
  yearsPlaying: number;
  formats: Doc<"profiles">["formats"];
  handedness?: Doc<"profiles">["handedness"];
  languages: string[];
};

function validateProfileInput(input: ProfileInput) {
  const name = input.displayName.trim();
  if (name.length < 2 || name.length > 40) fail("INVALID_DISPLAY_NAME");
  if (input.bio !== undefined && input.bio.length > 500) fail("INVALID_BIO");
  if (!parseIsoDate(input.birthDate)) fail("INVALID_BIRTH_DATE");
  if (ageOn(input.birthDate, Date.now()) < MIN_AGE) fail("UNDERAGE");
  if (input.ntrp < 1 || input.ntrp > 7 || (input.ntrp * 2) % 1 !== 0) fail("INVALID_NTRP");
  if (!Number.isInteger(input.yearsPlaying) || input.yearsPlaying < 0 || input.yearsPlaying > 90) {
    fail("INVALID_YEARS_PLAYING");
  }
  if (input.languages.length === 0 || input.languages.some((l) => !/^[a-z]{2}$/.test(l))) {
    fail("INVALID_LANGUAGES");
  }
  return { ...input, displayName: name };
}

const profileWithAge = v.object({
  ...schema.tables.profiles.validator.fields,
  _id: v.id("profiles"),
  _creationTime: v.number(),
  age: v.number(),
});

function withAge(profile: Doc<"profiles">) {
  return { ...profile, age: ageOn(profile.birthDate, Date.now()) };
}

export const create = mutation({
  args: profileInputFields,
  returns: v.id("profiles"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const existing = await getProfileForUser(ctx, user._id);
    if (existing) fail("PROFILE_EXISTS");
    const input = validateProfileInput(args);
    return ctx.db.insert("profiles", {
      ...input,
      userId: user._id,
      district: LAUNCH_DISTRICT,
      municipality: LAUNCH_MUNICIPALITY,
    });
  },
});

export const update = mutation({
  args: profileInputFields,
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile } = await getCurrentProfile(ctx);
    const input = validateProfileInput(args);
    await ctx.db.patch("profiles", profile._id, input);
    return null;
  },
});

export const mine = query({
  args: {},
  returns: doc(schema, "profiles"),
  handler: async (ctx) => {
    const { profile } = await getCurrentProfile(ctx);
    return profile;
  },
});

export const getByUserId = query({
  args: { userId: v.id("users") },
  returns: profileWithAge,
  handler: async (ctx, args) => {
    const { user } = await getCurrentProfile(ctx);
    if (await isBlockedEitherWay(ctx, user._id, args.userId)) fail("NOT_FOUND");
    const profile = await getProfileForUser(ctx, args.userId);
    if (!profile) fail("NOT_FOUND");
    return withAge(profile);
  },
});
