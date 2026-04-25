import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

/**
 * LazyImage
 * ---------
 * Loads `src` only when the placeholder div scrolls within `rootMargin` of
 * the viewport.  Until then the browser never touches the network for that
 * image, keeping simultaneous requests to 2-3 at most regardless of chapter
 * length.
 *
 * Props
 *   src        – real image URL
 *   alt        – alt text
 *   className  – extra classes forwarded to <img>
 *   rootMargin – how far ahead to start loading (default: 400px)
 *   aspectRatio– placeholder aspect ratio while image is unknown (default: "2/3")
 */
export default function LazyImage({
  src,
  alt,
  className,
  rootMargin = "400px 0px",
  aspectRatio = "auto",
}) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);

  // "idle"    → not yet observed to be near viewport
  // "loading" → src assigned, waiting for browser decode
  // "loaded"  → image fully decoded and painted
  // "error"   → network or decode failure
  const [status, setStatus] = useState("idle");

  // ── 1. Intersection observer — flip to "loading" once near viewport ────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !src) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStatus((prev) => (prev === "idle" ? "loading" : prev));
          observer.unobserve(el);
        }
      },
      { rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [src, rootMargin]);

  // ── 2. When status becomes "loading", imperatively set src on <img> ────────
  //    We use an imperative approach (not just a conditional src attribute) so
  //    React never mounts the <img> at all while status === "idle", which
  //    guarantees zero network activity before intersection.
  useEffect(() => {
    if (status !== "loading") return;
    const img = imgRef.current;
    if (!img) return;

    if (img.complete && img.naturalWidth > 0) {
      // Already cached by the browser
      setStatus("loaded");
      return;
    }

    const handleLoad = () => setStatus("loaded");
    const handleError = () => setStatus("error");

    img.addEventListener("load", handleLoad);
    img.addEventListener("error", handleError);
    img.src = src;

    return () => {
      img.removeEventListener("load", handleLoad);
      img.removeEventListener("error", handleError);
    };
  }, [status, src]);

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-gray-900"
      style={{ aspectRatio: status === "loaded" ? "auto" : aspectRatio }}
    >
      {/* ── Skeleton placeholder (shown while idle or loading) ─────────────── */}
      {status !== "loaded" && status !== "error" && (
        <div
          className={clsx(
            "absolute inset-0 flex flex-col items-center justify-center gap-3",
            status === "idle" ? "bg-gray-900" : "bg-gray-900",
          )}
          aria-hidden="true"
        >
          {/* Shimmer bar strip */}
          <div className="w-full h-full relative overflow-hidden">
            {/* Base grey fill */}
            <div className="absolute inset-0 bg-gray-800" />
            {/* Animated shimmer sweep */}
            <div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-700/40 to-transparent animate-shimmer"
              style={{
                backgroundSize: "200% 100%",
                animation: "shimmer 1.6s infinite linear",
              }}
            />
            {/* Centered spinner while actually loading */}
            {status === "loading" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-gray-700 border-t-manga-500 animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Error state ────────────────────────────────────────────────────── */}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-900 text-gray-600 select-none">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-10 h-10 opacity-40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75M12 15.75h.008M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15A2.25 2.25 0 002.25 6.75v10.5A2.25 2.25 0 004.5 19.5z"
            />
          </svg>
          <span className="text-xs">Failed to load page</span>
          <button
            className="text-xs text-manga-400 hover:text-manga-300 underline"
            onClick={() => setStatus("loading")}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── The actual <img> — only rendered once loading begins ───────────── */}
      {(status === "loading" || status === "loaded") && (
        <img
          ref={imgRef}
          alt={alt}
          className={clsx(
            "w-full block transition-opacity duration-300",
            status === "loaded" ? "opacity-100" : "opacity-0",
            className,
          )}
          // src is set imperatively in the useEffect above, NOT as a JSX prop,
          // which prevents React from causing a second redundant request.
          draggable={false}
        />
      )}

      {/* Global shimmer keyframe — injected once via a <style> tag */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
      `}</style>
    </div>
  );
}
