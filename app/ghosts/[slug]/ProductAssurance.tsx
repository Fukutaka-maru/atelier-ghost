"use client";

import { useState } from "react";
import type { Product } from "../../products";
import { RETURN_POLICY_CONDITIONS, RETURN_POLICY_SUMMARY } from "../../return-policy";

/** 購入可能な商品だけに表示する、返品無料※・配送予定・支払い方法・サイズ情報 */
export default function ProductAssurance({ product }: { product: Product }) {
  const [policyOpen, setPolicyOpen] = useState(false);
  const info = product.purchaseInfo ?? {};
  const size = info.size ?? product.specs?.find((spec) => spec.label === "サイズ")?.value;
  const exclusions = info.returnExclusions ?? [];
  const details = [
    { label: "配送予定", value: info.shipping },
    { label: "支払い方法", value: info.payment },
    { label: "サイズ", value: size },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value));

  return (
    <section className="product-assurance" aria-label="購入時の安心情報">
      <div className="product-assurance-returns">
        <p className="product-assurance-free">返品無料※ <span>FREE RETURNS</span></p>
        <p className="product-assurance-note">
          {RETURN_POLICY_SUMMARY[0]}<br />
          {RETURN_POLICY_SUMMARY[1]}
        </p>
        <button type="button" className="product-assurance-link" onClick={() => setPolicyOpen(true)}>返品条件を見る</button>
      </div>
      {details.length > 0 && (
        <dl className="product-assurance-details">
          {details.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {policyOpen && (
        <div className="interest-modal" role="dialog" aria-modal="true" aria-labelledby="return-policy-title">
          <button className="interest-modal-backdrop" type="button" aria-label="閉じる" onClick={() => setPolicyOpen(false)} />
          <div className="interest-modal-panel return-policy-panel">
            <button className="interest-modal-close" type="button" aria-label="閉じる" onClick={() => setPolicyOpen(false)}>×</button>
            <p className="interest-kicker">{product.name}</p>
            <h2 id="return-policy-title">返品条件</h2>
            <ul className="return-policy-list">
              {RETURN_POLICY_CONDITIONS.map((condition) => <li key={condition}>※{condition}</li>)}
            </ul>
            {exclusions.length > 0 && (
              <>
                <p className="return-policy-subtitle">この商品の返品対象外条件</p>
                <ul className="return-policy-list">
                  {exclusions.map((condition) => <li key={condition}>※{condition}</li>)}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
