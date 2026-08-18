import { BeianFooter } from "@/components/layout/BeianFooter";

// 备案号来自运行时环境变量，禁止在构建期预渲染固化
export const dynamic = "force-dynamic";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative min-h-screen">
      {children}
      <div className="absolute inset-x-0 bottom-0">
        <BeianFooter />
      </div>
    </div>
  );
}
