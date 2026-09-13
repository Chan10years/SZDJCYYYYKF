import type { RoundResult } from "@/domain/types";
import { getAiSourceLabel } from "@/domain/aiSource";

type ReasoningChainProps = {
  rounds: readonly RoundResult[];
};

function unavailable(label: string): string {
  return `旧记录未保存 ${label}。`;
}

/**
 * 完成记录的历史视图：优先展示 RoundResult 快照，不从当前 Scenario 猜回
 * 已经缺失的 Challenge 或 Professional Reference 内容。
 */
export function ReasoningChain({
  rounds,
}: ReasoningChainProps) {
  return (
    <section aria-label="训练记录" className="flex flex-col gap-3">
      <p className="text-[13px] font-medium text-app-muted">训练记录</p>
      <div className="flex flex-col gap-2">
        {rounds.map((round, index) => {
          const snapshot = round.scenarioSnapshot;
          const callLabel = snapshot?.calls.find(
            (call) => call.id === round.initialCall,
          )?.label;
          const finalCallLabel = snapshot?.calls.find(
            (call) => call.id === round.finalCall,
          )?.label;
          const reasonLabels = snapshot
            ? snapshot.selectedReasons.map((reason) => reason.label).join("、")
            : null;
          const challenge = round.aiChallenge;
          const source = challenge?.source ?? round.aiResponseSource;
          const professional = round.professionalReference;
          const responseLabel =
            round.userResponseToChallenge === "revise"
              ? `改判至 Call ${round.finalCall}${finalCallLabel ? ` · ${finalCallLabel}` : ""}`
              : round.userResponseToChallenge === "keep"
                ? `保持 Call ${round.finalCall}${finalCallLabel ? ` · ${finalCallLabel}` : ""}`
                : `旧记录仅保存最终 Call ${round.finalCall}`;

          return (
            <details
              key={`${round.scenarioId}-${round.completedAt}`}
              open={index === 0}
              className="border-b border-app-line/60 pb-2 last:border-b-0"
            >
              <summary className="cursor-pointer list-none py-2 text-[13px] font-medium text-app-text marker:hidden">
                <span className="mr-2 font-mono text-xs text-app-muted">
                  R{index + 1}
                </span>
                {snapshot?.title ?? `旧记录（Scenario ${round.scenarioId}）`}
                <span className="ml-2 text-xs text-app-muted">查看训练记录</span>
              </summary>
              <div className="grid gap-5 pb-4 pt-2 text-[13px] leading-relaxed text-app-muted lg:grid-cols-2">
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="font-medium text-app-text">初始判断</p>
                    <p className="mt-1">
                      Call {round.initialCall} · {callLabel ?? unavailable("初始 Call 快照")}
                    </p>
                    <p>
                      主要依据：
                      {reasonLabels ?? unavailable("判断理由快照")}
                    </p>
                    <p>
                      补充理由：
                      {round.optionalFreeformReasoning || "未补充自由理由"}
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-app-text">AI 第二意见</p>
                    {challenge ? (
                      <div className="mt-1 flex flex-col gap-1">
                        <p>立场：{challenge.stance === "challenge" ? "提出挑战" : "基本承接"}</p>
                        <p>承接：{challenge.acknowledge}</p>
                        <p>盲点：{challenge.blindspot}</p>
                        <p>反问：{challenge.question}</p>
                        <p>
                          替代方向：{challenge.alternativeCall ?? "未提供"}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-1">{unavailable("Challenge 正文")}</p>
                    )}
                    <p className="mt-2 text-xs">
                      来源：{getAiSourceLabel(source)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div>
                    <p className="font-medium text-app-text">你的回应</p>
                    <p className="mt-1">{responseLabel}</p>
                    <p>
                      坚持 / 改判理由：
                      {round.changeReason || unavailable("回应理由")}
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-app-text">参考路径快照</p>
                    {professional ? (
                      <div className="mt-1 flex flex-col gap-1">
                        <p>
                          Call {professional.call} · {professional.pathLabel}
                        </p>
                        <p>{professional.outcome}</p>
                      </div>
                    ) : (
                      <p className="mt-1">{unavailable("参考路径")}</p>
                    )}
                  </div>

                  <div>
                    <p className="font-medium text-app-text">本局 takeaway / next check</p>
                    <p className="mt-1">
                      Takeaway：{round.postRoundReflection || "未补充反思"}
                    </p>
                    <p>
                      Next check：
                      {round.nextTrainingHypothesis || unavailable("next check")}
                    </p>
                  </div>
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
