import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, getProductSlugs } from "../../products";
import ProductGallery from "./ProductGallery";
import ProductInterest from "./ProductInterest";
import VirtualTryOn from "./VirtualTryOn";

export async function generateStaticParams() {
  const slugs = await getProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  return (
    <main className="product-page">
      <Link href="/" className="product-page-back">← BACK TO GHOSTS</Link>
      <div className="product-page-body">
        <ProductGallery product={product} />
        <div className="product-page-info">
          <h1>{product.name}</h1>
          <p className="product-page-price">{product.price}</p>
          <p className="product-page-description">{product.description}</p>
          {product.specs && product.specs.length > 0 && (
            <dl className="product-specs">
              {product.specs.map((spec) => (
                <div key={spec.label}>
                  <dt>{spec.label}</dt>
                  <dd>{spec.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="product-page-actions">
            <VirtualTryOn product={product} />
            <ProductInterest productName={product.name} />
          </div>
        </div>
      </div>
    </main>
  );
}
