import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginForm from './LoginForm';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/lib/api', () => ({
  authApi: {
    login: jest.fn(),
    me: jest.fn(),
  },
}));

const mockLogin = authApi.login as jest.Mock;
const mockMe = authApi.me as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false });
});

describe('LoginForm', () => {
  it('muestra error si el email es inválido', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'no-es-email');
    await user.type(screen.getByLabelText(/contraseña/i), 'password123');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    expect(await screen.findByText('Email inválido')).toBeInTheDocument();
  });

  it('muestra error si la contraseña es muy corta', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'op@test.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'corta');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    expect(await screen.findByText('Mínimo 8 caracteres')).toBeInTheDocument();
  });

  it('llama a authApi.login con los datos del form y redirige a /command', async () => {
    mockLogin.mockResolvedValue({
      data: { accessToken: 'at-123', refreshToken: 'rt-456', expiresIn: 900 },
    });
    mockMe.mockResolvedValue({
      data: { id: 'u1', email: 'op@test.com', name: 'Operator', role: 'operator' },
    });

    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'op@test.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'password123');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('op@test.com', 'password123');
      expect(mockPush).toHaveBeenCalledWith('/command');
    });
  });

  it('muestra mensaje de error en credenciales incorrectas', async () => {
    mockLogin.mockRejectedValue(new Error('401'));

    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'op@test.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    expect(await screen.findByText('Credenciales incorrectas.')).toBeInTheDocument();
  });
});
