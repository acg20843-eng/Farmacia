import PageTitle from "../../components/common/PageTitle";
import EmptyState from "../../components/common/EmptyState";

export default function Productos() {
  return (
    <div>
      <PageTitle title="Productos" description="Consulta y administra el catálogo de productos." />
      <button type="button">Agregar producto</button>
      <div>
        <label htmlFor="buscar-producto">Buscar producto</label>
        <input id="buscar-producto" type="search" placeholder="Código o nombre del producto" />
      </div>
      <EmptyState message="La tabla de productos se conectará con la API." />
    </div>
  );
}
