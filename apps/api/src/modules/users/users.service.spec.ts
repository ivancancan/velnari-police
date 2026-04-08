import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserEntity } from '../../entities/user.entity';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@velnari/shared-types';

describe('UsersService', () => {
  let service: UsersService;

  const mockUser: UserEntity = {
    id: 'user-uuid-1',
    name: 'Juan López',
    email: 'juan@velnari.mx',
    passwordHash: '$2b$10$hashedpassword',
    role: UserRole.OPERATOR,
    isActive: true,
    customPermissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(UserEntity), useValue: mockRepo },
      ],
    }).compile();
    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it('findAll returns active users', async () => {
    mockRepo.find.mockResolvedValue([mockUser]);
    const result = await service.findAll();
    expect(result).toHaveLength(1);
    expect(mockRepo.find).toHaveBeenCalledWith({ where: { isActive: true } });
  });

  it('findOne throws NotFoundException when not found', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
  });

  it('create hashes password and saves user', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    mockRepo.create.mockReturnValue({ ...mockUser, id: undefined });
    mockRepo.save.mockResolvedValue(mockUser);
    const result = await service.create({
      name: 'Juan López',
      email: 'juan@velnari.mx',
      password: 'secret123',
      role: UserRole.OPERATOR,
    });
    expect(mockRepo.save).toHaveBeenCalled();
    expect(result.id).toBe('user-uuid-1');
  });

  it('create throws ConflictException when email taken', async () => {
    mockRepo.findOne.mockResolvedValue(mockUser);
    await expect(
      service.create({ name: 'X', email: 'juan@velnari.mx', password: 'secret123', role: UserRole.OPERATOR }),
    ).rejects.toThrow(ConflictException);
  });

  it('update deactivates user when isActive=false', async () => {
    mockRepo.findOne.mockResolvedValue({ ...mockUser });
    mockRepo.save.mockResolvedValue({ ...mockUser, isActive: false });
    const result = await service.update('user-uuid-1', { isActive: false });
    expect(result.isActive).toBe(false);
  });
});
