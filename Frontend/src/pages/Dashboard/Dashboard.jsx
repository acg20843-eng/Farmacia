import PageTitle from "../../components/common/PageTitle";
import EmptyState from "../../components/common/EmptyState";

export default function Dashboard() {
  // Las alertas se conectarán a la API cuando revisemos las rutas del backend.
  // La caducidad se calcula por lote, no solamente por producto.
  return (
    <div>
      <PageTitle
        title="Panel principal"
        description="Resumen de alertas importantes del inventario."
      />

      <section aria-labelledby="caducidad-title">
        <h2 id="caducidad-title">Productos próximos a caducar</h2>
        <EmptyState message="Aquí aparecerán los lotes que estén próximos a su fecha de caducidad." />
      </section>

      <section aria-labelledby="stock-title">
        <h2 id="stock-title">Existencias bajas</h2>
        <EmptyState message="Aquí aparecerán los productos cuya existencia sea igual o menor al stock mínimo." />
      </section>

      <section aria-labelledby="productos-title">
        <h2 id="productos-title">Productos registrados</h2>
        <p>—</p>
      </section>
    </div>
  );
}
