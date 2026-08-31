"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SelectionCheckbox } from "@/components/ui/SelectionCheckbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import { ASSIGNABLE_MENUS, menuLabel } from "@/lib/menus";

type UserRow = {
  id: string;
  username: string;
  role: string;
  is_active: boolean;
  menu_perms: string[] | null;
  created_at: string;
};

function roleLabel(role: string) {
  return role === "super_admin" ? "超级管理员" : "普通用户";
}

const ALL_ASSIGNABLE_KEYS = ASSIGNABLE_MENUS.map((m) => m.key);

export function UsersManager({
  initialUsers,
  currentUserId,
}: {
  initialUsers: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();

  const [addOpen, setAddOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "super_admin">("user");
  const [newPerms, setNewPerms] = useState<string[]>(ALL_ASSIGNABLE_KEYS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pwdTarget, setPwdTarget] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const [permTarget, setPermTarget] = useState<UserRow | null>(null);
  const [permKeys, setPermKeys] = useState<string[]>([]);

  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  async function handleAdd() {
    setError(null);
    if (!username.trim()) return setError("请输入用户名");
    if (password.length < 6) return setError("密码至少 6 位");
    setBusy(true);
    const res = await fetch("/api/auth/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username.trim(),
        password,
        role,
        menu_perms: role === "super_admin" ? null : newPerms,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "创建失败");
      return;
    }
    setAddOpen(false);
    setUsername("");
    setPassword("");
    setRole("user");
    setNewPerms(ALL_ASSIGNABLE_KEYS);
    router.refresh();
  }

  async function handleResetPassword() {
    if (!pwdTarget) return;
    if (newPassword.length < 6) {
      setError("密码至少 6 位");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/auth/users/${pwdTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });
    setBusy(false);
    if (res.ok) {
      setPwdTarget(null);
      setNewPassword("");
      router.refresh();
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    const res = await fetch(`/api/auth/users/${deleteTarget.id}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (res.ok) {
      setDeleteTarget(null);
      router.refresh();
    }
  }

  function openPerms(u: UserRow) {
    setError(null);
    // menu_perms 为 null 的旧账号默认拥有全部业务菜单
    setPermKeys(u.menu_perms ?? ALL_ASSIGNABLE_KEYS);
    setPermTarget(u);
  }

  async function handleSavePerms() {
    if (!permTarget) return;
    setBusy(true);
    const res = await fetch(`/api/auth/users/${permTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menu_perms: permKeys }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "保存失败");
      return;
    }
    setPermTarget(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              新增账号
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新增账号</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="new-username">用户名 *</Label>
                <Input
                  id="new-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="用于登录的用户名"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">密码 *</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 6 位"
                />
              </div>
              <div className="space-y-2">
                <Label>角色</Label>
                <Select
                  value={role}
                  onValueChange={(v) => setRole(v as "user" | "super_admin")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">普通用户</SelectItem>
                    <SelectItem value="super_admin">超级管理员</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {role === "user" ? (
                <MenuPermPicker value={newPerms} onChange={setNewPerms} />
              ) : (
                <p className="text-sm text-gray-500">
                  超级管理员拥有全部菜单权限。
                </p>
              )}
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                取消
              </Button>
              <Button onClick={handleAdd} disabled={busy}>
                {busy ? "保存中..." : "创建"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户名</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>菜单权限</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-400">
                  暂无账号
                </TableCell>
              </TableRow>
            ) : (
              initialUsers.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.username}</TableCell>
                  <TableCell>
                    {u.role === "super_admin" ? (
                      <span className="text-amber-700">{roleLabel(u.role)}</span>
                    ) : (
                      roleLabel(u.role)
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <MenuPermsCell user={u} />
                  </TableCell>
                  <TableCell>
                    {u.is_active ? (
                      <span className="text-green-600">启用</span>
                    ) : (
                      <span className="text-gray-400">停用</span>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(u.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="配置菜单权限"
                        disabled={u.role === "super_admin"}
                        onClick={() => openPerms(u)}
                        className="disabled:opacity-40"
                      >
                        <ShieldCheck className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="重置密码"
                        onClick={() => {
                          setError(null);
                          setNewPassword("");
                          setPwdTarget(u);
                        }}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="删除"
                        disabled={u.id === currentUserId}
                        onClick={() => setDeleteTarget(u)}
                        className="text-red-500 hover:text-red-600 disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={!!pwdTarget}
        onOpenChange={(o) => !o && setPwdTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重置密码 — {pwdTarget?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="reset-password">新密码 *</Label>
              <Input
                id="reset-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="至少 6 位"
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwdTarget(null)}>
              取消
            </Button>
            <Button onClick={handleResetPassword} disabled={busy}>
              {busy ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`确认删除账号「${deleteTarget?.username}」？`}
        description="删除后该账号将无法登录，操作不可撤销。"
        confirmText="确认删除"
        loading={busy}
        onConfirm={handleDelete}
      />

      <Dialog
        open={!!permTarget}
        onOpenChange={(o) => !o && setPermTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>菜单权限 — {permTarget?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <MenuPermPicker value={permKeys} onChange={setPermKeys} />
            <p className="text-xs text-gray-400">
              未勾选的菜单不会显示，直接访问地址也会被拦截，对应的新增/修改/删除接口同步禁用。保存后对该账号立即生效。
            </p>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermTarget(null)}>
              取消
            </Button>
            <Button onClick={handleSavePerms} disabled={busy}>
              {busy ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MenuPermPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const allChecked = value.length === ALL_ASSIGNABLE_KEYS.length;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>勾选该账号可访问的菜单</span>
        <button
          type="button"
          className="text-amber-700 hover:underline"
          onClick={() => onChange(allChecked ? [] : ALL_ASSIGNABLE_KEYS)}
        >
          {allChecked ? "清空" : "全选"}
        </button>
      </div>
      <div className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto rounded-lg border p-2 sm:grid-cols-2">
        {ASSIGNABLE_MENUS.map((m) => {
          const checked = value.includes(m.key);
          return (
            <label
              key={m.key}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-gray-50"
            >
              <SelectionCheckbox
                checked={checked}
                label={m.label}
                onToggle={() =>
                  onChange(
                    checked
                      ? value.filter((k) => k !== m.key)
                      : // 按菜单顺序存储，列表展示才不会随勾选先后顺序乱掉
                        ALL_ASSIGNABLE_KEYS.filter(
                          (k) => value.includes(k) || k === m.key
                        )
                  )
                }
              />
              {m.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function MenuPermsCell({ user }: { user: UserRow }) {
  if (user.role === "super_admin") {
    return <span className="text-amber-700">全部菜单</span>;
  }
  if (user.menu_perms === null) {
    return <span className="text-gray-500">全部业务菜单（默认）</span>;
  }
  if (user.menu_perms.length === 0) {
    return <span className="text-red-500">无</span>;
  }
  return (
    <span className="text-sm text-gray-600">
      {user.menu_perms.map((k) => menuLabel(k)).join("、")}
    </span>
  );
}
