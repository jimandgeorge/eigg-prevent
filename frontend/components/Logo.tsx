export default function Logo({ size = 28, className = "" }: { size?: number; className?: string }) {
  // Shield + check — "prevention, evidenced". Pairs with EIGG's water-edge disc.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 2.5l7.5 3v5.5c0 4.6-3.2 8.4-7.5 9.5-4.3-1.1-7.5-4.9-7.5-9.5V5.5l7.5-3z" />
      <path d="M9 12l2.2 2.2L15.5 10" />
    </svg>
  );
}
