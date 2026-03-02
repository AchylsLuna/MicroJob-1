export const webUi = {
  layout: {
    shell: "bg-[#f8f8f8] flex h-screen w-full overflow-hidden",
    content: "flex-1 flex flex-col overflow-y-auto",
    main: "flex-1 p-6",
    maxContainer: "w-full",
  },
  navbar: {
    root: "w-full sticky top-0 z-40 bg-[#f8f8f8]",
    container:
      "max-w-[1341px] mx-auto flex flex-wrap items-center gap-3 px-4 py-3 min-h-[56px] sm:px-6 lg:flex-nowrap lg:gap-6 lg:py-4",
    title: "font-semibold text-[24px] leading-[1.15] text-[#111827] whitespace-nowrap sm:text-[28px]",
    subtitle: "text-[13px] text-[#6B7280] mt-1 whitespace-nowrap",
    searchInput:
      "w-full h-full bg-white border border-[#E5E7EB] rounded-[10px] pl-12 pr-4 text-[14px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent shadow-sm",
    iconButton:
      "relative w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors",
    popover: "bg-white rounded-[14px] shadow-lg border border-[#E5E7EB]",
  },
  sidebar: {
    root: "bg-white text-gray-800 shadow-lg h-screen overflow-y-auto flex flex-col",
    navButton:
      "w-full flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-lg font-semibold transition relative",
    navButtonActive: "text-blue-600 bg-blue-50",
    navButtonIdle: "text-gray-700 hover:bg-gray-100",
    sectionDivider: "border-gray-200",
  },
  surfaces: {
    panel: "bg-white rounded-[16px] border border-[#E5E7EB] p-6",
    softPanel: "bg-white rounded-[16px] border border-[#E5E7EB] p-6",
  },
} as const;
