import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserEntity } from '../../entities/user.entity';
import { UserRole } from '@velnari/shared-types';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;

  const mockUser: UserEntity = {
    id: 'user-uuid-1',
    email: 'operador@corp.gob.mx',
    passwordHash: '',
    role: UserRole.OPERATOR,
    name: 'Juan Operador',
    isActive: true,
    customPermissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        'jwt.secret': 'test_secret',
        'jwt.expiresIn': '15m',
        'jwt.refreshSecret': 'test_refresh_secret',
        'jwt.refreshExpiresIn': '7d',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(UserEntity), useValue: mockUserRepository },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('retorna usuario si las credenciales son correctas', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        passwordHash: hashedPassword,
      });

      const result = await service.validateUser('operador@corp.gob.mx', 'password123');

      expect(result).not.toBeNull();
      expect(result?.email).toBe('operador@corp.gob.mx');
    });

    it('retorna null si el usuario no existe', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.validateUser('noexiste@corp.gob.mx', 'password123');

      expect(result).toBeNull();
    });

    it('retorna null si la contrasena es incorrecta', async () => {
      const hashedPassword = await bcrypt.hash('correct_password', 10);
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        passwordHash: hashedPassword,
      });

      const result = await service.validateUser('operador@corp.gob.mx', 'wrong_password');

      expect(result).toBeNull();
    });

    it('retorna null si el usuario esta inactivo', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        passwordHash: hashedPassword,
        isActive: false,
      });

      const result = await service.validateUser('operador@corp.gob.mx', 'password123');

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('retorna access y refresh tokens', async () => {
      mockJwtService.signAsync
        .mockResolvedValueOnce('access_token_mock')
        .mockResolvedValueOnce('refresh_token_mock');

      const result = await service.login(mockUser);

      expect(result.accessToken).toBe('access_token_mock');
      expect(result.refreshToken).toBe('refresh_token_mock');
      expect(result.expiresIn).toBe(900);
    });
  });

  describe('refreshToken', () => {
    it('retorna nuevo accessToken a partir del userId y role', async () => {
      mockJwtService.signAsync.mockResolvedValueOnce('new_access_token');
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        passwordHash: 'hashed',
      });

      const result = await service.refreshToken('user-uuid-1', UserRole.OPERATOR);

      expect(result.accessToken).toBe('new_access_token');
      expect(result.expiresIn).toBe(900);
    });
  });
});
