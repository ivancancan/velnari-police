export default function CreateIncidentModal({ onClose }: { onClose: () => void }) {
  return (
    <div>
      <button onClick={onClose}>Cerrar</button>
    </div>
  );
}
