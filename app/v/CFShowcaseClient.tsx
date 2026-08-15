"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Gem,
  Search,
  Sparkles,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
} from "lucide-react";

export type ShowcaseItem = {
  id: string;
  type: "product" | "stone";
  code: string;
  name: string;
  images: string[];
};

type Tab = "all" | "product" | "stone";

export function CFShowcaseClient({
  products,
  stones,
  headingClassName,
  bodyClassName,
}: {
  products: ShowcaseItem[];
  stones: ShowcaseItem[];
  headingClassName: string;
  bodyClassName: string;
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [activeItem, setActiveItem] = useState<ShowcaseItem | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  const allItems = useMemo(() => [...products, ...stones], [products, stones]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const source =
      tab === "product" ? products : tab === "stone" ? stones : allItems;

    if (!q) return source;

    return source.filter((item) => {
      const name = item.name.toLowerCase();
      const code = item.code.toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [allItems, products, query, stones, tab]);

  useEffect(() => {
    if (!activeItem) return;

    const total = activeItem.images.length;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveItem(null);
        return;
      }
      if (total < 2) return;
      if (event.key === "ArrowLeft") {
        setActiveImage((prev) => (prev - 1 + total) % total);
      }
      if (event.key === "ArrowRight") {
        setActiveImage((prev) => (prev + 1) % total);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      lastFocusedRef.current?.focus();
    };
  }, [activeItem]);

  const openPreview = (item: ShowcaseItem) => {
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    setActiveItem(item);
    setActiveImage(0);
  };

  const closePreview = () => {
    setActiveItem(null);
    setActiveImage(0);
  };

  const totalCount = allItems.length;

  return (
    <main
      className={`${bodyClassName} relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#f7efe4_0%,_#fcfaf7_45%,_#f4f1ed_100%)] text-stone-900`}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-rose-200/30 blur-3xl" />
      </div>

      <section className="relative mx-auto w-full max-w-7xl px-4 pb-14 pt-10 sm:px-6 lg:px-8 lg:pt-14">
        <div className="rounded-3xl border border-amber-100/70 bg-white/85 p-8 shadow-[0_20px_80px_-30px_rgba(120,86,34,0.35)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-amber-300/70 bg-amber-50 px-3 py-1 text-xs tracking-[0.2em] text-amber-800">
                <Sparkles className="h-3.5 w-3.5" />
                C&F JEWELRY COLLECTION
              </p>
              <h1
                className={`${headingClassName} mt-4 text-4xl font-semibold leading-tight text-stone-900 sm:text-5xl`}
              >
                C&amp;F 珠宝
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600 sm:text-base">
                公共展示主页，精选呈现产品与裸石。可按编号或名称检索，点击任意图片即可放大查看细节。
              </p>
            </div>

            <div className="grid min-w-[220px] grid-cols-2 gap-3 text-center">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xs tracking-wider text-stone-500">产品</p>
                <p className="mt-1 text-2xl font-semibold text-stone-900">
                  {products.length}
                </p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                <p className="text-xs tracking-wider text-stone-500">裸石</p>
                <p className="mt-1 text-2xl font-semibold text-stone-900">
                  {stones.length}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="inline-flex rounded-full border border-stone-200 bg-stone-50 p-1">
              {[
                { key: "all", label: "全部" },
                { key: "product", label: "产品" },
                { key: "stone", label: "裸石" },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setTab(option.key as Tab)}
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    tab === option.key
                      ? "bg-stone-900 text-white shadow"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <label className="relative block w-full max-w-md">
              <span className="sr-only">搜索编号或名称</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索编号或名称"
                className="h-11 w-full rounded-full border border-stone-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
              />
            </label>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between text-sm text-stone-500">
          <p>当前展示 {filtered.length} 件</p>
          <p>总计 {totalCount} 件</p>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-stone-300 bg-white/70 p-12 text-center">
            <Gem className="mx-auto h-10 w-10 text-stone-400" />
            <p className="mt-4 text-stone-600">未找到匹配结果，请更换关键词。</p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map((item) => {
              const cover = item.images[0];

              return (
                <button
                  key={`${item.type}-${item.id}`}
                  type="button"
                  onClick={() => openPreview(item)}
                  className="group overflow-hidden rounded-2xl border border-stone-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="relative aspect-square overflow-hidden bg-stone-100">
                    {cover ? (
                      <Image
                        src={cover}
                        alt={item.name}
                        fill
                        sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
                        className="object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-100 to-amber-100 text-stone-400">
                        <Gem className="h-10 w-10" />
                      </div>
                    )}

                    <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[10px] tracking-wider text-white">
                      {item.type === "product" ? "产品" : "裸石"}
                    </span>
                    <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] text-stone-700">
                      <ZoomIn className="h-3 w-3" />
                      放大
                    </span>
                  </div>

                  <div className="p-3">
                    <p className="font-mono text-[11px] tracking-wide text-stone-400">
                      {item.code}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm font-medium leading-6 text-stone-900">
                      {item.name}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {activeItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="图片预览"
          onClick={closePreview}
        >
          <div
            ref={dialogRef}
            tabIndex={-1}
            className="relative flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-stone-950 outline-none"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closePreview}
              className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-2 text-white transition hover:bg-black"
              aria-label="关闭"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="relative flex-1 bg-black">
              {activeItem.images.length > 0 ? (
                <Image
                  src={activeItem.images[activeImage]}
                  alt={activeItem.name}
                  fill
                  sizes="100vw"
                  className="object-contain"
                  priority
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-stone-500">
                  <Gem className="h-12 w-12" />
                </div>
              )}
            </div>

            <div className="border-t border-stone-800 bg-stone-950 p-4 text-white">
              <p className="font-mono text-xs text-stone-400">{activeItem.code}</p>
              <p className="mt-1 text-base">{activeItem.name}</p>

              {activeItem.images.length > 1 && (
                <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
                  {activeItem.images.map((imageUrl, index) => (
                    <button
                      key={`${activeItem.id}-${index}`}
                      type="button"
                      onClick={() => setActiveImage(index)}
                      className={`relative h-14 w-14 overflow-hidden rounded-lg border-2 ${
                        index === activeImage
                          ? "border-amber-400"
                          : "border-transparent opacity-70"
                      }`}
                    >
                      <Image
                        src={imageUrl}
                        alt={`${activeItem.name} ${index + 1}`}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {activeItem.images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setActiveImage(
                      (prev) =>
                        (prev - 1 + activeItem.images.length) %
                        activeItem.images.length
                    )
                  }
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition hover:bg-black"
                  aria-label="上一张"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveImage(
                      (prev) => (prev + 1) % activeItem.images.length
                    )
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition hover:bg-black"
                  aria-label="下一张"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
