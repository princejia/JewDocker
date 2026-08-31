import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase-server";
import { requireSuperAdmin, hashPassword, AppUser } from "@/lib/users";
import { sanitizeMenuPerms } from "@/lib/menus";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  username: z.string().trim().min(1, "请输入用户名").max(100),
  password: z.string().min(6, "密码至少 6 位"),
  role: z.enum(["super_admin", "user"]).default("user"),
  menu_perms: z.array(z.string()).nullable().optional(),
});

export async function GET() {
  const admin = await requireSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  const supabase = createServerClient();
  const { data } = await supabase
    .from("app_users")
    .select("id, username, role, is_active, menu_perms, created_at")
    .order("created_at", { ascending: true });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: Request) {
  const admin = await requireSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "参数错误" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();
  const { data: existing } = await supabase
    .from("app_users")
    .select("id")
    .eq("username", parsed.data.username)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "用户名已存在" }, { status: 409 });
  }

  const password_hash = await hashPassword(parsed.data.password);
  const { data, error } = await supabase
    .from("app_users")
    .insert({
      username: parsed.data.username,
      password_hash,
      role: parsed.data.role,
      menu_perms: parsed.data.menu_perms
        ? sanitizeMenuPerms(parsed.data.menu_perms)
        : null,
    })
    .select("id, username, role, is_active, menu_perms, created_at")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data as Partial<AppUser> }, { status: 201 });
}
