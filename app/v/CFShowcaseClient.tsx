"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type TouchEvent as ReactTouchEvent,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Gem,
  Images,
  Search,
  X,
} from "lucide-react";

export type ShowcaseItem = {
  id: string;
  type: "product" | "stone";
  code: string;
  name: string;
  category: string | null;
  images: string[];
};

type Tab = "all" | "product" | "stone";

/** 单批渲染数量：避免一次性挂载上千个 next/image 请求拖垮移动端首屏 */
const PAGE_SIZE = 60;

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "product", label: "产品" },
  { key: "stone", label: "裸石" },
];

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function CFShowcaseClient({
  products,
  stones,
}: {
  products: ShowcaseItem[];
  stones: ShowcaseItem[];
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [category, setCategory] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [activeItem, setActiveItem] = useState<ShowcaseItem | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef<number | null>(null);

  const allItems = useMemo(() => [...products, ...stones], [products, stones]);
  const totalCount = allItems.length;

  const source = useMemo(
    () => (tab === "product" ? products : tab === "stone" ? stones : allItems),
    [allItems, products, stones, tab]
  );

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    source.forEach((item) => {
      const key = item.category?.trim();
      if (!key) return;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([label]) => label);
  }, [source]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return source.filter((item) => {
      if (category && item.category?.trim() !== category) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        (item.category ?? "").toLowerCase().includes(q)
      );
    });
  }, [category, query, source]);

  const visible = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );
  const hasMore = visible.length < filtered.length;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [category, query, tab]);

  useEffect(() => {
    if (category && !categories.includes(category)) setCategory(null);
  }, [categories, category]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!hasMore || !node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => prev + PAGE_SIZE);
        }
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore]);

  const step = useCallback(
    (delta: number) => {
      const total = activeItem?.images.length ?? 0;
      if (total < 2) return;
      setActiveImage((prev) => (prev + delta + total) % total);
    },
    [activeItem]
  );

  const closePreview = useCallback(() => {
    setActiveItem(null);
    setActiveImage(0);
  }, []);

  useEffect(() => {
    if (!activeItem) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePreview();
        return;
      }
      if (event.key === "ArrowLeft") {
        step(-1);
        return;
      }
      if (event.key === "ArrowRight") {
        step(1);
        return;
      }
      if (event.key !== "Tab") return;

      // 焦点锁在弹窗内，否则 Tab 会跑到背后的网格上
      const root = dialogRef.current;
      if (!root) return;
      const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (nodes.length === 0) {
        event.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === root)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const restoreFocus = lastFocusedRef.current;
    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      restoreFocus?.focus();
    };
  }, [activeItem, closePreview, step]);

  const openPreview = (item: ShowcaseItem) => {
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    setActiveItem(item);
    setActiveImage(0);
  };

  const onTouchStart = (event: ReactTouchEvent) => {
    touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
  };

  const onTouchEnd = (event: ReactTouchEvent) => {
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;
    if (startX === null) return;
    const deltaX = (event.changedTouches[0]?.clientX ?? startX) - startX;
    if (Math.abs(deltaX) < 48) return;
    step(deltaX > 0 ? -1 : 1);
  };

  return (
    /* 圆角规则：面板与图片容器 rounded-2xl，嵌套小图 rounded-xl，可交互控件一律 rounded-full */
    <main className="showcase-theme min-h-[100dvh] bg-zinc-50 font-cn text-zinc-900">
      <header className="mx-auto w-full max-w-[1400px] px-4 pb-7 pt-10 sm:px-6 lg:px-8 lg:pt-14">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          C&amp;F 珠宝
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-500">
          公开展示目录，收录 {totalCount} 件产品与裸石实拍。点击任意图片查看大图与细节。
        </p>
      </header>

      <div className="sticky top-0 z-30 border-y border-zinc-200 bg-zinc-50/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div
            role="tablist"
            aria-label="展示类型"
            className="inline-flex rounded-full border border-zinc-200 bg-white p-1"
          >
            {TABS.map((option) => {
              const selected = tab === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setTab(option.key)}
                  className={`rounded-full px-4 py-1.5 text-sm transition active:scale-[0.98] ${
                    selected
                      ? "bg-[var(--sc-accent)] text-white"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <label className="relative block min-w-[180px] flex-1 sm:max-w-xs">
            <span className="sr-only">搜索编号、名称或品类</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索编号、名称或品类"
              className="h-10 w-full rounded-full border border-zinc-200 bg-white pl-9 pr-4 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-500 focus:border-[var(--sc-accent)] focus:ring-2 focus:ring-[var(--sc-accent-ring)]"
            />
          </label>

          <p
            aria-live="polite"
            className="ml-auto whitespace-nowrap text-sm text-zinc-500"
          >
            共 {filtered.length} 件
          </p>
        </div>
      </div>

      <section className="mx-auto w-full max-w-[1400px] px-4 pb-20 pt-6 sm:px-6 lg:px-8">
        {categories.length > 0 && (
          <div className="-mx-1 mb-6 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
            <button
              type="button"
              onClick={() => setCategory(null)}
              aria-pressed={category === null}
              className={`snap-start whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition ${
                category === null
                  ? "border-[var(--sc-accent)] bg-[var(--sc-accent)] text-white"
                  : "border-zinc-200 bg-white text-zinc-600 hover:text-zinc-900"
              }`}
            >
              全部品类
            </button>
            {categories.map((label) => {
              const selected = category === label;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setCategory(selected ? null : label)}
                  aria-pressed={selected}
                  className={`snap-start whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition ${
                    selected
                      ? "border-[var(--sc-accent)] bg-[var(--sc-accent)] text-white"
                      : "border-zinc-200 bg-white text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {totalCount === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-16 text-center">
            <Gem className="mx-auto h-10 w-10 text-zinc-300" />
            <p className="mt-4 text-zinc-600">目录还没有内容，稍后再来看看。</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-16 text-center">
            <Search className="mx-auto h-10 w-10 text-zinc-300" />
            <p className="mt-4 text-zinc-600">
              没有匹配「{query.trim() || category}」的结果。
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCategory(null);
              }}
              className="mt-5 rounded-full bg-[var(--sc-accent)] px-5 py-2 text-sm text-white transition active:translate-y-[1px]"
            >
              清除筛选
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {visible.map((item, index) => {
                const cover = item.images[0];

                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    type="button"
                    onClick={() => openPreview(item)}
                    className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left transition hover:border-zinc-300 hover:shadow-[0_14px_36px_-20px_rgba(24,24,27,0.5)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sc-accent)]"
                  >
                    <div className="relative aspect-square overflow-hidden bg-zinc-100">
                      {cover ? (
                        <Image
                          src={cover}
                          alt={item.name}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
                          priority={index < 10}
                          className="object-cover transition duration-500 group-hover:scale-[1.04]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-zinc-300">
                          <Gem className="h-10 w-10" />
                        </div>
                      )}

                      {tab === "all" && (
                        <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] text-zinc-700">
                          {item.type === "product" ? "产品" : "裸石"}
                        </span>
                      )}

                      {item.images.length > 1 && (
                        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-zinc-900/75 px-2 py-0.5 text-[10px] text-white">
                          <Images className="h-3 w-3" />
                          {item.images.length}
                        </span>
                      )}
                    </div>

                    <div className="p-3">
                      <p className="font-mono text-[11px] tracking-wide text-zinc-400">
                        {item.code}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm font-medium leading-6">
                        {item.name}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {hasMore && (
              <div ref={sentinelRef} className="mt-10 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                  className="rounded-full border border-zinc-300 bg-white px-6 py-2.5 text-sm text-zinc-700 transition hover:border-[var(--sc-accent)] hover:text-[var(--sc-accent)] active:translate-y-[1px]"
                >
                  加载更多 · 剩余 {filtered.length - visible.length} 件
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {activeItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/90 p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${activeItem.code} ${activeItem.name} 图片预览`}
          onClick={closePreview}
        >
          <div
            ref={dialogRef}
            tabIndex={-1}
            className="relative flex h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-zinc-950 outline-none"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closePreview}
              className="absolute right-3 top-3 z-10 rounded-full bg-zinc-950/60 p-2 text-white transition hover:bg-zinc-950 active:scale-[0.96]"
              aria-label="关闭"
            >
              <X className="h-5 w-5" />
            </button>

            <div
              className="relative flex-1 bg-black"
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              {activeItem.images.length > 0 ? (
                <Image
                  src={activeItem.images[activeImage]}
                  alt={`${activeItem.name} 第 ${activeImage + 1} 张`}
                  fill
                  sizes="100vw"
                  className="object-contain"
                  priority
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-zinc-600">
                  <Gem className="h-12 w-12" />
                </div>
              )}

              {activeItem.images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    aria-label="上一张"
                    className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-zinc-950/50 p-2 text-white transition hover:bg-zinc-950 sm:inline-flex"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    aria-label="下一张"
                    className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-zinc-950/50 p-2 text-white transition hover:bg-zinc-950 sm:inline-flex"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>

                  <span
                    aria-live="polite"
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 font-mono text-xs text-white backdrop-blur"
                  >
                    {activeImage + 1} / {activeItem.images.length}
                  </span>
                </>
              )}
            </div>

            <div className="border-t border-zinc-800 bg-zinc-950 p-4 text-white">
              <p className="font-mono text-xs text-zinc-400">{activeItem.code}</p>
              <p className="mt-1 text-base">{activeItem.name}</p>

              {activeItem.images.length > 1 && (
                <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
                  {activeItem.images.map((imageUrl, index) => (
                    <button
                      key={`${activeItem.id}-${index}`}
                      type="button"
                      onClick={() => setActiveImage(index)}
                      aria-label={`查看第 ${index + 1} 张`}
                      aria-current={index === activeImage}
                      className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                        index === activeImage
                          ? "border-white"
                          : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      <Image
                        src={imageUrl}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
