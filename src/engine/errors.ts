export class ContentValidationError extends Error {
  readonly issues: string[];

  constructor(message: string, issues: string[]) {
    super(`${message}: ${issues.join("; ")}`);
    this.name = "ContentValidationError";
    this.issues = issues;
  }
}
