export const webUi = {
  layout: {
    shell: "bg-[#f8f8f8] flex h-screen h-[100dvh] w-full overflow-hidden",
    content: "h-full min-w-0 flex-1 flex flex-col overflow-y-auto overscroll-contain",
    main: "min-w-0 flex-1 px-4 pb-6 pt-3 sm:px-6 lg:pt-6",
    maxContainer: "w-full",
  },
  navbar: {
    root: "w-full sticky top-0 z-40 bg-[#f8f8f8]",
    container:
      "max-w-[1341px] mx-auto grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4 py-3 min-h-[56px] sm:gap-4 sm:px-6 lg:gap-6 lg:py-4",
    title: "truncate font-semibold text-[20px] leading-[1.15] text-[#111827] sm:text-[28px]",
    subtitle: "mt-1 hidden truncate text-[13px] text-[#6B7280] sm:block",
    searchInput:
      "w-full h-full bg-white border border-[#E5E7EB] rounded-[10px] pl-12 pr-4 text-[14px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent shadow-sm",
    iconButton:
      "relative w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors",
    popover: "bg-white rounded-[14px] shadow-lg border border-[#E5E7EB]",
  },
  sidebar: {
    root: "dashboard-sidebar h-screen h-[100dvh] overflow-hidden border-r border-slate-200 bg-white text-slate-800 shadow-[8px_0_28px_rgba(15,23,42,0.05)] flex flex-col",
    navButton:
      "w-full flex min-h-11 items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-xl font-semibold transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
    navButtonActive: "text-blue-700 bg-blue-50 shadow-sm ring-1 ring-blue-100",
    navButtonIdle: "text-slate-700 hover:bg-slate-100 hover:text-slate-950",
    sectionDivider: "border-gray-200",
  },
  surfaces: {
    panel: "bg-white rounded-[16px] border border-[#E5E7EB] p-6",
    softPanel: "bg-white rounded-[16px] border border-[#E5E7EB] p-6",
  },
} as const;
