import type { IncidentPriority, IncidentStatus, IncidentType, UnitStatus } from '@velnari/shared-types';

export interface Unit {
  id: string;
  callSign: string;
  status: UnitStatus;
  sectorId?: string;
  shift?: string;
  isActive: boolean;
  lastLocationAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UnitPosition {
  unitId: string;
  lat: number;
  lng: number;
  timestamp: string;
}

export interface IncidentEvent {
  id: string;
  incidentId: string;
  type: string;
  description: string;
  actorId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface Incident {
  id: string;
  folio: string;
  type: IncidentType;
  priority: IncidentPriority;
  status: IncidentStatus;
  address?: string;
  description?: string;
  lat: number;
  lng: number;
  sectorId?: string;
  assignedUnitId?: string;
  createdBy: string;
  assignedAt?: string;
  arrivedAt?: string;
  closedAt?: string;
  resolution?: string;
  events?: IncidentEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface Sector {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
}
