class Borrower {
  constructor(id, amount, preferences) {
    this.id = id;
    this.amount = amount;
    this.preferences = preferences;
    this.nextIndex = 0;
    this.remaining = amount;
  }

  nextLender() {
    return this.nextIndex < this.preferences.length ? this.preferences[this.nextIndex++] : null;
  }
}

class Lender {
  constructor(id, available, riskTolerance) {
    this.id = id;
    this.available = available;
    this.riskTolerance = riskTolerance;
    this.accepted = [];
  }

  accept(borrowerId, contribution, riskScore) {
    if (riskScore <= this.riskTolerance) {
      this.accepted.push({ borrowerId, contribution, riskScore });
      this.available -= contribution;
      return true;
    }
    return false;
  }
}

function enhancedMatching(borrowers, lenders, borrowerRiskScores) {
  const queue = borrowers.filter(b => b.remaining > 0);
  while (queue.length > 0) {
    const b = queue.shift();
    const lenderId = b.nextLender();
    if (!lenderId) continue;
    const l = lenders[lenderId];
    const riskScore = borrowerRiskScores[b.id];
    const give = Math.min(b.remaining, l.available);
    if (give > 0 && l.accept(b.id, give, riskScore)) {
      b.remaining -= give;
      if (b.remaining > 0) queue.push(b);
    }
  }
  return lenders;
}

module.exports = { Borrower, Lender, enhancedMatching };
