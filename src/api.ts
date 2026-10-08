export async function api<T>(path:string, method='GET', body?:unknown):Promise<T> {
  const response = await fetch(`/api${path}`, {method, credentials:'same-origin', headers:body === undefined ? undefined : {'Content-Type':'application/json'}, body:body === undefined ? undefined : JSON.stringify(body)});
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || `The request failed (${response.status}). Please try again.`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function safeUrl(value:string):string|undefined {
  try { const parsed = new URL(value); return ['http:','https:'].includes(parsed.protocol) ? parsed.href : undefined; } catch { return undefined; }
}
