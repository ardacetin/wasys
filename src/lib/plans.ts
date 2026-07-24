import type { Plan } from "@prisma/client";

export const PLAN_LIMITS = {
  BASIC: {
    maxUsers: 5,
    features: {
      sharedInbox: true,
      tags: true,
      templates: true,
      voiceMessages: true,
      multiUserChat: true,
      mobileApp: true,
      assignmentRules: true,
      reporting: true,
      intentAi: false,
      zoho: false,
      shopify: false,
      callCenter: false,
      apiAccess: false,
      prioritySupport: false,
    },
  },
  PRO: {
    maxUsers: 50,
    features: {
      sharedInbox: true,
      tags: true,
      templates: true,
      voiceMessages: true,
      multiUserChat: true,
      mobileApp: true,
      assignmentRules: true,
      reporting: true,
      intentAi: true,
      zoho: true,
      shopify: true,
      callCenter: true,
      apiAccess: true,
      prioritySupport: true,
    },
  },
} as const;

export type FeatureKey = keyof (typeof PLAN_LIMITS)["BASIC"]["features"];

export function hasFeature(plan: Plan, feature: FeatureKey) {
  return PLAN_LIMITS[plan].features[feature];
}

export function planLabel(plan: Plan) {
  return plan === "PRO" ? "Pro" : "Basic";
}
