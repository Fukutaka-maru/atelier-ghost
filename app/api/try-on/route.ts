import { NextResponse } from "next/server";
import { getProductBySlug } from "../../products";
import { isMockEnabled } from "../../../lib/try-the-ghost/env";
import { isStillLineFriend } from "../../../lib/try-the-ghost/line";
import { readSession, sessionSecret } from "../../../lib/try-the-ghost/session";
import {
  clientIp,
  finishGeneration,
  getUser,
  hashValue,
  isSessionFriendVerified,
  reserveGeneration,
} from "../../../lib/try-the-ghost/store";

const OPENAI_IMAGE_EDIT_URL = "https://api.openai.com/v1/images/edits";
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

type ImageEditResponse = {
  data?: Array<{ b64_json?: string }>;
  error?: { code?: string; message?: string; type?: string };
};

function noStoreHeaders() {
  return {
    "Cache-Control": "private, no-store, no-cache, max-age=0",
    Pragma: "no-cache",
  };
}

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ error: message, code }, { status, headers: noStoreHeaders() });
}

const limitMessages = {
  ghost_used: { message: "このGHOSTは、1回だけ試せます。", status: 409, code: "TRY_GHOST_ALREADY_USED" },
  daily_limit: { message: "1日に3つまでGHOSTを試せます。また明日お試しください。", status: 429, code: "TRY_DAILY_LIMIT" },
  ip_limit: { message: "短時間に多くの生成が行われています。時間を置いてからお試しください。", status: 429, code: "TRY_ON_RATE_LIMITED" },
} as const;

function resolveProductReferences(product: Awaited<ReturnType<typeof getProductBySlug>>, colorName: string) {
  if (!product) return null;
  const color = product.colors?.find((item) => item.name === colorName) ?? product.colors?.[0];
  return {
    resolvedColorName: color?.name ?? colorName,
  };
}

function isReferenceImage(value: FormDataEntryValue | null): value is File {
  return value instanceof File && ALLOWED_IMAGE_TYPES.has(value.type) && value.size > 0 && value.size <= MAX_PHOTO_BYTES;
}

function categoryDirection(category: string) {
  if (category === "glasses") {
    return {
      framing: "A centered, straight-on head-and-shoulders portrait. The face looks toward camera. Use a clean warm-white studio background.",
      product: "Place the exact eyewear from image 2 naturally on the person's face. Preserve the lens silhouette, lens color, rimless construction, metal bridge, hinges, and all hardware exactly. The eyewear is the hero product.",
    };
  }
  if (category === "belt") {
    return {
      framing: "A centered, straight-on fashion e-commerce portrait framed from shoulders to upper legs on a clean warm-white studio background.",
      product: "Place the exact belt from image 2 naturally around the person's waist. Preserve every translucent bubble, proportion, color, clasp, and metal detail exactly. Keep the original clothing and make the belt fully visible.",
    };
  }
  if (category === "shoes") {
    return {
      framing: "A centered, straight-on full-body fashion e-commerce photograph with both legs and feet visible on a clean warm-white studio background.",
      product: "Place the exact boots from image 2 on the person's legs and feet. Preserve the sheer fabric, seams, shaft height, heel shape, and all construction details exactly. Keep the person's natural proportions.",
    };
  }
  return {
    framing: "A centered, straight-on fashion e-commerce photograph on a clean warm-white studio background. Clearly show the body area where the product is worn.",
    product: "Place the exact product from image 2 naturally on the person. Preserve its silhouette, material, color, scale, construction, and hardware exactly.",
  };
}

function tryOnPrompt(productName: string, colorName: string, category: string, hasTemplateReference: boolean) {
  const direction = categoryDirection(category);
  const lensOptics = /aqua/i.test(colorName)
    ? `- For ${colorName}, preserve the deep aqua-blue hue and iridescent blue edge, but render the lens body as clearly translucent rather than near-black. Target approximately 58–62% visual tint opacity: the pupils, irises, eyelids, and natural eye contrast must remain clearly readable through both lenses while the blue tint stays unmistakable.`
    : "- Preserve the selected color's exact transparent tint and optical character from image 3. Keep both eyes naturally visible through the lenses.";
  if (hasTemplateReference) {
    return `
Create a photorealistic ATELIER GHOST try-on portrait for ${productName}, color ${colorName}.

REFERENCE ORDER
- Image 1 is the customer identity reference. Use their recognisable facial features, hair characteristics, skin tone, and gender presentation. Do not copy the head angle, pose, camera perspective, clothing, or background from this image.
- Image 2 is the official ATELIER GHOST campaign template. Treat its exact frontal composition, centred face position, generous space above the hair, level head, direct camera angle, lighting, pale blue-white background, tonal treatment, styling, and eyewear presentation as locked art direction.
- Image 3 is the exact selected product reference and the sole authority for product geometry. Match its lens color, full lens silhouette, top-to-bottom lens height, width-to-height ratio, lower sculpted edge, rimless construction, bridge, hinges, and hardware precisely.

TASK
- Replace the person in image 2 with the person from image 1. Keep image 2's composition and the exact eyewear presentation, while naturally adapting the face and hairstyle to the customer.
- Apply refined editorial beauty retouch: gently even the complexion, soften temporary blemishes and excess shine, balance the skin tone, and tidy a few flyaways. Keep natural skin texture, pores, facial proportions, age appearance, and distinctive facial features recognisable.
- Do not change the customer's identity, ethnicity, gender presentation, or make them resemble the campaign model.

EYEWEAR GEOMETRY — NON-NEGOTIABLE
- Preserve the exact lens aspect ratio and vertical depth from image 3. Do not flatten, vertically compress, shorten, narrow, stretch, or redesign either lens to fit the customer's face.
- Scale the complete eyewear uniformly in both axes. If fit adjustment is needed, change only the uniform overall scale and bridge/temple placement; never deform the lens shape independently.
- The distinctive upper contour and deep lower cut-out silhouette must remain as tall and prominent as in image 3. Product accuracy has priority over adapting the product proportions to the customer's facial proportions.
- Normalise the worn size to the customer's face. Measure the visible facial width across the cheekbones/temples at eye level: the complete eyewear width from the outermost left hardware to the outermost right hardware must occupy approximately 88–92% of that facial width, with the outer hardware landing near the temples. Do not leave oversized faces wearing a visually undersized frame.
- Each lens's top-to-bottom height should read at approximately 30–34% of the vertical distance from the brow line to the bottom of the chin. If the result would be smaller, uniformly enlarge the complete eyewear until both the width and height targets are met, without altering the lens aspect ratio.
${lensOptics}

POSE AND GAZE — NON-NEGOTIABLE
- Reconstruct the customer as a geometrically true, straight-on studio portrait even when image 1 is angled. Infer the hidden side of the face as needed and do not preserve any source head pose or camera perspective. Frontal alignment has higher priority than copying the source angle.
- The vertical centre line of the forehead, nose, philtrum, lips, and chin must align with the vertical centre of the canvas.
- Position the camera exactly at eye level. Keep the head perfectly upright with zero roll, zero yaw, and zero pitch. Both eyes must be the same apparent size; both ears must sit at equal height and have equal visibility; the jaw must be level and visually symmetrical.
- Both pupils and irises must aim directly into the camera lens. The subject must make unmistakable eye contact with the viewer through the tinted lenses. No gaze to the side, no off-camera focus, and no three-quarter facial perspective.

EXPRESSION — NON-NEGOTIABLE
- Use a completely neutral fashion-casting expression, regardless of the expression in image 1. Do not copy a smile from the customer reference.
- Keep the lips gently closed with no teeth visible. The mouth corners must remain level and relaxed: no smile, grin, smirk, pout, or open mouth.
- Keep the cheeks, jaw, eyebrows, forehead, and eye area relaxed. No raised cheeks, squinting, surprised expression, anger, sadness, or exaggerated emotion.
- Preserve the customer's recognisable mouth and facial anatomy while changing only the expression to calm, composed, and emotionless.

OUTPUT
- A straight-on beauty portrait with the face centred and the eyewear clearly visible. Compose for a later centred 9:16 crop from this 2:3 source image.
- Scale the subject from the complete hair silhouette, not from the facial width. In this uncropped 2:3 source, the full hairstyle including every flyaway must occupy no more than 62–66% of the canvas width, leaving at least 17% clean background between the widest hair point and each side edge. For wider or more voluminous hairstyles, reduce the entire head proportionally rather than cropping or compressing the hair. Never enlarge a narrow hairstyle beyond this range.
- Position the entire person lower in the frame than a conventional passport portrait. Keep the highest point of the hair approximately 12–14% below the top edge in this source image, with all hair visible. Place the eyes around 48–51% of the image height. Do not compensate by enlarging the head; move the complete head, neck, and shoulders downward together while preserving their scale and the specified side margins.
- Include the full neck, clavicles, shoulder tops, and only a small amount below the clavicles. Do not generate any clothing, garment, neckline, shirt, jacket, collar, lapel, strap, or fabric anywhere in the frame.
- Apply a strong but smoothly graduated natural optical defocus beginning immediately below the clavicles and increasing toward the bottom edge. The lower shoulder and upper-chest area must be substantially blurred and softly dissolved into the pale blue-white background, so it never reads as a sharply exposed body. Keep the face, hairline, eyes, and eyewear tack-sharp. Do not create a hard blur boundary, fog patch, vignette, or artificial white border.
- Premium high-resolution minimal fashion photography with crisp product edges, fine hair detail, realistic skin texture, physically plausible eyewear fit, and natural contact shadows.
- No logo, no text, no watermark, no extra products, no duplicated features, and no illustration or fantasy effects.
`.trim();
  }
  return `
Create a photorealistic virtual try-on image for the fashion product ${productName}, color ${colorName}.

REFERENCE ORDER
- Image 1 is the customer. Preserve this person's identity, facial structure, skin tone, hair, age appearance, body shape, and distinguishing features. Do not beautify, feminize, masculinize, or change their gender presentation.
- Image 2 is the exact product reference. ${direction.product}

OUTPUT
- ${direction.framing}
- Preserve the customer's original clothing wherever it does not conflict with placing the product.
- Natural editorial lighting, realistic contact shadows, physically plausible fit, premium minimal fashion e-commerce photography.
- No logo, no text, no watermark, no extra products, no duplicated limbs or accessories.
- The result must look like a real photograph, not an illustration or AI artwork.
`.trim();
}

async function editImage(apiKey: string, images: File[], prompt: string) {
  const body = new FormData();
  body.append("model", process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-sunburst");
  body.append("prompt", prompt);
  body.append("size", process.env.OPENAI_IMAGE_SIZE || "1024x1536");
  body.append("quality", process.env.OPENAI_IMAGE_QUALITY || "xhigh");
  body.append("output_format", "jpeg");
  body.append("output_compression", process.env.OPENAI_IMAGE_COMPRESSION || "95");
  for (const image of images) body.append("image[]", image, image.name);

  const response = await fetch(OPENAI_IMAGE_EDIT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body,
    cache: "no-store",
  });
  const payload = await response.json() as ImageEditResponse;
  if (!response.ok) {
    const error = new Error(payload.error?.message || "IMAGE_EDIT_FAILED");
    Object.assign(error, { status: response.status, code: payload.error?.code || payload.error?.type });
    throw error;
  }
  const base64 = payload.data?.[0]?.b64_json;
  if (!base64) throw new Error("IMAGE_EDIT_EMPTY_RESULT");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function POST(request: Request) {
  // ここから下の条件をすべて満たした場合のみ、画像生成APIを呼ぶ。
  if (!sessionSecret()) return jsonError("TRY THE GHOSTは現在準備中です。", 503, "TRY_NOT_CONFIGURED");
  const session = await readSession(request);
  const user = session ? await getUser(session.uid) : null;
  if (!session || !user) return jsonError("メールアドレスを登録してください。", 401, "TRY_EMAIL_REQUIRED");
  if (!session.lid || !isSessionFriendVerified(session, user)) {
    return jsonError("LINEの友だち追加を確認してください。", 403, "TRY_LINE_REQUIRED");
  }
  try {
    if (await isStillLineFriend(session.lid) === false) {
      return jsonError("LINEの友だち追加が確認できませんでした。友だち追加後、もう一度確認してください。", 403, "TRY_LINE_NOT_FRIEND");
    }
  } catch (error) {
    console.error("ATELIER_GHOST_LINE_RECHECK_FAILED", error);
    return jsonError("LINEの友だち状態を確認できませんでした。時間を置いてお試しください。", 503, "TRY_LINE_CHECK_FAILED");
  }

  const mockImage = isMockEnabled(request, "TRY_ON_MOCK_IMAGE");
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey && !mockImage) return jsonError("AI試着は現在準備中です。", 503, "AI_NOT_CONFIGURED");

  let generationId: string | null = null;
  try {
    const form = await request.formData();
    const photo = form.get("photo");
    const productSlug = form.get("productSlug");
    const colorName = form.get("colorName");
    const productReference = form.get("productReference");
    const templateReference = form.get("templateReference");

    if (
      !(photo instanceof File)
      || typeof productSlug !== "string"
      || typeof colorName !== "string"
      || !isReferenceImage(productReference)
    ) {
      return jsonError("必要な画像または商品情報がありません。", 400, "INVALID_TRY_ON_REQUEST");
    }
    if (!ALLOWED_IMAGE_TYPES.has(photo.type) || photo.size > MAX_PHOTO_BYTES) {
      return jsonError("JPEG、PNG、WebP形式の12MB以下の写真を使用してください。", 400, "INVALID_TRY_ON_PHOTO");
    }

    const product = await getProductBySlug(productSlug);
    const references = resolveProductReferences(product, colorName);
    if (!product || !references) return jsonError("商品画像を確認できませんでした。", 404, "TRY_ON_PRODUCT_NOT_FOUND");

    const reservation = await reserveGeneration({
      user,
      lineUserId: session.lid,
      ghostId: product.slug,
      colorName: references.resolvedColorName,
      ipHash: await hashValue(clientIp(request)),
      userAgentHash: await hashValue(request.headers.get("user-agent")),
    });
    if (!reservation.ok) {
      const limit = limitMessages[reservation.reason];
      return jsonError(limit.message, limit.status, limit.code);
    }
    generationId = reservation.id;

    const hasTemplateReference = isReferenceImage(templateReference);
    // TRY_ON_MOCK_IMAGE（localhostのみ）: OpenAIを呼ばず参照画像を返して、制限の動作だけを確認する
    const image = mockImage
      ? new Uint8Array(await (hasTemplateReference ? templateReference : productReference).arrayBuffer())
      : await editImage(
        apiKey!,
        hasTemplateReference ? [photo, templateReference, productReference] : [photo, productReference],
        tryOnPrompt(product.name, references.resolvedColorName, product.category, hasTemplateReference),
      );

    await finishGeneration(generationId, "succeeded");
    generationId = null;

    // 写真・生成画像はレスポンスとして返すだけで、DB・R2・ファイルには保存しない。
    return new Response(image, {
      headers: {
        ...noStoreHeaders(),
        "Content-Type": "image/jpeg",
        "X-Atelier-Visual-Mode": "try-on",
      },
    });
  } catch (error) {
    // 失敗した生成は回数に数えず、同じGHOSTをもう一度試せるようにする
    if (generationId) await finishGeneration(generationId, "failed").catch(() => undefined);
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "TRY_ON_GENERATION_FAILED";
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    const detail = error instanceof Error ? error.message : String(error);
    console.error("ATELIER_GHOST_TRY_ON_FAILED", { code, status, detail });
    const safeStatus = Number.isFinite(status) && status >= 400 && status < 600 ? status : 500;
    const message = code === "moderation_blocked" || code === "image_generation_user_error"
      ? "この写真では生成できませんでした。別の写真をお試しください。"
      : "着用イメージを生成できませんでした。時間を置いてもう一度お試しください。";
    return jsonError(message, safeStatus, code);
  }
}
