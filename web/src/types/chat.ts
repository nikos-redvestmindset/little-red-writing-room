export interface ChatStreamRequest {
  chat_id: string;
  character_id: string;
  message: string;
}

export type SSETokenEvent = { text: string };
export type SSECitationEvent = {
  source: string;
  chunk_index: number;
  text: string;
};
export type SSEGapEvent = { attribute: string; suggestion: string };
export type SSEDoneEvent = { chat_id: string };
export type SSEErrorEvent = { code: string; message: string };
