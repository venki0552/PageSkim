import { countTokens as o200kCount } from "gpt-tokenizer/encoding/o200k_base";

/**
 * All token numbers AgentPage reports are estimates from one fixed encoding,
 * so they are comparable with each other but not exact for any given model.
 * Surface this label wherever counts are displayed.
 */
export const TOKENIZER_LABEL =
  "estimated (o200k_base); exact counts vary by model tokenizer";

export interface TokenCount {
  tokens: number;
  /** Always TOKENIZER_LABEL; carried so reports stay self-describing. */
  basis: string;
}

/** Count tokens in a string using the o200k_base encoding. Deterministic. */
export function countTokens(text: string): number {
  if (text.length === 0) return 0;
  return o200kCount(text);
}
