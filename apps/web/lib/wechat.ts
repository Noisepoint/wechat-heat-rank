export async function resolveBizIdFromUrl(inputUrl: string): Promise<string | null> {
  // Try to extract from query first
  try {
    const url = new URL(inputUrl);
    const direct = url.searchParams.get('__biz');
    if (direct) return direct;
  } catch {
    // ignore invalid URL here, will try fetch
  }

  const UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.40';

  try {
    // First try to get redirect location (WeChat short link usually 302 to long link with __biz)
    const res = await fetch(inputUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': UA,
        'Accept-Language': 'zh-CN,zh;q=0.9',
      } as any,
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location') || res.headers.get('Location');
      if (loc) {
        const m = /__biz=([^&]+)/.exec(loc);
        if (m) return decodeURIComponent(m[1]);
        // sometimes location is relative, try to resolve once more
        try {
          const next = new URL(loc, inputUrl).toString();
          const m2 = /__biz=([^&]+)/.exec(next);
          if (m2) return decodeURIComponent(m2[1]);
        } catch {
          // ignore
        }
      }
    }

    // Fall back: fetch page content and search for biz patterns
    const html = await res.text();
    let m =
      /__biz=([A-Za-z0-9+=/%_-]+)/.exec(html) ||
      /var\s+biz\s*=\s*\"([A-Za-z0-9+=/_-]+)\"/.exec(html) ||
      /data-user-name=\"([A-Za-z0-9@_]+)\"/.exec(html); // rarely appears
    if (m) {
      return decodeURIComponent(m[1]);
    }
  } catch {
    // ignore network errors, return null
  }
  return null;
}


