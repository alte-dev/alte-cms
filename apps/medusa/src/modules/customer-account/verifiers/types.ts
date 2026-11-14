export interface LegacyPasswordVerifier {
  readonly algorithm: string;
  verify(password: string, legacyHash: string): Promise<boolean>;
}
