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
    image: "/images/ghost-001-sunglasses.png",
    alt: "ブルーのべっ甲柄フレームにブルーレンズのリムレスサングラス",
    description: "まだ存在しないものを、存在してほしいと願うところから生まれた一着目。",
  },
  {
    slug: "ghost-002",
    name: "GHOST 002",
    price: "¥62,000 JPY",
    image: "/images/ghost-002-necklace.png",
    alt: "大小の淡いブルーのビーズが連なるネックレス",
    description: "誰かが欲しいと思う。誰かが心を動かされる。その願いが重なって現実になった一着。",
  },
  {
    slug: "ghost-003",
    name: "GHOST 003",
    price: "¥48,000 JPY",
    image: "/images/ghost-003-boots.jpg",
    alt: "黒いブラックバッグを持ち、シアーなロングブーツを履いたモデルの脚元",
    description: "素材も、構造も、つくり方も、最初から現実に合わせなくていい——そんな思想の結晶。",
  },
];
