export const webUi = {
  layout: {
    shell: "bg-[#f8fafc] flex h-screen h-[100dvh] w-full overflow-hidden",
    content: "h-full min-w-0 flex-1 flex flex-col overflow-y-auto overscroll-contain",
    main: "min-w-0 flex-1 px-4 pb-8 pt-4 sm:px-6 lg:px-8 lg:pt-6",
    maxContainer: "mx-auto w-full max-w-[1440px]",
  },
  navbar: {
    root: "sticky top-0 z-40 w-full bg-white/95 shadow-[inset_0_-1px_0_#e2e8f0] backdrop-blur",
    container:
      "mx-auto grid h-16 min-h-16 w-full max-w-[1440px] min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-6 lg:px-8",
    title: "truncate text-lg font-bold leading-tight tracking-tight text-slate-950 sm:text-xl",
    subtitle: "hidden truncate text-xs text-slate-500 sm:block",
    searchInput:
      "h-full w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-slate-950 outline-none transition focus:border-transparent focus:bg-white focus:ring-2 focus:ring-[#1C4D8D]",
    iconButton:
      "relative flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-slate-600 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-[#1C4D8D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D]",
    popover: "rounded-2xl border border-slate-200 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.16)]",
  },
  sidebar: {
    root: "dashboard-sidebar flex h-screen h-[100dvh] flex-col overflow-hidden border-r border-slate-200 bg-white text-slate-800 shadow-[8px_0_28px_rgba(15,23,42,0.05)]",
    navButton:
      "relative flex min-h-11 w-full items-center gap-3 rounded-xl px-4 py-3 text-left font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] focus-visible:ring-offset-2",
    navButtonActive: "bg-blue-50 text-[#1C4D8D] shadow-sm ring-1 ring-blue-100",
    navButtonIdle: "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
    sectionDivider: "border-slate-200",
  },
  surfaces: {
    panel: "bg-white rounded-[16px] border border-[#E5E7EB] p-6",
    softPanel: "bg-white rounded-[16px] border border-[#E5E7EB] p-6",
  },
} as const;
