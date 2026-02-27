let interceptorInstalled = false;

function isApiRequestUrl(url) {
  if (!url) return false;
  if (url.startsWith('/api/')) return true;
  if (typeof window === 'undefined') return false;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

export function installApiAuthFetchInterceptor(supabase) {
  if (interceptorInstalled || typeof window === 'undefined' || !supabase?.auth) return;
  interceptorInstalled = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = undefined) => {
    const requestUrl = typeof input === 'string'
      ? input
      : (input instanceof URL ? input.toString() : input?.url || '');

    if (!isApiRequestUrl(requestUrl)) {
      return originalFetch(input, init);
    }

    const nextInit = init ? { ...init } : {};
    const headers = new Headers(nextInit.headers || (input instanceof Request ? input.headers : undefined));
    if (!headers.has('Authorization')) {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) headers.set('Authorization', `Bearer ${token}`);
    }
    nextInit.headers = headers;

    if (input instanceof Request) {
      const proxiedRequest = new Request(input, nextInit);
      return originalFetch(proxiedRequest);
    }

    return originalFetch(input, nextInit);
  };
}
