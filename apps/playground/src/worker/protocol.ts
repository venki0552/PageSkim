import type { SiblingDoc, TokenReport, Warning } from "@pageskim/core";

export interface ConvertRequest {
  kind: "convert";
  html: string;
}

export interface ConvertPayload {
  llmMd: string;
  llmJson: string;
  splitFiles: Record<string, string>;
  tokenReport: TokenReport;
  warnings: Warning[];
  doc: SiblingDoc;
}

export type ConvertResponse =
  | { kind: "result"; payload: ConvertPayload }
  | { kind: "error"; code: string; message: string };
