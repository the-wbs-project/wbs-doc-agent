export type RegionType = "table" | "paragraph_block" | "drawing" | "unknown";

export type Region = {
  regionId: string;
  type: RegionType;
  pageOrSheet: string;
  text: string;
  evidenceRefs: Record<string, any>;
  tokenEstimate: number;
};
