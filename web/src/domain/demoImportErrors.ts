export type DemoImportFailureKind =
  | "parser-runtime"
  | "demo-parse"
  | "roster-recovery"
  | "roster-validation"
  | "map-metadata";

/** A typed failure boundary for the browser-local Demo import pipeline. */
export class DemoImportFailure extends Error {
  readonly kind: DemoImportFailureKind;

  constructor(kind: DemoImportFailureKind, message: string) {
    super(message);
    this.name = "DemoImportFailure";
    this.kind = kind;
  }
}

export class DemoParserRuntimeError extends DemoImportFailure {
  constructor(
    message = "浏览器本地 parser runtime 失败；原始文件未上传。",
  ) {
    super("parser-runtime", message);
    this.name = "DemoParserRuntimeError";
  }
}

export class DemoParseError extends DemoImportFailure {
  constructor(message = "浏览器本地 Demo 解析失败；原始文件未上传。") {
    super("demo-parse", message);
    this.name = "DemoParseError";
  }
}

export type DemoRosterRecoveryDetails = {
  unresolvedIdentityIds?: readonly string[];
  candidateIdentityIds?: readonly string[];
};

export class DemoRosterRecoveryError extends DemoImportFailure {
  readonly unresolvedIdentityIds: string[];
  readonly candidateIdentityIds: string[];

  constructor(message: string, details: DemoRosterRecoveryDetails = {}) {
    super("roster-recovery", message);
    this.name = "DemoRosterRecoveryError";
    this.unresolvedIdentityIds = [...(details.unresolvedIdentityIds ?? [])];
    this.candidateIdentityIds = [...(details.candidateIdentityIds ?? [])];
  }
}

export class DemoRosterValidationError extends DemoImportFailure {
  constructor(message: string) {
    super("roster-validation", message);
    this.name = "DemoRosterValidationError";
  }
}

export class DemoMapMetadataError extends DemoImportFailure {
  constructor(
    message =
      "match roster 已成功恢复，但当前地图缺少已批准的 overview metadata；无法生成 normalized state。",
  ) {
    super("map-metadata", message);
    this.name = "DemoMapMetadataError";
  }
}
