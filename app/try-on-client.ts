export type TryOnRequest = {
  photo: File;
  productSlug: string;
  productName: string;
  category: string;
  colorName: string;
  productImage: string;
  templateImage?: string;
};

export type TryOnResult = {
  imageUrl: string;
};

export class TryOnError extends Error {
  code: string;

  constructor(message: string, code = "TRY_ON_GENERATION_FAILED") {
    super(message);
    this.name = "TryOnError";
    this.code = code;
  }
}

function loadReferenceImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("REFERENCE_ENCODE_FAILED")), "image/jpeg", quality);
  });
}

async function referenceImageFile(source: string, filename: string) {
  const response = await fetch(source, { cache: "force-cache" });
  const sourceImage = await response.blob();
  if (!response.ok || !sourceImage.type.startsWith("image/")) {
    throw new TryOnError("商品画像を読み込めませんでした。", "REFERENCE_IMAGE_UNAVAILABLE");
  }
  const sourceUrl = URL.createObjectURL(sourceImage);
  try {
    const image = await loadReferenceImage(sourceUrl);
    const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = Math.min(1, 1024 / longestEdge);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("REFERENCE_CANVAS_UNAVAILABLE");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const encodedImage = await canvasBlob(canvas, 0.72);
    return new File([encodedImage], `${filename}.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

/**
 * AI接続用の境界。OPENAI_API_KEY が未設定の場合はAPIが503を返し、
 * UIはブラウザ内だけで完結するレイアウトプレビューを表示する。
 */
export async function generateTryOn(
  request: TryOnRequest,
): Promise<TryOnResult | null> {
  const endpoint = process.env.NEXT_PUBLIC_TRY_ON_ENDPOINT || "/api/try-on";
  const productReference = await referenceImageFile(request.productImage, "product-reference");
  const templateReference = request.templateImage
    ? await referenceImageFile(request.templateImage, "try-on-template")
    : null;

  const body = new FormData();
  body.append("photo", request.photo);
  body.append("productSlug", request.productSlug);
  body.append("colorName", request.colorName);
  body.append("productReference", productReference, productReference.name);
  if (templateReference) body.append("templateReference", templateReference, templateReference.name);

  const response = await fetch(endpoint, {
    method: "POST",
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string; code?: string } | null;
    if (response.status === 503 && payload?.code === "AI_NOT_CONFIGURED") return null;
    throw new TryOnError(payload?.error || "生成処理を完了できませんでした。", payload?.code);
  }
  const image = await response.blob();
  if (!image.type.startsWith("image/")) {
    throw new TryOnError("生成画像を受け取れませんでした。", "INVALID_GENERATION_RESPONSE");
  }
  if (response.headers.get("X-Atelier-Visual-Mode") !== "try-on") {
    throw new TryOnError("生成画像を確認できませんでした。", "INVALID_GENERATION_RESPONSE");
  }
  return {
    imageUrl: URL.createObjectURL(image),
  };
}
