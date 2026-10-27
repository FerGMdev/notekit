import { randomUUID } from "node:crypto";
import prisma from "../db";
import { aiConfig } from "../env";
import { AiQuotaError } from "./errors";

/**
 * A per-user, per-day budget for external AI calls.
 *
 * Implemented as one atomic statement so two concurrent requests cannot both
 * slip under the limit. The built-in heuristic provider does not consume quota
 * (it costs nothing), which is why the limit is enforced by the service layer
 * rather than in the UI.
 */

function utcDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export async function consumeAiQuota(
  userId: string,
  limit: number = aiConfig.dailyLimit
): Promise<void> {
  const affected = await prisma.$executeRaw`
    INSERT INTO "AiUsage" ("id", "userId", "day", "count")
    VALUES (${randomUUID()}, ${userId}, ${utcDay()}::date, 1)
    ON CONFLICT ("userId", "day")
    DO UPDATE SET "count" = "AiUsage"."count" + 1
    WHERE "AiUsage"."count" < ${limit}
  `;

  if (Number(affected) === 0) {
    throw new AiQuotaError(limit);
  }
}
