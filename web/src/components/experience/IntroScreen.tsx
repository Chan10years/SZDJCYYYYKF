import Image from "next/image";
import { PageFrame } from "@/components/layout/PageFrame";
import { MediaViewport } from "@/components/layout/MediaViewport";

type IntroScreenProps = {
  onStart: () => void;
};

/**
 * 引导页：主标题是全页视觉主角，低组件密度，成熟分析产品感。
 * 现代中文无衬线；免责声明为 fine print 而非厚重卡片；CTA 中性反色。
 */
export function IntroScreen({ onStart }: IntroScreenProps) {
  return (
    <PageFrame family="standalone">
      {/* desktop ≥lg：左主张 + 右视觉图，不机械居中 */}
      <div className="hidden items-center gap-16 py-16 lg:grid lg:grid-cols-[minmax(0,11fr)_minmax(0,9fr)]">
        <div className="flex flex-col gap-8">
          <h1 className="text-[2.5rem] font-semibold leading-[1.24] text-app-text">
            同一局比赛，
            <br />
            更深一层的判断。
          </h1>
          <p className="max-w-md text-[15px] leading-[1.7] text-app-muted">
            你会看到几个职业战术 FPS 的关键局面。AI 会在你下判断之后才出现——
            它不是裁判，而是一段第二意见。全程观察的，是连接 AI 后你的判断是否发生变化。
          </p>
          <p className="max-w-md text-xs leading-relaxed text-app-muted">
            职业路径只作为历史参考，不是标准答案，也不会告诉你“对”还是“错”。
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={onStart}
              className="h-12 rounded-md bg-app-text px-12 text-[15px] font-medium text-app-bg transition-colors hover:opacity-90"
            >
              开始体验
            </button>
            <p className="mt-3 text-xs text-app-muted">
              3 个案例 · 3 局体验 · 真实职业参考
            </p>
          </div>
        </div>
        <MediaViewport>
          <Image
            src="/media/visual/intro-hero.png"
            alt=""
            width={720}
            height={720}
            className="block h-auto w-full"
            priority
          />
        </MediaViewport>
      </div>

      {/* mobile：主张 + 开始按钮 首屏可见 */}
      <div className="flex flex-col gap-8 py-12 lg:hidden">
        <h1 className="text-[2rem] font-semibold leading-[1.24] text-app-text">
          同一局比赛，
          <br />
          更深一层的判断。
        </h1>
        <p className="text-[15px] leading-[1.7] text-app-muted">
          你会看到几个职业战术 FPS 的关键局面。AI 会在你下判断之后才出现——
          它不是裁判，而是一段第二意见。全程观察的，是连接 AI 后你的判断是否发生变化。
        </p>
        <MediaViewport>
          <Image
            src="/media/visual/intro-hero.png"
            alt=""
            width={640}
            height={640}
            className="block h-auto w-full"
            priority
          />
        </MediaViewport>
        <p className="text-xs leading-relaxed text-app-muted">
          职业路径只作为历史参考，不是标准答案，也不会告诉你“对”还是“错”。
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={onStart}
            className="h-12 w-full rounded-md bg-app-text text-[15px] font-medium text-app-bg transition-colors hover:opacity-90"
          >
            开始体验
          </button>
          <p className="mt-3 text-center text-xs text-app-muted">
            3 个案例 · 3 局体验 · 真实职业参考
          </p>
        </div>
      </div>
    </PageFrame>
  );
}
