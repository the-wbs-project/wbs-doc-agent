export type KeyValue = { key: string; value: string };

export type Provenance = {
  regionId: string;
  pageOrSheet: string;
  sourceType: "table_cell" | "paragraph" | "list_item" | "heading" | "unknown";
  quote: string;
};

export type WbsNode = {
  jobId: string;
  id: string;
  parentId: string | null;

  title: string;
  description?: string | null;

  wbsLevel?: string | null;
  metadata: KeyValue[];

  provenance: Provenance;

  inferred?: boolean;
  warnings?: string[];
};
