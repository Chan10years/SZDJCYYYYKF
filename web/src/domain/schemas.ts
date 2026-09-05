import { z } from "zod";

export const CallIdSchema = z.enum(["A", "B", "C"]);

export const ReasonIdSchema = z.enum([
  "numbers_advantage",
  "known_position",
  "time_pressure",
  "utility_advantage",
  "unknown_space",
  "resource_preservation",
]);

export const ExperiencePhaseSchema = z.enum([
  "intro",
  "situation",
  "decision",
  "challenge",
  "preview",
  "reference",
  "review",
  "summary",
]);

export const PointSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
});

export const PreviewRouteSchema = z.object({
  playerId: z.string(),
  points: z.array(PointSchema),
});

export const PreviewZoneKindSchema = z.enum([
  "pressure",
  "information",
  "risk",
]);

export const PreviewZoneSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  radius: z.number().min(0).max(100),
  kind: PreviewZoneKindSchema,
  label: z.string(),
});

export const PreviewMetricSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export const TacticalPreviewSpecSchema = z.object({
  routes: z.array(PreviewRouteSchema),
  zones: z.array(PreviewZoneSchema),
  metrics: z.array(PreviewMetricSchema).max(3),
});

export const PreviewByCallSchema = z.object({
  A: TacticalPreviewSpecSchema,
  B: TacticalPreviewSpecSchema,
  C: TacticalPreviewSpecSchema,
});

export const ScenarioFactSchema = z.object({
  label: z.string(),
  detail: z.string(),
});

export const ScenarioSourceSchema = z.object({
  event: z.string(),
  match: z.string(),
  map: z.string(),
  round: z.number().int().min(0),
  sourceLabel: z.string(),
  sourceUrl: z.string().url().optional(),
});

export const CallOptionSchema = z.object({
  id: CallIdSchema,
  label: z.string(),
  description: z.string(),
});

export const ReasonOptionSchema = z.object({
  id: ReasonIdSchema,
  label: z.string(),
});

export const ChallengeGuidanceSchema = z.object({
  blindspot: z.string(),
  question: z.string(),
  alternativeCall: CallIdSchema.nullable(),
});

export const ChallengeGuidanceByCallSchema = z.object({
  A: ChallengeGuidanceSchema,
  B: ChallengeGuidanceSchema,
  C: ChallengeGuidanceSchema,
});

export const ProfessionalReferenceSchema = z.object({
  call: CallIdSchema,
  pathLabel: z.string(),
  outcome: z.string(),
  observations: z.array(z.string()).min(1).max(3),
  clipSrc: z.string().optional(),
});

export const ScenarioSchema = z.object({
  id: z.string(),
  title: z.string(),
  purpose: z.string(),
  verified: z.boolean(),
  source: ScenarioSourceSchema,
  /** 可选：真实地图底图（已人工核验的 marker 编号 / 阵营色由图片承担）。Fixture 不提供。 */
  mapBase: z.string().optional(),
  situation: z.object({
    phase: z.string(),
    time: z.string(),
    alive: z.string(),
    objective: z.string(),
    facts: z.array(ScenarioFactSchema),
  }),
  calls: z.array(CallOptionSchema).length(3),
  reasonOptions: z.array(ReasonOptionSchema).min(3).max(6),
  previewByCall: PreviewByCallSchema,
  challengeGuidance: ChallengeGuidanceByCallSchema,
  professional: ProfessionalReferenceSchema,
});

export const ChallengeOutputSchema = z.object({
  stance: z.enum(["agree", "challenge"]),
  acknowledge: z.string(),
  blindspot: z.string(),
  question: z.string(),
  alternativeCall: CallIdSchema.nullable(),
  source: z.enum(["live", "fallback"]),
});

export const RoundResultSchema = z.object({
  scenarioId: z.string(),
  initialCall: CallIdSchema,
  reasonIds: z.array(ReasonIdSchema).min(1).max(2),
  aiStance: z.enum(["agree", "challenge"]),
  aiAlternativeCall: CallIdSchema.nullable(),
  aiResponseSource: z.enum(["live", "fallback"]),
  finalCall: CallIdSchema,
  changedAfterAI: z.boolean(),
  professionalCall: CallIdSchema,
  completedAt: z.string(),
});