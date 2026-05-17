export type VsCodeApi = {
  postMessage: (message: unknown) => void;
};

export const getVsCodeApi = (): VsCodeApi | undefined =>
  (window as Window & { vscode?: VsCodeApi }).vscode;

export const postToExtension = (message: unknown) => {
  getVsCodeApi()?.postMessage(message);
};
