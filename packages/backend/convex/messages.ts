import { v } from "convex/values";

import { profileMutation, profileQuery } from "./model/auth";
import {
  clearMessageNotifications,
  getMemberConversation,
  getMembership,
  unreadMessageNotifications,
} from "./model/conversations";
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

export const list = profileQuery({
  args: { conversationId: v.id("conversations"), limit: v.number() },
  returns: v.object({ messages: v.array(messageView), hasMore: v.boolean() }),
  handler: async (ctx, args) => {
    const { user } = ctx;
    await getMemberConversation(ctx, { conversationId: args.conversationId, userId: user._id });
    if (!Number.isFinite(args.limit)) fail("INVALID_LIMIT");
    const limit = Math.max(1, Math.min(MAX_LIMIT, Math.floor(args.limit)));
    // One extra row tells whether older messages exist.
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
      .order("desc")
      .take(limit + 1);
    // The window stops growing at MAX_LIMIT, so "load earlier" stops there too.
    const hasMore = rows.length > limit && limit < MAX_LIMIT;
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

export const send = profileMutation({
  args: { conversationId: v.id("conversations"), body: v.string() },
  returns: v.id("messages"),
  handler: async (ctx, args) => {
    const { user } = ctx;
    const body = args.body.trim();
    if (body.length === 0 || body.length > MAX_MESSAGE_LENGTH) fail("INVALID_MESSAGE");
    const { conversation, membership, otherUserId } = await getMemberConversation(ctx, {
      conversationId: args.conversationId,
      userId: user._id,
    });

    // One notification (and later one email) per conversation until the recipient
    // reads it, either by opening the thread or by reading the notification.
    const otherMembership = await getMembership(ctx, {
      conversationId: conversation._id,
      userId: otherUserId,
    });
    const recipientHasNotification =
      otherMembership !== null &&
      (
        await unreadMessageNotifications(ctx, {
          userId: otherUserId,
          conversationId: conversation._id,
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

    // Replying means the sender has seen the thread.
    await clearMessageNotifications(ctx, { userId: user._id, conversationId: conversation._id });

    if (otherMembership && !recipientHasNotification) {
      await createNotification(ctx, {
        userId: otherUserId,
        type: "new_message",
        conversationId: conversation._id,
      });
    }
    return messageId;
  },
});
