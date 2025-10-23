import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GlassCard } from '@/components/ui/glass-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

const RepayLoan = () => {
  const [selectedLoan, setSelectedLoan] = useState('');
  const [amount, setAmount] = useState('');

  const activeLoans = [
    { id: '1', borrower: 'Rajesh Kumar', amount: 25000, remaining: 17000 },
    { id: '2', borrower: 'Priya Sharma', amount: 15000, remaining: 15000 },
  ];

  const handleRepay = () => {
    if (!selectedLoan || !amount) {
      toast.error('Please fill in all fields');
      return;
    }
    toast.success('Repayment processed successfully!');
    setAmount('');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gold-gradient mb-2">Repay Loan</h1>
        <p className="text-muted-foreground">Make a loan repayment</p>
      </div>

      <GlassCard className="space-y-6">
        <div className="space-y-2">
          <Label>Select Loan</Label>
          <Select value={selectedLoan} onValueChange={setSelectedLoan}>
            <SelectTrigger className="glass-panel border-glass-border">
              <SelectValue placeholder="Choose a loan to repay" />
            </SelectTrigger>
            <SelectContent className="glass-panel border-glass-border">
              {activeLoans.map((loan) => (
                <SelectItem key={loan.id} value={loan.id}>
                  Loan #{loan.id} - {loan.borrower} (₹{loan.remaining.toLocaleString()} remaining)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Repayment Amount (₹)</Label>
          <Input
            id="amount"
            type="number"
            placeholder="Enter amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="glass-panel border-glass-border"
          />
        </div>

        <Button onClick={handleRepay} className="w-full bg-gold-gradient hover:opacity-90 text-background font-semibold">
          <CreditCard className="w-4 h-4 mr-2" />
          Process Repayment
        </Button>
      </GlassCard>
    </div>
  );
};

export default RepayLoan;
