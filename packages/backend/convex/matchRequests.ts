import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { slotDoc } from "./availability";
import { getProfileForUser, profileMutation, profileQuery, type Ctx } from "./model/auth";
import { isBanned, isBlockedEitherWay, isHiddenFrom } from "./model/blocks";
import { getOrCreateConversation } from "./model/conversations";
import { fail } from "./model/errors";
import { createNotification } from "./model/notifications";
import { playerCard, toPlayerCard } from "./model/playerCard";
import { declinePendingForSlot, declineRequest, latestRequest } from "./model/requests";
import schema from "./schema";

const MAX_MESSAGE = 300;
const MAX_LIST = 100;

const requestView = v.object({
  request: schema.doc("matchRequests"),
  slot: slotDoc,
  player: playerCard,
});

type PendingRequestOptions = {
  userId: Id<"users">;
  requestId: Id<"matchRequests">;
  /** The side of the request the caller must be on. */
  role: "fromUserId" | "toUserId";
};

async function getPendingRequest(ctx: Ctx, { userId, requestId, role }: PendingRequestOptions) {
  const request = await ctx.db.get("matchRequests", requestId);
  if (!request) fail("NOT_FOUND");
  if (request[role] !== userId) fail("FORBIDDEN");
  if (request.status !== "pending") fail("REQUEST_NOT_PENDING");
  return request;
}

type ViewOptions = {
  requests: Doc<"matchRequests">[];
  /** Which side of each request is shown as the player card. */
  player: "fromUserId" | "toUserId";
};

async function toViews(ctx: Ctx, { requests, player }: ViewOptions) {
  const views = [];
  const viewer = player === "fromUserId" ? "toUserId" : "fromUserId";
  for (const request of requests) {
    if (await isHiddenFrom(ctx, request[viewer], request[player])) continue;
    const slot = await ctx.db.get("availabilitySlots", request.slotId);
    const profile = await getProfileForUser(ctx, request[player]);
    if (slot && profile) views.push({ request, slot, player: toPlayerCard(profile) });
  }
  return views;
}

export const send = profileMutation({
  args: { slotId: v.id("availabilitySlots"), message: v.optional(v.string()) },
  returns: v.id("matchRequests"),
  handler: async (ctx, args) => {
    const { user } = ctx;
    if (args.message !== undefined && args.message.length > MAX_MESSAGE) fail("INVALID_MESSAGE");
    const slot = await ctx.db.get("availabilitySlots", args.slotId);
    // A banned player's slots look like they do not exist.
    if (!slot || (await isBanned(ctx, slot.userId))) fail("NOT_FOUND");
    if (slot.userId === user._id) fail("CANNOT_REQUEST_OWN_SLOT");
    if (slot.status !== "open") fail("SLOT_NOT_OPEN");
    if (slot.startAt <= Date.now()) fail("SLOT_IN_PAST");
    if (await isBlockedEitherWay(ctx, user._id, slot.userId)) fail("BLOCKED");
    // A new request is refused while one is pending, so only my newest one can be pending.
    const latest = await latestRequest(ctx, slot._id, user._id);
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

export const accept = profileMutation({
  args: { requestId: v.id("matchRequests") },
  returns: v.id("conversations"),
  handler: async (ctx, args) => {
    const { user } = ctx;
    const request = await getPendingRequest(ctx, {
      userId: user._id,
      requestId: args.requestId,
      role: "toUserId",
    });
    if (await isBanned(ctx, request.fromUserId)) fail("NOT_FOUND");
    const slot = await ctx.db.get("availabilitySlots", request.slotId);
    if (!slot || slot.status !== "open") fail("SLOT_NOT_OPEN");
    if (slot.startAt <= Date.now()) fail("SLOT_IN_PAST");
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

export const decline = profileMutation({
  args: { requestId: v.id("matchRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await getPendingRequest(ctx, {
      userId: ctx.user._id,
      requestId: args.requestId,
      role: "toUserId",
    });
    await declineRequest(ctx, request);
    return null;
  },
});

export const cancel = profileMutation({
  args: { requestId: v.id("matchRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await getPendingRequest(ctx, {
      userId: ctx.user._id,
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

export const received = profileQuery({
  args: {},
  returns: v.array(requestView),
  handler: async (ctx) => {
    const { user } = ctx;
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

export const sent = profileQuery({
  args: {},
  returns: v.array(requestView),
  handler: async (ctx) => {
    const { user } = ctx;
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
