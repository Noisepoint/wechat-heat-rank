// 默认分类关键词规则
export const DEFAULT_CATEGORY_RULES = {
  "效率": ["效率", "办公", "PPT", "模板", "自动化", "纪要", "总结", "快捷"],
  "编程": ["代码", "vibe coding", "Cursor", "Claude", "API", "SDK", "部署", "Vercel", "Supabase"],
  "AIGC": ["生图", "生视频", "配音", "提示词", "模型", "LoRA", "图生图", "文生图", "AI", "aigc", "人工智能", "机器学习", "深度学习", "自动化生成"],
  "赚钱": ["变现", "引流", "私域", "课程", "付费", "转化", "成交"],
  "人物": ["采访", "访谈", "对谈", "观点", "经验", "案例", "成长"],
  "提示词": ["提示词", "咒语", "prompt", "模版"],
  "其他": []
};

export interface CategoryRules {
  [category: string]: string[];
}

/**
 * 基于关键词规则对文章进行分类
 * @param title 文章标题
 * @param summary 文章摘要
 * @param customRules 自定义分类规则（可选）
 * @returns 匹配的分类标签数组
 */
export function classifyArticle(
  title: string | null | undefined,
  summary: string | null | undefined,
  customRules?: CategoryRules
): string[] {
  // 处理无效输入
  const safeTitle = (title || '').toString().trim();
  const safeSummary = (summary || '').toString().trim();

  // 如果标题和摘要都为空，返回默认分类
  if (!safeTitle && !safeSummary) {
    return ['其他'];
  }

  // 合并标题和摘要进行匹配
  const content = `${safeTitle} ${safeSummary}`.toLowerCase();
  const rules = customRules || DEFAULT_CATEGORY_RULES;
  const matchedTags: string[] = [];

  // 遍历每个分类和关键词
  Object.entries(rules).forEach(([category, keywords]) => {
    // 跳过"其他"分类（作为默认分类）
    if (category === '其他' || keywords.length === 0) {
      return;
    }

    // 检查是否有任何关键词匹配
    const hasMatch = keywords.some(keyword => {
      const safeKeyword = keyword.toLowerCase();
      return content.includes(safeKeyword);
    });

    if (hasMatch) {
      matchedTags.push(category);
    }
  });

  // 如果没有匹配到任何分类，返回"其他"
  if (matchedTags.length === 0) {
    return ['其他'];
  }

  // 去重并返回
  return [...new Set(matchedTags)];
}

/**
 * 获取默认分类规则
 * @returns 默认分类规则对象
 */
export function getDefaultRules(): CategoryRules {
  return { ...DEFAULT_CATEGORY_RULES };
}

/**
 * 验证分类规则的有效性
 * @param rules 分类规则
 * @returns 验证结果
 */
export function validateCategoryRules(rules: CategoryRules): boolean {
  if (!rules || typeof rules !== 'object') {
    return false;
  }

  // 检查每个分类
  for (const [category, keywords] of Object.entries(rules)) {
    if (typeof category !== 'string' || !Array.isArray(keywords)) {
      return false;
    }

    // 检查每个关键词
    for (const keyword of keywords) {
      if (typeof keyword !== 'string') {
        return false;
      }
    }
  }

  return true;
}