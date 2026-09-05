import { z } from "zod";
import {
  CallIdSchema,
  ChallengeOutputSchema,
  ExperiencePhaseSchema,
  ReasonIdSchema,
  RoundResultSchema,
  ScenarioSchema,
} from "./schemas";

export type Scenario = z.infer<typeof ScenarioSchema>;
export type ChallengeOutput = z.infer<typeof ChallengeOutputSchema>;
export type RoundResult = z.infer<typeof RoundResultSchema>;
export type CallId = z.infer<typeof CallIdSchema>;
export type ReasonId = z.infer<typeof ReasonIdSchema>;
export type ExperiencePhase = z.infer<typeof ExperiencePhaseSchema>;

export type ConnectionStats = {
  totalRounds: number;
  disagreementCount: number;
  acceptanceCount: number;
  persistenceCount: number;
  initialProfessionalAlignmentCount: number;
  finalProfessionalAlignmentCount: number;
  reasonFrequency: Record<ReasonId, number>;
};