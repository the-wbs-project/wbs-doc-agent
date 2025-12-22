/**
 * Types for Global Document Analysis (Step 03b)
 */

export type DocumentPattern = "outline" | "matrix" | "flat_list" | "mixed" | "unknown";

export interface SkeletonNode {
  title: string;
  suggestedWbsLevel: string;
  parentTitle: string | null;
  pageRefs: string[];
  confidence: number;
}

export interface RegionContext {
  sectionPath: string[];           // Breadcrumb path to this region
  suggestedParentWbs: string;      // WBS level for items in this region
  layoutHint: "outline" | "matrix" | "list" | "table" | "unknown";
  columnHeaders?: string[];        // If matrix layout
  rowHeader?: string;              // If matrix layout
  extractionNotes: string;         // Free-form guidance for extraction
}

export interface RegionGuidance {
  regionId: string;
  pageOrSheet: string;
  context: RegionContext;
}

export interface GlobalAnalysis {
  documentPattern: DocumentPattern;

  structuralElements: {
    columnHeaders?: string[];          // Repeating column headers
    hasPhaseColumns: boolean;          // Document organized by phases
    numberingScheme?: string;          // e.g., "1.1.1", "A.1.a", "none"
    pageCount: number;
  };

  skeleton: {
    nodes: SkeletonNode[];
    notes: string;
  };

  regionGuidance: RegionGuidance[];

  warnings: string[];
}

/**
 * Empty/fallback global analysis when Step 03b fails or is skipped
 */
export function emptyGlobalAnalysis(regionCount: number): GlobalAnalysis {
  return {
    documentPattern: "unknown",
    structuralElements: {
      hasPhaseColumns: false,
      pageCount: 0
    },
    skeleton: {
      nodes: [],
      notes: "Global analysis unavailable"
    },
    regionGuidance: [],
    warnings: ["global_analysis_unavailable"]
  };
}
