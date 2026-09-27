"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Product } from "./products";

type MobileFlow = "idle" | "statement" | "statement-exit" | "guide" | "guide-exit" | "done";
type GuideStep = 1 | 2;
let hasCompletedIntroThisLoad = false;

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

const productIntro = [
  ["ATELIER GHOSTは、", "まだ存在していない未来のアイテムを", "取り扱うブランドです。"],
  ["私たちは、それらをGHOSTと呼んでいます。"],
  ["欲しいと思ったGHOSTに、", "意思表示をしてください。"],
  ["その声が重なったとき、", "そのGHOSTは現実になります。"],
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

function getProductThumbnail(product: Product): { src: string; alt: string } {
  const src = product.colors?.[0]?.images[0] ?? product.images?.[0] ?? "/images/products/cut-lens/deep-aqua-blue/01.png";
  return { src, alt: product.alt };
}

function ProductCard({
  product,
  index,
  scope,
  onOpenMobile,
  onOpenDesktop,
}: {
  product: Product;
  index: number;
  scope: string;
  onOpenMobile: () => void;
  onOpenDesktop: () => void;
}) {
  const [showModel, setShowModel] = useState(false);
  const thumb = getProductThumbnail(product);
  const modelSrc = product.modelImages?.[0];

  useEffect(() => {
    if (!modelSrc) return;
    const timer = window.setInterval(() => setShowModel((current) => !current), 3000);
    return () => window.clearInterval(timer);
  }, [modelSrc]);

  return (
    <article className="product-card" key={`${scope}-${product.slug}`}>
      <Link
        className="product-image-wrap"
        href={`/ghosts/${product.slug}`}
        onClick={(event) => {
          if (!hasCompletedIntroThisLoad) {
            event.preventDefault();
            if (scope === "mobile") onOpenMobile();
            else onOpenDesktop();
          }
        }}
      >
        <span className="product-card-visuals">
          <img
            className={`product-card-img${showModel ? " is-hidden" : " is-visible"}`}
            src={thumb.src}
            alt={thumb.alt}
          />
          {modelSrc && (
            <img
              className={`product-card-img product-card-img--model${showModel ? " is-visible" : " is-hidden"}`}
              src={modelSrc}
              alt={`${product.name} 着用ビジュアル`}
            />
          )}
        </span>
        <span className="product-index">{String(index + 1).padStart(2, "0")}</span>
        <span className="product-view">VIEW GHOST</span>
      </Link>
      <div className="product-meta">
        <div><h2>{product.name}</h2><p>{product.price}</p></div>
      </div>
    </article>
  );
}

export default function HomeClient({ products }: { products: Product[] }) {
  const [statementVisible, setStatementVisible] = useState(false);
  const [mobileFlow, setMobileFlow] = useState<MobileFlow>(() => hasCompletedIntroThisLoad ? "done" : "idle");
  const [introSource, setIntroSource] = useState<"mobile" | "desktop">("mobile");
  const [guideStep, setGuideStep] = useState<GuideStep>(1);
  const [guideNextReady, setGuideNextReady] = useState(false);
  const [guideFastForward, setGuideFastForward] = useState(false);
  const statementRef = useRef<HTMLElement>(null);
  const mobileTouchStart = useRef<number | null>(null);
  const onboardingOpenedAt = useRef(0);
  const guideHoldTimer = useRef<number | null>(null);

  useEffect(() => {
    const target = statementRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => setStatementVisible(entry.isIntersecting), { threshold: 0.42 });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const isMobile = () => window.matchMedia("(max-width: 720px)").matches;
    const openFromScroll = (event: WheelEvent | TouchEvent) => {
      if (!isMobile() || mobileFlow !== "idle" || window.scrollY > 8) return;

      let movingDown = false;
      if (event instanceof WheelEvent) movingDown = event.deltaY > 4;
      if (event instanceof TouchEvent && event.touches[0] && mobileTouchStart.current !== null) {
        movingDown = mobileTouchStart.current - event.touches[0].clientY > 12;
      }

      if (movingDown) {
        event.preventDefault();
        onboardingOpenedAt.current = Date.now();
        setMobileFlow("statement");
      }
    };
    const rememberTouch = (event: TouchEvent) => {
      mobileTouchStart.current = event.touches[0]?.clientY ?? null;
    };

    window.addEventListener("wheel", openFromScroll, { passive: false });
    window.addEventListener("touchstart", rememberTouch, { passive: true });
    window.addEventListener("touchmove", openFromScroll, { passive: false });
    return () => {
      window.removeEventListener("wheel", openFromScroll);
      window.removeEventListener("touchstart", rememberTouch);
      window.removeEventListener("touchmove", openFromScroll);
    };
  }, [mobileFlow]);

  useEffect(() => {
    if (mobileFlow === "idle" || mobileFlow === "done") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [mobileFlow]);

  useEffect(() => {
    if (mobileFlow !== "guide" || guideStep !== 1) return;
    setGuideNextReady(false);
    const timer = window.setTimeout(() => setGuideNextReady(true), 6200);
    return () => window.clearTimeout(timer);
  }, [mobileFlow, guideStep]);

  useEffect(() => {
    setGuideFastForward(false);
  }, [mobileFlow, guideStep]);

  useEffect(() => () => {
    if (guideHoldTimer.current !== null) window.clearTimeout(guideHoldTimer.current);
  }, []);

  const openMobileOnboarding = () => {
    if (hasCompletedIntroThisLoad || mobileFlow === "done") {
      document.querySelector("#mobile-products")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (mobileFlow !== "idle") return;
    setIntroSource("mobile");
    onboardingOpenedAt.current = Date.now();
    setMobileFlow("statement");
  };

  const openDesktopGuide = () => {
    if (hasCompletedIntroThisLoad || mobileFlow === "done") {
      document.querySelector("#desktop-products")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (mobileFlow !== "idle") return;
    setIntroSource("desktop");
    setGuideStep(1);
    document.querySelector("#ghosts")?.scrollIntoView({ behavior: "auto", block: "start" });
    onboardingOpenedAt.current = Date.now();
    setMobileFlow("guide");
  };

  const finishMobileStatement = () => {
    if (mobileFlow !== "statement") return;
    setMobileFlow("statement-exit");
    window.setTimeout(() => {
      document.querySelector("#mobile-ghosts")?.scrollIntoView({ behavior: "auto", block: "start" });
      onboardingOpenedAt.current = Date.now();
      setGuideStep(1);
      setMobileFlow("guide");
    }, 980);
  };

  const finishMobileGuide = () => {
    if (mobileFlow !== "guide") return;
    setMobileFlow("guide-exit");
    window.setTimeout(() => {
      hasCompletedIntroThisLoad = true;
      setMobileFlow("done");
      document.querySelector(introSource === "mobile" ? "#mobile-products" : "#desktop-products")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 520);
  };

  const handleOnboardingGesture = (event: React.WheelEvent | React.TouchEvent) => {
    if (Date.now() - onboardingOpenedAt.current < 500) return;
    if ("deltaY" in event && event.deltaY <= 4) return;
    if (event.type === "touchmove" && mobileTouchStart.current !== null) {
      const touch = (event as React.TouchEvent).touches[0];
      if (!touch || mobileTouchStart.current - touch.clientY <= 12) return;
    }
    finishMobileStatement();
  };

  const goToGuideExplanation = () => {
    if (!guideNextReady) return;
    setGuideStep(2);
    setGuideNextReady(true);
  };

  const beginGuideFastForward = () => {
    if (guideHoldTimer.current !== null) window.clearTimeout(guideHoldTimer.current);
    guideHoldTimer.current = window.setTimeout(() => {
      setGuideFastForward(true);
      setGuideNextReady(true);
      guideHoldTimer.current = null;
    }, 300);
  };

  const cancelGuideFastForward = () => {
    if (guideHoldTimer.current === null) return;
    window.clearTimeout(guideHoldTimer.current);
    guideHoldTimer.current = null;
  };

  const guideDelay = (seconds: number) => ({ "--delay": `${seconds}s` } as React.CSSProperties);

  const renderProducts = (scope: string) => (
    <div className="product-grid">
      {products.map((product, index) => (
        <ProductCard
          key={`${scope}-${product.slug}`}
          product={product}
          index={index}
          scope={scope}
          onOpenMobile={openMobileOnboarding}
          onOpenDesktop={openDesktopGuide}
        />
      ))}
    </div>
  );

  const renderGuide = (mode: "desktop" | "overlay" = "desktop") => {
    if (guideStep === 2) {
      return (
        <div className="ghosts-guide ghosts-guide--step2">
          <div className="ghosts-guide-copy">
            <h2 className="ghosts-guide-title ghosts-guide-block" style={guideDelay(0)}>
              <span>「欲しい」を形に</span>
            </h2>
            <p className="ghosts-guide-block" style={guideDelay(.8)}>
              <span>I WANT THIS を押してメールアドレスを登録すると、</span><br />
              <span>この商品が欲しいという意思が</span><br />
              <span>ATELIER GHOSTに送られます。</span>
            </p>
            <p className="ghosts-guide-block" style={guideDelay(2.6)}>
              <span>このGHOSTの制作が進んだときに、</span><br />
              <span>お知らせを受け取れます。</span>
            </p>
            <p className="ghosts-guide-block" style={guideDelay(4.4)}>
              <span>登録は購入予約ではありません。</span><br />
              <span>複数の商品に登録できます。</span>
            </p>
            <p className="ghosts-guide-block" style={guideDelay(6.2)}>
              <span>欲しいという声が多く集まったGHOSTは、</span><br />
              <span>販売に向け実際に制作がスタートします。</span>
            </p>
            {mode === "overlay" ? (
              <button className="ghosts-guide-route ghosts-guide-block" style={guideDelay(6.2)} type="button" onClick={finishMobileGuide}>商品を見る <span aria-hidden="true">→</span></button>
            ) : (
              <a className="ghosts-guide-route ghosts-guide-block" style={guideDelay(6.2)} href="#desktop-products">商品を見る <span aria-hidden="true">→</span></a>
            )}
          </div>
          <div className="ghosts-request-demo ghosts-guide-block" style={guideDelay(1)} aria-hidden="true">
            <div className="ghosts-request-card">
              <div className="ghosts-request-context">
                <span>仕様</span>
                <span>軽量リムレスフレーム / ノーズパッド付き</span>
              </div>
              <div className="ghosts-request-dim" />
              <div className="ghosts-request-focus">
                <div className="ghosts-request-stage ghosts-request-stage--want">
                  <button type="button" className="ghosts-request-cta">I WANT THIS</button>
                  <span className="ghosts-request-tap" />
                </div>
                <div className="ghosts-request-stage ghosts-request-stage--send">
                  <span className="ghosts-request-label">EMAIL ADDRESS</span>
                  <span className="ghosts-request-input">you@example.com</span>
                  <button type="button" className="ghosts-request-send">SEND REQUEST</button>
                  <span className="ghosts-request-tap ghosts-request-tap--send" />
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="ghosts-guide ghosts-guide--step1">
        <div>
          <h2 className="ghosts-guide-title ghosts-guide-block" style={guideDelay(0)}>
            <span>これらのアイテムは</span>
            <span>まだ実在しません</span>
          </h2>
        </div>
        <div className="ghosts-guide-copy">
          {productIntro.map((paragraph, index) => (
            <p className="ghosts-guide-block" key={index} style={guideDelay(.8 + index * 1.8)}>
              {paragraph.map((text) => (
                <span key={text}>{text}<br /></span>
              ))}
            </p>
          ))}
          {mode === "overlay" ? (
            <button
              className="ghosts-guide-route ghosts-guide-block"
              style={guideDelay(.8 + (productIntro.length - 1) * 1.8)}
              type="button"
              onClick={goToGuideExplanation}
              disabled={!guideNextReady}
            >
              NEXT <span aria-hidden="true">→</span>
            </button>
          ) : (
            <a className="ghosts-guide-route ghosts-guide-block" style={guideDelay(.8 + (productIntro.length - 1) * 1.8)} href="#desktop-products">NEXT <span aria-hidden="true">→</span></a>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
    <main className="site-shell desktop-site">
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
        <a className="hero-product-link" href="#statement">商品を見る <span aria-hidden="true">→</span></a>
        <a className="scroll-cue" href="#statement" aria-label="ステートメントへスクロール">
          <span>SCROLL</span><i aria-hidden="true" />
        </a>
      </section>

      <section ref={statementRef} className={`statement snap-panel${statementVisible ? " is-visible" : ""}`} id="statement">
        <img className="statement-bg" src="/images/statement-bg-dreamy.png" alt="" aria-hidden="true" />
        <div className="statement-vignette" />
        <div className="statement-copy">
          <Logo />
          <div className="statement-lines">
            {statement.map((line, index) => <p key={line} style={{ "--line": index } as React.CSSProperties}>{line}</p>)}
          </div>
        </div>
        <button className="continue-cue" type="button" onClick={openDesktopGuide}><span>DISCOVER THE GHOSTS</span><i aria-hidden="true" /></button>
      </section>

      <section className="collection snap-panel" id="ghosts">
        <div className="collection-head">
          <div><span className="eyebrow">NEW GHOSTS</span><h1>Objects from<br />the near future.</h1></div>
          <Link href="/ghosts">VIEW ALL <span aria-hidden="true">→</span></Link>
        </div>
        <div id="desktop-products">{renderProducts("desktop")}</div>
        <footer id="journal"><span>ATELIER GHOST — TOKYO</span><span>© 2026</span></footer>
      </section>
    </main>

    <main className="site-shell mobile-site">
      <section className="mobile-hero" id="mobile-top" aria-label="Atelier Ghost campaign">
        <img className="hero-image" src="/images/hero.png" alt="青いリムレスサングラスをかけ、透明な泡に囲まれた女性" />
        <div className="hero-shade" />
        <header className="site-header">
          <a href="#mobile-top" className="header-logo"><Logo compact /></a>
          <nav aria-label="メインナビゲーション">
            <button type="button" onClick={() => mobileFlow === "done" ? document.querySelector("#mobile-products")?.scrollIntoView({ behavior: "smooth" }) : openMobileOnboarding()}>GHOSTS</button>
            <button type="button" onClick={openMobileOnboarding}>ABOUT</button>
            <a href="#cart">CART (0)</a>
          </nav>
        </header>
        <div className="hero-copy"><p>THINGS WE</p><p>WISH EXISTED.</p></div>
        <button className="hero-product-link" type="button" onClick={openMobileOnboarding}>商品を見る <span aria-hidden="true">→</span></button>
        <button className="scroll-cue" type="button" onClick={openMobileOnboarding} aria-label="ブランドステートメントを見る">
          <span>SCROLL</span><i aria-hidden="true" />
        </button>
      </section>

      <section className="mobile-collection" id="mobile-ghosts">
        <div className="collection-head">
          <div><span className="eyebrow">NEW GHOSTS</span><h1>Objects from<br />the near future.</h1></div>
          <Link href="/ghosts">VIEW ALL <span aria-hidden="true">→</span></Link>
        </div>
        <div id="mobile-products">{renderProducts("mobile")}</div>
        <footer><span>ATELIER GHOST — TOKYO</span><span>© 2026</span></footer>
      </section>

      {introSource === "mobile" && (mobileFlow === "statement" || mobileFlow === "statement-exit") && (
        <section
          className={`mobile-onboarding${mobileFlow === "statement-exit" ? " is-exiting" : " is-entering"}`}
          aria-label="ATELIER GHOST ブランドステートメント"
          onWheel={handleOnboardingGesture}
          onTouchStart={(event) => { mobileTouchStart.current = event.touches[0]?.clientY ?? null; }}
          onTouchMove={handleOnboardingGesture}
        >
          <img className="statement-bg" src="/images/statement-bg-dreamy.png" alt="" aria-hidden="true" />
          <div className="statement-vignette" />
          <header className="mobile-onboarding-header"><Logo compact /></header>
          <div className="statement-copy">
            <Logo />
            <div className="statement-lines">
              {statement.map((line, index) => <p key={line} style={{ "--line": index } as React.CSSProperties}>{line}</p>)}
            </div>
          </div>
          <button className="continue-cue" type="button" onClick={finishMobileStatement}><span>DISCOVER THE GHOSTS</span><i aria-hidden="true" /></button>
        </section>
      )}

    </main>

    {(mobileFlow === "guide" || mobileFlow === "guide-exit") && (
      <section
        className={`mobile-guide-overlay mobile-guide-overlay--${introSource}${mobileFlow === "guide-exit" ? " is-exiting" : " is-entering"}${guideFastForward ? " is-fast-forwarding" : ""}`}
        aria-label="これらのアイテムはまだ実在しません"
        aria-modal="true"
        role="dialog"
        onPointerDown={beginGuideFastForward}
        onPointerUp={cancelGuideFastForward}
        onPointerCancel={cancelGuideFastForward}
        onPointerLeave={cancelGuideFastForward}
        onContextMenu={(event) => event.preventDefault()}
      >
        <div className="mobile-guide-overlay-shade" />
        <div className="mobile-guide-overlay-copy">
          {renderGuide("overlay")}
        </div>
      </section>
    )}
    </>
  );
}
