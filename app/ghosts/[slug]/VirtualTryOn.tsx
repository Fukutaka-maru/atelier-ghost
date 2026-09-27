"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { Product } from "../../products";
import { generateTryOn, TryOnError } from "../../try-on-client";

type TryOnStep = "source" | "confirm" | "generating" | "result";

const guidanceByCategory: Record<string, { title: string; detail: string; capture: "user" | "environment" }> = {
  glasses: {
    title: "正面に近い顔写真がおすすめです。",
    detail: "目元が隠れておらず、顔全体がはっきり写っている写真を選んでください。",
    capture: "user",
  },
  belt: {
    title: "腰まわりが見える写真がおすすめです。",
    detail: "上半身から腰までが写り、身体の前が隠れていない写真を選んでください。",
    capture: "environment",
  },
  shoes: {
    title: "足元まで写った全身写真がおすすめです。",
    detail: "立った姿勢で、両脚と足元が見える写真を選んでください。",
    capture: "environment",
  },
};

const fallbackGuidance = {
  title: "商品を合わせたい部分が見える写真を選んでください。",
  detail: "明るい場所で撮影した、身体の輪郭が分かる写真がおすすめです。",
  capture: "environment" as const,
};

const MAX_SOURCE_PHOTO_BYTES = 25 * 1024 * 1024;
const MAX_NORMALIZED_EDGE = 1280;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const renderedWidth = image.naturalWidth * scale;
  const renderedHeight = image.naturalHeight * scale;
  context.drawImage(
    image,
    x + (width - renderedWidth) / 2,
    y + (height - renderedHeight) / 2,
    renderedWidth,
    renderedHeight,
  );
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PHOTO_ENCODE_FAILED"));
    }, type, quality);
  });
}

async function normalizePhoto(source: File) {
  if (!source.type.startsWith("image/")) throw new Error("PHOTO_TYPE_UNSUPPORTED");
  if (source.size > MAX_SOURCE_PHOTO_BYTES) throw new Error("PHOTO_TOO_LARGE");

  const sourceUrl = URL.createObjectURL(source);
  try {
    const image = await loadImage(sourceUrl);
    const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = Math.min(1, MAX_NORMALIZED_EDGE / longestEdge);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PHOTO_CANVAS_UNAVAILABLE");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.78);
    return new File([blob], "atelier-ghost-try-on.jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export default function VirtualTryOn({ product }: { product: Product }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<TryOnStep>("source");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [consented, setConsented] = useState(false);
  const [colorIndex, setColorIndex] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [isLayoutPreview, setIsLayoutPreview] = useState(false);
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [preparingPhoto, setPreparingPhoto] = useState(false);

  const guidance = guidanceByCategory[product.category] ?? fallbackGuidance;
  const colors = product.colors ?? [];
  const selectedColor = colors[colorIndex];
  const productImage = selectedColor?.images[0] ?? product.images?.[0] ?? "";
  const colorName = selectedColor?.name ?? "STANDARD";
  const templateImage = product.tryOnTemplate ?? product.modelImages?.[0] ?? productImage;
  const resultImage = result ?? photoUrl;

  const stepNumber = useMemo(() => {
    if (step === "source") return "01";
    if (step === "confirm") return "02";
    if (step === "generating") return "03";
    return "04";
  }, [step]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  const reset = () => {
    if (result?.startsWith("blob:")) URL.revokeObjectURL(result);
    setStep("source");
    setPhoto(null);
    setPhotoUrl("");
    setConsented(false);
    setColorIndex(0);
    setResult(null);
    setIsLayoutPreview(false);
    setError("");
    setPreparingPhoto(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const selectPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const sourcePhoto = event.target.files?.[0];
    event.target.value = "";
    if (!sourcePhoto) return;
    setPreparingPhoto(true);
    setError("");
    try {
      const nextPhoto = await normalizePhoto(sourcePhoto);
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      setPhoto(nextPhoto);
      setPhotoUrl(URL.createObjectURL(nextPhoto));
      setStep("confirm");
    } catch {
      setError("この写真を読み込めませんでした。25MB以下の写真をお試しください。");
    } finally {
      setPreparingPhoto(false);
    }
  };

  const generate = async () => {
    if (!photo || !consented) return;
    setStep("generating");
    setError("");

    try {
      const generated = await generateTryOn({
        photo,
        productSlug: product.slug,
        productName: product.name,
        category: product.category,
        colorName,
        productImage,
        templateImage,
      });

      setResult(generated?.imageUrl ?? null);
      setIsLayoutPreview(!generated);
      window.setTimeout(() => setStep("result"), generated ? 350 : 1100);
    } catch (generationError) {
      setError(generationError instanceof TryOnError
        ? generationError.message
        : "生成処理を完了できませんでした。時間を置いてもう一度お試しください。");
      setStep("confirm");
    }
  };

  const makeShareFile = async () => {
    if (!resultImage) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const context = canvas.getContext("2d");
    if (!context) return null;

    const image = await loadImage(resultImage);
    const portraitOffsetY = Math.round(canvas.height * 0.03);
    context.fillStyle = "#eaf2f8";
    context.fillRect(0, 0, canvas.width, canvas.height);
    // The generated 2:3 portrait deliberately leaves generous space around
    // the complete hairstyle. Shift the full portrait down slightly so the
    // final 9:16 composition keeps more air above every hairstyle.
    drawCover(context, image, 0, portraitOffsetY, canvas.width, canvas.height);

    // Build a separately blurred copy, then reveal it gradually only below the
    // clavicles. The eyewear and face stay fully sharp while the bare lower
    // edge dissolves into the pale background without a hard blur boundary.
    const blurredCanvas = document.createElement("canvas");
    blurredCanvas.width = canvas.width;
      blurredCanvas.height = canvas.height;
      const blurredContext = blurredCanvas.getContext("2d");
    if (blurredContext) {
      blurredContext.filter = "blur(18px)";
      drawCover(blurredContext, image, 0, portraitOffsetY, canvas.width, canvas.height);
      blurredContext.filter = "none";
      blurredContext.globalCompositeOperation = "destination-in";
      const blurMask = blurredContext.createLinearGradient(0, 1530, 0, canvas.height);
      blurMask.addColorStop(0, "rgba(0,0,0,0)");
      blurMask.addColorStop(0.68, "rgba(0,0,0,0.82)");
      blurMask.addColorStop(1, "rgba(0,0,0,1)");
      blurredContext.fillStyle = blurMask;
      blurredContext.fillRect(0, 1530, canvas.width, canvas.height - 1530);
      context.drawImage(blurredCanvas, 0, 0);
    }

    const lowerFade = context.createLinearGradient(0, 1580, 0, canvas.height);
    lowerFade.addColorStop(0, "rgba(234,242,248,0)");
    lowerFade.addColorStop(1, "rgba(234,242,248,0.62)");
    context.fillStyle = lowerFade;
    context.fillRect(0, 1580, canvas.width, canvas.height - 1580);

    const logo = await loadImage("/images/atelier-ghost-logo-black-inline.png");
    const logoWidth = 420;
    const logoHeight = logo.naturalHeight * (logoWidth / logo.naturalWidth);
    const rightInset = 64;
    context.drawImage(logo, canvas.width - rightInset - logoWidth, 64, logoWidth, logoHeight);

    context.textAlign = "right";
    context.fillStyle = "#111215";
    context.font = "28px Arial, Helvetica, sans-serif";
    context.letterSpacing = "5px";
    context.fillText(product.name, canvas.width - rightInset, 1818);
    context.fillStyle = "rgba(17,18,21,0.7)";
    context.font = "20px Arial, Helvetica, sans-serif";
    context.letterSpacing = "4px";
    context.fillText(colorName.toUpperCase(), canvas.width - rightInset, 1862);

    return new Promise<File | null>((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob ? new File([blob], `${product.slug}-try-on.jpg`, { type: "image/jpeg" }) : null);
      }, "image/jpeg", 0.92);
    });
  };

  const saveOrShare = async () => {
    setSharing(true);
    try {
      const file = await makeShareFile();
      if (!file) return;
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${product.name} — ATELIER GHOST` });
        return;
      }
      const url = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.name;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setSharing(false);
    }
  };

  const openInterest = () => {
    close();
    window.setTimeout(() => window.dispatchEvent(new Event("atelier:open-interest")), 80);
  };

  return (
    <>
      <button className="product-tryon-cta" type="button" onClick={() => setOpen(true)}>
        <span>ONLINE TRY-ON</span>
        オンライン試着する
      </button>

      {open && (
        <div className="tryon-modal" role="dialog" aria-modal="true" aria-labelledby="tryon-title">
          <header className="tryon-header">
            <img src="/images/atelier-ghost-logo-black-inline.png" alt="ATELIER GHOST" />
            <p>ONLINE TRY-ON&nbsp;&nbsp; {stepNumber} / 04</p>
            <button type="button" aria-label="オンライン試着を閉じる" onClick={close}>×</button>
          </header>

          <div className={`tryon-body tryon-body--${step}`}>
            {step === "source" && (
              <section className="tryon-source">
                <h2 id="tryon-title">自分の写真で<br />{product.name}<br />を試着する</h2>
                <div className="tryon-source-actions">
                  <button type="button" disabled={preparingPhoto} onClick={() => fileInputRef.current?.click()}>{preparingPhoto ? "写真を準備中…" : "写真を選ぶ"} <span>→</span></button>
                  <button type="button" disabled={preparingPhoto} onClick={() => cameraInputRef.current?.click()}>今撮影する <span>→</span></button>
                </div>
                {error && <p className="tryon-error" role="alert">{error}</p>}
                <div className="tryon-guidance">
                  <p>{guidance.title}</p>
                  <span>{guidance.detail}</span>
                </div>
                <p className="tryon-privacy-note">
                  写真は生成のためOpenAIへ一時送信されます。ATELIER GHOSTのサーバーには保存せず、このページを閉じるとブラウザ上の写真と生成結果を削除します。
                </p>
              </section>
            )}

            {step === "confirm" && photoUrl && (
              <section className="tryon-confirm">
                <div className="tryon-photo-preview">
                  <img src={photoUrl} alt="選択した試着用写真" />
                  <span>YOUR PHOTO</span>
                </div>
                <div className="tryon-confirm-copy">
                  <p className="tryon-kicker">PHOTO CHECK</p>
                  <h2 id="tryon-title">この写真を<br />使用しますか？</h2>
                  <p>{guidance.title}<br />{guidance.detail}</p>

                  {colors.length > 1 && (
                    <div className="tryon-color-picker">
                      <span>COLOR</span>
                      <p>{colorName}</p>
                      <div>
                        {colors.map((color, index) => (
                          <button
                            key={color.name}
                            type="button"
                            className={index === colorIndex ? "is-active" : ""}
                            style={{ background: color.swatch }}
                            aria-label={color.name}
                            aria-pressed={index === colorIndex}
                            onClick={() => setColorIndex(index)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <label className="tryon-consent">
                    <input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} />
                    <span>写真が生成のためOpenAIへ送信され、ATELIER GHOSTのサーバーには保存されないことを確認しました。</span>
                  </label>
                  {error && <p className="tryon-error" role="alert">{error}</p>}
                  <button className="tryon-primary" type="button" disabled={!consented} onClick={generate}>この写真で生成する</button>
                  <button className="tryon-text-button" type="button" onClick={() => fileInputRef.current?.click()}>別の写真を選ぶ</button>
                </div>
              </section>
            )}

            {step === "generating" && (
              <section className="tryon-generating" aria-live="polite">
                <div className="tryon-orbit" aria-hidden="true"><i /><i /><i /></div>
                <p className="tryon-kicker">GENERATING</p>
                <h2 id="tryon-title">YOUR GHOST<br />IS APPEARING.</h2>
                <p>着用イメージを準備しています。生成には1〜2分かかることがあります。</p>
              </section>
            )}

            {step === "result" && resultImage && (
              <section className="tryon-result">
                <div className="tryon-result-visual">
                  <div className="tryon-story tryon-story--try-on">
                    <img className="tryon-story-photo" src={resultImage} alt={`${product.name} 試着`} />
                    <img className="tryon-story-logo" src="/images/atelier-ghost-logo-black-inline.png" alt="ATELIER GHOST" />
                    <div className="tryon-story-meta"><span>{product.name}</span><span>{colorName.toUpperCase()}</span></div>
                  </div>
                </div>
                <div className="tryon-result-copy">
                  {isLayoutPreview && (
                    <p className="tryon-preview-notice">AI接続前のレイアウトプレビューです。接続後は、商品を着用した本人の生成画像に置き換わります。</p>
                  )}
                  <div className="tryon-share-callout">
                    <p>ストーリーズでシェアしよう</p>
                    <span>完成したビジュアルを保存して、Instagramストーリーズへ。</span>
                  </div>
                  <div className="tryon-result-actions">
                    <button className="tryon-primary" type="button" disabled={sharing || isLayoutPreview} onClick={saveOrShare}>
                      {isLayoutPreview ? "AI接続後に保存できます" : sharing ? "準備中…" : "画像を保存・シェアする"}
                    </button>
                    <button className="tryon-secondary" type="button" onClick={openInterest}>I WANT THIS</button>
                    <button className="tryon-text-button" type="button" onClick={reset}>別の写真で試す</button>
                  </div>
                </div>
              </section>
            )}
          </div>

          <input ref={fileInputRef} className="tryon-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} />
          <input ref={cameraInputRef} className="tryon-file-input" type="file" accept="image/*" capture={guidance.capture} onChange={selectPhoto} />
        </div>
      )}
    </>
  );
}
