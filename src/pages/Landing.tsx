import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Shield, TrendingUp, Users } from 'lucide-react';
import { motion } from 'framer-motion';

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Shield,
      title: 'Secure & Verified',
      description: 'Face verification and KYC for trusted lending',
    },
    {
      icon: TrendingUp,
      title: 'Competitive Rates',
      description: 'Best interest rates with flexible repayment',
    },
    {
      icon: Users,
      title: 'Peer-to-Peer',
      description: 'Direct connection between borrowers and lenders',
    },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-96 h-96 bg-gold/10 rounded-full blur-3xl top-10 -left-20 animate-float" />
        <div className="absolute w-96 h-96 bg-gold/5 rounded-full blur-3xl bottom-10 -right-20 animate-float" style={{ animationDelay: '2s' }} />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="glass-panel border-b border-glass-border">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gold-gradient flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-background" />
              </div>
              <span className="font-bold text-xl text-gold-gradient">RuralConnect</span>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/login')}>
                Login
              </Button>
              <Button 
                className="bg-gold-gradient hover:opacity-90 text-background font-semibold"
                onClick={() => navigate('/signup')}
              >
                Get Started
              </Button>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-6 py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center space-y-8"
          >
            <h1 className="text-6xl md:text-7xl font-bold leading-tight">
              Empowering Rural Finance
              <br />
              <span className="text-gold-gradient">Through Decentralized</span>
              <br />
              P2P Lending
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Connect directly with lenders and borrowers. Secure, transparent, and built for rural communities.
            </p>

            <div className="flex items-center justify-center gap-4 pt-4">
              <Button 
                size="lg"
                className="bg-gold-gradient hover:opacity-90 text-background font-semibold text-lg px-8 py-6 gold-glow"
                onClick={() => navigate('/signup')}
              >
                Start Lending
              </Button>
              <Button 
                size="lg"
                variant="outline"
                className="border-gold/50 text-gold hover:bg-gold/20 text-lg px-8 py-6"
                onClick={() => navigate('/login')}
              >
                Borrow Now
              </Button>
            </div>
          </motion.div>

          {/* Features Grid */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="grid md:grid-cols-3 gap-8 mt-24"
          >
            {features.map((feature, index) => (
              <div key={index} className="glass-card text-center space-y-4 hover:border-gold/30 transition-all">
                <div className="w-16 h-16 mx-auto rounded-full bg-gold/10 flex items-center justify-center">
                  <feature.icon className="w-8 h-8 text-gold" />
                </div>
                <h3 className="text-xl font-semibold">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </motion.div>
        </section>

        {/* Stats Section */}
        <section className="max-w-7xl mx-auto px-6 py-16">
          <div className="glass-card">
            <div className="grid md:grid-cols-4 gap-8">
              {[
                { label: 'Total Loans', value: '₹2.4M+' },
                { label: 'Active Borrowers', value: '1,200+' },
                { label: 'Success Rate', value: '98%' },
                { label: 'Avg. Processing', value: '24hrs' },
              ].map((stat, index) => (
                <div key={index} className="text-center">
                  <p className="text-4xl font-bold text-gold-gradient mb-2">{stat.value}</p>
                  <p className="text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Landing;
