import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, BarChart3, DollarSign } from "lucide-react";

const Analytics = () => {
  const metrics = [
    { label: "Active Loans", value: 48, icon: DollarSign },
    { label: "Avg. Interest", value: "8.7%", icon: TrendingUp },
    { label: "Repayment Rate", value: "96.5%", icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gold-gradient mb-2">
          Analytics
        </h1>
        <p className="text-muted-foreground">
          Key performance indicators and trends
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {metrics.map((m) => (
          <GlassCard key={m.label} className="p-4 flex items-center gap-3">
            <m.icon className="w-6 h-6 text-gold" />
            <div>
              <p className="text-sm text-muted-foreground">{m.label}</p>
              <p className="text-xl font-semibold">{m.value}</p>
            </div>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold mb-3">Recent Activity</h3>
        <div className="space-y-3">
          {[
            { id: "LN-1024", type: "Disbursed", amount: "₹25,000" },
            { id: "LN-984", type: "Repayment", amount: "₹3,200" },
            { id: "LN-1101", type: "New Request", amount: "₹40,000" },
          ].map((item) => (
            <div key={item.id} className="flex items-center justify-between">
              <span className="font-mono">{item.id}</span>
              <Badge className="bg-gold/20 text-gold">{item.type}</Badge>
              <span className="font-semibold">{item.amount}</span>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
};

export default Analytics;
