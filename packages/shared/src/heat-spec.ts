// 代理热度计算的默认配置

// 默认权重 (settings.key = 'heat_weights')
export const DEFAULT_HEAT_WEIGHTS = {
  time_decay: 0.40,
  account: 0.25,
  title_ctr: 0.20,
  buzz: 0.10,
  freshness: 0.05
};

// 标题要素词表 (settings.key = 'title_rules')
export const DEFAULT_TITLE_RULES = {
  boost: {
    numbers: true,
    contrast_words: ["对比","vs","VS","还是","or","OR"],
    benefit_words: ["提效","一键","白嫖","免费","避坑","升级","速通","模板","指南","全流程"],
    pain_words: ["翻车","踩雷","坑","别再","毁了","血亏"],
    persona_words: ["马斯克","余承东","OpenAI","Claude","Cursor","Gemini","Midjourney"],
    scenarios: ["PPT","会议纪要","效率","上班","面试","副业","变现"]
  },
  penalty: {
    too_long: 28,
    jargon: ["LoRA参数","采样器","温度系数","推理token"]
  }
};

// 时间参数
export const DEFAULT_TIME_DECAY_HOURS = 36;
export const DEFAULT_FRESHNESS_HOURS = 24;

// 限流配置 (settings.key = 'rate_limits')
export const DEFAULT_RATE_LIMITS = {
  daily: 3000,
  interval_ms: 2500,
  jitter_ms: 800,
  slow_min_ms: 10000,
  slow_max_ms: 20000,
  slow_hold_minutes: 60,
  success_restore: 10,
  no_429_minutes: 30
};

// 词表权重（示例，非刚性）(settings.key = 'title_rules' 的增强版)
export const DEFAULT_TITLE_RULES_WITH_WEIGHTS = {
  boost: {
    numbers_weight: 0.08,
    contrast_words: ["对比","vs","VS","还是","or","OR"],
    contrast_weight: 0.06,
    benefit_words: ["提效","一键","避坑","升级","速通","模板","指南","全流程","免费","白嫖"],
    benefit_weight: 0.10,
    pain_words: ["翻车","踩雷","坑","别再","毁了","血亏"],
    pain_weight: 0.07,
    persona_words: ["马斯克","余承东","OpenAI","Claude","Cursor","Gemini","Midjourney"],
    persona_weight: 0.05,
    scenarios: ["PPT","会议纪要","效率","上班","副业","变现"],
    scenarios_weight: 0.05
  },
  penalty: {
    too_long: 28,
    too_long_weight: 0.08,
    jargon: ["LoRA参数","采样器","温度系数","推理token"],
    jargon_weight: 0.06
  }
};