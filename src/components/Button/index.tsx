import { ReactNode } from "react";
import {
  Button as ShadcnButton,
  buttonVariants,
} from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";

// Map custom variants to shadcn variants
const variantMap = {
  primary: "default",
  secondary: "secondary",
  danger: "destructive",
  ghost: "ghost",
} as const;

// Map custom sizes to shadcn sizes
const sizeMap = {
  small: "sm",
  medium: "default",
  large: "lg",
} as const;

type CustomVariant = keyof typeof variantMap;
type CustomSize = keyof typeof sizeMap;

interface ButtonProps
  extends Omit<
    React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>,
    "variant" | "size"
  > {
  variant?: CustomVariant;
  size?: CustomSize;
  children: ReactNode;
  asChild?: boolean;
}

export function Button({
  variant = "secondary",
  size = "medium",
  children,
  ...props
}: ButtonProps) {
  return (
    <ShadcnButton
      variant={variantMap[variant]}
      size={sizeMap[size]}
      {...props}
    >
      {children}
    </ShadcnButton>
  );
}
