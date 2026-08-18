// 备案号必须在公开可访问页面底部悬挂，且 ICP 号需链接到工信部查询站
export function BeianFooter({ className = "" }: { className?: string }) {
  const icp = process.env.ICP_BEIAN?.trim();
  const police = process.env.POLICE_BEIAN?.trim();
  const policeCode = process.env.POLICE_BEIAN_CODE?.trim();

  if (!icp && !police) return null;

  return (
    <footer
      className={`w-full px-4 py-6 text-center text-xs leading-6 text-zinc-500 ${className}`}
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-1">
        {icp && (
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-zinc-700 hover:underline"
          >
            {icp}
          </a>
        )}
        {police && (
          <a
            href={
              policeCode
                ? `https://beian.mps.gov.cn/#/query/webSearch?code=${encodeURIComponent(
                    policeCode
                  )}`
                : "https://beian.mps.gov.cn/"
            }
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-zinc-700 hover:underline"
          >
            {police}
          </a>
        )}
      </div>
    </footer>
  );
}
