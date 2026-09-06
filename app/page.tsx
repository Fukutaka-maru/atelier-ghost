"use client";

import { useEffect, useRef, useState } from "react";

const products = [
  { name: "GHOST 001", price: "¥78,000 JPY", image: "/images/look-001.png", alt: "深い赤の背景で眼鏡をかけたモデル" },
  { name: "GHOST 002", price: "¥62,000 JPY", image: "/images/look-002.png", alt: "ブラウンの背景でサングラスをかけたモデル" },
  { name: "GHOST 003", price: "¥48,000 JPY", image: "/images/look-003.png", alt: "ネイビーの背景で淡いドレスを着たモデル" },
];

const statement = [
  "まだ存在しないけれど、存在してほしいと願うもの。",
  "どう作るかより先に、何が欲しいかを考える。",
  "素材も、構造も、つくり方も、最初から現実に合わせなくていい。",
  "ATELIER GHOSTは、そんな「存在してほしいもの」をデザインする。",
  "まだ形を持たないそれらを、私たちは GHOST と呼ぶ。",
  "誰かが欲しいと思う。誰かが心を動かされる。誰かが存在を願う。",
  "その願いが重なったとき、GHOSTは現実になるかもしれない。",
  "まだ存在しないものを、存在してほしいと願うところから。",
];

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <img
      className={`logo-img${compact ? " logo-img--inline" : " logo-img--stacked"}`}
      src={compact ? "/images/atelier-ghost-logo-white-inline.png" : "/images/atelier-ghost-logo-white-stacked.png"}
      alt="ATELIER GHOST"
    />
  );
}

function Bookmark({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button className={`bookmark${active ? " is-saved" : ""}`} onClick={onClick} aria-label={active ? "保存から外す" : "保存する"} aria-pressed={active}>
      <span aria-hidden="true" />
    </button>
  );
}

export default function Home() {
  const [statementVisible, setStatementVisible] = useState(false);
  const [saved, setSaved] = useState<number[]>([]);
  const statementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const target = statementRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => setStatementVisible(entry.isIntersecting), { threshold: 0.42 });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const toggleSaved = (index: number) => {
    setSaved((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index]);
  };

  return (
    <main className="site-shell">
      <section className="hero snap-panel" id="top" aria-label="Atelier Ghost campaign">
        <img className="hero-image" src="/images/hero.png" alt="青いリムレスサングラスをかけ、透明な泡に囲まれた女性" />
        <div className="hero-shade" />
        <header className="site-header">
          <a href="#top" className="header-logo"><Logo compact /></a>
          <nav aria-label="メインナビゲーション">
            <a href="#ghosts">GHOSTS</a>
            <a href="#statement">ABOUT</a>
            <a href="#journal">JOURNAL</a>
            <a href="#cart">CART (0)</a>
          </nav>
        </header>
        <div className="hero-copy">
          <p>THINGS WE</p>
          <p>WISH EXISTED.</p>
        </div>
        <a className="hero-product-link" href="#ghosts">商品を見る <span aria-hidden="true">→</span></a>
        <a className="scroll-cue" href="#statement" aria-label="ステートメントへスクロール">
          <span>SCROLL</span><i aria-hidden="true" />
        </a>
      </section>

      <section ref={statementRef} className={`statement snap-panel${statementVisible ? " is-visible" : ""}`} id="statement">
        <img className="statement-bg" src="/images/statement-bg.png" alt="" aria-hidden="true" />
        <div className="statement-vignette" />
        <div className="statement-copy">
          <Logo />
          <div className="statement-lines">
            {statement.map((line, index) => <p key={line} style={{ "--line": index } as React.CSSProperties}>{line}</p>)}
          </div>
        </div>
        <a className="continue-cue" href="#ghosts"><span>DISCOVER THE GHOSTS</span><i aria-hidden="true" /></a>
      </section>

      <section className="collection snap-panel" id="ghosts">
        <div className="collection-head">
          <div><span className="eyebrow">NEW GHOSTS</span><h1>Objects from<br />the near future.</h1></div>
          <a href="#all">VIEW ALL <span aria-hidden="true">→</span></a>
        </div>
        <div className="product-grid">
          {products.map((product, index) => (
            <article className="product-card" key={product.name}>
              <a className="product-image-wrap" href={`#${product.name.toLowerCase().replace(" ", "-")}`}>
                <img src={product.image} alt={product.alt} />
                <span className="product-index">0{index + 1}</span>
                <span className="product-view">VIEW GHOST</span>
              </a>
              <div className="product-meta">
                <div><h2>{product.name}</h2><p>{product.price}</p></div>
                <Bookmark active={saved.includes(index)} onClick={() => toggleSaved(index)} />
              </div>
            </article>
          ))}
        </div>
        <footer id="journal"><span>ATELIER GHOST — TOKYO</span><span>© 2026</span></footer>
      </section>
    </main>
  );
}
