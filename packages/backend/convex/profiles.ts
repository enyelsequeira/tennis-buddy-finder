import { v, type ObjectType } from "convex/values";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { getProfileForUser, profileMutation, profileQuery, userMutation } from "./model/auth";
import { isHiddenFrom } from "./model/blocks";
import { fail } from "./model/errors";
import { playerCard, toPlayerCard } from "./model/playerCard";
import { LANGUAGE_CODE } from "./model/profileSchema";
import { ageOn, MIN_AGE, parseIsoDate } from "./model/time";
import {
  formatsValidator,
  genderValidator,
  handednessValidator,
  LAUNCH_DISTRICT,
  LAUNCH_MUNICIPALITY,
} from "./model/validators";
import schema from "./schema";

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

type ProfileInput = ObjectType<typeof profileInputFields>;

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
  if (input.languages.length === 0 || input.languages.some((l) => !LANGUAGE_CODE.test(l))) {
    fail("INVALID_LANGUAGES");
  }
  return { ...input, displayName: name };
}

const publicProfile = playerCard.extend({
  municipality: v.string(),
  district: v.string(),
  handedness: v.optional(handednessValidator),
  bio: v.optional(v.string()),
});

const AVATAR_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

function getAvatarUpload(ctx: MutationCtx, storageId: Id<"_storage">) {
  return ctx.db
    .query("avatarUploads")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .unique();
}

/**
 * Records `storageId` as `userId`'s avatar upload; FORBIDDEN if another user claimed it.
 * shortcut: first claim wins, since an upload-URL POST carries no identity; upgrade to an authenticated httpAction upload route if storage ids can leak before they are claimed.
 * shortcut: rejected and abandoned uploads stay in storage (a throwing mutation rolls back deletes); upgrade to a scheduled cleanup of unclaimed files.
 * shortcut: contentType is the uploader's declared Content-Type, not sniffed; upgrade to a magic-byte check in an action if avatars are ever served same-origin.
 */
async function claimAvatar(ctx: MutationCtx, userId: Id<"users">, storageId: Id<"_storage">) {
  const upload = await getAvatarUpload(ctx, storageId);
  if (upload) {
    if (upload.userId !== userId) fail("FORBIDDEN");
    return;
  }
  const file = await ctx.db.system.get("_storage", storageId);
  if (
    !file ||
    !AVATAR_CONTENT_TYPES.includes(file.contentType ?? "") ||
    file.size > AVATAR_MAX_BYTES
  ) {
    fail("INVALID_AVATAR");
  }
  await ctx.db.insert("avatarUploads", { userId, storageId });
}

/** Deletes a replaced avatar file, only when `userId` uploaded it. */
async function deleteAvatar(ctx: MutationCtx, userId: Id<"users">, storageId: Id<"_storage">) {
  const upload = await getAvatarUpload(ctx, storageId);
  if (upload?.userId !== userId) return;
  await ctx.db.delete("avatarUploads", upload._id);
  await ctx.storage.delete(storageId);
}

export const create = userMutation({
  args: profileInputFields,
  returns: v.id("profiles"),
  handler: async (ctx, args) => {
    const { user } = ctx;
    const existing = await getProfileForUser(ctx, user._id);
    if (existing) fail("PROFILE_EXISTS");
    const input = validateProfileInput(args);
    if (input.avatarStorageId) await claimAvatar(ctx, user._id, input.avatarStorageId);
    return ctx.db.insert("profiles", {
      ...input,
      userId: user._id,
      district: LAUNCH_DISTRICT,
      municipality: LAUNCH_MUNICIPALITY,
    });
  },
});

export const update = profileMutation({
  args: profileInputFields,
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, profile } = ctx;
    const input = validateProfileInput(args);
    const previous = profile.avatarStorageId;
    if (input.avatarStorageId && input.avatarStorageId !== previous) {
      await claimAvatar(ctx, user._id, input.avatarStorageId);
      if (previous) await deleteAvatar(ctx, user._id, previous);
    }
    await ctx.db.patch("profiles", profile._id, input);
    return null;
  },
});

/** Upload URL for an avatar; pass the returned storage id to `create` / `update`. */
export const generateAvatarUploadUrl = userMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => ctx.storage.generateUploadUrl(),
});

export const mine = profileQuery({
  args: {},
  returns: schema.doc("profiles"),
  handler: async (ctx) => {
    const { profile } = ctx;
    return profile;
  },
});

export const getByUserId = profileQuery({
  args: { userId: v.id("users") },
  returns: publicProfile,
  handler: async (ctx, args) => {
    const { user } = ctx;
    if (await isHiddenFrom(ctx, user._id, args.userId)) fail("NOT_FOUND");
    const profile = await getProfileForUser(ctx, args.userId);
    if (!profile) fail("NOT_FOUND");
    return {
      ...toPlayerCard(profile),
      municipality: profile.municipality,
      district: profile.district,
      handedness: profile.handedness,
      bio: profile.bio,
    };
  },
});
