import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Users, UserPlus } from "lucide-react";

const PeerConnections = () => {
  const peers = [
    { name: "Sharma Lending Group", rating: 4.7, loansFunded: 120 },
    { name: "Rural Growth Partners", rating: 4.5, loansFunded: 95 },
    { name: "AgriBoost Collective", rating: 4.2, loansFunded: 60 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="w-6 h-6 text-gold" />
        <div>
          <h1 className="text-3xl font-bold text-gold-gradient">
            Peer Connections
          </h1>
          <p className="text-muted-foreground">
            Discover and connect with lending peers
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {peers.map((p) => (
          <GlassCard
            key={p.name}
            className="p-4 flex items-center justify-between"
          >
            <div>
              <p className="font-semibold">{p.name}</p>
              <p className="text-sm text-muted-foreground">
                Rating {p.rating} • {p.loansFunded} loans funded
              </p>
            </div>
            <Button
              variant="outline"
              className="border-gold/50 text-gold hover:bg-gold/20"
            >
              <UserPlus className="w-4 h-4 mr-2" /> Connect
            </Button>
          </GlassCard>
        ))}
      </div>
    </div>
  );
};

export default PeerConnections;
