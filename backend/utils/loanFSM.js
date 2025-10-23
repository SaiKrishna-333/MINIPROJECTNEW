class LoanFSM {
  constructor(amount) {
    this.amount = amount;
    this.remaining = amount;
    this.state = "REQUESTED";
  }

  approve() {
    if (this.state === "REQUESTED") this.state = "APPROVED";
  }

  disburse() {
    if (this.state === "APPROVED") this.state = "ACTIVE";
  }

  repay(amount) {
    if (this.state !== "ACTIVE") return;
    this.remaining -= amount;
    if (this.remaining <= 0) {
      this.state = "REPAID";
      this.remaining = 0;
    } else {
      this.state = "PARTIALLY_REPAID";
    }
  }

  gracePeriod() {
    if (this.state === "ACTIVE") this.state = "GRACE";
  }

  default() {
    if (["ACTIVE", "PARTIALLY_REPAID", "GRACE"].includes(this.state)) this.state = "DEFAULTED";
  }
}

module.exports = { LoanFSM };
