import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IncidentDetail from './IncidentDetail';
import { IncidentPriority, IncidentStatus, IncidentType } from '@velnari/shared-types';
import type { Incident } from '@/lib/types';

jest.mock('@/lib/api', () => ({
  incidentsApi: {
    getEvents: jest.fn().mockResolvedValue({ data: [] }),
    close: jest.fn().mockResolvedValue({ data: {} }),
    addNote: jest.fn().mockResolvedValue({ data: {} }),
  },
  dispatchApi: {
    assignUnit: jest.fn().mockResolvedValue({ data: {} }),
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
  description: 'Robo a mano armada',
  createdBy: 'user-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  events: [
    {
      id: 'ev-1',
      incidentId: 'inc-1',
      type: 'created',
      description: 'Incidente IC-001 creado',
      actorId: 'user-1',
      createdAt: new Date().toISOString(),
    },
  ],
};

describe('IncidentDetail', () => {
  it('muestra el folio y la dirección del incidente', () => {
    render(<IncidentDetail incident={mockIncident} onBack={jest.fn()} />);
    expect(screen.getByText('IC-001')).toBeInTheDocument();
    expect(screen.getByText('Calle Falsa 123')).toBeInTheDocument();
  });

  it('muestra los eventos del timeline', () => {
    render(<IncidentDetail incident={mockIncident} onBack={jest.fn()} />);
    expect(screen.getByText('Incidente IC-001 creado')).toBeInTheDocument();
  });

  it('llama a onBack al hacer click en volver', async () => {
    const onBack = jest.fn();
    const user = userEvent.setup();
    render(<IncidentDetail incident={mockIncident} onBack={onBack} />);

    await user.click(screen.getByRole('button', { name: /volver/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('muestra el botón "Asignar unidad" para incidentes abiertos', () => {
    render(<IncidentDetail incident={mockIncident} onBack={jest.fn()} />);
    expect(
      screen.getByRole('button', { name: /asignar unidad/i }),
    ).toBeInTheDocument();
  });
});
