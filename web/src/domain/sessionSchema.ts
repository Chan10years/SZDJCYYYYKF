import { z } from "zod";
import {
  CallIdSchema,
  ChallengeResponseSchema,
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
  optionalFreeformReasoning: z.string().max(500).default(""),
  challenge: ChallengeOutputSchema.nullable(),
  userResponseToChallenge: ChallengeResponseSchema.nullable().default(null),
  changeReason: z.string().max(500).default(""),
  finalCall: CallIdSchema.nullable(),
  postRoundReflection: z.string().max(500).default(""),
  nextTrainingHypothesis: z.string().max(500).default(""),
  completedRounds: z.array(RoundResultSchema).max(3),
});

export type PersistedSession = z.infer<typeof PersistedSessionSchema>;
