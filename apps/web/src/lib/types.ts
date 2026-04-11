import type { IncidentPriority, IncidentStatus, IncidentType, UnitStatus } from '@velnari/shared-types';

export interface Unit {
  id: string;
  callSign: string;
  status: UnitStatus;
  sectorId?: string;
  shift?: string;
  isActive: boolean;
  lat?: number | null;
  lng?: number | null;
  lastLocationAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UnitPosition {
  unitId: string;
  lat: number;
  lng: number;
  timestamp: string;
  batteryLevel?: number;
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

export interface IncidentAssignment {
  id: string;
  unitId: string;
  unit?: { callSign: string; status: string };
  assignedAt: string;
  unassignedAt?: string;
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
  assignments?: IncidentAssignment[];
  createdAt: string;
  updatedAt: string;
}

export interface Sector {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
}

export interface LocationHistoryPoint {
  id: string;
  lat: number;
  lng: number;
  recordedAt: string;
}

export interface IncidentStats {
  total: number;
  open: number;
  assigned: number;
  closed: number;
  byPriority: Record<string, number>;
  byType: Record<string, number>;
  avgResponseMinutes: number | null;
}

export interface UnitStats {
  total: number;
  available: number;
  enRoute: number;
  onScene: number;
  outOfService: number;
}

export interface UnitWithDistance extends Unit {
  distanceKm: number;
}

export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: [number, number][][];
}

export interface SectorWithBoundary extends Sector {
  boundaryGeoJson: GeoJsonPolygon | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  badgeNumber?: string;
  sectorId?: string;
  shift?: string;
  customPermissions: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UnitReportStats {
  totalIncidents: number;
  closedIncidents: number;
  avgResponseMinutes: number | null;
  gpsPointsRecorded: number;
}

export interface UnitReport {
  unit: { id: string; callSign: string; status: string };
  period: { from: string; to: string };
  stats: UnitReportStats;
  incidents: Incident[];
}

export interface Attachment {
  id: string;
  incidentId: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
  uploadedBy: string;
  createdAt: string;
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  weight: number;
}

export interface Patrol {
  id: string;
  unitId: string;
  sectorId: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  startAt: string;
  endAt: string;
  createdBy: string;
  createdAt: string;
  unit?: { id: string; callSign: string };
  sector?: { id: string; name: string; color: string };
}

export interface DailySummary {
  date: string;
  totalIncidents: number;
  closedIncidents: number;
  openIncidents: number;
  avgResponseMinutes: number | null;
  busiestSector: { name: string; count: number } | null;
  bestUnit: { callSign: string; avgResponseMin: number } | null;
  worstHour: { hour: number; count: number } | null;
  comparedToYesterday: { incidents: number; responseTime: number | null };
}

export interface PatrolCoverage {
  patrolId: string;
  pings: number;
  startAt: string;
  endAt: string;
}

export interface UnitScore {
  unitId: string;
  callSign: string;
  totalIncidents: number;
  avgResponseMinutes: number | null;
  totalGpsPoints: number;
  hoursOnDuty: number;
  score: number;
}

export interface SuggestedUnit {
  unitId: string;
  callSign: string;
  distanceKm: number;
  incidentsToday: number;
  score: number;
}

export interface AnalyticsResult {
  period: { from: string; to: string };
  summary: {
    totalIncidents: number;
    closedIncidents: number;
    openIncidents: number;
    avgResponseMinutes: number | null;
    avgCloseMinutes: number | null;
  };
  byPriority: Record<string, number>;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byHour: { hour: number; count: number }[];
  byDay: { date: string; count: number }[];
  bySector: { sectorId: string; sectorName: string; count: number }[];
  byUnit: { unitId: string; callSign: string; count: number; avgResponseMin: number | null }[];
  incidents: { id: string; folio: string; type: string; priority: string; status: string; createdAt: string; address?: string; patrolId?: string }[];
}

export interface SlaComplianceRow {
  priority: IncidentPriority;
  targetMinutes: number;
  avgMinutes: number | null;
  compliantCount: number;
  totalCount: number;
  compliancePct: number;
}

export interface SlaCompliance {
  byPriority: SlaComplianceRow[];
  overallPct: number;
}
