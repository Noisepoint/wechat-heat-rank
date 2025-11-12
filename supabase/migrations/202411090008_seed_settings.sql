-- seed default settings for weights, rules, and rate limits
insert into public.settings(key, value) values
('weights', '{
  "time_decay": 0.3,
  "account_reputation": 0.2,
  "title_ctr": 0.25,
  "cross_platform_buzz": 0.15,
  "freshness_boost": 0.1
}'::jsonb)
on conflict(key) do update set value = excluded.value, updated_at = now();

insert into public.settings(key, value) values
('time_decay_hours', '36'::jsonb),
('freshness_hours', '24'::jsonb)
on conflict(key) do update set value = excluded.value, updated_at = now();

insert into public.settings(key, value) values
('rate_limits', '{
  "daily": 3000,
  "interval_ms": 2500,
  "jitter_ms": 800,
  "slow_min_ms": 10000,
  "slow_max_ms": 20000,
  "slow_hold_minutes": 60,
  "success_restore": 10,
  "no_429_minutes": 30
}'::jsonb)
on conflict(key) do update set value = excluded.value, updated_at = now();

insert into public.settings(key, value) values
('title_rules', '{
  "boost": {
    "numbers_weight": 0.08,
    "contrast_words": ["对比", "vs", "VS", "还是", "or", "OR"],
    "contrast_weight": 0.06,
    "benefit_words": ["提效", "一键", "避坑", "升级", "速通", "模板", "指南", "全流程", "免费", "白嫖"],
    "benefit_weight": 0.10,
    "pain_words": ["翻车", "踩雷", "坑", "别再", "毁了", "血亏"],
    "pain_weight": 0.07,
    "persona_words": ["马斯克", "余承东", "OpenAI", "Claude", "Cursor", "Gemini", "Midjourney"],
    "persona_weight": 0.05,
    "scenarios": ["PPT", "会议纪要", "效率", "上班", "副业", "变现"],
    "scenarios_weight": 0.05
  },
  "penalty": {
    "too_long": 28,
    "too_long_weight": 0.08,
    "jargon": ["LoRA参数", "采样器", "温度系数", "推理token"],
    "jargon_weight": 0.06
  }
}'::jsonb)
on conflict(key) do update set value = excluded.value, updated_at = now();

insert into public.settings(key, value) values
('category_rules', '{
  "效率": ["效率", "办公", "PPT", "模板", "自动化", "纪要", "总结", "快捷"],
  "编程": ["代码", "vibe coding", "Cursor", "Claude", "API", "SDK", "部署", "Vercel", "Supabase"],
  "AIGC": ["生图", "生视频", "配音", "提示词", "模型", "LoRA", "图生图", "文生图"],
  "赚钱": ["变现", "引流", "私域", "课程", "付费", "转化", "成交"],
  "人物": ["采访", "访谈", "对谈", "观点", "经验", "案例", "成长"],
  "提示词": ["提示词", "咒语", "prompt", "模版"],
  "其他": []
}'::jsonb)
on conflict(key) do update set value = excluded.value, updated_at = now();

