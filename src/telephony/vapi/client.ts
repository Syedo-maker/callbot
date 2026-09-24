/** Minimal Vapi REST client. Never logs request bodies (they can contain phone numbers or carrier secrets). */
export class VapiApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    readonly path: string,
  ) {
    super(`Vapi ${path}: HTTP ${status} ${body.slice(0, 500)}`);
  }
}

export class VapiClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = "https://api.vapi.ai",
  ) {
    if (!apiKey) throw new Error("VAPI_API_KEY is not set (see .env.example)");
  }

  static fromEnv(): VapiClient {
    return new VapiClient(process.env.VAPI_API_KEY ?? "");
  }

  async request<T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
    const res = await fetch(this.baseUrl + path, {
      method,
      headers: { Authorization: `Bearer ${this.apiKey}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    if (!res.ok) throw new VapiApiError(res.status, text, path);
    return (text ? JSON.parse(text) : {}) as T;
  }
}
