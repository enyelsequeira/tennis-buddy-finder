import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

import type { Ctx } from "./auth";
import { isBlockedEitherWay } from "./blocks";
import { fail } from "./errors";

type Pair = { userId: Id<"users">; otherUserId: Id<"users"> };

export async function getOrCreateConversation(ctx: MutationCtx, pair: Pair) {
  const [userAId, userBId] =
    pair.userId < pair.otherUserId
      ? [pair.userId, pair.otherUserId]
      : [pair.otherUserId, pair.userId];
  const existing = await ctx.db
    .query("conversations")
    .withIndex("by_userAId_and_userBId", (q) => q.eq("userAId", userAId).eq("userBId", userBId))
    .unique();
  if (existing) return existing._id;
  const now = Date.now();
  const conversationId = await ctx.db.insert("conversations", {
    userAId,
    userBId,
    lastMessageAt: now,
  });
  await ctx.db.insert("conversationMembers", { conversationId, userId: userAId, lastReadAt: now });
  await ctx.db.insert("conversationMembers", { conversationId, userId: userBId, lastReadAt: now });
  return conversationId;
}

export function otherMemberId(conversation: Doc<"conversations">, userId: Id<"users">) {
  return conversation.userAId === userId ? conversation.userBId : conversation.userAId;
}

type MembershipOptions = { conversationId: Id<"conversations">; userId: Id<"users"> };

export async function getMembership(ctx: Ctx, { conversationId, userId }: MembershipOptions) {
  return ctx.db
    .query("conversationMembers")
    .withIndex("by_conversationId_and_userId", (q) =>
      q.eq("conversationId", conversationId).eq("userId", userId),
    )
    .unique();
}

/**
 * Loads a conversation the user belongs to. Conversations with a block in
 * either direction look like they do not exist, as on the player profile.
 */
export async function getMemberConversation(ctx: Ctx, options: MembershipOptions) {
  const conversation = await ctx.db.get("conversations", options.conversationId);
  if (!conversation) fail("NOT_FOUND");
  const membership = await getMembership(ctx, options);
  if (!membership) fail("NOT_FOUND");
  const otherUserId = otherMemberId(conversation, options.userId);
  if (await isBlockedEitherWay(ctx, options.userId, otherUserId)) fail("NOT_FOUND");
  return { conversation, membership, otherUserId };
}

type UnreadOptions = {
  conversationId: Id<"conversations">;
  /** The reader: messages they sent never count as unread. */
  userId: Id<"users">;
  since: number | undefined;
  limit: number;
};

/** Messages from the other member after `since`, oldest first, at most `limit`. */
export async function unreadMessages(ctx: Ctx, options: UnreadOptions) {
  const since = options.since ?? 0;
  const rows = await ctx.db
    .query("messages")
    .withIndex("by_conversationId", (q) =>
      q.eq("conversationId", options.conversationId).gt("_creationTime", since),
    )
    .take(options.limit);
  return rows.filter((row) => row.senderId !== options.userId);
}
