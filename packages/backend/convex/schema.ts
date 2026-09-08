import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import {
  formatsValidator,
  genderValidator,
  handednessValidator,
  notificationTypeValidator,
  reportReasonValidator,
  reportStatusValidator,
  requestStatusValidator,
  roleValidator,
  slotStatusValidator,
  surfaceValidator,
} from "./model/validators";

export default defineSchema({
  /** One row per authenticated account. `authId` mirrors the auth provider's user id. */
  users: defineTable({
    authId: v.string(),
    email: v.string(),
    name: v.string(),
    image: v.optional(v.string()),
    role: roleValidator,
    emailNotifications: v.boolean(),
    bannedAt: v.optional(v.number()),
  }).index("by_authId", ["authId"]),

  /** Player profile created during onboarding. One per user. */
  profiles: defineTable({
    userId: v.id("users"),
    displayName: v.string(),
    bio: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    /** ISO `YYYY-MM-DD`. Minimum age 18 is enforced in functions, not here. */
    birthDate: v.string(),
    gender: v.optional(genderValidator),
    /** NTRP rating, 1.0 to 7.0 in 0.5 steps. */
    ntrp: v.number(),
    yearsPlaying: v.number(),
    formats: formatsValidator,
    handedness: v.optional(handednessValidator),
    district: v.string(),
    municipality: v.string(),
    /** ISO 639-1 codes, at least one. */
    languages: v.array(v.string()),
  }).index("by_userId", ["userId"]),

  venues: defineTable({
    name: v.string(),
    district: v.string(),
    municipality: v.string(),
    address: v.optional(v.string()),
    surface: v.optional(surfaceValidator),
    isActive: v.boolean(),
  }).index("by_municipality", ["municipality"]),

  /** A window when a player wants to play. Bounds are epoch ms on 30-minute boundaries. */
  availabilitySlots: defineTable({
    userId: v.id("users"),
    startAt: v.number(),
    endAt: v.number(),
    district: v.string(),
    municipality: v.string(),
    venueId: v.optional(v.id("venues")),
    note: v.optional(v.string()),
    status: slotStatusValidator,
  })
    .index("by_userId_and_startAt", ["userId", "startAt"])
    .index("by_municipality_and_status_and_startAt", ["municipality", "status", "startAt"])
    .index("by_status_and_startAt", ["status", "startAt"]),

  /** A request from `fromUserId` to play `toUserId`'s slot. */
  matchRequests: defineTable({
    slotId: v.id("availabilitySlots"),
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    message: v.optional(v.string()),
    status: requestStatusValidator,
    respondedAt: v.optional(v.number()),
    /** Set when the request is accepted and a conversation opens. */
    conversationId: v.optional(v.id("conversations")),
  })
    .index("by_slotId_and_fromUserId", ["slotId", "fromUserId"])
    .index("by_slotId_and_status", ["slotId", "status"])
    .index("by_toUserId_and_status", ["toUserId", "status"])
    .index("by_fromUserId_and_status", ["fromUserId", "status"]),

  /** One direct-message thread per pair of users. `userAId` < `userBId` for a stable lookup key. */
  conversations: defineTable({
    userAId: v.id("users"),
    userBId: v.id("users"),
    lastMessageAt: v.number(),
  }).index("by_userAId_and_userBId", ["userAId", "userBId"]),

  conversationMembers: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    lastReadAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_conversationId_and_userId", ["conversationId", "userId"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    /** Unset once the sender deletes their account (message body is tombstoned). */
    senderId: v.optional(v.id("users")),
    body: v.string(),
  })
    .index("by_conversationId", ["conversationId"])
    .index("by_senderId", ["senderId"]),

  blocks: defineTable({
    blockerId: v.id("users"),
    blockedId: v.id("users"),
  })
    .index("by_blockerId_and_blockedId", ["blockerId", "blockedId"])
    .index("by_blockedId", ["blockedId"]),

  reports: defineTable({
    reporterId: v.id("users"),
    reportedUserId: v.id("users"),
    reason: reportReasonValidator,
    details: v.optional(v.string()),
    messageId: v.optional(v.id("messages")),
    status: reportStatusValidator,
  })
    .index("by_status", ["status"])
    .index("by_reporterId", ["reporterId"]),

  /** In-app notification. `emailedAt` is set by the email scheduler once sent. */
  notifications: defineTable({
    userId: v.id("users"),
    type: notificationTypeValidator,
    requestId: v.optional(v.id("matchRequests")),
    conversationId: v.optional(v.id("conversations")),
    readAt: v.optional(v.number()),
    emailedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_readAt", ["userId", "readAt"]),
});
