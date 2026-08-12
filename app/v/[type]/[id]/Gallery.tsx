"use client";

import { useState } from "react";
import Image from "next/image";

export function Gallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const prev = () => setActive((i) => (i - 1 + images.length) % images.length);
  const next = () => setActive((i) => (i + 1) % images.length);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-amber-100 to-rose-100 text-7xl">
        💎
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setZoom(true)}
        className="relative aspect-square w-full cursor-zoom-in bg-gradient-to-br from-amber-100 to-rose-100"
      >
        <Image
          src={images[active]}
          alt={title}
          fill
          sizes="(max-width: 768px) 100vw, 768px"
          className="object-cover"
          priority
        />
      </button>

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-4 pt-4">
          {images.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setActive(i)}
              className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border-2 transition ${
                i === active ? "border-amber-400" : "border-transparent opacity-70"
              }`}
            >
              <Image src={url} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      {zoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/90"
          onClick={() => setZoom(false)}
          onTouchStart={(e) => {
            setTouchStartX(e.touches[0].clientX);
            setDragging(true);
          }}
          onTouchMove={(e) => {
            if (touchStartX === null) return;
            setDragX(e.touches[0].clientX - touchStartX);
          }}
          onTouchEnd={() => {
            if (dragX > 50) prev();
            else if (dragX < -50) next();
            setTouchStartX(null);
            setDragX(0);
            setDragging(false);
          }}
        >
          <div
            className="flex h-full w-full"
            style={{
              transform: `translateX(calc(-${active * 100}% + ${dragX}px))`,
              transition: dragging ? "none" : "transform 0.3s ease-out",
            }}
          >
            {images.map((url) => (
              <div
                key={url}
                className="relative flex h-full w-full flex-shrink-0 items-center justify-center p-4"
              >
                <Image
                  src={url}
                  alt={title}
                  fill
                  sizes="100vw"
                  className="cursor-zoom-out object-contain p-4"
                />
              </div>
            ))}
          </div>
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-2xl text-white hover:bg-white/30"
                aria-label="上一张"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-2xl text-white hover:bg-white/30"
                aria-label="下一张"
              >
                ›
              </button>
              <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2">
                {images.map((url, i) => (
                  <button
                    key={url}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActive(i);
                    }}
                    className={`h-2.5 w-2.5 rounded-full ${
                      i === active ? "bg-white" : "bg-white/40"
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
