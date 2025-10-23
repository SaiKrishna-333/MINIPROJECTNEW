const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
  borrowerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  duration: { type: Number, required: true },
  interestRate: { type: Number, required: true },
  purpose: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Active', 'Completed'], default: 'Pending' },
  createdAt: { type: Date, default: Date.now },
  repaidAmount: { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ['Pending', 'Disbursed', 'Repaid'], default: 'Pending' },
  installments: [{ amount: Number, status: { type: String, enum: ['Pending', 'Paid'] } }],
  razorpayOrderId: String,
});

module.exports = mongoose.model('Loan', loanSchema);
