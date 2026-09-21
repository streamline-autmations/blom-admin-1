import { supabase } from '@/lib/supabase';

/**
 * Sends the signed-in admin's access token with every internal function call.
 *
 * The serverless functions use the Supabase service-role key, which bypasses row
 * level security, so each one now requires an owner or staff session. Call sites
 * are spread across dozens of pages, so the token is attached here in one place
 * rather than at each fetch.
 *
 * Requests to anywhere else are passed through untouched.
 */
const FUNCTIONS_PREFIX = '/.netlify/functions/';

const requestUrl = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input?.url ?? '';
};

export function attachAdminAuthToFunctionCalls(): void {
  if (typeof window === 'undefined') return;
  if ((window as any).__adminAuthFetchInstalled) return;
  (window as any).__adminAuthFetchInstalled = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = requestUrl(input);
    const isFunctionCall =
      url.startsWith(FUNCTIONS_PREFIX) || url.includes(`${window.location.origin}${FUNCTIONS_PREFIX}`);

    if (!isFunctionCall) return originalFetch(input, init);

    let token: string | undefined;
    try {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token;
    } catch (error) {
      console.warn('Could not read admin session for function call:', error);
    }

    if (!token) return originalFetch(input, init);

    // Respect an Authorization header the caller set explicitly.
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);

    if (input instanceof Request && !init) {
      return originalFetch(new Request(input, { headers }));
    }
    return originalFetch(input, { ...init, headers });
  };
}
