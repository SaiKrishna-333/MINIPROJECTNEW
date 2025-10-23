import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { User, Shield, Wallet } from 'lucide-react';

const Settings = () => {
  const { user } = useAuth();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gold-gradient mb-2">Account Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <GlassCard>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-gold" />
          Profile Information
        </h3>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Full Name</p>
            <p className="font-medium">{user?.fullName}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="font-medium">{user?.email}</p>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-gold" />
          Wallet Information
        </h3>
        <div>
          <p className="text-sm text-muted-foreground">Wallet Address</p>
          <p className="font-mono text-sm break-all">{user?.walletAddress}</p>
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-gold" />
          Verification Status
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span>KYC Verification</span>
            <span className="text-green-400">✓ Verified</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Face Verification</span>
            <span className="text-green-400">✓ Verified</span>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};

export default Settings;
