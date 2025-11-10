// 默认权重配置
export const DEFAULT_WEIGHTS = {
  time_decay: 0.40,
  account: 0.25,
  title_ctr: 0.20,
  buzz: 0.10,
  freshness: 0.05
};

// 默认标题评分规则
export const DEFAULT_TITLE_RULES = {
  boost: {
    numbers: true,
    contrast_words: ["对比", "vs", "VS", "还是", "or", "OR"],
    benefit_words: ["提效", "一键", "白嫖", "免费", "避坑", "升级", "速通", "模板", "指南", "全流程"],
    pain_words: ["翻车", "踩雷", "坑", "别再", "毁了", "血亏"],
    persona_words: ["马斯克", "余承东", "OpenAI", "Claude", "Cursor", "Gemini", "Midjourney"],
    scenarios: ["PPT", "会议纪要", "效率", "上班", "面试", "副业", "变现"]
  },
  penalty: {
    too_long: 28,
    jargon: ["LoRA参数", "采样器", "温度系数", "推理token"]
  }
};

export interface HeatWeights {
  time_decay: number;
  account: number;
  title_ctr: number;
  buzz: number;
  freshness: number;
}

export interface TitleRules {
  boost: {
    numbers: boolean;
    contrast_words: string[];
    benefit_words: string[];
    pain_words: string[];
    persona_words: string[];
    scenarios: string[];
  };
  penalty: {
    too_long: number;
    jargon: string[];
  };
}

export interface TitleScoreResult {
  score: number;
  details: string[];
}

/**
 * 计算时间衰减分数
 * TimeDecay = exp(-hours_since_pub / 36)
 */
export function calculateTimeDecay(hoursSincePub: number): number {
  if (hoursSincePub <= 0) {
    return 1.0;
  }
  return Math.exp(-hoursSincePub / 36);
}

/**
 * 计算账号星级分数
 * AccountScore = (star - 1) / 4
 */
export function calculateAccountScore(star: number): number {
  if (star <= 1) return 0;
  if (star >= 5) return 1;
  return (star - 1) / 4;
}

/**
 * 计算标题CTR分数
 * 基于标题要素进行加分和扣分
 */
export function calculateTitleCTRScore(title: string, rules?: TitleRules): TitleScoreResult {
  const titleRules = rules || DEFAULT_TITLE_RULES;
  const titleStr = (title || '').toString().trim();

  if (!titleStr) {
    return { score: 0, details: ['空标题'] };
  }

  let score = 0.5; // 基础分数
  const details: string[] = [];

  // 加分项
  // 数字检测
  if (titleRules.boost.numbers && /\d/.test(titleStr)) {
    score += 0.1;
    details.push('包含数字');
  }

  // 对比词检测
  const hasContrastWords = titleRules.boost.contrast_words.some(word =>
    titleStr.toLowerCase().includes(word.toLowerCase())
  );
  if (hasContrastWords) {
    score += 0.15;
    details.push('包含对比词');
  }

  // 收益词检测
  const hasBenefitWords = titleRules.boost.benefit_words.some(word =>
    titleStr.toLowerCase().includes(word.toLowerCase())
  );
  if (hasBenefitWords) {
    score += 0.15;
    details.push('包含收益词');
  }

  // 痛点词检测
  const hasPainWords = titleRules.boost.pain_words.some(word =>
    titleStr.toLowerCase().includes(word.toLowerCase())
  );
  if (hasPainWords) {
    score += 0.1;
    details.push('包含痛点词');
  }

  // 人物词检测
  const hasPersonaWords = titleRules.boost.persona_words.some(word =>
    titleStr.toLowerCase().includes(word.toLowerCase())
  );
  if (hasPersonaWords) {
    score += 0.1;
    details.push('包含人物词');
  }

  // 场景词检测
  const hasScenarios = titleRules.boost.scenarios.some(word =>
    titleStr.toLowerCase().includes(word.toLowerCase())
  );
  if (hasScenarios) {
    score += 0.1;
    details.push('包含场景词');
  }

  // 扣分项
  // 标题过长扣分
  if (titleStr.length > titleRules.penalty.too_long) {
    score -= 0.2;
    details.push(`标题过长(${titleStr.length}字)`);
  }

  // 术语堆叠扣分
  const jargonCount = titleRules.penalty.jargon.filter(word =>
    titleStr.toLowerCase().includes(word.toLowerCase())
  ).length;
  if (jargonCount > 0) {
    score -= 0.15 * jargonCount;
    details.push(`术语堆叠(${jargonCount}个)`);
  }

  // 确保分数在0-1范围内
  score = Math.max(0, Math.min(1, score));

  return { score, details };
}

/**
 * 计算新鲜度加成
 * 24小时内提供加成
 */
export function calculateFreshnessBoost(hoursSincePub: number): number {
  if (hoursSincePub < 0 || hoursSincePub > 24) {
    return 0;
  }

  // 24小时内线性衰减的加成
  const boost = 0.1 * (1 - hoursSincePub / 24);
  return Math.max(0.051, boost); // 最小0.051，确保大于0.05，最大0.1
}

/**
 * 计算小时差
 */
export function calculateHoursSincePub(pubTime: string, now: string): number {
  try {
    const pub = new Date(pubTime);
    const currentTime = new Date(now);

    if (isNaN(pub.getTime()) || isNaN(currentTime.getTime())) {
      return 0;
    }

    const diffMs = currentTime.getTime() - pub.getTime();
    return Math.max(0, diffMs / (1000 * 60 * 60)); // 转换为小时
  } catch (error) {
    return 0;
  }
}

/**
 * 主要代理热度计算函数
 * ProxyHeat (0~100) = 100 * (
 *   0.40 * TimeDecay +
 *   0.25 * AccountScore +
 *   0.20 * TitleCTRScore +
 *   0.10 * CrossPlatformBuzz +
 *   0.05 * FreshnessBoost
 * )
 */
export function calcProxyHeat(
  pubTime: string | null | undefined,
  star: number | null | undefined,
  title: string | null | undefined,
  buzz: number | null | undefined,
  now: string | null | undefined,
  weights?: Partial<HeatWeights>,
  titleRules?: TitleRules
): number {
  // 处理无效输入
  if (!pubTime || star == null || !title || buzz == null || !now) {
    return 0;
  }

  const finalWeights = { ...DEFAULT_WEIGHTS, ...weights };
  const hoursSincePub = calculateHoursSincePub(pubTime, now);

  // 计算各个组件
  const timeDecay = calculateTimeDecay(hoursSincePub);
  const accountScore = calculateAccountScore(star);
  const titleScore = calculateTitleCTRScore(title, titleRules);
  const freshnessBoost = calculateFreshnessBoost(hoursSincePub);

  // 计算最终分数
  const heat = 100 * (
    finalWeights.time_decay * timeDecay +
    finalWeights.account * accountScore +
    finalWeights.title_ctr * titleScore.score +
    finalWeights.buzz * buzz +
    finalWeights.freshness * freshnessBoost
  );

  // 确保分数在0-100范围内
  return Math.max(0, Math.min(100, Math.round(heat * 10) / 10)); // 保留1位小数
}

/**
 * 获取默认权重配置
 */
export function getDefaultWeights(): HeatWeights {
  return { ...DEFAULT_WEIGHTS };
}

/**
 * 获取默认标题规则
 */
export function getDefaultTitleRules(): TitleRules {
  return JSON.parse(JSON.stringify(DEFAULT_TITLE_RULES)); // 深拷贝
}

/**
 * 验证权重配置
 */
export function validateWeights(weights: any): boolean {
  if (!weights || typeof weights !== 'object') {
    return false;
  }

  const requiredKeys = ['time_decay', 'account', 'title_ctr', 'buzz', 'freshness'];
  for (const key of requiredKeys) {
    if (typeof weights[key] !== 'number' || weights[key] < 0 || weights[key] > 1) {
      return false;
    }
  }

  const sum = Object.values(weights).reduce((a: number, b: number) => a + b, 0);
  return Math.abs(sum - 1.0) < 0.001; // 允许小的浮点误差
}