"use client";

import { useState } from "react";
import type { Product } from "../../products";

export default function ProductGallery({ product }: { product: Product }) {
  const [colorIndex, setColorIndex] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);

  const images = product.colors ? product.colors[colorIndex].images : product.images!;

  const selectColor = (index: number) => {
    setColorIndex(index);
    setImageIndex(0);
  };

  return (
    <div className="product-gallery">
      <div className="product-gallery-main">
        <img src={images[imageIndex]} alt={product.alt} />
      </div>
      {images.length > 1 && (
        <div className="product-gallery-dots">
          {images.map((src, index) => (
            <button
              key={src}
              className={`product-gallery-dot${index === imageIndex ? " is-active" : ""}`}
              aria-label={`画像 ${index + 1}`}
              onClick={() => setImageIndex(index)}
            />
          ))}
        </div>
      )}
      {product.colors && (
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
    </div>
  );
}
