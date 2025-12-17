export type ValidationReport = {
  schemaValid: boolean;
  unsupportedNodes: Array<{ nodeId: string; reason: string }>;
  duplicates: Array<{ nodeIds: string[]; reason: string }>;
  numberingIssues: Array<{ nodeId: string; issue: string }>;
  hierarchyIssues: Array<{ nodeId: string; issue: string }>;
  coverage: { consumedEvidenceCount: number; totalEvidenceCount: number; coverageRatio: number };
  regionRiskScores: Array<{ regionId: string; risk: number; reasons: string[] }>;
};
