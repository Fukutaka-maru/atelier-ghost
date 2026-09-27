export type ColorOption = {
  name: string;
  swatch: string;
  images: string[];
};

export type Product = {
  slug: string;
  name: string;
  price: string;
  category: "glasses" | "belt" | "shoes" | "jacket" | "tops" | "bottoms" | "accessory" | string;
  alt: string;
  description: string;
  wornBy?: string;
  wearerQuote?: string;
  specs?: { label: string; value: string }[];
  images?: string[];
  modelImages?: string[];
  tryOnTemplate?: string;
  colors?: ColorOption[];
};

export const fallbackProducts: Product[] = [
  {
    slug: "ghost-001",
    name: "CUT LENS",
    price: "¥24,200 JPY",
    category: "glasses",
    alt: "リムレスフレームのサングラス CUT LENS",
    description: "水面の光を切り取ったようなブルーレンズ。輪郭だけが残るリムレスのGHOST。",
    wornBy: "KAHO",
    wearerQuote: "強さを見せなくても、強くいられる自分。",
    modelImages: [
      "/images/products/cut-lens/model/01.png",
      "/images/products/cut-lens/model/02.png",
    ],
    tryOnTemplate: "/images/products/cut-lens/try-on-template-v2.jpg",
    specs: [
      { label: "サイズ", value: "レンズ幅 54mm / ブリッジ 18mm / テンプル 140mm" },
      { label: "素材", value: "カラーポリカーボネートレンズ / ステンレススチール金具" },
      { label: "仕様", value: "軽量リムレスフレーム / ノーズパッド付き" },
    ],
    colors: [
      {
        name: "DEEP AQUA BLUE",
        swatch: "#3d6d8a",
        images: [
          "/images/products/cut-lens/deep-aqua-blue/01.png",
          "/images/products/cut-lens/deep-aqua-blue/02.png",
          "/images/products/cut-lens/deep-aqua-blue/03.png",
          "/images/products/cut-lens/deep-aqua-blue/04.png",
        ],
      },
      {
        name: "SMOKE PURPLE",
        swatch: "#9089a0",
        images: [
          "/images/products/cut-lens/smoke-purple/01.png",
          "/images/products/cut-lens/smoke-purple/02.png",
          "/images/products/cut-lens/smoke-purple/03.png",
          "/images/products/cut-lens/smoke-purple/04.png",
        ],
      },
      {
        name: "SAKURA PINK",
        swatch: "#f0c3cd",
        images: [
          "/images/products/cut-lens/sakura-pink/01.png",
          "/images/products/cut-lens/sakura-pink/02.png",
          "/images/products/cut-lens/sakura-pink/03.png",
          "/images/products/cut-lens/sakura-pink/04.png",
        ],
      },
    ],
  },
  {
    slug: "ghost-002",
    name: "BUBBLE BELT",
    price: "¥18,700 JPY",
    category: "belt",
    alt: "大小の淡いブルーのビーズが連なるベルト",
    description: "透明な泡を連ねたようなベルト。服の上に、光の粒だけを置くためのGHOST。",
    wornBy: "KAHO",
    wearerQuote: "強さを見せなくても、強くいられる自分。",
    specs: [
      { label: "サイズ", value: "フリーサイズ / 調整チェーン 62〜92cm" },
      { label: "素材", value: "アクリルバブルビーズ / シルバートーン金具" },
      { label: "仕様", value: "ジャケット、シャツ、ワンピースの上から重ねられる設計" },
    ],
    images: [
      "/images/products/bubble-belt/01.png",
      "/images/products/bubble-belt/02.png",
      "/images/products/bubble-belt/03.png",
      "/images/products/bubble-belt/04.png",
    ],
  },
  {
    slug: "ghost-003",
    name: "SHEER LONG BOOTS",
    price: "¥34,100 JPY",
    category: "shoes",
    alt: "黒いブラックバッグを持ち、シアーなロングブーツを履いたモデルの脚元",
    description: "脚の輪郭に沿って立ち上がる、透けるロングブーツ。存在感だけが先に届くGHOST。",
    wornBy: "KAHO",
    wearerQuote: "強さを見せなくても、強くいられる自分。",
    specs: [
      { label: "サイズ", value: "S / M / L" },
      { label: "素材", value: "シアーメッシュアッパー / ヴィーガンレザーソール / メタルジップ" },
      { label: "ヒール", value: "約 7.5cm" },
    ],
    images: [
      "/images/products/sheer-long-boots/01.jpg",
      "/images/products/sheer-long-boots/02.png",
      "/images/products/sheer-long-boots/03.png",
      "/images/products/sheer-long-boots/04.png",
    ],
  },
];

export function getProductThumbnail(product: Product): { src: string; alt: string } {
  const src = product.colors ? product.colors[0].images[0] : product.images![0];
  return { src, alt: product.alt };
}

export const products = fallbackProducts;

type MicroCMSImage = {
  url?: string;
};

type MicroCMSColor = {
  name?: string;
  swatch?: string;
  images?: MicroCMSImage | MicroCMSImage[];
};

type MicroCMSProduct = {
  id?: string;
  slug?: string;
  name?: string;
  price?: string;
  category?: string;
  alt?: string;
  description?: string;
  wornBy?: string;
  wearerQuote?: string;
  specs?: { label?: string; value?: string }[];
  images?: MicroCMSImage | MicroCMSImage[];
  modelImages?: MicroCMSImage | MicroCMSImage[];
  colors?: MicroCMSColor[];
};

type MicroCMSListResponse = {
  contents?: MicroCMSProduct[];
};

function imageUrl(image: MicroCMSImage | string | undefined): string | null {
  if (!image) return null;
  if (typeof image === "string") return image;
  return image.url ?? null;
}

function compactImages(images: MicroCMSImage | MicroCMSImage[] | string | string[] | undefined): string[] {
  const list = Array.isArray(images) ? images : [images];
  return list.map(imageUrl).filter((url): url is string => Boolean(url));
}

function normalizeProduct(item: MicroCMSProduct): Product | null {
  const slug = item.slug || item.id;
  if (!slug || !item.name) return null;

  const colors = (item.colors ?? [])
    .map((color) => ({
      name: color.name || "COLOR",
      swatch: color.swatch || "#d8d8d8",
      images: compactImages(color.images),
    }))
    .filter((color) => color.images.length > 0);

  const images = compactImages(item.images);
  const modelImages = compactImages(item.modelImages);
  if (colors.length === 0 && images.length === 0) return null;

  return {
    slug,
    name: item.name,
    price: item.price || "",
    category: item.category || "other",
    alt: item.alt || item.name,
    description: item.description || "",
    wornBy: item.wornBy,
    wearerQuote: item.wearerQuote,
    modelImages,
    specs: (item.specs ?? [])
      .filter((spec) => spec.label && spec.value)
      .map((spec) => ({ label: spec.label!, value: spec.value! })),
    ...(colors.length > 0 ? { colors } : { images }),
  };
}

export async function getProducts(): Promise<Product[]> {
  const serviceDomain = process.env.MICROCMS_SERVICE_DOMAIN;
  const apiKey = process.env.MICROCMS_API_KEY;
  const endpoint = process.env.MICROCMS_ENDPOINT || "ghosts";

  if (!serviceDomain || !apiKey) return fallbackProducts;

  try {
    const params = new URLSearchParams({
      limit: "100",
      orders: "sortOrder,publishedAt",
    });
    const response = await fetch(`https://${serviceDomain}.microcms.io/api/v1/${endpoint}?${params.toString()}`, {
      headers: { "X-MICROCMS-API-KEY": apiKey },
      cache: "no-store",
    });

    if (!response.ok) return fallbackProducts;

    const data = await response.json() as MicroCMSListResponse;
    const cmsProducts = (data.contents ?? []).map(normalizeProduct).filter((product): product is Product => Boolean(product));
    return cmsProducts.length > 0 ? cmsProducts : fallbackProducts;
  } catch {
    return fallbackProducts;
  }
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const allProducts = await getProducts();
  return allProducts.find((product) => product.slug === slug) ?? null;
}

export async function getProductSlugs(): Promise<string[]> {
  const allProducts = await getProducts();
  return allProducts.map((product) => product.slug);
}
