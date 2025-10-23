import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GlassCard } from '@/components/ui/glass-card';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Copy } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const OTPVerification = () => {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [credentials, setCredentials] = useState<{ uniqueId: string; password: string } | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otp) {
      toast.error('Please enter OTP');
      return;
    }

    setLoading(true);

    try {
      const userEmail = localStorage.getItem('userEmail') || '';
      
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-email': userEmail
        },
        body: JSON.stringify({ otp }),
      });

      const data = await response.json();
      if (data.success) {
        // Generate unique ID and password
        const uniqueId = `UID-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const password = `PWD-${Math.random().toString(36).substr(2, 9)}`;

        setCredentials({ uniqueId, password });
        setVerified(true);
        toast.success('OTP verified! Your credentials are generated.');

        // Save to backend
        await fetch('/api/auth/generate-credentials', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-user-email': userEmail
          },
          body: JSON.stringify({ uniqueId, password }),
        });
      } else {
        toast.error(data.error || 'OTP verification failed');
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      toast.error('OTP verification error');
    }

    setLoading(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute w-96 h-96 bg-gold/10 rounded-full blur-3xl top-0 right-0 animate-float" />
        <div className="absolute w-96 h-96 bg-gold/5 rounded-full blur-3xl bottom-0 left-0 animate-float" style={{ animationDelay: '2s' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <Link to="/face-verification" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to face verification
        </Link>

        <GlassCard className="space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-full bg-gold-gradient flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-background" />
            </div>
            <h1 className="text-3xl font-bold text-gold-gradient">Step 3: OTP Verification</h1>
            <p className="text-muted-foreground">Enter the OTP sent to your phone</p>
          </div>

          {!verified ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">OTP</Label>
                <Input
                  id="otp"
                  name="otp"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="glass-panel border-glass-border focus:border-gold"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gold-gradient hover:opacity-90 text-background font-semibold"
                disabled={loading}
              >
                {loading ? 'Verifying...' : 'Verify OTP'}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-xl font-bold text-gold">Your Credentials</h2>
                <p className="text-muted-foreground">Save these for login</p>
              </div>

              <div className="space-y-3">
                <div className="glass-panel p-3 rounded-lg">
                  <Label className="text-sm text-muted-foreground">Unique ID</Label>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">{credentials?.uniqueId}</span>
                    <Button size="sm" variant="outline" onClick={() => copyToClipboard(credentials?.uniqueId || '')}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="glass-panel p-3 rounded-lg">
                  <Label className="text-sm text-muted-foreground">Password</Label>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">{credentials?.password}</span>
                    <Button size="sm" variant="outline" onClick={() => copyToClipboard(credentials?.password || '')}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <Button onClick={() => navigate('/login')} className="w-full bg-gold-gradient">
                Proceed to Login
              </Button>
            </div>
          )}
        </GlassCard>
      </motion.div>
    </div>
  );
};

export default OTPVerification;
