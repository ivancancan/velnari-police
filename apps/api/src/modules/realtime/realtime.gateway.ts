import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Server, Socket } from 'socket.io';

// Rooms:
//   'command'             → all operators and supervisors (Command view)
//   'sector:{sectorId}'   → units in a specific sector
//   'incident:{id}'       → tracking a specific incident
//   'unit:{unitId}'       → dedicated room for a specific unit (mobile)

@WebSocketGateway({
  cors: {
    origin: process.env['ALLOWED_ORIGINS']?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  },
  namespace: '/',
  pingInterval: 25000,
  pingTimeout: 20000,
})
export class RealtimeGateway {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  // ─── Presence tracking ────────────────────────────────────────────────────
  /** userId → Set of connected socketIds (one user can have multiple tabs/devices) */
  private readonly connectedUsers = new Map<string, Set<string>>();
  /** socketId → userId (reverse lookup for disconnect cleanup) */
  private readonly socketUserMap = new Map<string, string>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Connection lifecycle ─────────────────────────────────────────────────

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        client.handshake.auth?.token ??
        client.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        this.logger.warn(`Client ${client.id} disconnected: no token`);
        client.disconnect();
        return;
      }
      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = this.jwtService.verify(token, { secret });
      (client as any).user = payload;

      const userId: string = payload.sub ?? payload.id;
      this.logger.log(`Client ${client.id} authenticated as ${payload.email ?? userId}`);

      // Track presence
      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, new Set());
      }
      this.connectedUsers.get(userId)!.add(client.id);
      this.socketUserMap.set(client.id, userId);

      // Notify command room about presence change
      this.server.to('command').emit('presence:update', {
        onlineCount: this.getOnlineCount(),
        userId,
        status: 'connected',
      });
    } catch {
      this.logger.warn(`Client ${client.id} disconnected: invalid token`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = this.socketUserMap.get(client.id);
    if (!userId) return;

    // Remove this socket from the user's set
    const sockets = this.connectedUsers.get(userId);
    if (sockets) {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.connectedUsers.delete(userId);
      }
    }
    this.socketUserMap.delete(client.id);

    this.logger.log(`Client ${client.id} disconnected (user ${userId})`);

    // Notify command room about presence change
    this.server.to('command').emit('presence:update', {
      onlineCount: this.getOnlineCount(),
      userId,
      status: 'disconnected',
    });
  }

  // ─── Presence query helpers ───────────────────────────────────────────────

  /** Returns the set of unique user IDs currently connected */
  getOnlineUserIds(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  /** Returns the number of unique users currently connected */
  getOnlineCount(): number {
    return this.connectedUsers.size;
  }

  // ─── Client events (received from client) ───────────────────────────────

  @SubscribeMessage('join:command')
  handleJoinCommand(@ConnectedSocket() client: Socket): void {
    void client.join('command');
    this.logger.log(`Client ${client.id} joined room: command`);
  }

  @SubscribeMessage('join:sector')
  handleJoinSector(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sectorId: string },
  ): void {
    const room = `sector:${data.sectorId}`;
    void client.join(room);
    this.logger.log(`Client ${client.id} joined room: ${room}`);
  }

  @SubscribeMessage('join:incident')
  handleJoinIncident(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { incidentId: string },
  ): void {
    const room = `incident:${data.incidentId}`;
    void client.join(room);
    this.logger.log(`Client ${client.id} joined room: ${room}`);
  }

  @SubscribeMessage('join:unit')
  handleJoinUnit(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { unitId: string },
  ): void {
    const room = `unit:${data.unitId}`;
    void client.join(room);
    this.logger.log(`Client ${client.id} joined room: ${room}`);
  }

  // ─── Server events (emitted from services) ────────────────────────────────

  emitUnitLocationChanged(
    sectorId: string | undefined,
    payload: { unitId: string; lat: number; lng: number; timestamp: string },
  ): void {
    // Always emit to command room (all operators/supervisors watching the map)
    this.server.to('command').emit('unit:location:changed', payload);
    // Also emit to the sector room if applicable
    if (sectorId) {
      this.server.to(`sector:${sectorId}`).emit('unit:location:changed', payload);
    }
  }

  emitUnitStatusChanged(payload: {
    unitId: string;
    status: string;
    previousStatus: string;
  }): void {
    this.server.to('command').emit('unit:status:changed', payload);
    // Also emit to the unit's dedicated room (mobile app)
    this.server.to(`unit:${payload.unitId}`).emit('unit:status:changed', payload);
  }

  emitIncidentCreated(incident: Record<string, unknown>): void {
    this.server.to('command').emit('incident:created', incident);
  }

  emitIncidentAssigned(incidentId: string, unitId: string, etaMinutes: number | null = null): void {
    const payload = { incidentId, unitId, etaMinutes };
    this.server.to('command').emit('incident:assigned', payload);
    this.server.to(`incident:${incidentId}`).emit('incident:assigned', payload);
    // Also emit to the unit's dedicated room (mobile app gets direct notification)
    this.server.to(`unit:${unitId}`).emit('incident:assigned', payload);
  }

  emitIncidentUpdated(incidentId: string, incident: Record<string, unknown>): void {
    this.server.to('command').emit('incident:updated', { incidentId, ...incident });
    this.server.to(`incident:${incidentId}`).emit('incident:updated', { incidentId, ...incident });
  }

  emitIncidentStatusChanged(incidentId: string, status: string): void {
    this.server
      .to(`incident:${incidentId}`)
      .emit('incident:status:changed', { incidentId, status });
  }

  emitIncidentClosed(incidentId: string, resolution: string): void {
    this.server
      .to('command')
      .emit('incident:closed', { incidentId, resolution });
  }

  emitGeofenceEntered(payload: {
    unitId: string;
    callSign: string;
    sectorId: string;
    sectorName: string;
  }): void {
    this.server.to('command').emit('geofence:entered', payload);
  }

  emitGeofenceExited(payload: {
    unitId: string;
    callSign: string;
    sectorId: string;
    sectorName: string;
  }): void {
    this.server.to('command').emit('geofence:exited', payload);
  }

  emitUnitGpsStale(payload: {
    unitId: string;
    callSign: string;
    minutesSinceLastPing: number | null;
  }): void {
    this.server.to('command').emit('unit:gps:stale', payload);
  }

  emitChatMessage(roomId: string, message: Record<string, unknown>): void {
    this.server.to(roomId).emit('chat:message', message);
    // Also emit to command room so operators always see chat
    if (roomId !== 'command') {
      this.server.to('command').emit('chat:message', message);
    }
  }
}
