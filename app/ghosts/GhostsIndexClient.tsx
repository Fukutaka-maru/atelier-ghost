"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Product } from "../products";

const categories = [
  { value: "all", label: "ALL GHOSTS" },
  { value: "glasses", label: "GLASSES" },
  { value: "belt", label: "BELT" },
  { value: "shoes", label: "SHOES" },
  { value: "jacket", label: "JACKET" },
  { value: "tops", label: "TOPS" },
  { value: "bottoms", label: "BOTTOMS" },
  { value: "accessory", label: "ACCESSORY" },
];

function getProductThumbnail(product: Product): { src: string; alt: string } {
  const src = product.colors?.[0]?.images[0] ?? product.images?.[0] ?? "/images/products/cut-lens/deep-aqua-blue/01.png";
  return { src, alt: product.alt };
}

export default function GhostsIndexClient({ products }: { products: Product[] }) {
  const [category, setCategory] = useState("all");
  const filteredProducts = useMemo(
    () => category === "all" ? products : products.filter((product) => product.category === category),
    [category, products],
  );

  return (
    <main className="ghosts-index-page">
      <header className="ghosts-index-header">
        <Link href="/" className="ghosts-index-logo" aria-label="トップへ戻る">
          <img src="/images/atelier-ghost-logo-black-inline.png" alt="ATELIER GHOST" />
        </Link>
        <nav aria-label="商品一覧ナビゲーション">
          <Link href="/">BACK TO TOP</Link>
          <Link href="/#statement">ABOUT</Link>
          <Link href="/#cart">CART (0)</Link>
        </nav>
      </header>

      <section className="ghosts-index-hero" aria-label="商品一覧">
        <img className="ghosts-index-watermark" src="/images/atelier-ghost-logo-black-stacked.png" alt="" aria-hidden="true" />
        <div className="ghosts-index-head">
          <div>
            <span className="eyebrow">ALL GHOSTS</span>
            <h1>Objects from<br />the near future.</h1>
          </div>
          <label className="ghosts-filter">
            <span>FILTER</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((item) => (
                <option value={item.value} key={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="ghosts-index-grid">
          {filteredProducts.map((product, index) => {
            const thumb = getProductThumbnail(product);
            return (
              <article className="ghosts-index-card" key={product.slug}>
                <Link href={`/ghosts/${product.slug}`} className="ghosts-index-image">
                  <img src={thumb.src} alt={thumb.alt} />
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </Link>
                <div className="ghosts-index-meta">
                  <div>
                    <h2>{product.name}</h2>
                    <p>{product.price}</p>
                  </div>
                  <span>{product.category.toUpperCase()}</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
