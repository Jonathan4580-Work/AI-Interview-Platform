import type { ReactNode } from "react";

export const metadata = {
  robots: { index: false, follow: false },
};

export default function CandidateLayout({ children }: { readonly children: ReactNode }) {
  return children;
}
