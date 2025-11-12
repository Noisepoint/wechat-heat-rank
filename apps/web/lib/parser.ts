// Lightweight client-side util for extracting WeChat __biz id from a URL
export function extractBizId(url: string): string {
  try {
    const parsed = new URL(url);
    const biz = parsed.searchParams.get('__biz');
    if (biz) return biz;
  } catch {
    // ignore and try regex based extraction below
  }
  // Fallback: directly match from query string
  const m1 = url.match(/[?&]__biz=([^&]+)/);
  if (m1 && m1[1]) return m1[1];
  // Fallback: sometimes appears in path like /s/__biz=xxxx
  const m2 = url.match(/\\/s\\/__biz=([^&?#]+)/);
  if (m2 && m2[1]) return m2[1];
  throw new Error(`Invalid WeChat article URL: ${url}`);
}


