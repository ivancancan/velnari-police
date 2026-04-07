import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IncidentList from './IncidentList';
import { useIncidentsStore } from '@/store/incidents.store';
import { IncidentPriority, IncidentStatus, IncidentType } from '@velnari/shared-types';
import type { Incident } from '@/lib/types';

jest.mock('@/lib/api', () => ({
  incidentsApi: {
    getAll: jest.fn().mockResolvedValue({ data: [] }),
  },
}));

const mockIncident: Incident = {
  id: 'inc-1',
  folio: 'IC-001',
  type: IncidentType.ROBBERY,
  priority: IncidentPriority.HIGH,
  status: IncidentStatus.OPEN,
  lat: 19.43,
  lng: -99.13,
  address: 'Calle Falsa 123',
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

describe('IncidentList', () => {
  it('muestra mensaje vacío cuando no hay incidentes', () => {
    render(<IncidentList />);
    expect(screen.getByText(/sin incidentes activos/i)).toBeInTheDocument();
  });

  it('renderiza tarjetas por cada incidente', () => {
    useIncidentsStore.setState({ incidents: [mockIncident], selectedId: null, isLoading: false });
    render(<IncidentList />);
    expect(screen.getByLabelText('Incidente IC-001')).toBeInTheDocument();
  });

  it('al hacer click en un incidente lo selecciona en el store', async () => {
    useIncidentsStore.setState({ incidents: [mockIncident], selectedId: null, isLoading: false });
    const user = userEvent.setup();
    render(<IncidentList />);

    await user.click(screen.getByLabelText('Incidente IC-001'));
    expect(useIncidentsStore.getState().selectedId).toBe('inc-1');
  });
});
