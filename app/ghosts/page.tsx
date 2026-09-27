import { getProducts } from "../products";
import GhostsIndexClient from "./GhostsIndexClient";

export default async function GhostsIndexPage() {
  const products = await getProducts();
  return <GhostsIndexClient products={products} />;
}
