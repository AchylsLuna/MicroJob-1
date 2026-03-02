import { Briefcase, FileText, Plus } from "lucide-react";
import { motion } from "motion/react";
import logoImage from "../assets/68a121b08b33b30d03e128f79030947b62e7077c.png";

interface CombinedLogoProps {
  className?: string;
  onClick?: () => void;
  showJobPostingIcon?: boolean;
  animate?: boolean;
}

export function CombinedLogo({ 
  className = "", 
  onClick, 
  showJobPostingIcon = true,
  animate = true 
}: CombinedLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`} onClick={onClick}>
      {/* Micro Jobs Logo */}
      <motion.img
        src={logoImage}
        alt="Micro Jobs"
        className="h-12 w-auto object-contain cursor-pointer"
        whileHover={animate ? { scale: 1.05 } : {}}
        whileTap={animate ? { scale: 0.95 } : {}}
      />

      {showJobPostingIcon && (
        <>
          {/* Separator Line */}
          <motion.div
            initial={animate ? { scaleY: 0 } : {}}
            animate={animate ? { scaleY: 1 } : {}}
            transition={{ delay: 0.2 }}
            className="h-10 w-[2px] bg-gradient-to-b from-[#4988C4] to-[#1C4D8D]"
          />

          {/* Job Posting Icon */}
          <motion.div
            initial={animate ? { opacity: 0, x: -20 } : {}}
            animate={animate ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.3 }}
            whileHover={animate ? { scale: 1.1, rotate: 5 } : {}}
            className="relative cursor-pointer"
          >
            {/* Outer Glow Circle */}
            <motion.div
              animate={animate ? {
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.6, 0.3],
              } : {}}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute inset-0 bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] rounded-full blur-md"
            />

            {/* Main Icon Container */}
            <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] flex items-center justify-center shadow-lg">
              {/* Briefcase Icon */}
              <div className="relative">
                <Briefcase className="w-5 h-5 text-white" strokeWidth={2.5} />
                
                {/* Plus Badge */}
                <motion.div
                  animate={animate ? {
                    scale: [1, 1.2, 1],
                    rotate: [0, 180, 360],
                  } : {}}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center"
                >
                  <Plus className="w-2.5 h-2.5 text-[#4988C4]" strokeWidth={3} />
                </motion.div>
              </div>
            </div>

            {/* Label */}
            <motion.div
              initial={animate ? { opacity: 0, y: 10 } : {}}
              animate={animate ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.5 }}
              className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 whitespace-nowrap"
            >
              <span className="text-[10px] font-semibold text-gray-600">Job Posting</span>
            </motion.div>
          </motion.div>
        </>
      )}
    </div>
  );
}

// Alternative: Document-style Job Posting Icon
export function JobPostingIconAlt({ className = "" }: { className?: string }) {
  return (
    <motion.div
      whileHover={{ scale: 1.1, rotate: 5 }}
      className={`relative cursor-pointer ${className}`}
    >
      {/* Outer Glow */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute inset-0 bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] rounded-xl blur-md"
      />

      {/* Main Icon Container */}
      <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] flex items-center justify-center shadow-lg">
        {/* Document Icon with Plus */}
        <div className="relative">
          <FileText className="w-5 h-5 text-white" strokeWidth={2.5} />
          
          {/* Plus Badge */}
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center"
          >
            <Plus className="w-2.5 h-2.5 text-[#4988C4]" strokeWidth={3} />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

// Compact Version for Navigation
export function CompactJobPostingLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <motion.img
        src={logoImage}
        alt="Micro Jobs"
        className="h-8 w-auto object-contain"
        whileHover={{ scale: 1.05 }}
      />
      <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] flex items-center justify-center shadow-md">
        <Briefcase className="w-4 h-4 text-white" strokeWidth={2.5} />
        <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-white flex items-center justify-center">
          <Plus className="w-2 h-2 text-[#4988C4]" strokeWidth={3} />
        </div>
      </div>
    </div>
  );
}
