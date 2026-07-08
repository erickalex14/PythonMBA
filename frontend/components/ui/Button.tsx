import React from "react";

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  loading?: boolean;
  loadingText?: React.ReactNode;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ loading, loadingText, children, disabled, ...rest }) => (
  <button disabled={disabled || loading} {...rest}>
    {loading ? loadingText ?? children : children}
  </button>
);
