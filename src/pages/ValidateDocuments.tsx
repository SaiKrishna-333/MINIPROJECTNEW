import { useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, FileText, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

interface VerificationResult {
  success: boolean;
  error?: string;
  details?: {
    digilocker?: {
      name?: string;
      aadhaarNumber?: string;
      simulatedMode?: boolean;
    };
  };
}

const ValidateDocuments = () => {
  const [formData, setFormData] = useState({
    borrowerId: "",
    aadharNumber: "",
  });
  const [loading, setLoading] = useState(false);
  const [verificationResult, setVerificationResult] =
    useState<VerificationResult | null>(null);

  const handleVerifyAadhaar = async () => {
    if (!formData.borrowerId || !formData.aadharNumber) {
      toast.error("Please enter both Borrower ID and Aadhaar number");
      return;
    }

    setLoading(true);
    try {
      // Call backend to verify Aadhaar via DigiLocker
      const response = await fetch("/api/auth/verify-aadhaar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({
          email: formData.borrowerId,
          aadharNumber: formData.aadharNumber,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setVerificationResult(data);
        toast.success("Aadhaar verification successful");
      } else {
        setVerificationResult({ success: false, error: data.error });
        toast.error(data.error || "Verification failed");
      }
    } catch (error) {
      toast.error("Error verifying Aadhaar");
      setVerificationResult({ success: false, error: "Network error" });
    }
    setLoading(false);
  };

  const handleVerifyFace = async () => {
    toast.info(
      "Face verification requires uploading borrower's live image. Feature coming soon."
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gold/20 flex items-center justify-center">
          <ShieldCheck className="w-6 h-6 text-gold" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gold-gradient">
            Validate Documents
          </h1>
          <p className="text-muted-foreground">
            Verify borrower Aadhaar and biometric data
          </p>
        </div>
      </div>

      <GlassCard className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="borrowerId">Borrower Email / ID</Label>
            <Input
              id="borrowerId"
              placeholder="borrower@example.com"
              className="glass-panel border-glass-border"
              value={formData.borrowerId}
              onChange={(e) =>
                setFormData({ ...formData, borrowerId: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="aadharNumber">Aadhaar Number (12 digits)</Label>
            <Input
              id="aadharNumber"
              placeholder="123456789012"
              className="glass-panel border-glass-border"
              value={formData.aadharNumber}
              onChange={(e) =>
                setFormData({ ...formData, aadharNumber: e.target.value })
              }
              maxLength={12}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleVerifyAadhaar}
            disabled={loading}
            className="bg-gold-gradient text-background"
          >
            {loading ? "Verifying..." : "Verify Aadhaar"}
          </Button>
          <Button
            variant="outline"
            className="border-gold/40"
            onClick={handleVerifyFace}
          >
            Verify Face
          </Button>
        </div>

        {verificationResult && (
          <div className="mt-4 p-4 rounded-lg glass-panel">
            <div className="flex items-center gap-2 mb-3">
              {verificationResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
              <h3 className="font-semibold">
                {verificationResult.success
                  ? "Verification Successful"
                  : "Verification Failed"}
              </h3>
            </div>

            {verificationResult.success ? (
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  <strong>Name:</strong>{" "}
                  {verificationResult.details?.digilocker?.name || "N/A"}
                </p>
                <p className="text-muted-foreground">
                  <strong>Aadhaar:</strong>{" "}
                  {verificationResult.details?.digilocker?.aadhaarNumber ||
                    "Verified"}
                </p>
                <p className="text-muted-foreground">
                  <strong>Mode:</strong>{" "}
                  {verificationResult.details?.digilocker?.simulatedMode
                    ? "Simulated"
                    : "Live"}
                </p>
              </div>
            ) : (
              <p className="text-sm text-red-400">
                {verificationResult.error || "Unknown error occurred"}
              </p>
            )}
          </div>
        )}
      </GlassCard>
    </div>
  );
};

export default ValidateDocuments;
