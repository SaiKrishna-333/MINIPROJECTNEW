import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
  hover?: boolean;
}

export const GlassCard = ({ 
  className, 
  children, 
  glow = false, 
  hover = true,
  ...props 
}: GlassCardProps) => {
  return (
    <div
      className={cn(
        "glass-card p-6",
        hover && "hover:border-gold/30 hover:shadow-lg hover:shadow-gold/10 transition-all duration-300",
        glow && "gold-glow",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
