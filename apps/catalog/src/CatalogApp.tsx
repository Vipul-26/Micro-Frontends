import { Link, Route, Routes, useParams } from "react-router-dom";
import { addToCart, formatPrice, useCartLines } from "@mfe/cart-client";
import styles from "./CatalogApp.module.css";
import { findProduct, products, type CatalogProduct } from "./products";

export default function CatalogApp() {
  return (
    <section className={styles.panel}>
      <Routes>
        <Route index element={<ProductList />} />
        <Route path=":productId" element={<ProductDetail />} />
      </Routes>
    </section>
  );
}

function ProductList() {
  const lines = useCartLines();

  return (
    <>
      <header className={styles.heading}>
        <h1 className={styles.title}>Catalog</h1>
        <p className={styles.origin}>catalog · localhost:3001</p>
      </header>
      <ul className={styles.grid}>
        {products.map((product) => {
          const quantity = lines.find((line) => line.id === product.id)?.quantity ?? 0;
          return (
            <li key={product.id} className={styles.card}>
              <h2>
                <Link className={styles.product} to={product.id}>
                  {product.name}
                </Link>
              </h2>
              <p className={styles.price}>{formatPrice(product.priceCents)}</p>
              <div className={styles.actions}>
                <button type="button" onClick={() => addToCart(product)}>
                  Add to cart
                </button>
                <span>{quantity === 0 ? "Not in cart" : `${quantity} in cart`}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function ProductDetail() {
  const { productId } = useParams();
  const product = productId ? findProduct(productId) : undefined;

  if (!product) {
    return (
      <>
        <Link className={styles.back} to="..">
          Back to catalog
        </Link>
        <p className={styles.missing}>No product for this URL.</p>
      </>
    );
  }

  return <ProductDetailView product={product} />;
}

function ProductDetailView({ product }: { product: CatalogProduct }) {
  const quantity = useCartLines().find((line) => line.id === product.id)?.quantity ?? 0;

  return (
    <article className={styles.detail}>
      <Link className={styles.back} to="..">
        Back to catalog
      </Link>
      <header className={styles.heading}>
        <h1 className={styles.title}>{product.name}</h1>
        <p className={styles.origin}>catalog · localhost:3001</p>
      </header>
      <p className={styles.price}>{formatPrice(product.priceCents)}</p>
      <p className={styles.summary}>{product.summary}</p>
      <div className={styles.actions}>
        <button type="button" onClick={() => addToCart(product)}>
          Add to cart
        </button>
        <span>{quantity === 0 ? "Not in cart" : `${quantity} in cart`}</span>
      </div>
    </article>
  );
}
