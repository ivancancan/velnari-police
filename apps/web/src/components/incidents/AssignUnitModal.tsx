export default function AssignUnitModal({
  incidentId,
  onClose,
}: {
  incidentId: string;
  onClose: () => void;
}) {
  return (
    <div>
      <button onClick={onClose}>Cerrar</button>
    </div>
  );
}
