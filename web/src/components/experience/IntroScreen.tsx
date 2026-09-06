import Image from "next/image";

type IntroScreenProps = {
  onStart: () => void;
};

/**
 * 引导页：整张比赛画面即首页本体（全出血），不是“图卡 + 说明页”。
 * 标题/引导语/disclaimer 与按钮全部层叠于同一主视觉之上；
 * “开始体验”是英雄区的行动收口。双向渐变保证 HUD 区与文字区可读。
 */
export function IntroScreen({ onStart }: IntroScreenProps) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* 主视觉：整页铺满，移动端即页面最强视觉中心 */}
      <Image
        src="/media/visual/intro-hero.png"
        alt=""
        fill
        sizes="100vw"
        className="object-cover object-center"
        priority
      />
      {/* 可读性遮罩：顶部压标题区、底部压行动区，中部保留画面 */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/80"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-black/45 via-transparent to-transparent"
      />

      {/* 同一主视觉上的完整构图：题文在上，行动收口在下 */}
      <div className="relative mx-auto flex w-full max-w-[1056px] flex-1 flex-col px-5 sm:px-6">
        <p className="pt-6 text-xs font-medium text-white/60">01 · 引导</p>

        <div className="mt-10 flex flex-col gap-4 lg:mt-16 lg:gap-5">
          <h1 className="text-[2rem] font-semibold leading-[1.24] text-white lg:text-[2.75rem]">
            同一局比赛，
            <br />
            更深一层的判断。
          </h1>
          <p className="max-w-md text-[14px] leading-[1.7] text-white/85 lg:text-[15px]">
            你会看到几个职业战术 FPS 的关键局面。AI 会在你下判断之后才出现——
            它不是裁判，而是一段第二意见。全程观察的，是连接 AI
            后你的判断是否发生变化。
          </p>
          <p className="max-w-md text-xs leading-relaxed text-white/55">
            职业路径只作为历史参考，不是标准答案，也不会告诉你“对”还是“错”。
          </p>
        </div>

        <div className="flex-1" />

        {/* 行动收口：主视觉的一部分，不是表单底部按钮 */}
        <div className="flex flex-col gap-3 pb-8 sm:flex-row sm:items-center sm:gap-6 lg:pb-10">
          <button
            type="button"
            onClick={onStart}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-app-text text-[15px] font-medium text-app-bg transition-colors hover:opacity-90 sm:w-auto sm:px-14"
          >
            开始体验
            <span aria-hidden="true">→</span>
          </button>
          <p className="text-center text-xs text-white/55 sm:text-left">
            3 个案例 · 3 局体验 · 真实职业参考
          </p>
        </div>
      </div>
    </div>
  );
}
