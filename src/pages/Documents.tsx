import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, FileText } from "lucide-react";

const Documents = () => {
  const docs = [
    {
      id: "aadhaar",
      name: "Aadhaar Card",
      status: "Verified",
      updated: "2025-01-10",
    },
    {
      id: "face",
      name: "Face Embedding",
      status: "Verified",
      updated: "2025-01-10",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gold/20 flex items-center justify-center">
          <FolderOpen className="w-6 h-6 text-gold" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gold-gradient">
            Borrower Documents
          </h1>
          <p className="text-muted-foreground">
            Review verified documents and status
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {docs.map((doc) => (
          <GlassCard key={doc.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-gold" />
                <div>
                  <h3 className="font-semibold">{doc.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Updated: {doc.updated}
                  </p>
                </div>
              </div>
              <Badge className="bg-green-500/20 text-green-400">
                {doc.status}
              </Badge>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
};

export default Documents;
