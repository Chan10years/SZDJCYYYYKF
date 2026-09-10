import type { Scenario } from "@/domain/types";

/**
 * 正式体验 Scenario —— 两个已核验职业比赛截点 + 一个练习参考截点。
 * 唯一事实来源：human-assets/specs/{HERO,LITE2,LITE3}_SPEC.md。
 *
 * 呈现边界（严格遵守 SPEC）：
 * - 底图 PNG 承担底层视觉与已人工核验的 marker 编号 / 阵营色；
 *   renderer 只叠加 Call 的 authored routes / zones / qualitative metrics，
 *   不重复绘制编号、不显示未确认的对手实时位置。
 * - 坐标为 0..100 normalized 的最小合理表达，遵循 Mirage / Dust2 通行结构；
 *   无法可靠确定的点位停在最小表达，不编造精确位置。
 *
 * verificationStatus 状态：
 * - Hero / Lite2：事实与素材已核验 → verified；
 * - Lite3：SPEC 明确“待最终人工核验” → practice。
 */
export const realScenarios: Scenario[] = [
  // ============================= HERO =============================
  {
    id: "hero-spirit-falcons-mirage-r5",
    title: "A 区已破，兑现还是控图",
    purpose: "确定信息 vs 展开控图",
    verificationStatus: "verified",
    source: {
      event: "IEM Cologne Major 2026",
      match: "Team Spirit vs Falcons",
      map: "Mirage",
      round: 5,
      sourceLabel: "Bilibili BV1GpjW6YEnv · HLTV 交叉核验",
    },
    mapBase: "/maps/MVP_Map.png",
    situation: {
      phase: "Round 5",
      time: "0:47",
      alive: "3v2",
      objective: "zont1x 携带 C4 · A 侧 AWP 刚被清除",
      facts: [
        { label: "比分", detail: "Spirit 0 : 4 Falcons" },
        { label: "局面", detail: "当前 3v2，剩余 0:47，zont1x 携带 C4" },
        { label: "已确认", detail: "A 侧 AWP（m0NESY）刚被 tN1R 击杀，A 区出现缺口" },
        { label: "站位", detail: "tN1R 位于 A 侧前沿，zont1x 与 sh1ro 控制中路 / 下水道" },
        { label: "未知", detail: "剩余两名 Falcons 防守者位置未知" },
      ],
    },
    calls: [
      {
        id: "A",
        label: "立即兑现 A 区优势",
        description: "兑现已确认的 A 区缺口，将三人快速集中到同一执行方向",
      },
      {
        id: "B",
        label: "利用现有控制转向 B",
        description: "放弃立即兑现 A，让现有分布转换成两条 B 侧进攻路线",
      },
      {
        id: "C",
        label: "保持控图，继续获取信息",
        description: "暂不锁定 A/B，维持现有空间控制，用时间交换更多防守信息",
      },
    ],
    reasonOptions: [
      { id: "known_position", label: "A 区已确认缺口" },
      { id: "unknown_space", label: "剩余防守位置未知" },
      { id: "time_pressure", label: "剩余 0:47" },
      { id: "numbers_advantage", label: "当前 3v2" },
      { id: "resource_preservation", label: "保持现有控图结构" },
    ],
    previewByCall: {
      // 三人向 A 收缩汇合
      A: {
        routes: [
          { playerId: "tN1R", points: [{ x: 63, y: 70 }, { x: 57, y: 73 }, { x: 51, y: 78 }] },
          { playerId: "zont1x", points: [{ x: 38, y: 36 }, { x: 39, y: 45 }, { x: 43, y: 56 }, { x: 48, y: 67 }, { x: 51, y: 78 }] },
          { playerId: "sh1ro", points: [{ x: 43, y: 38 }, { x: 44, y: 47 }, { x: 47, y: 58 }, { x: 50, y: 68 }, { x: 51, y: 78 }] },
        ],
        zones: [
          { x: 51, y: 78, radius: 14, kind: "pressure", label: "A 区执行区" },
          { x: 43, y: 55, radius: 11, kind: "information", label: "中路汇合带" },
        ],
        metrics: [
          { label: "信息确定性", value: "高" },
          { label: "兵力集中", value: "高" },
          { label: "转点空间", value: "低" },
        ],
      },
      // 两路转 B：zont1x+sh1ro 走 B 二楼体系，tN1R 经 Market 包抄
      B: {
        routes: [
          { playerId: "zont1x", points: [{ x: 38, y: 36 }, { x: 31, y: 34 }, { x: 25, y: 28 }, { x: 15, y: 20 }] },
          { playerId: "sh1ro", points: [{ x: 43, y: 38 }, { x: 36, y: 35 }, { x: 28, y: 28 }, { x: 15, y: 20 }] },
          { playerId: "tN1R", points: [{ x: 63, y: 70 }, { x: 60, y: 61 }, { x: 54, y: 52 }, { x: 46, y: 43 }, { x: 35, y: 34 }, { x: 25, y: 27 }, { x: 15, y: 20 }] },
        ],
        zones: [
          { x: 15, y: 20, radius: 15, kind: "pressure", label: "B 区多向压力" },
          { x: 37, y: 35, radius: 11, kind: "information", label: "转点通道" },
        ],
        metrics: [
          { label: "信息确定性", value: "低" },
          { label: "多向压力", value: "高" },
          { label: "转点成本", value: "中" },
        ],
      },
      // 保持展开：不画进攻路线，仅淡分叉 + information zone
      C: {
        routes: [
          { playerId: "tN1R", points: [{ x: 63, y: 70 }, { x: 64, y: 70 }] },
          { playerId: "zont1x", points: [{ x: 38, y: 36 }, { x: 39, y: 37 }] },
          { playerId: "sh1ro", points: [{ x: 43, y: 38 }, { x: 44, y: 39 }] },
        ],
        zones: [
          { x: 51, y: 78, radius: 11, kind: "information", label: "A 方向仍开放" },
          { x: 15, y: 20, radius: 11, kind: "information", label: "B 方向仍开放" },
          { x: 41, y: 38, radius: 12, kind: "pressure", label: "中路控制" },
        ],
        metrics: [
          { label: "信息获取", value: "高" },
          { label: "路线灵活性", value: "高" },
          { label: "时间消耗", value: "高" },
        ],
      },
    },
    challengeGuidance: {
      A: {
        blindspot: "A 区缺口确定，但剩余两名防守者位置未知，收缩三人可能正中未暴露的交叉。",
        question: "如果剩余 CT 已在 A 区形成交叉火力，三人同向收缩的退路在哪里？",
        alternativeCall: "C",
      },
      B: {
        blindspot: "转 B 两路拉开，带包者与包抄者都被拆散，任一路被截都会失去交易。",
        question: "在信息不确定下分兵两路，谁能保证带包者抵达 B 时有补枪保护？",
        alternativeCall: "C",
      },
      C: {
        blindspot: "控图换信息的同时，0:47 正在流逝，防守方也在重新部署。",
        question: "继续等待的时间里，倒计时是在帮你确认信息，还是在逼你失去执行窗口？",
        alternativeCall: "A",
      },
    },
    professional: {
      call: "C",
      pathLabel: "保持控图，继续获取信息",
      outcome:
        "Spirit 在 A1 AWP 被清除后没有立即执行 A 或转 B，继续维持控图；随后在 VIP 再取得一次击杀，局面发展后最终转向 B 区完成执行。",
      observations: [
        "职业路径选择了先用时间换信息，而非立即兑现已确认的 A 区缺口",
        "路径结果成功，不等于其余方案在决策时刻不成立",
      ],
      clipSrc: "/media/scenarios/MVP.mp4",
    },
  },

  // ============================= LITE 2 =============================
  {
    id: "lite2-g2-spirit-mirage-r34",
    title: "R34：16:17 的三向抉择",
    purpose: "欺骗收益 vs 带包安全",
    verificationStatus: "verified",
    source: {
      event: "IEM Cologne Major 2026",
      match: "G2 vs Team Spirit",
      map: "Mirage",
      round: 34,
      sourceLabel: "HLTV Match Page 交叉核验",
    },
    mapBase: "/maps/Lite2_Map.png",
    situation: {
      phase: "Round 34 · 双加时 · 先到 19",
      time: "0:40",
      alive: "5v5",
      objective: "C4 在进攻后场 · 多点展开尚未承诺方向",
      facts: [
        { label: "比分", detail: "G2 16 : 17 Team Spirit，双加时，剩余 0:40" },
        { label: "站位", detail: "7/9 号在 A 侧，6 号 B 侧前沿，0 号中路，8 号带 C4 靠后" },
        { label: "信息", detail: "关键通路被烟雾封锁，双方都无法确认对方完整阵型" },
        { label: "选择", detail: "仍可执行 A、分兵施压后转 B、或重新集合执行 B" },
      ],
    },
    calls: [
      {
        id: "A",
        label: "向 A 集中执行",
        description: "让带包队员向 A 侧汇合，兑现已经形成的 A 区兵力",
      },
      {
        id: "B",
        label: "A 侧施压，带包转 B",
        description: "保留 A 侧真实压力，同时让带包组利用后场路线攻击 B 区",
      },
      {
        id: "C",
        label: "全员重组后同步进攻 B",
        description: "撤回 A 侧兵力，在带包者周围重新形成完整队形后同步执行 B",
      },
    ],
    reasonOptions: [
      { id: "known_position", label: "A 侧已有双人前点" },
      { id: "numbers_advantage", label: "B 侧已有前沿控制" },
      { id: "resource_preservation", label: "中路仍可连接两侧" },
      { id: "unknown_space", label: "烟后防守信息完全未知" },
      { id: "time_pressure", label: "剩余时间限制二次调整" },
      { id: "utility_advantage", label: "C4 仍在后场方向仍开放" },
    ],
    previewByCall: {
      // 8 号向 A 汇合，7/9 保持 A 前沿，重心在 A
      A: {
        routes: [
          { playerId: "p8", points: [{ x: 85, y: 57 }, { x: 82, y: 62 }, { x: 76, y: 70 }, { x: 68, y: 80 }, { x: 60, y: 87 }, { x: 51, y: 90 }] },
          { playerId: "p7", points: [{ x: 67, y: 77 }, { x: 67, y: 77 }] },
          { playerId: "p9", points: [{ x: 62, y: 91 }, { x: 62, y: 91 }] },
          { playerId: "p0", points: [{ x: 70, y: 37 }, { x: 70, y: 37 }] },
          { playerId: "p6", points: [{ x: 31, y: 12 }, { x: 31, y: 12 }] },
        ],
        zones: [
          { x: 51, y: 90, radius: 15, kind: "pressure", label: "A 区执行区" },
          { x: 70, y: 65, radius: 10, kind: "information", label: "带包汇合线" },
        ],
        metrics: [
          { label: "A 侧兵力", value: "高" },
          { label: "执行集中度", value: "高" },
          { label: "欺骗强度", value: "低" },
        ],
      },
      // 7/9 施压 A，8 带包转 B，0 中路衔接，6 从 B Apartments 进 B
      B: {
        routes: [
          { playerId: "p7", points: [{ x: 67, y: 77 }, { x: 67, y: 77 }] },
          { playerId: "p9", points: [{ x: 62, y: 91 }, { x: 62, y: 91 }] },
          { playerId: "p8", points: [{ x: 85, y: 57 }, { x: 84, y: 50 }, { x: 80, y: 43 }, { x: 73, y: 36 }, { x: 64, y: 29 }, { x: 53, y: 25 }, { x: 40, y: 23 }, { x: 17, y: 23 }] },
          { playerId: "p0", points: [{ x: 70, y: 37 }, { x: 65, y: 32 }, { x: 57, y: 27 }, { x: 47, y: 24 }, { x: 35, y: 23 }, { x: 17, y: 23 }] },
          { playerId: "p6", points: [{ x: 31, y: 12 }, { x: 30, y: 15 }, { x: 26, y: 19 }, { x: 22, y: 21 }, { x: 17, y: 23 }] },
        ],
        zones: [
          { x: 67, y: 77, radius: 12, kind: "pressure", label: "A 侧真实施压" },
          { x: 17, y: 23, radius: 14, kind: "pressure", label: "B 区窗口" },
        ],
        metrics: [
          { label: "欺骗强度", value: "高" },
          { label: "多向压力", value: "高" },
          { label: "带包安全", value: "低" },
        ],
      },
      // 第一阶段：7/9/0 收缩到带包者附近，6 保持 B 侧前沿；第二阶段：五人统一执行 B。
      C: {
        routes: [
          { playerId: "p7", phaseBreak: 3, points: [{ x: 67, y: 77 }, { x: 74, y: 70 }, { x: 79, y: 62 }, { x: 80, y: 55 }, { x: 72, y: 46 }, { x: 64, y: 38 }, { x: 52, y: 32 }, { x: 38, y: 27 }, { x: 17, y: 23 }] },
          { playerId: "p9", phaseBreak: 4, points: [{ x: 62, y: 91 }, { x: 68, y: 81 }, { x: 75, y: 70 }, { x: 80, y: 61 }, { x: 80, y: 55 }, { x: 72, y: 46 }, { x: 64, y: 38 }, { x: 52, y: 32 }, { x: 38, y: 27 }, { x: 17, y: 23 }] },
          { playerId: "p8", phaseBreak: 2, points: [{ x: 85, y: 57 }, { x: 82, y: 55 }, { x: 80, y: 54 }, { x: 70, y: 45 }, { x: 61, y: 37 }, { x: 51, y: 31 }, { x: 37, y: 26 }, { x: 17, y: 23 }] },
          { playerId: "p0", phaseBreak: 2, points: [{ x: 70, y: 37 }, { x: 76, y: 48 }, { x: 79, y: 53 }, { x: 71, y: 45 }, { x: 62, y: 38 }, { x: 52, y: 32 }, { x: 39, y: 27 }, { x: 17, y: 23 }] },
          { playerId: "p6", phaseBreak: 1, points: [{ x: 31, y: 12 }, { x: 31, y: 12 }, { x: 30, y: 15 }, { x: 26, y: 19 }, { x: 22, y: 21 }, { x: 17, y: 23 }] },
        ],
        movementPhases: [
          { id: "regroup", label: "第一阶段：收缩 / 重组" },
          { id: "execute", label: "第二阶段：统一执行 B" },
        ],
        zones: [
          { x: 81, y: 55, radius: 10, kind: "information", label: "带包者周围重组区" },
          { x: 17, y: 23, radius: 14, kind: "pressure", label: "B 区同步执行" },
        ],
        metrics: [
          { label: "兵力集中", value: "高" },
          { label: "交易完整性", value: "高" },
          { label: "时间压力", value: "高" },
        ],
      },
    },
    challengeGuidance: {
      A: {
        blindspot: "A 侧已有站位不等于 A 点防守薄弱，烟后信息完全未知，向 A 集中可能是把兵力投入未经确认的区域。",
        question: "0 号与 6 号的远端控制，在主力收缩 A 之后还能转化为有效交易吗？",
        alternativeCall: "B",
      },
      B: {
        blindspot: "A 侧施压未必真能迫使防守轮转，你可能把“可能骗动防守”当成了已经发生的轮转。",
        question: "8 号带包转 B 时，谁能提供第一时间的补枪与下包保护？",
        alternativeCall: "C",
      },
      C: {
        blindspot: "重新集合需要消耗 0:40 里的大量时间，而你设想的 B 侧窗口从未被信息确认。",
        question: "放弃 A 侧压力后，防守方是否更容易读到你们在向 B 集合？",
        alternativeCall: "B",
      },
    },
    professional: {
      call: "B",
      pathLabel: "A 侧施压，带包转 B",
      outcome:
        "Spirit 在约 0:40 仍维持默认控图，随后 A 侧制造大规模真实压力吸引 G2 回应，同时带包路线转向 B 并形成 B 区下包机会；下包后的残局仍具高方差。",
      observations: [
        "职业路径用多点压力换取防守误判，但带包组因此承担了更高的失联与无交易风险",
        "路径结果成功，不等于该决策结构在决策时刻属于低风险",
      ],
      clipSrc: "/media/scenarios/Lite2.mp4",
    },
  },

  // ============================= LITE 3 =============================
  {
    id: "lite3-spirit-falcons-dust2-r20",
    title: "B 门外：守位、穿烟还是后撤",
    purpose: "资源与站位安全 vs 主动创造机会",
    // SPEC 标记：待最终人工核验后才能进入 verified。
    verificationStatus: "practice",
    source: {
      event: "IEM Cologne Major 2026",
      match: "Team Spirit vs Falcons",
      map: "Dust2",
      round: 20,
      sourceLabel: "HLTV / BO3.gg / BLAST.tv / ESL VOD 交叉核验",
    },
    mapBase: "/maps/Lite3_Map.png",
    situation: {
      phase: "Round 20 · 半决赛",
      time: "0:32",
      alive: "5v4",
      objective: "Bomb 尚未下包 · Spirit 主力已进入 B 区",
      facts: [
        { label: "比分", detail: "Spirit 9 : 10 Falcons，剩余 0:32，Bomb 尚未下包" },
        { label: "你的状态", detail: "karrigan 位于 B Doors 附近，99 HP，使用 M4A1-S" },
        { label: "已确认", detail: "Spirit 主要兵力已进入 / 占据 B 包点区域" },
        { label: "协同", detail: "其余三名 CT（两人中门、一人警家）能快速向 B 门外协同" },
        { label: "烟雾", detail: "B Doors 附近有烟雾，穿烟意味着主动承担视野与暴露风险" },
      ],
    },
    calls: [
      {
        id: "A",
        label: "守住 B 门位置",
        description: "守住 B Doors 的枪位与步枪资源，等待更完整的队友协同后再处理 B 区",
      },
      {
        id: "B",
        label: "主动穿烟反清",
        description: "先手穿烟抢在下包前制造机会，再由快速跟进的队友把第一接触转化为团队反清",
      },
      {
        id: "C",
        label: "后撤重组",
        description: "放弃当前孤立前点，先与队友重组成更完整的四人结构，再处理 B 区",
      },
    ],
    reasonOptions: [
      { id: "resource_preservation", label: "保留 M4A1-S 与当前枪位" },
      { id: "known_position", label: "已确认多名进攻方进入 B 区" },
      { id: "time_pressure", label: "Bomb 尚未下包，但只剩 0:32" },
      { id: "utility_advantage", label: "B Doors 烟雾改变了接触方式" },
    ],
    previewByCall: {
      // 8 守 B 门，0/7/9 向 B 门外围协同（不冲入）
      A: {
        routes: [
          { playerId: "karrigan", points: [{ x: 27, y: 18 }, { x: 27, y: 18 }] },
          { playerId: "ct7", points: [{ x: 48, y: 35 }, { x: 43, y: 31 }, { x: 37, y: 27 }, { x: 31, y: 23 }] },
          { playerId: "ct9", points: [{ x: 58, y: 22 }, { x: 51, y: 23 }, { x: 43, y: 24 }, { x: 34, y: 23 }] },
          { playerId: "ct0", points: [{ x: 46, y: 32 }, { x: 41, y: 29 }, { x: 36, y: 26 }, { x: 31, y: 23 }] },
        ],
        zones: [
          { x: 27, y: 18, radius: 12, kind: "information", label: "B 门协同位" },
          { x: 20, y: 17, radius: 13, kind: "pressure", label: "B 区进攻压力" },
        ],
        metrics: [
          { label: "资源安全", value: "高" },
          { label: "第一接触风险", value: "低" },
          { label: "协同等待", value: "高" },
        ],
      },
      // 第一阶段：8 先手穿烟制造 B 区压力；第二阶段：0/7/9 随后跟进协同推进。
      B: {
        routes: [
          {
            playerId: "karrigan",
            phaseBreak: 2,
            points: [
              { x: 27, y: 18 },
              { x: 25, y: 19 },
              { x: 22, y: 18 },
              { x: 22, y: 18 },
            ],
          },
          {
            playerId: "ct7",
            phaseBreak: 1,
            points: [
              { x: 48, y: 35 },
              { x: 48, y: 35 },
              { x: 43, y: 31 },
              { x: 36, y: 26 },
              { x: 28, y: 22 },
            ],
          },
          {
            playerId: "ct9",
            phaseBreak: 1,
            points: [
              { x: 58, y: 22 },
              { x: 58, y: 22 },
              { x: 50, y: 24 },
              { x: 41, y: 25 },
              { x: 28, y: 22 },
            ],
          },
          {
            playerId: "ct0",
            phaseBreak: 1,
            points: [
              { x: 46, y: 32 },
              { x: 46, y: 32 },
              { x: 41, y: 29 },
              { x: 35, y: 25 },
              { x: 28, y: 22 },
            ],
          },
        ],
        movementPhases: [
          { id: "lead", label: "第一阶段：先手穿烟 / 制造 B 区压力" },
          { id: "follow", label: "第二阶段：队友随后跟进 / 协同推进" },
        ],
        zones: [
          { x: 25, y: 19, radius: 10, kind: "risk", label: "穿烟暴露带" },
          { x: 20, y: 17, radius: 13, kind: "pressure", label: "B 区反清窗口" },
        ],
        metrics: [
          { label: "主动性", value: "高" },
          { label: "第一接触风险", value: "高" },
          { label: "后续协同速度", value: "高" },
        ],
      },
      // 8 后撤，0/7/9 收拢重组（先收缩，不直接冲 B）
      C: {
        routes: [
          { playerId: "karrigan", points: [{ x: 27, y: 18 }, { x: 32, y: 23 }, { x: 38, y: 28 }, { x: 44, y: 31 }] },
          { playerId: "ct7", points: [{ x: 48, y: 35 }, { x: 46, y: 32 }] },
          { playerId: "ct9", points: [{ x: 58, y: 22 }, { x: 52, y: 27 }, { x: 46, y: 31 }] },
          { playerId: "ct0", points: [{ x: 46, y: 32 }, { x: 46, y: 31 }] },
        ],
        zones: [
          { x: 46, y: 31, radius: 12, kind: "information", label: "重组汇合区" },
          { x: 20, y: 17, radius: 13, kind: "pressure", label: "B 区进攻压力" },
        ],
        metrics: [
          { label: "阵型完整性", value: "高" },
          { label: "单点风险", value: "低" },
          { label: "时间成本", value: "中" },
        ],
      },
    },
    challengeGuidance: {
      A: {
        blindspot: "你在保存 M4A1-S 与 B 门枪位，但 Bomb 尚未下包；等待可能主动让出阻止下包的最后窗口。",
        question: "队友确实在靠近，但你是否假设了 Spirit 会在这几秒内保持静止？",
        alternativeCall: "B",
      },
      B: {
        blindspot: "穿烟意味着 karrigan 首先承担最大暴露风险，你可能高估了 2–3 秒后队友跟进对第一接触的保护。",
        question: "“敌人已进入 B”是否足以证明现在必须主动穿烟，而不是守住烟边等待协同？",
        alternativeCall: "A",
      },
      C: {
        blindspot: "后撤能提高阵型完整性，但可能直接让 Spirit 获得下包时间。",
        question: "0:32 的时间，是否允许一次明显后撤再重新组织？",
        alternativeCall: "B",
      },
    },
    professional: {
      call: "B",
      pathLabel: "主动穿烟反清",
      outcome:
        "在 Bomb 尚未下包、Spirit 已大量进入 B 区的情况下，karrigan 主动穿过 B Doors 烟雾承担第一接触风险并取得两次关键击杀；约 2–3 秒后队友迅速跟进，把窗口转化为团队反清，Spirit 未能完成下包。",
      observations: [
        "这次主动操作成功制造了团队窗口，但不代表穿烟在决策时刻属于低风险或唯一合理选择",
        "双杀是个人枪法结果，不能反向证明该决策本身无风险",
      ],
      clipSrc: "/media/scenarios/Lite3.mp4",
    },
  },
];
