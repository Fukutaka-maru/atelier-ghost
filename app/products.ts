export type ColorOption = {
  name: string;
  swatch: string;
  images: string[];
};

export type Product = {
  slug: string;
  name: string;
  price: string;
  alt: string;
  description: string;
  images?: string[];
  colors?: ColorOption[];
};

export const products: Product[] = [
  {
    slug: "ghost-001",
    name: "CUT LENS",
    price: "¥78,000 JPY",
    alt: "リムレスフレームのサングラス CUT LENS",
    description: "まだ存在しないものを、存在してほしいと願うところから生まれた一着目。",
    colors: [
      {
        name: "DEEP AQUA BLUE",
        swatch: "#3d6d8a",
        images: [
          "/images/cut-lens-aqua-01.png",
          "/images/cut-lens-aqua-02.png",
          "/images/cut-lens-aqua-03.png",
          "/images/cut-lens-aqua-04.png",
        ],
      },
      {
        name: "SMOKE PURPLE",
        swatch: "#9089a0",
        images: [
          "/images/cut-lens-purple-01.png",
          "/images/cut-lens-purple-02.png",
          "/images/cut-lens-purple-03.png",
          "/images/cut-lens-purple-04.png",
        ],
      },
      {
        name: "SAKURA PINK",
        swatch: "#f0c3cd",
        images: [
          "/images/cut-lens-pink-01.png",
          "/images/cut-lens-pink-02.png",
          "/images/cut-lens-pink-03.png",
          "/images/cut-lens-pink-04.png",
        ],
      },
    ],
  },
  {
    slug: "ghost-002",
    name: "BUBBLE BELT",
    price: "¥62,000 JPY",
    alt: "大小の淡いブルーのビーズが連なるベルト",
    description: "誰かが欲しいと思う。誰かが心を動かされる。その願いが重なって現実になった一着。",
    images: [
      "/images/bubble-belt-01.png",
      "/images/bubble-belt-04.png",
      "/images/bubble-belt-02.png",
      "/images/bubble-belt-03.png",
    ],
  },
  {
    slug: "ghost-003",
    name: "SHEER LONG BOOTS",
    price: "¥48,000 JPY",
    alt: "黒いブラックバッグを持ち、シアーなロングブーツを履いたモデルの脚元",
    description: "素材も、構造も、つくり方も、最初から現実に合わせなくていい——そんな思想の結晶。",
    images: ["/images/sheer-long-boots-01.jpg"],
  },
];

export function getProductThumbnail(product: Product): { src: string; alt: string } {
  const src = product.colors ? product.colors[0].images[0] : product.images![0];
  return { src, alt: product.alt };
}
