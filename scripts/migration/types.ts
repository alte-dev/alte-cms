export type MigrationIssueCode =
  | "invalid_email"
  | "control_char"
  | "oversized_field"
  | "duplicate_in_file"
  | "existing_account_skipped"
  | "existing_guest_skipped"
  | "unsupported_hash"
  | "missing_hash"
  | "malformed_phone"
  | "malformed_address"
  | "guest_skipped";

export interface MigrationReportEntry {
  rowNumber: number;
  code: MigrationIssueCode;
  maskedEmail: string;
  field?: string;
}

export interface MigrationDbGuardOptions {
  apply: boolean;
  confirmDatabase?: string;
  allowProduction?: boolean;
  databaseUrl: string;
  nodeEnv?: string;
}
