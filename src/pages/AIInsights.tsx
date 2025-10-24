import { GlassCard } from "@/components/ui/glass-card";
import { Brain, Lightbulb } from "lucide-react";

const AIInsights = () => {
  const insights = [
    {
      title: "High Repayment Probabilities in 6–12 month terms",
      detail: "Shorter durations show 2.3% higher on-time repayment.",
    },
    {
      title: "Optimal Interest Rate Band 8–9%",
      detail: "Balances borrower affordability and lender returns.",
    },
    {
      title: "Peak Requests in Pre-Harvest Cycles",
      detail: "Funding demand spikes 3 weeks before harvest season.",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="w-6 h-6 text-gold" />
        <div>
          <h1 className="text-3xl font-bold text-gold-gradient">AI Insights</h1>
          <p className="text-muted-foreground">
            Actionable recommendations generated from platform data
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {insights.map((i) => (
          <GlassCard key={i.title} className="p-4 flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-gold mt-1" />
            <div>
              <p className="font-semibold">{i.title}</p>
              <p className="text-sm text-muted-foreground">{i.detail}</p>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
};

export default AIInsights;
