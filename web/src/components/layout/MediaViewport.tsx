import type { ReactNode } from "react";

type MediaViewportProps = {
  children: ReactNode;
  className?: string;
};

/**
 * 唯一取景框 primitive：地图 / 视频 / keyframe 共用。
 * Surface 白名单之一 —— 仅 media 本体使用，禁止套在文字内容上。
 */
export function MediaViewport({ children, className = "" }: MediaViewportProps) {
  return (
    <div
      className={`overflow-hidden rounded-lg border border-app-line bg-app-elevated ${className}`}
    >
      {children}
    </div>
  );
}
