import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AssignUnitModal from './AssignUnitModal';
import { useUnitsStore } from '@/store/units.store';
import { useIncidentsStore } from '@/store/incidents.store';
import { dispatchApi } from '@/lib/api';
import { UnitStatus, IncidentPriority, IncidentStatus, IncidentType } from '@velnari/shared-types';
import type { Unit } from '@/lib/types';

jest.mock('@/lib/api', () => ({
  dispatchApi: {
    assignUnit: jest.fn(),
  },
}));

const mockAssign = dispatchApi.assignUnit as jest.Mock;

const mockUnit: Unit = {
  id: 'unit-1',
  callSign: 'P-14',
  status: UnitStatus.AVAILABLE,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockUpdatedIncident = {
  id: 'inc-1',
  folio: 'IC-001',
  type: IncidentType.ROBBERY,
  priority: IncidentPriority.HIGH,
  status: IncidentStatus.ASSIGNED,
  assignedUnitId: 'unit-1',
  lat: 19.43,
  lng: -99.13,
  createdBy: 'user-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

beforeEach(() => {
  jest.clearAllMocks();
  useUnitsStore.setState({ units: [mockUnit], positions: {}, isLoading: false });
  useIncidentsStore.setState({ incidents: [], selectedId: null, isLoading: false });
});

describe('AssignUnitModal', () => {
  it('muestra las unidades disponibles', () => {
    render(<AssignUnitModal incidentId="inc-1" onClose={jest.fn()} />);
    expect(screen.getByText('P-14')).toBeInTheDocument();
  });

  it('muestra mensaje si no hay unidades disponibles', () => {
    useUnitsStore.setState({ units: [], positions: {}, isLoading: false });
    render(<AssignUnitModal incidentId="inc-1" onClose={jest.fn()} />);
    expect(screen.getByText(/sin unidades disponibles/i)).toBeInTheDocument();
  });

  it('llama a dispatchApi.assignUnit al seleccionar una unidad', async () => {
    mockAssign.mockResolvedValue({ data: mockUpdatedIncident });
    const onClose = jest.fn();
    const user = userEvent.setup();

    render(<AssignUnitModal incidentId="inc-1" onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /asignar p-14/i }));

    await waitFor(() => {
      expect(mockAssign).toHaveBeenCalledWith('inc-1', 'unit-1');
      expect(onClose).toHaveBeenCalled();
    });
  });
});
