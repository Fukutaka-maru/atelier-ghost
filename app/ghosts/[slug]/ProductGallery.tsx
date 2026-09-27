"use client";

import { useEffect, useRef, useState } from "react";
import type { Product } from "../../products";

type GalleryView = "product" | "model";

export default function ProductGallery({ product }: { product: Product }) {
  const hasModelImages = Boolean(product.modelImages?.length);
  const [view, setView] = useState<GalleryView>("product");
  const [colorIndex, setColorIndex] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const wheelConsumedRef = useRef(false);
  const wheelEndTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const productImages = product.colors ? product.colors[colorIndex].images : product.images!;
  const images = view === "model" && hasModelImages ? product.modelImages! : productImages;

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: track.clientWidth * imageIndex, behavior: "smooth" });
  }, [colorIndex, imageIndex, view]);

  const selectView = (nextView: GalleryView) => {
    setView(nextView);
    setImageIndex(0);
  };

  const selectColor = (index: number) => {
    setView("product");
    setColorIndex(index);
    setImageIndex(0);
  };

  const selectImage = (index: number) => {
    const nextIndex = Math.min(images.length - 1, Math.max(0, index));
    setImageIndex(nextIndex);
  };

  const stepImage = (direction: -1 | 1) => {
    selectImage(imageIndex + direction);
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (images.length <= 1) return;
    const distance = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (Math.abs(distance) < 12) return;
    event.preventDefault();
    if (wheelEndTimerRef.current) window.clearTimeout(wheelEndTimerRef.current);
    if (!wheelConsumedRef.current) {
      wheelConsumedRef.current = true;
      stepImage(distance > 0 ? 1 : -1);
    }
    wheelEndTimerRef.current = window.setTimeout(() => {
      wheelConsumedRef.current = false;
    }, 220);
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (images.length <= 1 || !touchStartRef.current) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const deltaX = touchStartRef.current.x - touch.clientX;
    const deltaY = touchStartRef.current.y - touch.clientY;
    touchStartRef.current = null;
    if (Math.abs(deltaX) < 36 || Math.abs(deltaX) < Math.abs(deltaY) * 0.8) return;
    stepImage(deltaX > 0 ? 1 : -1);
  };

  return (
    <div className="product-gallery">
      <div
        className="product-gallery-main"
        onWheel={handleWheel}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
        }}
        onTouchEnd={handleTouchEnd}
      >
        <div className="product-gallery-track" ref={trackRef}>
          {images.map((src, index) => (
            <div className="product-gallery-slide" key={`${view}-${src}-${index}`}>
              <img src={src} alt={`${product.alt} ${index + 1}`} />
            </div>
          ))}
        </div>
      </div>
      {hasModelImages && (
        <div className="product-gallery-tabs" aria-label="画像の表示切り替え">
          <button
            type="button"
            className={view === "product" ? "is-active" : ""}
            aria-pressed={view === "product"}
            onClick={() => selectView("product")}
          >
            PRODUCT
          </button>
          <button
            type="button"
            className={view === "model" ? "is-active" : ""}
            aria-pressed={view === "model"}
            onClick={() => selectView("model")}
          >
            MODEL
          </button>
        </div>
      )}
      {images.length > 1 && (
        <div className="product-gallery-controls">
          <button
            className="product-gallery-arrow"
            type="button"
            aria-label="前の画像"
            disabled={imageIndex === 0}
            onClick={() => stepImage(-1)}
          >
            ←
          </button>
          <div className="product-gallery-dots">
            {images.map((src, index) => (
              <button
                key={src}
                className={`product-gallery-dot${index === imageIndex ? " is-active" : ""}`}
                aria-label={`画像 ${index + 1}`}
                onClick={() => selectImage(index)}
              />
            ))}
          </div>
          <button
            className="product-gallery-arrow"
            type="button"
            aria-label="次の画像"
            disabled={imageIndex === images.length - 1}
            onClick={() => stepImage(1)}
          >
            →
          </button>
        </div>
      )}
      {view === "product" && product.colors && (
        <div className="product-color-picker">
          <p className="product-color-label">{product.colors[colorIndex].name}</p>
          <div className="product-color-swatches">
            {product.colors.map((color, index) => (
              <button
                key={color.name}
                className={`product-color-swatch${index === colorIndex ? " is-active" : ""}`}
                style={{ background: color.swatch }}
                aria-label={color.name}
                aria-pressed={index === colorIndex}
                onClick={() => selectColor(index)}
              />
            ))}
          </div>
        </div>
      )}
      {view === "model" && (product.wornBy || product.wearerQuote) && (
        <section className="product-worn product-worn--model" aria-label="着用者コメント">
          {product.wornBy && <p className="product-detail-kicker">WORN BY {product.wornBy}</p>}
          {product.wearerQuote && <blockquote>「{product.wearerQuote}」</blockquote>}
        </section>
      )}
    </div>
  );
}
