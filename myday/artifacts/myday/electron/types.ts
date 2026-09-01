export type IpcRequest = {
  path: string;
  method: string;
  body?: unknown;
};

export type IpcResponse = {
  status: number;
  statusText: string;
  body: unknown;
};

export type MyDayElectronApi = {
  request(request: IpcRequest): Promise<IpcResponse>;
};