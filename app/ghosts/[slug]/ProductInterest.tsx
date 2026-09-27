"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { sendWant, TryOnError } from "../../try-on-client";

export default function ProductInterest({ productName, productSlug }: { productName: string; productSlug: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email) return;
    setSending(true);
    setError("");
    try {
      await sendWant({ ghostId: productSlug, source: "product_page", email });
      setSubmitted(true);
    } catch (wantError) {
      setError(wantError instanceof TryOnError ? wantError.message : "登録できませんでした。時間を置いてもう一度お試しください。");
    } finally {
      setSending(false);
    }
  };

  const close = () => {
    setOpen(false);
    setSubmitted(false);
    setEmail("");
    setError("");
  };

  return (
    <>
      <button className="product-page-cta" type="button" onClick={() => setOpen(true)}>I WANT THIS</button>
      {open && (
        <div className="interest-modal" role="dialog" aria-modal="true" aria-labelledby="interest-title">
          <button className="interest-modal-backdrop" type="button" aria-label="閉じる" onClick={close} />
          <div className="interest-modal-panel">
            <button className="interest-modal-close" type="button" aria-label="閉じる" onClick={close}>×</button>
            {!submitted ? (
              <>
                <p className="interest-kicker">{productName}</p>
                <h2 id="interest-title">I WANT THIS GHOST.</h2>
                <p>
                  これは購入予約ではありません。あなたがこのGHOSTを欲しいと思っている、という意思表示です。
                  複数のGHOSTに登録できます。
                </p>
                <p>
                  生産が決まった場合や進行状況が更新された場合に、メールでお知らせします。
                  ただのメルマガ登録ではなく、このGHOSTへのリクエストとして受け取ります。
                </p>
                <form className="interest-form" onSubmit={submit}>
                  <label htmlFor="interest-email">EMAIL ADDRESS</label>
                  <input
                    id="interest-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                  {error && <p className="interest-error" role="alert">{error}</p>}
                  <button type="submit" disabled={sending}>{sending ? "SENDING…" : "SEND REQUEST"}</button>
                </form>
              </>
            ) : (
              <div className="interest-complete">
                <p className="interest-kicker">{productName}</p>
                <h2>REQUEST RECEIVED.</h2>
                <p>
                  このGHOSTへの意思表示を受け取りました。購入予約ではないので、ほかに気になるGHOSTがあれば続けて登録できます。
                </p>
                <button type="button" onClick={close}>BACK TO GHOST</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
