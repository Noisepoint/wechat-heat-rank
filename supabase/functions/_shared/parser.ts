import { URL } from 'node:url';

// 常用的正则表达式模式
const TIME_PATTERNS = [
  /(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/, // 2025年01月15日 10:30
  /(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/, // 2025-01-15 10:30
  /(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/, // 2025/1/15 10:30
  /(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})/, // 2025-01-15 10:30:45
];

const TIME_EXTRACT_PATTERN = /(\d{4}年\d{1,2}月\d{1,2}日\s+\d{1,2}:\d{2}(?::\d{2})?)|(\d{4}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?)|(\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?)/;

const OG_TITLE_PATTERN = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i;
const OG_DESC_PATTERN = /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i;
const OG_IMAGE_PATTERN = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i;
const H2_TITLE_PATTERN = /<h2[^>]*class=["']rich_media_title["'][^>]*>([^<]+)<\/h2>/i;
const TITLE_PATTERN = /<title[^>]*>([^<]+)<\/title>/i;
const IMG_PATTERN = /<img[^>]+src=["']([^"']+)["']/i;
const TIME_FILTER_PATTERN = /\d{4}年\d{1,2}月\d{1,2}日\s+\d{1,2}:\d{2}/;

export interface ParsedArticle {
  title: string;
  cover: string | null;
  pub_time: string;
  summary: string;
}

export function extractBizId(url: string): string {
  try {
    const parsedUrl = new URL(url);
    const bizId = parsedUrl.searchParams.get('__biz');
    if (!bizId) {
      throw new Error('URL中缺少__biz参数');
    }
    return bizId;
  } catch (error) {
    // 如果URL解析失败，尝试直接从字符串中提取__biz参数
    const bizMatch = url.match(/[?&]__biz=([^&]+)/);
    if (bizMatch && bizMatch[1]) {
      return bizMatch[1];
    }
    // 尝试从路径中提取（如 /s/__biz=Mz... 格式）
    const pathBizMatch = url.match(/\/s\/__biz=([^&?#]+)/);
    if (pathBizMatch && pathBizMatch[1]) {
      return pathBizMatch[1];
    }
    throw new Error(`无效的微信文章URL: ${url}`);
  }
}

export function parsePubTime(timeStr: string): string {
  // 尝试各种支持的时间格式
  for (const format of TIME_PATTERNS) {
    const match = timeStr.match(format);
    if (match) {
      const [, year, month, day, hour, minute, second = '00'] = match;
      const monthNum = parseInt(month);
      const dayNum = parseInt(day);
      const hourNum = parseInt(hour);
      const minuteNum = parseInt(minute);

      // 基本日期时间验证
      if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31 ||
          hourNum < 0 || hourNum > 23 || minuteNum < 0 || minuteNum > 59) {
        continue; // 跳过无效的日期时间
      }

      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:${second}Z`;
    }
  }

  throw new Error(`无效的时间格式: ${timeStr}`);
}

export function extractSummary(html: string): string {
  // 优先提取og:description
  const ogDescMatch = html.match(OG_DESC_PATTERN);
  if (ogDescMatch && ogDescMatch[1]) {
    return truncateSummary(ogDescMatch[1]);
  }

  // 如果没有og:description，提取正文首段
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    const bodyContent = bodyMatch[1];
    // 移除HTML标签
    const textContent = bodyContent.replace(/<[^>]+>/g, '');
    // 分段并找到第一段非时间、非空的文本
    const paragraphs = textContent.split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .filter(p => !TIME_FILTER_PATTERN.test(p)); // 过滤时间行
    if (paragraphs.length > 0) {
      return truncateSummary(paragraphs[0]);
    }
  }

  throw new Error('无法提取摘要');
}

function truncateSummary(text: string): string {
  // 截取到80-120字之间
  if (text.length <= 120) {
    return text;
  }

  // 尝试在117字内截断，留3个字符给省略号
  let truncated = text.substring(0, 117);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > 80) {
    truncated = truncated.substring(0, lastSpace);
  }

  const result = truncated + '...';
  // 确保最终结果不超过120字
  if (result.length > 120) {
    return truncated.substring(0, 117) + '...';
  }
  return result;
}

export function parseArticle(html: string, url: string): ParsedArticle {
  if (!html || html.trim().length === 0) {
    throw new Error('HTML内容为空');
  }

  // 提取标题 - 优先取og:title，然后是h2标题，最后是title标签
  let title = '';
  const ogTitleMatch = html.match(OG_TITLE_PATTERN);
  if (ogTitleMatch && ogTitleMatch[1]) {
    title = ogTitleMatch[1].trim();
  } else {
    const h2Match = html.match(H2_TITLE_PATTERN);
    if (h2Match && h2Match[1]) {
      title = h2Match[1].trim();
    } else {
      const titleMatch = html.match(TITLE_PATTERN);
      title = titleMatch ? titleMatch[1].trim() : '';
    }
  }

  // 提取封面图 - 优先取og:image
  let cover: string | null = null;
  const ogImageMatch = html.match(OG_IMAGE_PATTERN);
  if (ogImageMatch && ogImageMatch[1]) {
    cover = ogImageMatch[1];
  } else {
    // 如果没有og:image，尝试从body中找第一个图片
    const imgMatch = html.match(IMG_PATTERN);
    if (imgMatch && imgMatch[1]) {
      cover = imgMatch[1];
    }
  }

  // 提取发布时间
  const timeMatch = html.match(TIME_EXTRACT_PATTERN);
  let pubTime: string;
  if (timeMatch) {
    pubTime = parsePubTime(timeMatch[0]);
  } else {
    throw new Error('无法提取发布时间');
  }

  // 提取摘要
  const summary = extractSummary(html);

  return {
    title,
    cover,
    pub_time: pubTime,
    summary
  };
}