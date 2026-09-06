import Link from "next/link";
import { notFound } from "next/navigation";
import { products } from "../../products";

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = products.find((item) => item.slug === slug);
  if (!product) notFound();

  return (
    <main className="product-page">
      <Link href="/" className="product-page-back">← BACK TO GHOSTS</Link>
      <div className="product-page-body">
        <div className="product-page-image">
          <img src={product.image} alt={product.alt} />
        </div>
        <div className="product-page-info">
          <h1>{product.name}</h1>
          <p className="product-page-price">{product.price}</p>
          <p className="product-page-description">{product.description}</p>
        </div>
      </div>
    </main>
  );
}
