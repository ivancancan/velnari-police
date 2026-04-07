import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateIncidentModal from './CreateIncidentModal';
import { incidentsApi } from '@/lib/api';
import { useIncidentsStore } from '@/store/incidents.store';
import { IncidentPriority, IncidentStatus, IncidentType } from '@velnari/shared-types';

jest.mock('@/lib/api', () => ({
  incidentsApi: {
    create: jest.fn(),
  },
}));

const mockCreate = incidentsApi.create as jest.Mock;

const mockCreatedIncident = {
  id: 'inc-new',
  folio: 'IC-002',
  type: IncidentType.ROBBERY,
  priority: IncidentPriority.HIGH,
  status: IncidentStatus.OPEN,
  lat: 19.4326,
  lng: -99.1332,
  createdBy: 'user-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

beforeEach(() => {
  jest.clearAllMocks();
  useIncidentsStore.setState({ incidents: [], selectedId: null, isLoading: false });
});

describe('CreateIncidentModal', () => {
  it('muestra el formulario con campos tipo y prioridad', () => {
    render(<CreateIncidentModal onClose={jest.fn()} />);
    expect(screen.getByLabelText(/tipo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/prioridad/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/latitud/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/longitud/i)).toBeInTheDocument();
  });

  it('muestra error de validación si lat está vacío', async () => {
    const user = userEvent.setup();
    render(<CreateIncidentModal onClose={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: /crear incidente/i }));

    expect(await screen.findByText(/latitud requerida/i)).toBeInTheDocument();
  });

  it('llama a incidentsApi.create y cierra el modal al enviar correctamente', async () => {
    mockCreate.mockResolvedValue({ data: mockCreatedIncident });
    const onClose = jest.fn();
    const user = userEvent.setup();

    render(<CreateIncidentModal onClose={onClose} />);

    await user.selectOptions(screen.getByLabelText(/tipo/i), 'robbery');
    await user.selectOptions(screen.getByLabelText(/prioridad/i), 'high');
    await user.clear(screen.getByLabelText(/latitud/i));
    await user.type(screen.getByLabelText(/latitud/i), '19.4326');
    await user.clear(screen.getByLabelText(/longitud/i));
    await user.type(screen.getByLabelText(/longitud/i), '-99.1332');

    await user.click(screen.getByRole('button', { name: /crear incidente/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'robbery',
          priority: 'high',
          lat: 19.4326,
          lng: -99.1332,
        }),
      );
      expect(onClose).toHaveBeenCalled();
    });
  });
});
