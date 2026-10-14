/**
 * 建立（或重設）管理員帳號。
 *
 * 互動式：npm run admin:create
 * 非互動：ADMIN_EMAIL=... ADMIN_NAME=... ADMIN_PASSWORD=... npm run admin:create
 * 重設既有帳號密碼：加上 --reset
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { prisma } from "../src/lib/db";
import { hashPassword, validatePasswordStrength } from "../src/server/auth/password";
import { writeAudit } from "../src/server/audit/audit";

async function ask(rl: ReturnType<typeof createInterface>, q: string, fallback?: string) {
  if (fallback) return fallback;
  return (await rl.question(q)).trim();
}

async function main() {
  const reset = process.argv.includes("--reset");
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const email = (await ask(rl, "管理員 Email：", process.env.ADMIN_EMAIL)).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Email 格式錯誤");
    const name = await ask(rl, "姓名（預設：系統管理員）：", process.env.ADMIN_NAME) || "系統管理員";
    const password = await ask(rl, "密碼（至少 10 碼，含英文與數字）：", process.env.ADMIN_PASSWORD);
    const err = validatePasswordStrength(password);
    if (err) throw new Error(err);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && !reset) throw new Error("此 Email 已存在；如需重設密碼並設為管理員請加上 --reset");
    const passwordHash = await hashPassword(password);
    const user = existing
      ? await prisma.user.update({ where: { id: existing.id }, data: { passwordHash, role: "ADMIN", isActive: true, failedLoginCount: 0, lockedUntil: null, passwordChangedAt: new Date() } })
      : await prisma.user.create({ data: { email, name, role: "ADMIN", passwordHash, passwordChangedAt: new Date(), reminderPreference: { create: {} } } });
    if (existing) await prisma.session.deleteMany({ where: { userId: user.id } });
    await writeAudit({ actorId: null, action: existing ? "ADMIN_RESET_CLI" : "ADMIN_CREATE_CLI", entityType: "User", entityId: user.id, summary: `以命令列${existing ? "重設" : "建立"}管理員 ${email}` });
    console.log(`✓ 已${existing ? "重設" : "建立"}管理員：${email}`);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
