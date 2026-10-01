import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

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
