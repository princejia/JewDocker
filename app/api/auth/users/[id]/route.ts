import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase-server";
import { requireSuperAdmin, hashPassword } from "@/lib/users";
import { sanitizeMenuPerms } from "@/lib/menus";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  password: z.string().min(6, "密码至少 6 位").optional(),
  role: z.enum(["super_admin", "user"]).optional(),
  is_active: z.boolean().optional(),
  // null = 恢复默认（全部业务菜单）
  menu_perms: z.array(z.string()).nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const admin = await requireSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "参数错误" },
      { status: 400 }
    );
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.password) {
    update.password_hash = await hashPassword(parsed.data.password);
  }
  if (parsed.data.role) update.role = parsed.data.role;
  if (typeof parsed.data.is_active === "boolean") {
    update.is_active = parsed.data.is_active;
  }
  if (parsed.data.menu_perms !== undefined) {
    update.menu_perms = parsed.data.menu_perms
      ? sanitizeMenuPerms(parsed.data.menu_perms)
      : null;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "无更新内容" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from("app_users")
    .update(update)
    .eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const admin = await requireSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  // 禁止删除自己，避免锁死
  if (admin.sub === params.id) {
    return NextResponse.json({ error: "不能删除当前登录账号" }, { status: 400 });
  }
  const supabase = createServerClient();
  const { error } = await supabase
    .from("app_users")
    .delete()
    .eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
