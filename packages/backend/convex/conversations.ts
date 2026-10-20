import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { slotDoc } from "./availability";
import { getCurrentProfile, getProfileForUser, type Ctx } from "./model/auth";
import { isHiddenFrom } from "./model/blocks";
import {
  clearMessageNotifications,
  getMemberConversation,
  latestMessage,
  otherMemberId,
  unreadMessages,
} from "./model/conversations";
import { playerCard, toPlayerCard } from "./model/playerCard";

const MAX_CONVERSATIONS = 100;
/** Unread counts stop here; the UI shows "9+". */
const MAX_UNREAD_COUNT = 10;
const MAX_ACCEPTED = 20;
const PREVIEW_LENGTH = 140;

const conversationSummary = v.object({
  conversationId: v.id("conversations"),
  lastMessageAt: v.number(),
  /** Null when the other player has deleted their profile. */
  player: v.union(playerCard, v.null()),
  lastMessage: v.union(
    v.object({ body: v.string(), mine: v.boolean(), sentAt: v.number() }),
    v.null(),
  ),
  unreadCount: v.number(),
});

/** The newest slot this conversation was matched on, pinned at the top of the thread. */
async function latestMatchedSlot(ctx: Ctx, conversationId: Id<"conversations">) {
  const accepted = await ctx.db
    .query("matchRequests")
    .withIndex("by_conversationId_and_status", (q) =>
      q.eq("conversationId", conversationId).eq("status", "accepted"),
    )
    .order("desc")
    .take(MAX_ACCEPTED);
  let latest: Doc<"matchRequests"> | null = null;
  for (const request of accepted) {
    if (!latest || (request.respondedAt ?? 0) > (latest.respondedAt ?? 0)) latest = request;
  }
  return latest ? ctx.db.get("availabilitySlots", latest.slotId) : null;
}

export const list = query({
  args: {},
  returns: v.array(conversationSummary),
  handler: async (ctx) => {
    const { user } = await getCurrentProfile(ctx);
    const memberships = await ctx.db
      .query("conversationMembers")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(MAX_CONVERSATIONS);

    const rows = [];
    for (const membership of memberships) {
      const conversation = await ctx.db.get("conversations", membership.conversationId);
      if (!conversation) continue;
      const otherUserId = otherMemberId(conversation, user._id);
      if (await isHiddenFrom(ctx, user._id, otherUserId)) continue;

      const profile = await getProfileForUser(ctx, otherUserId);
      const last = await latestMessage(ctx, conversation._id);
      const unread = await unreadMessages(ctx, {
        conversationId: conversation._id,
        userId: user._id,
        since: membership.lastReadAt,
        limit: MAX_UNREAD_COUNT,
      });

      rows.push({
        conversationId: conversation._id,
        lastMessageAt: conversation.lastMessageAt,
        player: profile ? toPlayerCard(profile) : null,
        lastMessage: last
          ? {
              body: last.body.slice(0, PREVIEW_LENGTH),
              mine: last.senderId === user._id,
              sentAt: last._creationTime,
            }
          : null,
        unreadCount: unread.length,
      });
    }
    rows.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    return rows;
  },
});

export const get = query({
  args: { conversationId: v.id("conversations") },
  returns: v.object({
    conversationId: v.id("conversations"),
    otherUserId: v.id("users"),
    player: v.union(playerCard, v.null()),
    slot: v.union(slotDoc, v.null()),
  }),
  handler: async (ctx, args) => {
    const { user } = await getCurrentProfile(ctx);
    const { conversation, otherUserId } = await getMemberConversation(ctx, {
      conversationId: args.conversationId,
      userId: user._id,
    });
    const profile = await getProfileForUser(ctx, otherUserId);
    return {
      conversationId: conversation._id,
      otherUserId,
      player: profile ? toPlayerCard(profile) : null,
      slot: await latestMatchedSlot(ctx, conversation._id),
    };
  },
});

export const markRead = mutation({
  args: { conversationId: v.id("conversations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await getCurrentProfile(ctx);
    const { membership } = await getMemberConversation(ctx, {
      conversationId: args.conversationId,
      userId: user._id,
    });
    const newest = await latestMessage(ctx, args.conversationId);
    // Only write when something is unread, so an open thread does not churn its own queries.
    if (newest && newest._creationTime > (membership.lastReadAt ?? 0)) {
      await ctx.db.patch("conversationMembers", membership._id, {
        lastReadAt: newest._creationTime,
      });
    }
    await clearMessageNotifications(ctx, {
      userId: user._id,
      conversationId: args.conversationId,
    });
    return null;
  },
});
