import { motion } from "framer-motion";
import type { ChallengeOutput } from "@/domain/types";

type ChallengeScreenProps = {
  challenge: ChallengeOutput | null;
  onKeep: () => void;
  onAccept: () => void;
};

const isDev = process.env.NODE_ENV === "development";

export function ChallengeScreen({
  challenge,
  onKeep,
  onAccept,
}: ChallengeScreenProps) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6">
      <header className="border-b border-app-line py-4">
        <h1 className="text-[15px] font-medium text-app-text">AI 第二意见</h1>
      </header>

      {challenge === null ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-[15px] text-app-text">AI 正在读取你的判断……</p>
          <p className="font-mono text-[11px] text-app-muted">
            基于你的 Call 与依据，正在生成第二意见
          </p>
        </div>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-1 flex-col gap-6 py-6"
          >
            {isDev && (
              <p className="font-mono text-[10px] uppercase tracking-wider text-app-info">
                source: {challenge.source}
              </p>
            )}

            <section className="flex flex-col gap-1.5">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-app-muted">
                承接你的判断
              </p>
              <p className="text-[15px] leading-relaxed text-app-text">
                {challenge.acknowledge}
              </p>
            </section>

            <section className="flex flex-col gap-1.5">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-app-muted">
                一个盲点
              </p>
              <p className="text-[15px] leading-relaxed text-app-text">
                {challenge.blindspot}
              </p>
            </section>

            <section className="flex flex-col gap-1.5 rounded-lg border border-app-line bg-app-surface px-4 py-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-app-accent">
                需要你再想一次
              </p>
              <p className="text-[15px] leading-relaxed text-app-text">
                {challenge.question}
              </p>
            </section>
          </motion.div>

          <div className="flex flex-col gap-2 py-6">
            {challenge.alternativeCall !== null ? (
              <>
                <button
                  type="button"
                  onClick={onAccept}
                  className="h-12 w-full rounded-md bg-app-accent text-[15px] font-medium text-[#16130c] transition-colors hover:bg-[#ebba79]"
                >
                  采纳 AI：Call {challenge.alternativeCall}
                </button>
                <button
                  type="button"
                  onClick={onKeep}
                  className="h-12 w-full rounded-md border border-app-line text-[15px] font-medium text-app-text transition-colors hover:border-app-line/70"
                >
                  坚持我的判断
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onKeep}
                className="h-12 w-full rounded-md bg-app-accent text-[15px] font-medium text-[#16130c] transition-colors hover:bg-[#ebba79]"
              >
                继续
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}