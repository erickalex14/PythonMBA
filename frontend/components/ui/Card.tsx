import React from "react";

type CardVariant = "kpiCard" | "chartCard" | "tableCard" | "adminCard";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant: CardVariant;
  styles: Record<string, string>;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ variant, styles, children, className, ...rest }) => (
  <div className={[styles.card, styles[variant], className].filter(Boolean).join(" ")} {...rest}>
    {children}
  </div>
);
