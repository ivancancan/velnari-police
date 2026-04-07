import { useIncidentsStore } from './incidents.store';
import { IncidentPriority, IncidentStatus, IncidentType } from '@velnari/shared-types';
import type { Incident } from '@/lib/types';

const mockIncident: Incident = {
  id: 'inc-1',
  folio: 'IC-001',
  type: IncidentType.ROBBERY,
  priority: IncidentPriority.HIGH,
  status: IncidentStatus.OPEN,
  lat: 19.43,
  lng: -99.13,
  createdBy: 'user-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

beforeEach(() => {
  useIncidentsStore.setState({
    incidents: [],
    selectedId: null,
    isLoading: false,
  });
});

describe('useIncidentsStore', () => {
  it('setIncidents reemplaza la lista', () => {
    useIncidentsStore.getState().setIncidents([mockIncident]);
    expect(useIncidentsStore.getState().incidents).toHaveLength(1);
  });

  it('addIncident inserta al principio', () => {
    useIncidentsStore.getState().setIncidents([mockIncident]);
    const second: Incident = { ...mockIncident, id: 'inc-2', folio: 'IC-002' };
    useIncidentsStore.getState().addIncident(second);
    expect(useIncidentsStore.getState().incidents[0]?.folio).toBe('IC-002');
  });

  it('updateIncident actualiza un incidente específico', () => {
    useIncidentsStore.getState().setIncidents([mockIncident]);
    const updated = { ...mockIncident, status: IncidentStatus.ASSIGNED };
    useIncidentsStore.getState().updateIncident(updated);
    expect(useIncidentsStore.getState().incidents[0]?.status).toBe(IncidentStatus.ASSIGNED);
  });

  it('selectIncident guarda el id seleccionado', () => {
    useIncidentsStore.getState().selectIncident('inc-1');
    expect(useIncidentsStore.getState().selectedId).toBe('inc-1');
  });
});
