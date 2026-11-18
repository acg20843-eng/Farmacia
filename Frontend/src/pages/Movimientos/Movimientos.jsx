import PageTitle from "../../components/common/PageTitle";
import EmptyState from "../../components/common/EmptyState";

export default function Movimientos() {
  return (
    <div>
      <PageTitle title="Movimientos" description="Registra y consulta entradas y salidas del inventario." />
      <button type="button">Registrar entrada</button>
      <button type="button">Registrar salida</button>
      <EmptyState message="El historial de movimientos se conectará con la API." />
    </div>
  );
}
