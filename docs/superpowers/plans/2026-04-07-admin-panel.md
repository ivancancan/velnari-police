# Admin Panel (User Management) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web admin panel for creating, editing, and deactivating users (operators, field units, supervisors, commanders).

**Architecture:** Add a `UsersModule` to the NestJS API with standard CRUD endpoints guarded by ADMIN role. On the web, add `/admin` page (accessible from Command) with a user table, create modal, and edit modal — all using the existing axios `api` instance and Tailwind dark-mode styles.

**Tech Stack:** NestJS + TypeORM + bcrypt (API), Next.js 14 + React + Tailwind (web), Jest (tests).

---

## File Structure

**New files:**
- `packages/shared-types/src/dto/users/create-user.dto.ts` — DTO with name, email, password, role, badgeNumber, sectorId
- `packages/shared-types/src/dto/users/update-user.dto.ts` — PartialType of CreateUserDto minus password; add optional `isActive`
- `apps/api/src/modules/users/users.service.ts` — findAll, findOne, create (bcrypt hash), update, deactivate
- `apps/api/src/modules/users/users.controller.ts` — GET/POST/PATCH endpoints, ADMIN-only guards
- `apps/api/src/modules/users/users.module.ts` — module declaration
- `apps/web/src/components/admin/UserTable.tsx` — table listing users with status badge and action buttons
- `apps/web/src/components/admin/UserFormModal.tsx` — form for create/edit with role selector
- `apps/web/src/app/admin/page.tsx` — admin page orchestrating table + modals

**Modified files:**
- `packages/shared-types/src/index.ts` — export new DTOs
- `apps/api/src/app.module.ts` — import UsersModule
- `apps/web/src/lib/types.ts` — add `User` interface
- `apps/web/src/lib/api.ts` — add `usersApi`

---

## Task 1: shared-types — CreateUserDto + UpdateUserDto

**Files:**
- Create: `packages/shared-types/src/dto/users/create-user.dto.ts`
- Create: `packages/shared-types/src/dto/users/update-user.dto.ts`
- Modify: `packages/shared-types/src/index.ts`

- [ ] **Step 1: Create create-user.dto.ts**

```typescript
// packages/shared-types/src/dto/users/create-user.dto.ts
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../enums/role.enum';

export class CreateUserDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsEnum(UserRole)
  role!: UserRole;

  @IsOptional()
  @IsString()
  badgeNumber?: string;

  @IsOptional()
  @IsUUID()
  sectorId?: string;
}
```

- [ ] **Step 2: Create update-user.dto.ts**

```typescript
// packages/shared-types/src/dto/users/update-user.dto.ts
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../enums/role.enum';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsString()
  badgeNumber?: string;

  @IsOptional()
  @IsUUID()
  sectorId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

- [ ] **Step 3: Export from index.ts**

Open `packages/shared-types/src/index.ts`. Add after the auth exports:

```typescript
// DTOs — Users
export * from './dto/users/create-user.dto';
export * from './dto/users/update-user.dto';
```

- [ ] **Step 4: Build shared-types**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/packages/shared-types" && pnpm build 2>&1 | tail -5
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari" && git add packages/shared-types/src/dto/users/ packages/shared-types/src/index.ts && git commit -m "feat: add CreateUserDto and UpdateUserDto to shared-types"
```

---

## Task 2: Backend — UsersService + UsersController + UsersModule

**Files:**
- Create: `apps/api/src/modules/users/users.service.ts`
- Create: `apps/api/src/modules/users/users.controller.ts`
- Create: `apps/api/src/modules/users/users.module.ts`
- Create: `apps/api/src/modules/users/users.service.spec.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/users/users.service.spec.ts`:

```typescript
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
    mockRepo.findOne.mockResolvedValue(null); // email not taken
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api" && npx jest users.service.spec --no-coverage 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module './users.service'`

- [ ] **Step 3: Implement UsersService**

Create `apps/api/src/modules/users/users.service.ts`:

```typescript
// apps/api/src/modules/users/users.service.ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../../entities/user.entity';
import type { CreateUserDto, UpdateUserDto } from '@velnari/shared-types';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
  ) {}

  findAll(): Promise<UserEntity[]> {
    return this.repo.find({ where: { isActive: true } });
  }

  async findOne(id: string): Promise<UserEntity> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`Usuario ${id} no encontrado`);
    return user;
  }

  async create(dto: CreateUserDto): Promise<UserEntity> {
    const existing = await this.repo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException(`El email ${dto.email} ya está registrado`);

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.repo.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      role: dto.role,
      badgeNumber: dto.badgeNumber,
      sectorId: dto.sectorId,
    });
    return this.repo.save(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    const user = await this.findOne(id);
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.badgeNumber !== undefined) user.badgeNumber = dto.badgeNumber;
    if (dto.sectorId !== undefined) user.sectorId = dto.sectorId;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.password) user.passwordHash = await bcrypt.hash(dto.password, 10);
    return this.repo.save(user);
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api" && npx jest users.service.spec --no-coverage 2>&1 | tail -10
```

Expected: PASS — 5 tests passed.

- [ ] **Step 5: Create UsersController**

Create `apps/api/src/modules/users/users.controller.ts`:

```typescript
// apps/api/src/modules/users/users.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole, CreateUserDto, UpdateUserDto } from '@velnari/shared-types';
import type { UserEntity } from '../../entities/user.entity';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  findAll(): Promise<UserEntity[]> {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserEntity> {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateUserDto): Promise<UserEntity> {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserEntity> {
    return this.service.update(id, dto);
  }
}
```

- [ ] **Step 6: Create UsersModule**

Create `apps/api/src/modules/users/users.module.ts`:

```typescript
// apps/api/src/modules/users/users.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../../entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

- [ ] **Step 7: Register in app.module.ts**

Read `apps/api/src/app.module.ts`. Add `UsersModule` to the imports array. Add the import statement:
```typescript
import { UsersModule } from './modules/users/users.module';
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/api" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari" && git add apps/api/src/modules/users/ apps/api/src/app.module.ts && git commit -m "feat: add UsersModule with CRUD endpoints (admin-only)"
```

---

## Task 3: Web — Admin page + UserTable + UserFormModal

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/components/admin/UserTable.tsx`
- Create: `apps/web/src/components/admin/UserFormModal.tsx`
- Create: `apps/web/src/app/admin/page.tsx`

- [ ] **Step 1: Add User type to types.ts**

Open `apps/web/src/lib/types.ts`. Add at the end:

```typescript
export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  badgeNumber?: string;
  sectorId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Add usersApi to api.ts**

Open `apps/web/src/lib/api.ts`. Add `User` to the types import. Add at the end of the file:

```typescript
// ─── Users ───────────────────────────────────────────────────────────────────

export const usersApi = {
  getAll: () => api.get<User[]>('/users'),

  create: (dto: {
    name: string;
    email: string;
    password: string;
    role: string;
    badgeNumber?: string;
    sectorId?: string;
  }) => api.post<User>('/users', dto),

  update: (
    id: string,
    dto: {
      name?: string;
      role?: string;
      badgeNumber?: string;
      sectorId?: string;
      isActive?: boolean;
      password?: string;
    },
  ) => api.patch<User>(`/users/${id}`, dto),
};
```

- [ ] **Step 3: Create UserTable.tsx**

Create `apps/web/src/components/admin/UserTable.tsx`:

```tsx
// apps/web/src/components/admin/UserTable.tsx
import type { User } from '@/lib/types';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  commander: 'Comandante',
  supervisor: 'Supervisor',
  operator: 'Operador',
  field_unit: 'Unidad',
};

interface UserTableProps {
  users: User[];
  onEdit: (user: User) => void;
  onDeactivate: (user: User) => void;
}

export default function UserTable({ users, onEdit, onDeactivate }: UserTableProps) {
  if (users.length === 0) {
    return <p className="text-slate-gray text-sm py-8 text-center">Sin usuarios registrados.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-slate-gray uppercase border-b border-slate-700">
          <tr>
            <th className="py-3 px-4">Nombre</th>
            <th className="py-3 px-4">Email</th>
            <th className="py-3 px-4">Rol</th>
            <th className="py-3 px-4">Placa</th>
            <th className="py-3 px-4">Estado</th>
            <th className="py-3 px-4">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-slate-800 hover:bg-slate-800/40">
              <td className="py-3 px-4 text-signal-white">{u.name}</td>
              <td className="py-3 px-4 text-slate-gray">{u.email}</td>
              <td className="py-3 px-4">
                <span className="px-2 py-0.5 rounded text-xs bg-tactical-blue/20 text-tactical-blue">
                  {ROLE_LABELS[u.role] ?? u.role}
                </span>
              </td>
              <td className="py-3 px-4 text-slate-gray">{u.badgeNumber ?? '—'}</td>
              <td className="py-3 px-4">
                {u.isActive ? (
                  <span className="text-green-400 text-xs">Activo</span>
                ) : (
                  <span className="text-red-400 text-xs">Inactivo</span>
                )}
              </td>
              <td className="py-3 px-4 flex gap-2">
                <button
                  onClick={() => onEdit(u)}
                  className="text-xs text-tactical-blue hover:underline"
                >
                  Editar
                </button>
                {u.isActive && (
                  <button
                    onClick={() => onDeactivate(u)}
                    className="text-xs text-red-400 hover:underline"
                  >
                    Desactivar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Create UserFormModal.tsx**

Create `apps/web/src/components/admin/UserFormModal.tsx`:

```tsx
// apps/web/src/components/admin/UserFormModal.tsx
'use client';

import { useState } from 'react';
import type { User } from '@/lib/types';

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'commander', label: 'Comandante' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'operator', label: 'Operador' },
  { value: 'field_unit', label: 'Unidad de Campo' },
];

interface UserFormModalProps {
  user?: User | null;
  onSubmit: (data: {
    name: string;
    email: string;
    password: string;
    role: string;
    badgeNumber: string;
  }) => Promise<void>;
  onClose: () => void;
}

export default function UserFormModal({ user, onSubmit, onClose }: UserFormModalProps) {
  const isEdit = !!user;
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(user?.role ?? 'operator');
  const [badgeNumber, setBadgeNumber] = useState(user?.badgeNumber ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEdit && password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onSubmit({ name, email, password, role, badgeNumber });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 w-full max-w-md shadow-xl">
        <h2 className="text-signal-white font-semibold text-lg mb-4">
          {isEdit ? 'Editar usuario' : 'Nuevo usuario'}
        </h2>

        {error && (
          <p className="text-red-400 text-xs mb-3 bg-red-950 border border-red-800 rounded px-3 py-2">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-slate-gray text-xs block mb-1">Nombre completo</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-signal-white text-sm focus:outline-none focus:border-tactical-blue"
            />
          </div>

          {!isEdit && (
            <div>
              <label className="text-slate-gray text-xs block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-signal-white text-sm focus:outline-none focus:border-tactical-blue"
              />
            </div>
          )}

          <div>
            <label className="text-slate-gray text-xs block mb-1">
              {isEdit ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!isEdit}
              minLength={8}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-signal-white text-sm focus:outline-none focus:border-tactical-blue"
            />
          </div>

          <div>
            <label className="text-slate-gray text-xs block mb-1">Rol</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-signal-white text-sm focus:outline-none focus:border-tactical-blue"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-gray text-xs block mb-1">Número de placa (opcional)</label>
            <input
              value={badgeNumber}
              onChange={(e) => setBadgeNumber(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-signal-white text-sm focus:outline-none focus:border-tactical-blue"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-tactical-blue hover:bg-blue-600 disabled:opacity-50 text-white rounded py-2 text-sm font-medium"
            >
              {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear usuario'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-signal-white rounded py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create admin page**

Create `apps/web/src/app/admin/page.tsx`:

```tsx
// apps/web/src/app/admin/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { usersApi } from '@/lib/api';
import UserTable from '@/components/admin/UserTable';
import UserFormModal from '@/components/admin/UserFormModal';
import type { User } from '@/lib/types';
import Link from 'next/link';

export default function AdminPage() {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);

  useEffect(() => {
    if (!isAuthenticated) { router.push('/login'); return; }
    if (user?.role !== 'admin') { router.push('/command'); return; }
  }, [isAuthenticated, user, router]);

  function loadUsers() {
    setLoading(true);
    usersApi.getAll()
      .then((res) => setUsers(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadUsers(); }, []);

  async function handleCreate(data: {
    name: string; email: string; password: string; role: string; badgeNumber: string;
  }) {
    await usersApi.create({
      name: data.name,
      email: data.email,
      password: data.password,
      role: data.role,
      badgeNumber: data.badgeNumber || undefined,
    });
    loadUsers();
  }

  async function handleEdit(data: {
    name: string; email: string; password: string; role: string; badgeNumber: string;
  }) {
    if (!editUser) return;
    await usersApi.update(editUser.id, {
      name: data.name,
      role: data.role,
      badgeNumber: data.badgeNumber || undefined,
      password: data.password || undefined,
    });
    loadUsers();
  }

  async function handleDeactivate(u: User) {
    if (!confirm(`¿Desactivar a ${u.name}?`)) return;
    await usersApi.update(u.id, { isActive: false });
    loadUsers();
  }

  return (
    <div className="min-h-screen bg-midnight-command text-signal-white">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <h1 className="text-lg font-semibold tracking-wide">Gestión de Usuarios</h1>
        <div className="flex items-center gap-4">
          <Link href="/command" className="text-xs text-slate-gray hover:text-signal-white">
            ← Centro de Mando
          </Link>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-tactical-blue hover:bg-blue-600 text-white text-xs px-3 py-2 rounded font-medium"
          >
            + Nuevo usuario
          </button>
        </div>
      </header>

      <main className="p-6">
        {loading ? (
          <p className="text-slate-gray text-sm">Cargando usuarios...</p>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-lg">
            <UserTable
              users={users}
              onEdit={(u) => setEditUser(u)}
              onDeactivate={handleDeactivate}
            />
          </div>
        )}
      </main>

      {showCreate && (
        <UserFormModal
          onSubmit={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}

      {editUser && (
        <UserFormModal
          user={editUser}
          onSubmit={handleEdit}
          onClose={() => setEditUser(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 6: Add Admin link to CommandPage header**

Read `apps/web/src/app/command/page.tsx`. Find the header area. Add a link to admin only for admin users:

```tsx
{user?.role === 'admin' && (
  <Link href="/admin" className="text-xs text-slate-gray hover:text-signal-white">
    Usuarios
  </Link>
)}
```

Add this alongside the existing "Dashboard →" link.

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari/apps/web" && npx tsc --noEmit 2>&1 | head -15
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd "/Users/ivanrdz/Desktop/Proyectos/EarthRanger para policias/velnari" && git add apps/web/src/lib/types.ts apps/web/src/lib/api.ts apps/web/src/components/admin/ apps/web/src/app/admin/ apps/web/src/app/command/page.tsx && git commit -m "feat: add admin panel for user management"
```

---

## Self-Review

**Spec coverage:**
- ✅ List users — `GET /users` + `UserTable` showing name, email, role, badge, status
- ✅ Create user — `POST /users` + `UserFormModal` with all fields + password hashing
- ✅ Edit user — `PATCH /users/:id` + edit modal pre-filled
- ✅ Deactivate user — `PATCH /users/:id` with `{ isActive: false }` + confirm dialog
- ✅ Admin-only access — `@Roles(UserRole.ADMIN)` on controller + redirect in page
- ✅ Link from Command page — visible only to admin role

**Placeholder scan:** None found. All code complete.

**Type consistency:**
- `User` interface in `types.ts` matches `UserEntity` fields ✅
- `usersApi.create` dto matches `CreateUserDto` fields ✅
- `usersApi.update` dto matches `UpdateUserDto` fields ✅
