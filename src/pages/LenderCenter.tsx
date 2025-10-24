import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, CreditCard, Wallet } from "lucide-react";
import { loanApi } from "@/lib/api";

const LenderCenter = () => {
  const opportunities = [
    {
      id: "REQ-201",
      borrower: "Amit Patel",
      amount: 20000,
      rate: 9.0,
      duration: 12,
    },
    {
      id: "REQ-225",
      borrower: "Sunita Reddy",
      amount: 15000,
      rate: 8.5,
      duration: 10,
    },
  ];

  const handleFund = async (loanId: string) => {
    await loanApi.fund(loanId);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gold-gradient mb-2">
          Lender Center
        </h1>
        <p className="text-muted-foreground">
          Manage lending opportunities and transactions
        </p>
      </div>

      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-gold" /> Opportunities
        </h3>
        <div className="space-y-3">
          {opportunities.map((op) => (
            <div key={op.id} className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{op.borrower}</p>
                <p className="text-sm text-muted-foreground">
                  {op.duration}m • {op.rate}% • ID {op.id}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="bg-gold/20 text-gold">
                  ₹{op.amount.toLocaleString()}
                </Badge>
                <Button
                  className="bg-gold-gradient text-background"
                  onClick={() => handleFund(op.id)}
                >
                  Fund
                </Button>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-gold" /> Transactions
        </h3>
        <div className="space-y-3">
          {[
            {
              id: "TX-911",
              type: "Funding",
              amount: "₹10,000",
              date: "2024-05-02",
            },
            {
              id: "TX-932",
              type: "Interest Payout",
              amount: "₹800",
              date: "2024-06-10",
            },
          ].map((t) => (
            <div key={t.id} className="flex items-center justify-between">
              <span className="font-mono">{t.id}</span>
              <span>{t.type}</span>
              <span className="font-semibold">{t.amount}</span>
              <span className="text-sm text-muted-foreground">{t.date}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-gold" /> Wallet
        </h3>
        <p className="text-sm text-muted-foreground">
          Connect wallet from the topbar to enable funding and payouts.
        </p>
      </GlassCard>
    </div>
  );
};

export default LenderCenter;
