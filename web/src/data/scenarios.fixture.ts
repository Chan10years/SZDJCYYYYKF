import type { Scenario } from "@/domain/types";

/**
 * 开发用 Fixture，仅供测试与开发验证。
 * 规则：
 * - verificationStatus 均为 practice；
 * - 赛事/比赛名显式包含 `Practice Fixture`；
 * - 三局冲突类型互不相同；
 * - 每局正好 3 个 Calls；
 * - 职业参考标注 `Practice Reference`。
 */

export const fixtureScenarios: Scenario[] = [
  {
    id: "fixture-hero",
    title: "A 区确定性 vs B 区机会",
    purpose: "确定信息 vs 未知机会",
    verificationStatus: "practice",
    source: {
      event: "Practice Fixture — Hero",
      match: "Practice Fixture — 练习赛",
      map: "Practice Map Alpha",
      round: 12,
      sourceLabel: "Practice Fixture",
    },
    situation: {
      phase: "回合 12",
      time: "31 秒",
      alive: "3v2",
      objective: "B 区已下包 · CT 回防",
      facts: [
        { label: "A 区信息", detail: "A 区已被己方清空，信息相对明确" },
        { label: "B 区未知", detail: "B 区两名对手位置未确认" },
        { label: "时间", detail: "剩余 31 秒可以执行一次转点" },
      ],
    },
    calls: [
      {
        id: "A",
        label: "稳阵 A 区展开",
        description: "利用 A 区已知信息稳住优势，压缩对手活动空间",
      },
      {
        id: "B",
        label: "主动进入 B 区",
        description: "趁对手信息少主动击穿 B 区，换取更大执行窗口",
      },
      {
        id: "C",
        label: "中路架点施压",
        description: "在中路建立线型控制，逼对手先暴露信息再定夺",
      },
    ],
    reasonOptions: [
      { id: "known_position", label: "已知位置" },
      { id: "unknown_space", label: "未知区域" },
      { id: "time_pressure", label: "时间压力" },
      { id: "numbers_advantage", label: "人数优势" },
      { id: "resource_preservation", label: "资源保存" },
    ],
    previewByCall: {
      A: {
        routes: [
          {
            playerId: "t1",
            points: [
              { x: 20, y: 70 },
              { x: 25, y: 55 },
              { x: 30, y: 40 },
            ],
          },
          {
            playerId: "t2",
            points: [
              { x: 15, y: 75 },
              { x: 12, y: 60 },
              { x: 20, y: 45 },
            ],
          },
        ],
        zones: [
          { x: 30, y: 40, radius: 18, kind: "information", label: "已确认信息区" },
          { x: 45, y: 30, radius: 14, kind: "risk", label: "B 区风险" },
        ],
        metrics: [
          { label: "信息确定性", value: "高" },
          { label: "正面接触", value: "低" },
        ],
      },
      B: {
        routes: [
          {
            playerId: "t1",
            points: [
              { x: 20, y: 70 },
              { x: 40, y: 60 },
              { x: 60, y: 55 },
            ],
          },
          {
            playerId: "t2",
            points: [
              { x: 15, y: 75 },
              { x: 35, y: 68 },
              { x: 55, y: 65 },
            ],
          },
        ],
        zones: [
          { x: 60, y: 55, radius: 16, kind: "pressure", label: "B 区接触区" },
          { x: 30, y: 62, radius: 12, kind: "information", label: "信息过渡带" },
        ],
        metrics: [
          { label: "信息确定性", value: "低" },
          { label: "正面接触", value: "中" },
        ],
      },
      C: {
        routes: [
          {
            playerId: "t1",
            points: [
              { x: 20, y: 70 },
              { x: 40, y: 50 },
            ],
          },
          {
            playerId: "t2",
            points: [
              { x: 15, y: 75 },
              { x: 35, y: 55 },
            ],
          },
        ],
        zones: [
          { x: 40, y: 50, radius: 14, kind: "pressure", label: "中路控制线" },
          { x: 50, y: 65, radius: 12, kind: "risk", label: "转点风险区" },
        ],
        metrics: [
          { label: "正面接触", value: "中" },
          { label: "转点空间", value: "低" },
        ],
      },
    },
    challengeGuidance: {
      A: {
        blindspot: "A 区信息明确，但那可能只是对手主动撤出留下的诱饵。",
        question: "如果 B 区两名对手都已压向 A 区，你的信息优势还成立吗？",
        alternativeCall: "B",
      },
      B: {
        blindspot: "B 区完全未知，主动进入可能直接撞上对手阵型重心。",
        question: "在信息缺失下进入 B 区，你是否留了能随时撤回的退路？",
        alternativeCall: "A",
      },
      C: {
        blindspot: "中路架点虽稳，但会消耗剩余时间，压缩后续执行空间。",
        question: "等待对手暴露信息的时间里，倒计时是在帮你还是在逼你？",
        alternativeCall: "A",
      },
    },
    professional: {
      call: "A",
      pathLabel: "Practice Reference — 控制已确认区域（练习参考）",
      outcome: "历史结果（练习参考，非正式比赛核验）",
      observations: [
        "先稳定已确认信息，再向未知区扩展是目前练习中更常见的路径",
        "该路径并不保证结果，只反映一种执行取舍",
      ],
    },
  },
  {
    id: "fixture-lite-2",
    title: "人数优势 vs 时间压力",
    purpose: "人数优势 vs 时间压力",
    verificationStatus: "practice",
    source: {
      event: "Practice Fixture — Lite 2",
      match: "Practice Fixture — 练习赛",
      map: "Practice Map Beta",
      round: 8,
      sourceLabel: "Practice Fixture",
    },
    situation: {
      phase: "回合 8",
      time: "20 秒",
      alive: "4v2",
      objective: "寻找 B 点下包位置",
      facts: [
        { label: "人数", detail: "己方 4 人存活，对手仅存 2 人" },
        { label: "时间", detail: "仅剩 20 秒，继续搜集信息会压缩执行窗口" },
      ],
    },
    calls: [
      {
        id: "A",
        label: "继续搜集信息",
        description: "利用人数优势把残存对手位置摸清后再行动",
      },
      {
        id: "B",
        label: "立即压向 B 点",
        description: "趁人数优势直接展开下包，不给对手反应时间",
      },
      {
        id: "C",
        label: "双线夹击",
        description: "一条路牵制，一条路包抄 B 点后侧",
      },
    ],
    reasonOptions: [
      { id: "numbers_advantage", label: "人数优势" },
      { id: "time_pressure", label: "时间压力" },
      { id: "known_position", label: "已知位置" },
      { id: "unknown_space", label: "未知区域" },
    ],
    previewByCall: {
      A: {
        routes: [
          {
            playerId: "t1",
            points: [
              { x: 30, y: 30 },
              { x: 45, y: 30 },
              { x: 60, y: 35 },
            ],
          },
        ],
        zones: [
          { x: 60, y: 35, radius: 15, kind: "information", label: "信息搜索区" },
          { x: 70, y: 50, radius: 12, kind: "risk", label: "时间风险带" },
        ],
        metrics: [
          { label: "时间充裕度", value: "低" },
          { label: "接触风险", value: "低" },
        ],
      },
      B: {
        routes: [
          {
            playerId: "t1",
            points: [
              { x: 30, y: 30 },
              { x: 55, y: 40 },
              { x: 75, y: 55 },
            ],
          },
        ],
        zones: [
          { x: 75, y: 55, radius: 16, kind: "pressure", label: "B 点展开区" },
          { x: 55, y: 45, radius: 12, kind: "risk", label: "中途遭遇带" },
        ],
        metrics: [
          { label: "时间充裕度", value: "高" },
          { label: "接触风险", value: "中" },
        ],
      },
      C: {
        routes: [
          {
            playerId: "t1",
            points: [
              { x: 30, y: 30 },
              { x: 45, y: 40 },
              { x: 60, y: 55 },
            ],
          },
          {
            playerId: "t2",
            points: [
              { x: 30, y: 30 },
              { x: 40, y: 20 },
              { x: 65, y: 25 },
            ],
          },
        ],
        zones: [
          { x: 65, y: 30, radius: 13, kind: "risk", label: "侧翼遭遇区" },
          { x: 60, y: 55, radius: 14, kind: "pressure", label: "B 点后侧" },
        ],
        metrics: [
          { label: "时间充裕度", value: "中" },
          { label: "接触风险", value: "高" },
        ],
      },
    },
    challengeGuidance: {
      A: {
        blindspot: "继续搜集信息的同时，20 秒倒计时正在收紧你的下包窗口。",
        question: "当你的信息收集占掉最后几秒，你还来得及落地执行吗？",
        alternativeCall: "B",
      },
      B: {
        blindspot: "直接压向 B 点可能因目标不明确而暴露在对手枪线下。",
        question: "人数优势下直接推进，你如何保证落位时阵型没有脱节？",
        alternativeCall: "A",
      },
      C: {
        blindspot: "双线夹击要求两路同步，任一线路脱节都会暴露侧翼。",
        question: "剩余时间内双线能否协调到位，还是会把优势拆散？",
        alternativeCall: "B",
      },
    },
    professional: {
      call: "B",
      pathLabel: "Practice Reference — 人数优势快速推进（练习参考）",
      outcome: "历史结果（练习参考，非正式比赛核验）",
      observations: [
        "在人数领先且时间紧张时，练习中更倾向压缩决策并快速展开",
        "该路径依赖落位质量，不保证结果",
      ],
    },
  },
  {
    id: "fixture-lite-3",
    title: "资源安全 vs 主动创造机会",
    purpose: "资源安全 vs 主动创造机会",
    verificationStatus: "practice",
    source: {
      event: "Practice Fixture — Lite 3",
      match: "Practice Fixture — 练习赛",
      map: "Practice Map Gamma",
      round: 15,
      sourceLabel: "Practice Fixture",
    },
    situation: {
      phase: "回合 15",
      time: "25 秒",
      alive: "3v3",
      objective: "守住 A 点并等待下包",
      facts: [
        { label: "状态", detail: "己方 3 人守 A，道具相对完好" },
        { label: "机会", detail: "对手布局分散，存在一次主动前压的空间" },
      ],
    },
    calls: [
      {
        id: "A",
        label: "保守守区",
        description: "利用完好道具固守 A 点，等待对手暴露路线",
      },
      {
        id: "B",
        label: "主动前压",
        description: "消耗道具主动打进对手空间，尝试换取节奏优势",
      },
      {
        id: "C",
        label: "中路可控推进",
        description: "在中路适度前推建立控制又不冒进脱离后援",
      },
    ],
    reasonOptions: [
      { id: "resource_preservation", label: "资源保存" },
      { id: "unknown_space", label: "未知区域" },
      { id: "utility_advantage", label: "道具优势" },
      { id: "time_pressure", label: "时间压力" },
      { id: "numbers_advantage", label: "人数优势" },
    ],
    previewByCall: {
      A: {
        routes: [
          {
            playerId: "t1",
            points: [
              { x: 40, y: 45 },
              { x: 45, y: 45 },
            ],
          },
        ],
        zones: [
          { x: 45, y: 45, radius: 18, kind: "information", label: "防守信息区" },
          { x: 50, y: 55, radius: 12, kind: "risk", label: "外围风险带" },
        ],
        metrics: [
          { label: "资源消耗", value: "低" },
          { label: "机会获取", value: "低" },
        ],
      },
      B: {
        routes: [
          {
            playerId: "t1",
            points: [
              { x: 40, y: 45 },
              { x: 30, y: 35 },
              { x: 20, y: 25 },
            ],
          },
        ],
        zones: [
          { x: 20, y: 25, radius: 15, kind: "pressure", label: "前压接触区" },
          { x: 35, y: 40, radius: 12, kind: "risk", label: "脱节风险带" },
        ],
        metrics: [
          { label: "资源消耗", value: "高" },
          { label: "机会获取", value: "高" },
        ],
      },
      C: {
        routes: [
          {
            playerId: "t1",
            points: [
              { x: 40, y: 45 },
              { x: 35, y: 35 },
            ],
          },
        ],
        zones: [
          { x: 35, y: 35, radius: 13, kind: "pressure", label: "中路可控区" },
          { x: 50, y: 40, radius: 11, kind: "risk", label: "回撤风险带" },
        ],
        metrics: [
          { label: "资源消耗", value: "中" },
          { label: "机会获取", value: "中" },
        ],
      },
    },
    challengeGuidance: {
      A: {
        blindspot: "固守 A 点虽然稳妥，但把节奏完全交给对手。",
        question: "当对手始终不推进时，你的资源优势是否会变成被动等待？",
        alternativeCall: "C",
      },
      B: {
        blindspot: "主动前压会消耗道具并拉长阵型，可能正中对手分散布局的圈套。",
        question: "前压换来的节奏优势，是否足以弥补后援脱节的风险？",
        alternativeCall: "A",
      },
      C: {
        blindspot: "中路可控推进的收益依赖于对手阵型是否真的松动。",
        question: "如果对手只是收缩并无漏洞，这次推进会不会白白暴露位置？",
        alternativeCall: "A",
      },
    },
    professional: {
      call: "A",
      pathLabel: "Practice Reference — 资源保存固守（练习参考）",
      outcome: "历史结果（练习参考，非正式比赛核验）",
      observations: [
        "在道具完好且位置有利时，练习中更倾向保守守区等待信息",
        "该路径依赖对手施压，不保证结果",
      ],
    },
  },
];
