import { render, screen } from '@testing-library/react';
import CommandMap from './CommandMap';
import { useUnitsStore } from '@/store/units.store';
import { useIncidentsStore } from '@/store/incidents.store';
import { UnitStatus, IncidentPriority, IncidentStatus, IncidentType } from '@velnari/shared-types';
import type { Unit } from '@/lib/types';
import type { Incident } from '@/lib/types';

// react-map-gl/maplibre is mocked via moduleNameMapper in jest.config.ts

const mockUnit: Unit = {
  id: 'unit-1',
  callSign: 'P-14',
  status: UnitStatus.AVAILABLE,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

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
  useUnitsStore.setState({ units: [], positions: {}, isLoading: false });
  useIncidentsStore.setState({ incidents: [], selectedId: null, isLoading: false });
});

describe('CommandMap', () => {
  it('renderiza el contenedor del mapa', () => {
    render(<CommandMap />);
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('muestra marcadores para cada unidad con posición', () => {
    useUnitsStore.setState({
      units: [mockUnit],
      positions: {
        'unit-1': { unitId: 'unit-1', lat: 19.43, lng: -99.13, timestamp: '' },
      },
      isLoading: false,
    });

    render(<CommandMap />);
    expect(screen.getByLabelText('Unidad P-14')).toBeInTheDocument();
  });

  it('muestra marcadores para cada incidente activo', () => {
    useIncidentsStore.setState({
      incidents: [mockIncident],
      selectedId: null,
      isLoading: false,
    });

    render(<CommandMap />);
    expect(screen.getByLabelText('Incidente IC-001')).toBeInTheDocument();
  });
});
