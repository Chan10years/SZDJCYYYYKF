type IntroScreenProps = {
  onStart: () => void;
};

export function IntroScreen({ onStart }: IntroScreenProps) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6">
      <div className="flex flex-1 flex-col justify-center gap-8">
        <div className="flex flex-col gap-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-app-muted">
            Connected Decisions · 三局观察
          </p>
          <h1 className="text-3xl font-medium leading-tight tracking-tight text-app-text">
            先做出你的判断，
            <br />
            再让 AI 进入你的决策过程。
          </h1>
        </div>

        <p className="text-[15px] leading-relaxed text-app-muted">
          你会看到几个职业战术 FPS 的关键局面。AI 会在你下判断之后才出现——
          它不是裁判，而是一段第二意见。全程观察的，是连接 AI 后你的判断是否发生变化。
        </p>

        <div className="rounded-lg border border-app-line bg-app-surface px-4 py-3">
          <p className="text-sm leading-relaxed text-app-muted">
            职业路径只作为历史参考，{" "}
            <span className="text-app-text">不是标准答案</span>
            ，也不会告诉你“对”还是“错”。
          </p>
        </div>
      </div>

      <div className="py-6">
        <button
          type="button"
          onClick={onStart}
          className="h-12 w-full rounded-md bg-app-accent text-[15px] font-medium text-[#16130c] transition-colors hover:bg-[#ebba79]"
        >
          开始训练
        </button>
      </div>
    </div>
  );
}