import { formatPrice, removeFromCart, useCartLines } from "@mfe/cart-client";
import styles from "./CartApp.module.css";

export default function CartApp() {
  const lines = useCartLines();
  const totalCents = lines.reduce((sum, line) => sum + line.priceCents * line.quantity, 0);

  return (
    <section className={styles.panel}>
      <header className={styles.heading}>
        <h1 className={styles.title}>Cart</h1>
        <p className={styles.origin}>cart · localhost:3002</p>
      </header>
      {lines.length === 0 ? (
        <p className={styles.empty}>No line items yet.</p>
      ) : (
        <>
          <ul className={styles.lines}>
            {lines.map((line) => (
              <li key={line.id} className={styles.line}>
                <div>
                  <h2 className={styles.name}>{line.name}</h2>
                  <p className={styles.meta}>
                    {line.quantity} × {formatPrice(line.priceCents)}
                  </p>
                </div>
                <div className={styles.lineEnd}>
                  <strong>{formatPrice(line.priceCents * line.quantity)}</strong>
                  <button type="button" onClick={() => removeFromCart(line.id)}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className={styles.total}>
            Total <strong>{formatPrice(totalCents)}</strong>
          </p>
        </>
      )}
    </section>
  );
}
