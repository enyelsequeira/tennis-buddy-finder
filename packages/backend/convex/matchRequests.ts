import { doc } from "convex-helpers/validators";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { slotDoc } from "./availability";
import { getCurrentProfile, getProfileForUser, type Ctx } from "./model/auth";
import { isBlockedEitherWay } from "./model/blocks";
import { getOrCreateConversation } from "./model/conversations";
import { fail } from "./model/errors";
import { createNotification } from "./model/notifications";
import { playerCard, toPlayerCard } from "./model/playerCard";
import { declinePendingForSlot, declineRequest } from "./model/requests";
import schema from "./schema";

const MAX_MESSAGE = 300;
const MAX_LIST = 100;

const requestView = v.object({
  request: doc(schema, "matchRequests"),
  slot: slotDoc,
  player: playerCard,
});

type PendingRequestOptions = {
  requestId: Id<"matchRequests">;
  /** The side of the request the caller must be on. */
  role: "fromUserId" | "toUserId";
};

async function getPendingRequest(ctx: Ctx, { requestId, role }: PendingRequestOptions) {
  const { user } = await getCurrentProfile(ctx);
  const request = await ctx.db.get("matchRequests", requestId);
  if (!request) fail("NOT_FOUND");
  if (request[role] !== user._id) fail("FORBIDDEN");
  if (request.status !== "pending") fail("REQUEST_NOT_PENDING");
  return { user, request };
}

type ViewOptions = {
  requests: Doc<"matchRequests">[];
  /** Which side of each request is shown as the player card. */
  player: "fromUserId" | "toUserId";
};

async function toViews(ctx: Ctx, { requests, player }: ViewOptions) {
  const views = [];
  for (const request of requests) {
    if (await isBlockedEitherWay(ctx, request.fromUserId, request.toUserId)) continue;
    const slot = await ctx.db.get("availabilitySlots", request.slotId);
    const profile = await getProfileForUser(ctx, request[player]);
    if (slot && profile) views.push({ request, slot, player: toPlayerCard(profile) });
  }
  return views;
}

export const send = mutation({
  args: { slotId: v.id("availabilitySlots"), message: v.optional(v.string()) },
  returns: v.id("matchRequests"),
  handler: async (ctx, args) => {
    const { user } = await getCurrentProfile(ctx);
    if (args.message !== undefined && args.message.length > MAX_MESSAGE) fail("INVALID_MESSAGE");
    const slot = await ctx.db.get("availabilitySlots", args.slotId);
    if (!slot) fail("NOT_FOUND");
    if (slot.userId === user._id) fail("CANNOT_REQUEST_OWN_SLOT");
    if (slot.status !== "open") fail("SLOT_NOT_OPEN");
    if (slot.startAt <= Date.now()) fail("SLOT_IN_PAST");
    if (await isBlockedEitherWay(ctx, user._id, slot.userId)) fail("BLOCKED");
    // A new request is refused while one is pending, so only my newest one can be pending.
    const latest = await ctx.db
      .query("matchRequests")
      .withIndex("by_slotId_and_fromUserId", (q) =>
        q.eq("slotId", slot._id).eq("fromUserId", user._id),
      )
      .order("desc")
      .first();
    if (latest?.status === "pending") fail("REQUEST_EXISTS");
    const requestId = await ctx.db.insert("matchRequests", {
      slotId: slot._id,
      fromUserId: user._id,
      toUserId: slot.userId,
      message: args.message,
      status: "pending",
    });
    await createNotification(ctx, { userId: slot.userId, type: "request_received", requestId });
    return requestId;
  },
});

export const accept = mutation({
  args: { requestId: v.id("matchRequests") },
  returns: v.id("conversations"),
  handler: async (ctx, args) => {
    const { user, request } = await getPendingRequest(ctx, {
      requestId: args.requestId,
      role: "toUserId",
    });
    const slot = await ctx.db.get("availabilitySlots", request.slotId);
    if (!slot || slot.status !== "open") fail("SLOT_NOT_OPEN");
    if (await isBlockedEitherWay(ctx, user._id, request.fromUserId)) fail("BLOCKED");

    const conversationId = await getOrCreateConversation(ctx, {
      userId: user._id,
      otherUserId: request.fromUserId,
    });
    await ctx.db.patch("matchRequests", request._id, {
      status: "accepted",
      respondedAt: Date.now(),
      conversationId,
    });
    await ctx.db.patch("availabilitySlots", slot._id, { status: "matched" });
    await declinePendingForSlot(ctx, { slotId: slot._id, except: request._id });
    await createNotification(ctx, {
      userId: request.fromUserId,
      type: "request_accepted",
      requestId: request._id,
      conversationId,
    });
    return conversationId;
  },
});

export const decline = mutation({
  args: { requestId: v.id("matchRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { request } = await getPendingRequest(ctx, {
      requestId: args.requestId,
      role: "toUserId",
    });
    await declineRequest(ctx, request);
    return null;
  },
});

export const cancel = mutation({
  args: { requestId: v.id("matchRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { request } = await getPendingRequest(ctx, {
      requestId: args.requestId,
      role: "fromUserId",
    });
    await ctx.db.patch("matchRequests", request._id, {
      status: "cancelled",
      respondedAt: Date.now(),
    });
    return null;
  },
});

export const received = query({
  args: {},
  returns: v.array(requestView),
  handler: async (ctx) => {
    const { user } = await getCurrentProfile(ctx);
    const requests = await ctx.db
      .query("matchRequests")
      .withIndex("by_toUserId_and_status", (q) =>
        q.eq("toUserId", user._id).eq("status", "pending"),
      )
      .order("desc")
      .take(MAX_LIST);
    return toViews(ctx, { requests, player: "fromUserId" });
  },
});

export const sent = query({
  args: {},
  returns: v.array(requestView),
  handler: async (ctx) => {
    const { user } = await getCurrentProfile(ctx);
    const requests = [];
    for (const status of ["pending", "accepted", "declined"] as const) {
      const rows = await ctx.db
        .query("matchRequests")
        .withIndex("by_fromUserId_and_status", (q) =>
          q.eq("fromUserId", user._id).eq("status", status),
        )
        .order("desc")
        .take(MAX_LIST);
      requests.push(...rows);
    }
    requests.sort((a, b) => b._creationTime - a._creationTime);
    return toViews(ctx, { requests, player: "toUserId" });
  },
});
