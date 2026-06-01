const STORAGE_PREFIX = "unlock_";

export function getStoredUnlockToken(renderId: string): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(`${STORAGE_PREFIX}${renderId}`);
}

export function storeUnlockToken(renderId: string, token: string): void {
  sessionStorage.setItem(`${STORAGE_PREFIX}${renderId}`, token);
}

export function isUnlocked(renderId: string): boolean {
  return Boolean(getStoredUnlockToken(renderId));
}

export interface UnlockResponse {
  unlocked: boolean;
  token?: string;
  paymentRequired?: boolean;
  message?: string;
}

export async function requestUnlock(
  renderId: string,
  sessionId?: string,
): Promise<UnlockResponse> {
  const res = await fetch("/api/unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ renderId, sessionId }),
  });
  const data = (await res.json()) as UnlockResponse;
  if (res.ok && data.unlocked && data.token) {
    storeUnlockToken(renderId, data.token);
    return data;
  }
  return {
    unlocked: false,
    paymentRequired: true,
    message: data.message ?? "Payment required to download.",
  };
}
