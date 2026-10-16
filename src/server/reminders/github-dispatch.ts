/**
 * 透過 GitHub Actions「每日提醒」流程補寄（網站本身無法寄信時使用）。
 * 需於網站環境變數設定 GITHUB_DISPATCH_TOKEN（僅具該儲存庫 Actions 讀寫權限之 fine-grained token）。
 */
export function githubRepoSlug(): string | null {
  return process.env.GITHUB_REPOSITORY ?? process.env.RENDER_GIT_REPO_SLUG ?? null;
}

export function githubActionsUrl(): string | null {
  const slug = githubRepoSlug();
  return slug ? `https://github.com/${slug}/actions/workflows/daily-reminders.yml` : null;
}

export const canDispatchToGithub = () => !!process.env.GITHUB_DISPATCH_TOKEN && !!githubRepoSlug();

export async function dispatchResend(email: string): Promise<void> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const slug = githubRepoSlug();
  if (!token || !slug) throw new Error("尚未設定 GitHub 補寄連線");
  const ref = process.env.GITHUB_DISPATCH_REF ?? process.env.RENDER_GIT_BRANCH ?? "main";
  const res = await fetch(`https://api.github.com/repos/${slug}/actions/workflows/daily-reminders.yml/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref, inputs: { resend_email: email } }),
  });
  if (!res.ok) {
    const hint = res.status === 401 || res.status === 403 ? "（GitHub 金鑰無效或權限不足）" : res.status === 404 ? "（找不到儲存庫或流程，或金鑰沒有此儲存庫權限）" : "";
    throw new Error(`GitHub 回應 ${res.status}${hint}`);
  }
}
