export type XsdNodeKind =
  | "schema"
  | "element"
  | "complexType"
  | "simpleType"
  | "attribute"
  | "attributeGroup"
  | "group"
  | "sequence"
  | "choice"
  | "all"
  | "enumeration"
  | "pattern"
  | "length"
  | "minLength"
  | "maxLength"
  | "minInclusive"
  | "maxInclusive"
  | "minExclusive"
  | "maxExclusive"
  | "totalDigits"
  | "fractionDigits"
  | "whiteSpace"
  | "restriction"
  | "extension"
  | "documentation"
  | "import"
  | "include"
  | "other";

export interface XsdNode {
  id: string;
  kind: XsdNodeKind;
  /** Original source tag name, e.g. "xs:element". */
  tag?: string | undefined;
  name?: string | undefined;
  type?: string | undefined;
  base?: string | undefined;
  value?: string | undefined;
  documentation?: string | undefined;
  minOccurs?: string | undefined;
  maxOccurs?: string | undefined;
  use?: string | undefined;
  attributes: Record<string, string>;
  line: number;
  children: XsdNode[];
  path: string;
}

export interface SchemaDependency {
  kind: "import" | "include";
  namespace?: string | undefined;
  location?: string | undefined;
}

export interface ParsedSchema {
  id: string;
  fileName: string;
  size: number;
  content: string;
  targetNamespace?: string | undefined;
  elementFormDefault?: string | undefined;
  prefix?: string | undefined;
  root?: XsdNode | undefined;
  dependencies: SchemaDependency[];
  errors: ValidationIssue[];
  stats: {
    elements: number;
    complexTypes: number;
    simpleTypes: number;
    attributes: number;
    enumerations: number;
  };
  uploadedAt: number;
}

export interface ValidationIssue {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  line: number;
  detail?: string | undefined;
}

export type FindingCategory =
  | "naming"
  | "duplicate"
  | "unused"
  | "documentation"
  | "circular"
  | "design";

export interface ReviewFinding {
  id: string;
  category: FindingCategory;
  severity: "error" | "warning" | "info";
  title: string;
  message: string;
  target: string;
  line: number;
}

export type DiffStatus = "added" | "removed" | "modified" | "unchanged";

export interface DiffEntry {
  id: string;
  path: string;
  kind: XsdNodeKind;
  status: DiffStatus;
  left?: string | undefined;
  right?: string | undefined;
  details: string[];
}
