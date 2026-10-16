import { afterEach, describe, expect, it, vi } from "vitest";
import { canDispatchToGithub, dispatchResend, githubActionsUrl } from "@/server/reminders/github-dispatch";

describe("GitHub 補寄觸發", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("未設定金鑰時不可觸發，但仍提供 Actions 連結", () => {
    vi.stubEnv("GITHUB_DISPATCH_TOKEN", "");
    vi.stubEnv("RENDER_GIT_REPO_SLUG", "owner/repo");
    expect(canDispatchToGithub()).toBe(false);
    expect(githubActionsUrl()).toBe("https://github.com/owner/repo/actions/workflows/daily-reminders.yml");
  });

  it("送出 workflow_dispatch，帶入補寄 Email 與分支", async () => {
    vi.stubEnv("GITHUB_DISPATCH_TOKEN", "tok");
    vi.stubEnv("RENDER_GIT_REPO_SLUG", "owner/repo");
    vi.stubEnv("RENDER_GIT_BRANCH", "main-branch");
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await dispatchResend("eng@example.com");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.github.com/repos/owner/repo/actions/workflows/daily-reminders.yml/dispatches");
    expect(JSON.parse(String(init.body))).toEqual({ ref: "main-branch", inputs: { resend_email: "eng@example.com" } });
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("權限不足時回報清楚錯誤", async () => {
    vi.stubEnv("GITHUB_DISPATCH_TOKEN", "tok");
    vi.stubEnv("RENDER_GIT_REPO_SLUG", "owner/repo");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 403 })));
    await expect(dispatchResend("a@b.c")).rejects.toThrow(/權限不足/);
  });
});
