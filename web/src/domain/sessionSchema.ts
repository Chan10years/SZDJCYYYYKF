import { z } from "zod";
import {
  CallIdSchema,
  ChallengeOutputSchema,
  ExperiencePhaseSchema,
  ReasonIdSchema,
  RoundResultSchema,
} from "@/domain/schemas";

export const PersistedSessionSchema = z.object({
  phase: ExperiencePhaseSchema,
  scenarioIndex: z.number().int().min(0).max(2),
  initialCall: CallIdSchema.nullable(),
  reasonIds: z.array(ReasonIdSchema).max(2),
  challenge: ChallengeOutputSchema.nullable(),
  finalCall: CallIdSchema.nullable(),
  completedRounds: z.array(RoundResultSchema).max(3),
});

export type PersistedSession = z.infer<typeof PersistedSessionSchema>;