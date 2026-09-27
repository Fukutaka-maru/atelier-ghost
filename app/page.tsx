import HomeClient from "./HomeClient";
import { getProducts } from "./products";

export default async function Home() {
  const products = await getProducts();
  return <HomeClient products={products} />;
}
