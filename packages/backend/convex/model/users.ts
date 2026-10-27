import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

import { getProfileForUser, type Ctx } from "./auth";
import { deleteRequestNotifications } from "./notifications";
import { cancelSlot } from "./requests";

/** Rows each step of `deleteAccountData` handles per run. */
const DELETE_BATCH = 100;

type AuthUserInput = {
  /** Better Auth user id (`identity.subject`). */
  authId: string;
  email: string;
  name: string;
  image?: string | null;
};

/** Looks up the app `users` row mirroring a Better Auth user id. */
export async function getUserByAuthId(ctx: Ctx, authId: string) {
  return ctx.db
    .query("users")
    .withIndex("by_authId", (q) => q.eq("authId", authId))
    .unique();
}

/**
 * Creates the app `users` row for a Better Auth user. Idempotent on `authId`:
 * a second call returns the existing row's id without touching it.
 */
export async function createUserFromAuth(ctx: MutationCtx, input: AuthUserInput) {
  const existing = await getUserByAuthId(ctx, input.authId);
  if (existing) return existing._id;
  return ctx.db.insert("users", {
    authId: input.authId,
    email: input.email,
    name: input.name,
    image: input.image ?? undefined,
    role: "user",
    emailNotifications: true,
  });
}

/**
 * Removes what a deleted account leaves behind; its `users` row is already gone. Future slots
 * and requests are closed like the matching user actions, messages are tombstoned so the other
 * player keeps the thread. Past slots and requests stay as history, reports for moderation.
 * Reschedules itself while any step filled a batch.
 */
export async function deleteAccountData(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
  const now = Date.now();
  let more = false;
  function batch<Row>(rows: Row[]) {
    if (rows.length === DELETE_BATCH) more = true;
    return rows;
  }

  const profile = await getProfileForUser(ctx, userId);
  if (profile) await ctx.db.delete("profiles", profile._id);
  const uploads = await ctx.db
    .query("avatarUploads")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(DELETE_BATCH);
  for (const upload of batch(uploads)) {
    await ctx.storage.delete(upload.storageId);
    await ctx.db.delete("avatarUploads", upload._id);
  }

  for (const status of ["open", "matched"] as const) {
    const slots = await ctx.db
      .query("availabilitySlots")
      .withIndex("by_userId_and_status_and_startAt", (q) =>
        q.eq("userId", userId).eq("status", status).gt("startAt", now),
      )
      .take(DELETE_BATCH);
    for (const slot of batch(slots)) await cancelSlot(ctx, slot);
  }

  const pending = await ctx.db
    .query("matchRequests")
    .withIndex("by_fromUserId_and_status", (q) =>
      q.eq("fromUserId", userId).eq("status", "pending"),
    )
    .take(DELETE_BATCH);
  for (const request of batch(pending)) {
    await ctx.db.patch("matchRequests", request._id, { status: "cancelled", respondedAt: now });
    await deleteRequestNotifications(ctx, request._id);
  }

  // Every accepted request has a conversation, so the memberships reach the slots matched as requester.
  const memberships = await ctx.db
    .query("conversationMembers")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(DELETE_BATCH);
  for (const membership of batch(memberships)) {
    // shortcut: only the pair's newest DELETE_BATCH accepted requests are checked, upgrade to a batched scan if a pair can have more future matches.
    const accepted = await ctx.db
      .query("matchRequests")
      .withIndex("by_conversationId_and_status", (q) =>
        q.eq("conversationId", membership.conversationId).eq("status", "accepted"),
      )
      .order("desc")
      .take(DELETE_BATCH);
    for (const request of accepted) {
      if (request.fromUserId !== userId) continue;
      const slot = await ctx.db.get("availabilitySlots", request.slotId);
      if (!slot || slot.status !== "matched" || slot.startAt <= now) continue;
      // No notification type fits "your partner left", so the owner just finds the slot open again.
      await ctx.db.patch("matchRequests", request._id, { status: "cancelled", respondedAt: now });
      await ctx.db.patch("availabilitySlots", slot._id, { status: "open" });
    }
    await ctx.db.delete("conversationMembers", membership._id);
  }

  const messages = await ctx.db
    .query("messages")
    .withIndex("by_senderId", (q) => q.eq("senderId", userId))
    .take(DELETE_BATCH);
  for (const message of batch(messages)) {
    await ctx.db.patch("messages", message._id, { senderId: undefined, body: "" });
  }

  const notifications = await ctx.db
    .query("notifications")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(DELETE_BATCH);
  for (const notification of batch(notifications)) {
    await ctx.db.delete("notifications", notification._id);
  }

  const blocking = await ctx.db
    .query("blocks")
    .withIndex("by_blockerId_and_blockedId", (q) => q.eq("blockerId", userId))
    .take(DELETE_BATCH);
  const blockedBy = await ctx.db
    .query("blocks")
    .withIndex("by_blockedId", (q) => q.eq("blockedId", userId))
    .take(DELETE_BATCH);
  for (const block of [...batch(blocking), ...batch(blockedBy)]) {
    await ctx.db.delete("blocks", block._id);
  }

  if (more) await ctx.scheduler.runAfter(0, internal.users.deleteAccountData, { userId });
}
