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
  info: "M12 21a9 9 0 1 0 0-18a9 9 0 1 0 0 18zM12 11v5M12 8h.01",
  plus: "M12 5v14M5 12h14",
  trash: "M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  ducani:
    "M4 9l1.5-5h13L20 9M4 9h16M4 9v1a2.7 2.7 0 0 0 5.3 0a2.7 2.7 0 0 0 5.4 0a2.7 2.7 0 0 0 5.3 0V9M5 12v8h14v-8M10 20v-5h4v5",
  swap: "M7 7h12l-3-3M17 17H5l3 3",
  search: "M11 18a7 7 0 1 0 0-14a7 7 0 1 0 0 14zM20 20l-4-4",
  chev: "M6 9l6 6 6-6",
  clock: "M12 21a9 9 0 1 0 0-18a9 9 0 1 0 0 18zM12 7v5l3 2",
  flame: "M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5c0 2 1 3 2.5 3c0-3-1-5 0-8z",
  muscle: "M5 18c2-6 5-9 9-9c2 0 3 1 3 3c0 1.5-1 2-2 2M5 18h12c1.7 0 3-1.3 3-3c0-2-1.6-3-3-3M9 9l1-4h3l1 3",
  euro: "M17 6.5A7 7 0 1 0 17 17.5M4 10.5h9M4 13.5h9",
  link: "M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1",
  edit: "M4 20h4L19 9l-4-4L4 16zM13 7l4 4",
  filter: "M4 5h16l-6 8v5l-4 2v-7z",
  copy: "M8 8h11v12H8zM5 16V4h11",
  gear: "M12 15a3 3 0 1 0 0-6a3 3 0 1 0 0 6zM19 12l2-1-1-3-2 .3-1.2-1.2L17 5l-3-1-1 2h-2L10 4 7 5l.2 2.1L6 8.3 4 8 3 11l2 1-2 1 1 3 2-.3 1.2 1.2L7 19l3 1 1-2h2l1 2 3-1-.2-2.1 1.2-1.2 2 .3 1-3z",
  flask: "M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3M7.5 15h9",
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
