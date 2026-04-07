import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';

// Rooms:
//   'command'           → all operators and supervisors (Command view)
//   'sector:{sectorId}' → units in a specific sector
//   'incident:{id}'     → tracking a specific incident

@WebSocketGateway({
  cors: {
    origin: process.env['ALLOWED_ORIGINS']?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  },
  namespace: '/',
})
export class RealtimeGateway {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

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
  }

  // ─── Server events (emitted from services) ────────────────────────────────

  emitUnitLocationChanged(
    sectorId: string | undefined,
    payload: { unitId: string; lat: number; lng: number; timestamp: string },
  ): void {
    const room = sectorId ? `sector:${sectorId}` : 'command';
    this.server.to(room).emit('unit:location:changed', payload);
  }

  emitUnitStatusChanged(payload: {
    unitId: string;
    status: string;
    previousStatus: string;
  }): void {
    this.server.to('command').emit('unit:status:changed', payload);
  }

  emitIncidentCreated(incident: Record<string, unknown>): void {
    this.server.to('command').emit('incident:created', incident);
  }

  emitIncidentAssigned(incidentId: string, unitId: string): void {
    this.server
      .to(`incident:${incidentId}`)
      .emit('incident:assigned', { incidentId, unitId });
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
}
