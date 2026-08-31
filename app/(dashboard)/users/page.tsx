import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase-server";
import { requireSuperAdmin } from "@/lib/users";
import { UsersManager } from "@/components/users/UsersManager";

export const dynamic = "force-dynamic";

type UserRow = {
  id: string;
  username: string;
  role: string;
  is_active: boolean;
  menu_perms: string[] | null;
  created_at: string;
};

export default async function UsersPage() {
  const admin = await requireSuperAdmin();
  if (!admin) redirect("/");

  const supabase = createServerClient();
  const { data } = await supabase
    .from("app_users")
    .select("id, username, role, is_active, menu_perms, created_at")
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">账号管理</h1>
      <UsersManager
        initialUsers={(data ?? []) as UserRow[]}
        currentUserId={admin.sub}
      />
    </div>
  );
}
