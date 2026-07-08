import React from "react";

type BadgeStatus = "badgeActivo" | "badgeAnulado" | "badgeAdmin" | "badgeUser";

interface BadgeProps {
  status: BadgeStatus;
  styles: Record<string, string>;
  children: React.ReactNode;
}

const ROLE_STATUSES = new Set<BadgeStatus>(["badgeAdmin", "badgeUser"]);

export const Badge: React.FC<BadgeProps> = ({ status, styles, children }) => {
  const className = ROLE_STATUSES.has(status)
    ? `${styles.roleBadge} ${styles[status]}`
    : styles[status];

  return <span className={className}>{children}</span>;
};
