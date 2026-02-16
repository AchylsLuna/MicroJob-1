interface ComingSoonProps {
  title: string;
  description: string;
}

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="bg-white rounded-[15px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.1)] p-12 text-center">
      <h1 className="font-['Roboto_Serif:Bold',sans-serif] font-bold text-[24px] text-black tracking-[0.2px] mb-4">
        {title}
      </h1>
      <p className="text-[#64748b] text-[14px] mb-6">{description}</p>
      <div className="inline-flex items-center justify-center bg-[#EEF2FF] rounded-full px-6 py-3">
        <p className="text-[#4F46E5] text-[14px] font-['Poppins:Medium',sans-serif]">Coming Soon</p>
      </div>
    </div>
  );
}
