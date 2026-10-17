/* Jednostavne ikone (stroke 1.8, 24×24), boja iz currentColor */
const P = {
  plan: "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4M8 14h3M13 14h3M8 17h3",
  omlet: "M12 4c-4.5 0-7 5-7 9a7 7 0 0 0 14 0c0-4-2.5-9-7-9zM12 11a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z",
  zaliha: "M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10",
  kupovina: "M3 4h2l2.4 11h10.2L20 7H6.2M9 20a1 1 0 1 0 0-2a1 1 0 1 0 0 2zM17 20a1 1 0 1 0 0-2a1 1 0 1 0 0 2z",
  troskovi: "M4 19V5M4 19h16M8 16v-4M12 16V8M16 16v-6",
  recepti: "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11M9 8h6",
  prep: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18a9 9 0 1 0 0 18z",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6L6 18",
  check: "M5 12l4 4L19 7",
  more: "M6 12h.01M12 12h.01M18 12h.01",
  sync: "M4 12a8 8 0 0 1 14-5l2 2M20 12a8 8 0 0 1-14 5l-2-2M20 4v5h-5M4 20v-5h5",
} as const;

export type IconName = keyof typeof P;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={P[name]} />
    </svg>
  );
}
