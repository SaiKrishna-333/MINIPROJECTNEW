import { GlassCard } from '@/components/ui/glass-card';
import { Badge } from '@/components/ui/badge';
import { User, Calendar, DollarSign } from 'lucide-react';

const BorrowerLoans = () => {
  const borrowerLoans = [
    { id: '1', amount: 25000, status: 'Active', startDate: '2024-01-15', dueDate: '2025-01-15', paid: 8000 },
    { id: '2', amount: 15000, status: 'Completed', startDate: '2023-06-10', dueDate: '2024-06-10', paid: 15000 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gold-gradient mb-2">Borrower Loans</h1>
        <p className="text-muted-foreground">View borrower-specific loan details</p>
      </div>

      <GlassCard className="flex items-center gap-4 p-6">
        <div className="w-16 h-16 rounded-full bg-gold/20 flex items-center justify-center">
          <User className="w-8 h-8 text-gold" />
        </div>
        <div>
          <h3 className="text-xl font-semibold">Rajesh Kumar</h3>
          <p className="text-muted-foreground">KYC Verified • Face Verified</p>
        </div>
      </GlassCard>

      <div className="space-y-4">
        {borrowerLoans.map((loan) => (
          <GlassCard key={loan.id}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Loan #{loan.id}</h3>
              <Badge className={loan.status === 'Active' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}>
                {loan.status}
              </Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Amount</p>
                <p className="text-lg font-semibold text-gold">₹{loan.amount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Paid</p>
                <p className="text-lg font-semibold">₹{loan.paid.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Start Date</p>
                <p className="font-medium">{loan.startDate}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Due Date</p>
                <p className="font-medium">{loan.dueDate}</p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
};

export default BorrowerLoans;
