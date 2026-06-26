export * from './stream';
export * from './recording';

export type ExtensionMessage =
  | { type: 'STREAM_DETECTED'; payload: { streams: import('./stream').StreamInfo[] } | import('./stream').StreamInfo }
  | { type: 'STREAM_LOST'; payload: { id: string } }
  | { type: 'START_RECORDING'; payload: { stream: import('./stream').StreamInfo; quality: string } }
  | { type: 'STOP_RECORDING'; payload: { id: string } }
  | { type: 'PAUSE_RECORDING'; payload: { id: string } }
  | { type: 'RESUME_RECORDING'; payload: { id: string } }
  | { type: 'GET_STREAMS' }
  | { type: 'GET_RECORDINGS' }
  | { type: 'DELETE_RECORDING'; payload: { id: string } }
  | { type: 'DOWNLOAD_SEGMENTS'; payload: { id: string } }
  | { type: 'START_RESTREAM' }
  | { type: 'STOP_RESTREAM' }
  | { type: 'RECORDING_STATUS'; payload: { id: string } }
  | { type: 'ERROR'; payload: { message: string } }
  | { type: 'RECORDING_STARTED'; payload: import('./recording').Recording }
  | { type: 'RECORDING_PROGRESS'; payload: { id: string; bytes: number; segments: number } }
  | { type: 'RECORDING_COMPLETED'; payload: import('./recording').Recording }
  | { type: 'RECORDING_ERROR'; payload: { id: string; error: string } }
  | { type: 'RESTREAM_STATUS'; payload: import('./recording').ReStreamStatus }
  | { type: 'SETTINGS_UPDATE'; payload: Partial<import('./recording').AppSettings> };

export type MessageType =
  | 'STREAM_DETECTED'
  | 'START_RECORDING'
  | 'STOP_RECORDING'
  | 'PAUSE_RECORDING'
  | 'RESUME_RECORDING'
  | 'GET_STREAMS'
  | 'GET_RECORDINGS'
  | 'DELETE_RECORDING'
  | 'DOWNLOAD_SEGMENTS'
  | 'START_RESTREAM'
  | 'STOP_RESTREAM'
  | 'RECORDING_STATUS'
  | 'ERROR'
  | 'STREAM_LOST'
  | 'RECORDING_STARTED'
  | 'RECORDING_PROGRESS'
  | 'RECORDING_COMPLETED'
  | 'RECORDING_ERROR'
  | 'RESTREAM_STATUS'
  | 'SETTINGS_UPDATE';

export type TauriCommand =
  | { cmd: 'get_stream_info'; url: string }
  | { cmd: 'start_recording'; url: string; output?: string; format?: string }
  | { cmd: 'stop_recording'; id: string }
  | { cmd: 'pause_recording'; id: string }
  | { cmd: 'resume_recording'; id: string }
  | { cmd: 'list_recordings' }
  | { cmd: 'delete_recording'; id: string }
  | { cmd: 'open_recording_folder'; id: string }
  | { cmd: 'start_restream'; protocol: 'hls' | 'rtsp'; port?: number }
  | { cmd: 'stop_restream' }
  | { cmd: 'get_restream_status' }
  | { cmd: 'get_settings' }
  | { cmd: 'update_settings'; settings: Partial<import('./recording').AppSettings> };

export type TauriResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };
