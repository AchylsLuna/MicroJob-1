export const webUi = {
  layout: {
    shell: "flex min-h-screen w-full bg-[#F4F7FC] text-[#0F172A]",
    content: "flex min-w-0 flex-1 flex-col",
    main: "flex-1 overflow-y-auto px-4 pb-8 pt-5 sm:px-6 lg:px-8",
    maxContainer: "mx-auto w-full max-w-[1360px]",
  },
  navbar: {
    root: "sticky top-0 z-40 w-full border-b border-[#E2E8F0] bg-[#F4F7FC]/95 backdrop-blur",
    container:
      "mx-auto flex max-w-[1360px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:flex-nowrap lg:gap-5 lg:px-8",
    title: "truncate text-[26px] font-semibold leading-[1.12] text-[#111827] sm:text-[30px]",
    subtitle: "mt-1 truncate text-[13px] text-[#6B7280]",
    searchInput:
      "h-full w-full rounded-[12px] border border-[#D7DFEB] bg-white pl-12 pr-4 text-[14px] text-[#111827] placeholder-[#9CA3AF] shadow-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#1C4D8D]",
    iconButton:
      "relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-[#E8EEF7]",
    popover: "rounded-[14px] border border-[#E2E8F0] bg-white shadow-[0_20px_50px_rgba(15,23,42,0.12)]",
  },
  sidebar: {
    root: "h-screen shrink-0 overflow-y-auto border-r border-[#E2E8F0] bg-white/95 text-[#1F2937]",
    navButton:
      "w-full flex items-center gap-3 rounded-xl text-[15px] font-semibold transition relative",
    navButtonActive: "text-[#1D4ED8] bg-[#EAF2FF] shadow-[inset_0_0_0_1px_rgba(59,130,246,0.2)]",
    navButtonIdle: "text-[#334155] hover:bg-[#F1F5F9]",
    sectionDivider: "border-[#E2E8F0]",
  },
  surfaces: {
    panel: "rounded-[20px] border border-[#E5EAF2] bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)]",
    softPanel: "rounded-[20px] border border-[#DFE7F6] bg-gradient-to-br from-[#EEF2FF] to-white p-6 shadow-[0_10px_30px_rgba(79,70,229,0.08)]",
  },
} as const;

