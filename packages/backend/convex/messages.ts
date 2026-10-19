import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getCurrentProfile } from "./model/auth";
import { getMemberConversation, getMembership, unreadMessages } from "./model/conversations";
import { fail } from "./model/errors";
import { MAX_MESSAGE_LENGTH } from "./model/messageSchema";
import { createNotification } from "./model/notifications";

/** Most messages one `list` call returns; the thread loads older ones by raising `limit`. */
const MAX_LIMIT = 500;

const messageView = v.object({
  _id: v.id("messages"),
  _creationTime: v.number(),
  body: v.string(),
  /** False for the other player's messages and for tombstoned ones (sender deleted). */
  mine: v.boolean(),
});

export const list = query({
  args: { conversationId: v.id("conversations"), limit: v.number() },
  returns: v.object({ messages: v.array(messageView), hasMore: v.boolean() }),
  handler: async (ctx, args) => {
    const { user } = await getCurrentProfile(ctx);
    await getMemberConversation(ctx, { conversationId: args.conversationId, userId: user._id });
    if (!Number.isFinite(args.limit)) fail("INVALID_LIMIT");
    const limit = Math.max(1, Math.min(MAX_LIMIT, Math.floor(args.limit)));
    // One extra row tells whether older messages exist.
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
      .order("desc")
      .take(limit + 1);
    const hasMore = rows.length > limit;
    const messages = rows
      .slice(0, limit)
      .reverse()
      .map((row) => ({
        _id: row._id,
        _creationTime: row._creationTime,
        body: row.body,
        mine: row.senderId === user._id,
      }));
    return { messages, hasMore };
  },
});

export const send = mutation({
  args: { conversationId: v.id("conversations"), body: v.string() },
  returns: v.id("messages"),
  handler: async (ctx, args) => {
    const { user } = await getCurrentProfile(ctx);
    const body = args.body.trim();
    if (body.length === 0 || body.length > MAX_MESSAGE_LENGTH) fail("INVALID_MESSAGE");
    const { conversation, membership, otherUserId } = await getMemberConversation(ctx, {
      conversationId: args.conversationId,
      userId: user._id,
    });

    // One notification (and later one email) per conversation until the recipient reads it.
    const otherMembership = await getMembership(ctx, {
      conversationId: conversation._id,
      userId: otherUserId,
    });
    const recipientHadUnread =
      otherMembership !== null &&
      (
        await unreadMessages(ctx, {
          conversationId: conversation._id,
          userId: otherUserId,
          since: otherMembership.lastReadAt,
          limit: 1,
        })
      ).length > 0;

    const messageId = await ctx.db.insert("messages", {
      conversationId: conversation._id,
      senderId: user._id,
      body,
    });
    const message = await ctx.db.get("messages", messageId);
    const sentAt = message?._creationTime ?? Date.now();
    await ctx.db.patch("conversations", conversation._id, { lastMessageAt: sentAt });
    await ctx.db.patch("conversationMembers", membership._id, {
      lastReadAt: Math.max(sentAt, membership.lastReadAt ?? 0),
    });

    if (otherMembership && !recipientHadUnread) {
      await createNotification(ctx, {
        userId: otherUserId,
        type: "new_message",
        conversationId: conversation._id,
      });
    }
    return messageId;
  },
});
