import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { ApiKeyEntity } from '../../entities/api-key.entity';

const KEY_PREFIX = 'vnrk_'; // "velnari key" — human-identifiable prefix
const RAW_KEY_BYTES = 24;   // ~32 chars base64url after prefix

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKeyEntity)
    private readonly repo: Repository<ApiKeyEntity>,
  ) {}

  /** Generate a raw key, store the hash, return BOTH the saved row and the
   *  plain key. The caller is responsible for showing the plain key once
   *  and warning the admin that it won't be shown again. */
  async create(params: {
    name: string;
    createdBy: string;
    scopes?: string[];
    tenantId?: string | null;
  }): Promise<{ apiKey: ApiKeyEntity; rawKey: string }> {
    const rawBytes = randomBytes(RAW_KEY_BYTES);
    const rawKey = `${KEY_PREFIX}${rawBytes.toString('base64url')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const prefix = `${KEY_PREFIX}${rawBytes.toString('base64url').slice(0, 4)}`;

    const apiKey = await this.repo.save(
      this.repo.create({
        name: params.name.trim().slice(0, 120),
        keyHash,
        prefix,
        scopes: params.scopes && params.scopes.length > 0 ? params.scopes : ['incident.ingest'],
        createdBy: params.createdBy,
        tenantId: params.tenantId ?? null,
      }),
    );

    return { apiKey, rawKey };
  }

  async list(tenantId?: string | null): Promise<ApiKeyEntity[]> {
    return this.repo.find({
      where: tenantId ? { tenantId } : {},
      order: { createdAt: 'DESC' },
    });
  }

  async revoke(id: string): Promise<void> {
    const key = await this.repo.findOne({ where: { id } });
    if (!key) throw new NotFoundException('API key no encontrada');
    await this.repo.softRemove(key);
  }

  /** Look up by raw key (as sent in the Authorization header). Returns the
   *  key row if valid + active + not expired. Bumps use counters. */
  async verifyAndTouch(rawKey: string, scope: string): Promise<ApiKeyEntity> {
    if (!rawKey || !rawKey.startsWith(KEY_PREFIX)) {
      throw new UnauthorizedException('API key inválida');
    }
    const hash = createHash('sha256').update(rawKey).digest('hex');
    const key = await this.repo.findOne({ where: { keyHash: hash } });
    if (!key || !key.isActive) {
      throw new UnauthorizedException('API key inválida o revocada');
    }
    if (!key.scopes.includes(scope)) {
      throw new UnauthorizedException(`API key no tiene el scope requerido: ${scope}`);
    }

    // Fire-and-forget counter update — we don't want to block ingest on writes.
    void this.repo
      .createQueryBuilder()
      .update(ApiKeyEntity)
      .set({ useCount: () => 'use_count + 1', lastUsedAt: new Date() })
      .where('id = :id', { id: key.id })
      .execute();

    return key;
  }
}
