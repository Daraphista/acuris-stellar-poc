export class AmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AmountError";
  }
}

export class SplitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SplitError";
  }
}

export class SettlementTransactionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SettlementTransactionError";
  }
}
