import PageTitle from "../../components/common/PageTitle";
import EmptyState from "../../components/common/EmptyState";

export default function Categorias() {
  return (
    <div>
      <PageTitle title="Categorías" description="Organiza los productos de la farmacia." />
      <button type="button">Agregar categoría</button>
    </div>
  );
}
