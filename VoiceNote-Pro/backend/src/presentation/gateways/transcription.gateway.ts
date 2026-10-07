import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class TranscriptionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('audio_chunk')
  handleAudioChunk(client: Socket, payload: any) {
    // TODO: Process audio chunk and stream to STT service
    console.log(`Received audio chunk from ${client.id}`);
  }

  @SubscribeMessage('stop_recording')
  handleStopRecording(client: Socket) {
    // TODO: Stop transcription stream
    console.log(`Stop recording from ${client.id}`);
  }
}
