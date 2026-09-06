export type Product = {
  slug: string;
  name: string;
  price: string;
  image: string;
  alt: string;
  description: string;
};

export const products: Product[] = [
  {
    slug: "ghost-001",
    name: "GHOST 001",
    price: "¥78,000 JPY",
    image: "/images/look-001.png",
    alt: "深い赤の背景で眼鏡をかけたモデル",
    description: "まだ存在しないものを、存在してほしいと願うところから生まれた一着目。",
  },
  {
    slug: "ghost-002",
    name: "GHOST 002",
    price: "¥62,000 JPY",
    image: "/images/look-002.png",
    alt: "ブラウンの背景でサングラスをかけたモデル",
    description: "誰かが欲しいと思う。誰かが心を動かされる。その願いが重なって現実になった一着。",
  },
  {
    slug: "ghost-003",
    name: "GHOST 003",
    price: "¥48,000 JPY",
    image: "/images/look-003.png",
    alt: "ネイビーの背景で淡いドレスを着たモデル",
    description: "素材も、構造も、つくり方も、最初から現実に合わせなくていい——そんな思想の結晶。",
  },
];
