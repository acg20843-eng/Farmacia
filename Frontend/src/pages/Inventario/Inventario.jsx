import PageTitle from "../../components/common/PageTitle";
import EmptyState from "../../components/common/EmptyState";

export default function Inventario() {
  return (
    <div>
      <PageTitle title="Inventario" description="Consulta y administra los lotes y sus existencias." />
      <button type="button">Registrar lote</button>
      <EmptyState message="La tabla de lotes se conectará con la API." />
    </div>
  );
}
