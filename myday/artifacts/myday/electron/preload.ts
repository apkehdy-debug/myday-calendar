import { contextBridge, ipcRenderer } from "electron";
import type { IpcRequest, IpcResponse } from "./types";

contextBridge.exposeInMainWorld("myday", {
  request: (request: IpcRequest): Promise<IpcResponse> =>
    ipcRenderer.invoke("myday:request", request),
});