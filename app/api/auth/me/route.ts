import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/users";
import { fetchUserAccess } from "@/lib/user-access";
import { resolveMenus } from "@/lib/menus";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  const access = await fetchUserAccess(session.sub);
  return NextResponse.json({
    user: {
      id: session.sub,
      username: session.username,
      role: access?.role ?? session.role,
      menus: access?.menus ?? resolveMenus(session.role, null),
    },
  });
}
