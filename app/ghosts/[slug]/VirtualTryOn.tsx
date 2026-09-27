"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { Product } from "../../products";
import {
  fetchTryStatus,
  generateTryOn,
  lineLoginUrl,
  registerTryEmail,
  sendWant,
  TryOnError,
} from "../../try-on-client";
import type { TryStatus } from "../../try-on-client";

type TryOnStep = "checking" | "email" | "line" | "unavailable" | "source" | "confirm" | "generating" | "result";

const LINE_FRIEND_URL = "https://line.me/R/ti/p/@060emkyc";
const TRY_RULES = ["このGHOSTは、1回だけ試せます。", "1日に3つまでGHOSTを試せます。"];

// LINE Login から戻ったときの結果（?tryon=...）
const lineResultMessages: Record<string, { tone: "ok" | "error"; text: string }> = {
  line_ok: { tone: "ok", text: "LINEの友だち追加を確認しました。" },
  line_not_friend: { tone: "error", text: "LINEの友だち追加が確認できませんでした。\n友だち追加後、もう一度確認してください。" },
  line_mismatch: { tone: "error", text: "このメールアドレスは、別のLINEアカウントと連携済みです。\n登録時のLINEアカウントでログインしてください。" },
  line_cancelled: { tone: "error", text: "LINEでのログインがキャンセルされました。" },
  line_error: { tone: "error", text: "LINEの確認を完了できませんでした。もう一度お試しください。" },
  line_unavailable: { tone: "error", text: "LINE連携は現在準備中です。" },
  email_required: { tone: "error", text: "先にメールアドレスを登録してください。" },
};

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

function supportsFileShare() {
  try {
    const probe = new File([new Blob()], "probe.jpg", { type: "image/jpeg" });
    return typeof navigator.share === "function" && Boolean(navigator.canShare?.({ files: [probe] }));
  } catch {
    return false;
  }
}

export default function VirtualTryOn({ product }: { product: Product }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<TryOnStep>("checking");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [consented, setConsented] = useState(false);
  const [colorIndex, setColorIndex] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [isLayoutPreview, setIsLayoutPreview] = useState(false);
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [status, setStatus] = useState<TryStatus | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [submittingEmail, setSubmittingEmail] = useState(false);
  const [lineNotice, setLineNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [unavailableMessage, setUnavailableMessage] = useState("");
  const [wantState, setWantState] = useState<"idle" | "sending" | "done">("idle");
  const [shareUnsupported, setShareUnsupported] = useState(false);
  const closeRef = useRef<() => void>(() => undefined);

  const guidance = guidanceByCategory[product.category] ?? fallbackGuidance;
  const colors = product.colors ?? [];
  const selectedColor = colors[colorIndex];
  const productImage = selectedColor?.images[0] ?? product.images?.[0] ?? "";
  const colorName = selectedColor?.name ?? "STANDARD";
  const templateImage = product.tryOnTemplate ?? product.modelImages?.[0] ?? productImage;
  const resultImage = result ?? photoUrl;

  const stepNumber = useMemo(() => {
    const numbers: Partial<Record<TryOnStep, string>> = {
      email: "01", line: "02", source: "03", confirm: "04", generating: "05", result: "06",
    };
    return numbers[step] ?? "—";
  }, [step]);

  const applyStatus = (next: TryStatus) => {
    setStatus(next);
    if (next.email) setEmailInput(next.email);
    if (!next.registered) return setStep("email");
    if (!next.friendVerified) return setStep("line");
    if (next.triedThisGhost) {
      setUnavailableMessage("このGHOSTは、1回だけ試せます。\nこのGHOSTはすでに試着済みです。");
      return setStep("unavailable");
    }
    if (next.todayCount >= next.dailyLimit) {
      setUnavailableMessage("1日に3つまでGHOSTを試せます。\nまた明日お試しください。");
      return setStep("unavailable");
    }
    setStep("source");
  };

  const refreshStatus = async () => {
    setStep("checking");
    setError("");
    try {
      applyStatus(await fetchTryStatus(product.slug));
    } catch (statusError) {
      setUnavailableMessage(statusError instanceof TryOnError ? statusError.message : "TRY THE GHOSTの状態を確認できませんでした。");
      setStep("unavailable");
    }
  };

  const openTryOn = () => {
    setOpen(true);
    void refreshStatus();
  };

  // LINE Login から戻ってきたら、結果を表示してモーダルを開き直す
  useEffect(() => {
    const url = new URL(window.location.href);
    const lineResult = url.searchParams.get("tryon");
    if (!lineResult) return;
    url.searchParams.delete("tryon");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    const timer = window.setTimeout(() => {
      setLineNotice(lineResultMessages[lineResult] ?? null);
      openTryOn();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
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
    // 写真・生成画像はブラウザのメモリ上にだけあり、ここで破棄する
    if (result?.startsWith("blob:")) URL.revokeObjectURL(result);
    setStep("checking");
    setPhoto(null);
    setPhotoUrl("");
    setConsented(false);
    setColorIndex(0);
    setResult(null);
    setIsLayoutPreview(false);
    setError("");
    setPreparingPhoto(false);
    setLineNotice(null);
    setUnavailableMessage("");
    setWantState("idle");
    setShareUnsupported(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const close = () => {
    if (
      step === "result"
      && !isLayoutPreview
      && !window.confirm("生成画像はこの画面を閉じると再表示できません。閉じてもよろしいですか？")
    ) return;
    setOpen(false);
    reset();
  };
  useEffect(() => {
    closeRef.current = close;
  });

  const submitEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmittingEmail(true);
    setError("");
    try {
      await registerTryEmail(emailInput);
      applyStatus(await fetchTryStatus(product.slug));
    } catch (registerError) {
      setError(registerError instanceof TryOnError ? registerError.message : "メールアドレスを登録できませんでした。");
    } finally {
      setSubmittingEmail(false);
    }
  };

  const startLineLogin = (mock?: "friend" | "not_friend") => {
    window.location.href = lineLoginUrl(window.location.pathname, mock);
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
      const message = generationError instanceof TryOnError
        ? generationError.message
        : "生成処理を完了できませんでした。時間を置いてもう一度お試しください。";
      const code = generationError instanceof TryOnError ? generationError.code : "";
      if (code === "TRY_GHOST_ALREADY_USED" || code === "TRY_DAILY_LIMIT") {
        setUnavailableMessage(message);
        setStep("unavailable");
        return;
      }
      if (code === "TRY_EMAIL_REQUIRED" || code === "TRY_LINE_REQUIRED" || code === "TRY_LINE_NOT_FRIEND") {
        setLineNotice({ tone: "error", text: message });
        void refreshStatus();
        return;
      }
      setError(message);
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

  const saveImage = async () => {
    setSharing(true);
    try {
      const file = await makeShareFile();
      if (!file) return;
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

  const shareImage = async () => {
    setSharing(true);
    try {
      const file = await makeShareFile();
      if (!file) return;
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${product.name} — ATELIER GHOST` }).catch(() => undefined);
      } else {
        setShareUnsupported(true);
      }
    } finally {
      setSharing(false);
    }
  };

  // TRY THE GHOST後の I WANT THIS は post_try として記録する（商品ページのI WANT THISとは別集計）
  const wantAfterTry = async () => {
    setWantState("sending");
    setError("");
    try {
      await sendWant({ ghostId: product.slug, source: "post_try", colorName });
      setWantState("done");
    } catch (wantError) {
      setWantState("idle");
      setError(wantError instanceof TryOnError ? wantError.message : "登録できませんでした。");
    }
  };

  return (
    <>
      <button className="product-tryon-cta" type="button" onClick={openTryOn}>
        <span>ONLINE TRY-ON</span>
        オンライン試着する
      </button>

      {open && (
        <div className="tryon-modal" role="dialog" aria-modal="true" aria-labelledby="tryon-title">
          <header className="tryon-header">
            <img src="/images/atelier-ghost-logo-black-inline.png" alt="ATELIER GHOST" />
            <p>ONLINE TRY-ON&nbsp;&nbsp; {stepNumber} / 06</p>
            <button type="button" aria-label="オンライン試着を閉じる" onClick={close}>×</button>
          </header>

          <div className={`tryon-body tryon-body--${step}`}>
            {step === "checking" && (
              <section className="tryon-gate" aria-live="polite">
                <div className="tryon-orbit" aria-hidden="true"><i /><i /><i /></div>
                <p className="tryon-kicker">CHECKING</p>
              </section>
            )}

            {step === "email" && (
              <section className="tryon-gate">
                <p className="tryon-kicker">EMAIL</p>
                <h2 id="tryon-title">TRY THE GHOST</h2>
                <p>
                  試着には、メールアドレスの登録と<br />
                  ATELIER GHOST公式LINEの友だち追加が必要です。
                </p>
                {lineNotice && <p className={`tryon-notice tryon-notice--${lineNotice.tone}`} role="status">{lineNotice.text}</p>}
                <form className="tryon-email-form" onSubmit={submitEmail}>
                  <label htmlFor="tryon-email">EMAIL ADDRESS</label>
                  <input
                    id="tryon-email"
                    type="email"
                    autoComplete="email"
                    value={emailInput}
                    onChange={(event) => setEmailInput(event.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                  {error && <p className="tryon-error" role="alert">{error}</p>}
                  <button className="tryon-primary" type="submit" disabled={submittingEmail}>
                    {submittingEmail ? "登録中…" : "次へ"}
                  </button>
                </form>
                <ul className="tryon-rules">{TRY_RULES.map((rule) => <li key={rule}>{rule}</li>)}</ul>
              </section>
            )}

            {step === "line" && (
              <section className="tryon-gate">
                <p className="tryon-kicker">LINE</p>
                <h2 id="tryon-title">公式LINEを<br />友だち追加</h2>
                <p>
                  ATELIER GHOST公式LINEの友だち追加を確認できた方だけ、<br />
                  写真をアップロードして試着できます。
                </p>
                {lineNotice && <p className={`tryon-notice tryon-notice--${lineNotice.tone}`} role="status">{lineNotice.text}</p>}
                {status?.lineLoginReady === false ? (
                  <p className="tryon-error" role="alert">LINE連携は現在準備中です。</p>
                ) : (
                  <button className="tryon-line-button" type="button" onClick={() => startLineLogin()}>
                    {lineNotice?.tone === "error" && status?.lineLinked ? "もう一度確認する" : "LINEで友だち追加して続ける"}
                  </button>
                )}
                {status?.lineLinked && (
                  <a className="tryon-text-button" href={LINE_FRIEND_URL} target="_blank" rel="noreferrer">公式LINEを友だち追加する</a>
                )}
                {status?.lineMock && (
                  <div className="tryon-mock-actions">
                    <span>LOCAL MOCK</span>
                    <button type="button" onClick={() => startLineLogin("friend")}>友だち</button>
                    <button type="button" onClick={() => startLineLogin("not_friend")}>友だちではない</button>
                  </div>
                )}
                <p className="tryon-registered-email">
                  登録メール: {status?.email}
                  <button type="button" onClick={() => { setLineNotice(null); setStep("email"); }}>変更する</button>
                </p>
              </section>
            )}

            {step === "unavailable" && (
              <section className="tryon-gate">
                <p className="tryon-kicker">TRY THE GHOST</p>
                <h2 id="tryon-title">{product.name}</h2>
                <p className="tryon-notice">{unavailableMessage}</p>
                <button className="tryon-secondary" type="button" onClick={close}>閉じる</button>
              </section>
            )}

            {step === "source" && (
              <section className="tryon-source">
                <h2 id="tryon-title">自分の写真で<br />{product.name}<br />を試着する</h2>
                <div className="tryon-source-actions">
                  <button type="button" disabled={preparingPhoto} onClick={() => fileInputRef.current?.click()}>{preparingPhoto ? "写真を準備中…" : "写真を選ぶ"} <span>→</span></button>
                  <button type="button" disabled={preparingPhoto} onClick={() => cameraInputRef.current?.click()}>今撮影する <span>→</span></button>
                </div>
                {lineNotice?.tone === "ok" && <p className="tryon-notice tryon-notice--ok" role="status">{lineNotice.text}</p>}
                {error && <p className="tryon-error" role="alert">{error}</p>}
                <ul className="tryon-rules">{TRY_RULES.map((rule) => <li key={rule}>{rule}</li>)}</ul>
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
                  <p className="tryon-discard-note">
                    生成画像はこの画面を閉じると再表示できません。<br />
                    保存したい場合は、ご自身の端末に保存してください。
                  </p>
                  <div className="tryon-result-actions">
                    <button
                      className="tryon-primary"
                      type="button"
                      disabled={isLayoutPreview || wantState !== "idle"}
                      onClick={wantAfterTry}
                    >
                      {wantState === "done" ? "REQUEST RECEIVED" : wantState === "sending" ? "送信中…" : "I WANT THIS"}
                    </button>
                    <button className="tryon-secondary" type="button" disabled={sharing || isLayoutPreview} onClick={saveImage}>
                      {isLayoutPreview ? "AI接続後に保存できます" : sharing ? "準備中…" : "SAVE IMAGE"}
                    </button>
                    {supportsFileShare() && !shareUnsupported ? (
                      <button className="tryon-secondary" type="button" disabled={sharing || isLayoutPreview} onClick={shareImage}>SHARE</button>
                    ) : (
                      <p className="tryon-share-fallback">このブラウザは画像の共有に対応していません。SAVE IMAGEで端末に保存してから共有してください。</p>
                    )}
                    {wantState === "done" && <p className="tryon-notice tryon-notice--ok" role="status">このGHOSTへの意思表示を受け取りました。</p>}
                    {error && <p className="tryon-error" role="alert">{error}</p>}
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
