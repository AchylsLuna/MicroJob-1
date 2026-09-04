import { useNavigate } from "react-router-dom";
import { ArrowRight, Briefcase, ChevronRight, MapPin, Menu, Pause, Play, Search, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { MicroJobsLogo } from "./MicroJobsLogo";
import { getPostAuthLandingPath } from "../utils/dashboardRoutes";
import { ROUTES } from "../utils/routes";
import { getCategories, getJobs } from "../services/api";
import { openCookiePreferences } from "../lib/cookieConsent";
import { toAbsoluteAssetUrl } from "../lib/assetUrl";

type LandingCategory = { _id: string; name: string };
type HeroIntent = "work" | "hire";

// Animated Counter Component
function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [target]);

  return <span>{count}{suffix}</span>;
}

export function LandingPageBlue() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const appEntryPath = getPostAuthLandingPath(user);
  const { scrollYProgress } = useScroll();
  const prefersReducedMotion = useReducedMotion();

  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.8]);

  const [jobCards, setJobCards] = useState<Array<{
    title: string;
    company: string;
    location: string;
    salary: string;
    /** The job's own photo if the employer uploaded one, else their avatar. */
    image: string | null;
  }>>([]);
  const [isJobsLoading, setIsJobsLoading] = useState(false);
  const [jobsLoadError, setJobsLoadError] = useState<string | null>(null);

  // Shared by both the hero chips and the nav mega-menu — fetched once.
  // GET /categories is a public endpoint, so this works signed-out.
  const [categories, setCategories] = useState<LandingCategory[]>([]);
  const [heroIntent, setHeroIntent] = useState<HeroIntent>("work");
  const [heroQuery, setHeroQuery] = useState("");
  const [openMenu, setOpenMenu] = useState<HeroIntent | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navMenuRef = useRef<HTMLDivElement>(null);

  // Hero image slot. Null renders the blank placeholder; set it to a path
  // under /media/ (e.g. "/media/hero-team.webp") to show a real photo.
  const heroPhoto: string | null = null;

  // "How it works" keeps its own intent so reading about hiring doesn't
  // silently retarget the hero's search box, and vice versa.
  const [howItWorksIntent, setHowItWorksIntent] = useState<HeroIntent>("hire");
  const demoVideoRef = useRef<HTMLVideoElement>(null);
  const [isDemoPlaying, setIsDemoPlaying] = useState(false);

  const getJobsPath = isAuthenticated
    ? user?.accountType === "employer"
      ? ROUTES.employer.jobs
      : ROUTES.worker.findJobs
    : ROUTES.signIn;

  useEffect(() => {
    let isMounted = true;
    getCategories()
      .then((records) => {
        if (!isMounted) return;
        const list = (Array.isArray(records) ? records : [])
          .map((category: any) => ({
            _id: String(category?._id || category?.id || ""),
            name: String(category?.name || "").trim(),
          }))
          .filter((category) => category._id && category.name);
        setCategories(list);
      })
      .catch(() => {
        // Categories are decorative here — the hero and nav both degrade to
        // their non-category state rather than surfacing an error.
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (navMenuRef.current && !navMenuRef.current.contains(event.target as Node)) setOpenMenu(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenu]);

  /**
   * Where a hero search / category chip should land.
   *
   * Signed-out users can't reach /worker/find-jobs (it's behind RoleRoute), so
   * instead of dropping them on a bare login wall we hand SignIn the intended
   * URL as `location.state.from` — `getPostSignInPath` then delivers them to
   * their actual search once they authenticate, query intact.
   */
  const goToSearch = useCallback(
    (options?: { query?: string; categoryId?: string; intent?: HeroIntent }) => {
      const intent = options?.intent ?? heroIntent;

      if (intent === "hire") {
        if (!isAuthenticated) {
          navigate(ROUTES.signUp, { state: { from: ROUTES.employer.postJob } });
          return;
        }
        navigate(user?.accountType === "employer" ? ROUTES.employer.postJob : ROUTES.employer.dashboard);
        return;
      }

      const params = new URLSearchParams();
      const query = (options?.query ?? "").trim();
      if (query) params.set("q", query);
      if (options?.categoryId) params.set("category", options.categoryId);
      const search = params.toString();
      const target = `${ROUTES.worker.findJobs}${search ? `?${search}` : ""}`;

      if (!isAuthenticated) {
        navigate(ROUTES.signIn, { state: { from: target } });
        return;
      }
      navigate(target);
    },
    [heroIntent, isAuthenticated, navigate, user?.accountType],
  );

  const heroCopy = useMemo(
    () =>
      heroIntent === "hire"
        ? {
            leadIn: "Hire local talent",
            highlight: "Ready to Work",
            trailing: "in your community",
            subhead:
              "Post a job in minutes and reach verified workers near you. Track applicants, schedule interviews, and pay securely through escrow.",
            placeholder: "What do you need done?",
            action: "Post a job",
          }
        : {
            leadIn: "Unlock Your",
            highlight: "Career Potential",
            trailing: "with Micro Jobs",
            subhead:
              "Discover local job opportunities with all the information you need. It's your future. Come find it — and manage every application from start to finish.",
            placeholder: "Search local jobs, skills, or employers",
            action: "Search jobs",
          },
    [heroIntent],
  );

  const chipCategories = useMemo(() => categories.slice(0, 4), [categories]);
  const chipCategoriesFull = useMemo(() => categories.slice(0, 8), [categories]);

  const normalizeCadenceLabel = useCallback((raw: string) => {
    const source = raw.toLowerCase();
    if (source.includes("/mo") || source.includes("/month") || source.includes("per month")) return "/month";
    if (source.includes("/yr") || source.includes("/year") || source.includes("per year")) return "/year";
    if (source.includes("/week") || source.includes("per week")) return "/week";
    if (source.includes("/day") || source.includes("per day")) return "/day";
    if (source.includes("/hr") || source.includes("/hour") || source.includes("per hour")) return "/hour";
    return "";
  }, []);

  const formatJobSalary = useCallback((rawSalary?: string | number) => {
    if (!rawSalary && rawSalary !== 0) return "—";
    const salaryString = typeof rawSalary === "number" ? rawSalary.toString() : String(rawSalary);
    const numeric = Number.parseFloat(salaryString.replace(/,/g, "").replace(/[^0-9.]/g, ""));
    if (Number.isFinite(numeric) && numeric > 0) {
      const cadence = normalizeCadenceLabel(salaryString);
      return `₱${numeric.toLocaleString()}${cadence ? ` ${cadence}` : ""}`;
    }
    return salaryString.replace(/\$/g, "₱").replace(/\s{2,}/g, " ").trim();
  }, [normalizeCadenceLabel]);

  const getCompanyName = (job: any) => {
    if (typeof job.company === "string" && job.company.trim()) {
      return job.company;
    }
    if (job.jobPoster && typeof job.jobPoster === "object") {
      const name = `${job.jobPoster.firstName || ""} ${job.jobPoster.lastName || ""}`.trim();
      return name || job.jobPoster.companyName || "MicroJobs";
    }
    return "MicroJobs";
  };

  useEffect(() => {
    let isMounted = true;
    // Browsing is open to everyone: GET /jobs runs behind optionalAuth on the
    // server, so signed-out visitors get the nationwide list. Applying is what
    // requires an account — that gate lives on the card CTA below.
    const loadLandingJobs = async () => {
      setIsJobsLoading(true);
      setJobsLoadError(null);
      try {
        const data = await getJobs({ limit: 6, city: user?.city || undefined });
        if (!isMounted) return;
        setJobCards(
          (Array.isArray(data) ? data : []).slice(0, 6).map((job: any) => ({
            title: job.title || "Job Title",
            company: getCompanyName(job),
            location: job.location || "Location not specified",
            salary: formatJobSalary(job.salary),
            // The posted job photo wins; otherwise fall back to whoever posted
            // it. Both arrive on the public payload via PUBLIC_JOB_POSTER_SELECT.
            image: toAbsoluteAssetUrl(job.image) || toAbsoluteAssetUrl(job.jobPoster?.avatarUrl),
          })),
        );
      } catch (error: any) {
        if (!isMounted) return;
        setJobsLoadError(error?.message || "Unable to load jobs yet.");
      } finally {
        if (isMounted) setIsJobsLoading(false);
      }
    };
    loadLandingJobs();
    return () => {
      isMounted = false;
    };
  }, [formatJobSalary, isAuthenticated, user?.city]);

  /**
   * "How it works" media are real recordings and screenshots of this app, taken
   * against a throwaway database — see `public/media/how-it-works/`. The first
   * card of each intent carries the video; the other two are stills.
   */
  const howItWorksSteps = useMemo(
    () =>
      howItWorksIntent === "hire"
        ? [
            {
              title: "Posting a job is always free",
              description:
                "Describe the work, pick a category, and set the pay. Publishing costs nothing — you only move money when you fund the job.",
              video: "/media/how-it-works/how-it-works-hire.mp4",
              poster: "/media/how-it-works/how-it-works-hire-poster.webp",
              mediaLabel: "Screen recording: creating a job post in MicroJobs, from the empty form to the published listing.",
              action: "Post a job",
            },
            {
              title: "Review applicants and hire",
              description:
                "Applications land on a board you can move by stage. Shortlist, schedule an interview, and message candidates without leaving the page.",
              image: "/media/how-it-works/hire-2-applications.webp",
              mediaLabel: "The employer applications board, with an applicant in the Applied column.",
            },
            {
              title: "Pay when the work is done",
              description:
                "Pay is held in escrow the moment you post, and released to the worker's e-wallet once you accept the finished job.",
              image: "/media/how-it-works/hire-3-wallet.webp",
              mediaLabel: "The employer e-wallet, showing the balance and a completed escrow transaction.",
            },
          ]
        : [
            {
              title: "Finding work is always free",
              description:
                "Search jobs near you, compare guaranteed pay, and apply in one tap. Browsing and applying never cost you anything.",
              video: "/media/how-it-works/how-it-works-work.mp4",
              poster: "/media/how-it-works/how-it-works-work-poster.webp",
              mediaLabel: "Screen recording: searching for a job in MicroJobs, opening it, and applying.",
              action: "Find jobs",
            },
            {
              title: "Track every application",
              description:
                "Follow each application from submitted to hired, with interview schedules and employer messages in the same tracker.",
              image: "/media/how-it-works/work-2-applied.webp",
              mediaLabel: "The worker application tracker, showing a submitted application.",
            },
            {
              title: "Get paid to your e-wallet",
              description:
                "Accepted work releases straight from escrow to your worker balance. Withdraw to your bank or e-wallet whenever you want.",
              image: "/media/how-it-works/work-3-wallet.webp",
              mediaLabel: "The worker e-wallet, showing a balance built from completed job payments.",
            },
          ],
    [howItWorksIntent],
  );

  const toggleDemoPlayback = useCallback(() => {
    const video = demoVideoRef.current;
    if (!video) return;
    // onPlay/onPause below own the button's label, so the two never disagree
    // if playback is interrupted by the browser rather than by this click.
    if (video.paused) {
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  return (
    <div className="min-h-screen bg-white overflow-hidden">
      {/* Navigation */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md z-50 border-b border-gray-100"
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <motion.div 
              className="flex items-center"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <MicroJobsLogo
                className="cursor-pointer"
                onClick={() => navigate(ROUTES.home)}
              />
            </motion.div>

            <div className="hidden md:flex items-center gap-6" ref={navMenuRef}>
              {(["work", "hire"] as const).map((intent) => {
                const label = intent === "work" ? "Find work" : "Hire talent";
                const isOpen = openMenu === intent;
                return (
                  <div key={intent} className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenMenu(isOpen ? null : intent)}
                      aria-haspopup="true"
                      aria-expanded={isOpen}
                      className={`inline-flex min-h-11 items-center gap-1 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] ${
                        isOpen ? "text-[#1C4D8D]" : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      {label}
                      <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : "rotate-0"}`} aria-hidden />
                    </button>

                    <AnimatePresence>
                      {isOpen ? (
                        <motion.div
                          initial={prefersReducedMotion ? false : { opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
                          transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
                          className="absolute left-0 top-full z-50 mt-3 w-[740px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg"
                        >
                          <div className="grid grid-cols-[190px_minmax(0,1fr)]">
                            <div className="border-r border-slate-100 bg-slate-50 px-5 py-6">
                              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Categories</p>
                              <p className="mt-3 text-[13px] leading-relaxed text-slate-500">
                                {intent === "work"
                                  ? "Browse local openings by the kind of work you do."
                                  : "Find verified workers by the kind of help you need."}
                              </p>
                            </div>
                            <div className="px-6 py-6">
                              {chipCategoriesFull.length === 0 ? (
                                <p className="py-6 text-[13px] text-slate-500">Categories are loading…</p>
                              ) : (
                                <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                                  {chipCategoriesFull.map((category) => (
                                    <button
                                      key={category._id}
                                      type="button"
                                      onClick={() => {
                                        setOpenMenu(null);
                                        goToSearch({ categoryId: category._id, intent });
                                      }}
                                      className="group/item block text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D]"
                                    >
                                      <span className="block text-[15px] font-bold leading-snug text-slate-900 group-hover/item:text-[#1C4D8D]">
                                        {category.name}
                                      </span>
                                      <span className="mt-0.5 block text-[13px] leading-snug text-slate-500">
                                        {intent === "work"
                                          ? `Local ${category.name.toLowerCase()} jobs`
                                          : `Hire for ${category.name.toLowerCase()}`}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="border-t border-slate-100 px-6 py-4">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenu(null);
                                goToSearch({ intent });
                              }}
                              className="inline-flex items-center gap-1 text-[14px] font-bold text-[#1C4D8D] transition hover:opacity-80"
                            >
                              {intent === "work" ? "See all jobs" : "Post a job"}
                              <ChevronRight className="h-4 w-4" aria-hidden />
                            </button>
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                );
              })}

              <a href="#features" className="inline-flex min-h-11 items-center text-[14px] text-gray-600 hover:text-gray-900 font-medium transition-colors">Features</a>
              <a href="#help" className="inline-flex min-h-11 items-center text-[14px] text-gray-600 hover:text-gray-900 font-medium transition-colors">How it works</a>
              <a href="#contact" className="inline-flex min-h-11 items-center text-[14px] text-gray-600 hover:text-gray-900 font-medium transition-colors">Contact Us</a>
            </div>

            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(isAuthenticated ? appEntryPath : ROUTES.signIn)}
                className="hidden text-[14px] font-semibold text-gray-700 px-5 py-2 rounded-full hover:bg-gray-100 transition-colors sm:inline-flex"
              >
                {isAuthenticated ? "Go to app" : "Sign In"}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: "0 10px 30px rgba(73, 136, 196, 0.3)" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(ROUTES.signUp)}
                className="brand-primary-interactive hidden rounded-full px-6 py-2.5 text-[14px] font-semibold hover:shadow-lg sm:inline-flex"
              >
                Get Started
              </motion.button>
              <button
                type="button"
                onClick={() => setMobileNavOpen((prev) => !prev)}
                aria-expanded={mobileNavOpen}
                aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50 md:hidden"
              >
                {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu — the landing nav previously had no navigation at all below md. */}
        <AnimatePresence>
          {mobileNavOpen ? (
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
              className="border-t border-slate-100 bg-white px-6 py-4 md:hidden"
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => { setMobileNavOpen(false); goToSearch({ intent: "work" }); }}
                  className="min-h-11 text-left text-[15px] font-semibold text-slate-800"
                >
                  Find work
                </button>
                <button
                  type="button"
                  onClick={() => { setMobileNavOpen(false); goToSearch({ intent: "hire" }); }}
                  className="min-h-11 text-left text-[15px] font-semibold text-slate-800"
                >
                  Hire talent
                </button>
                <a href="#features" onClick={() => setMobileNavOpen(false)} className="min-h-11 text-[15px] font-medium leading-[44px] text-slate-600">Features</a>
                <a href="#help" onClick={() => setMobileNavOpen(false)} className="min-h-11 text-[15px] font-medium leading-[44px] text-slate-600">How it works</a>
                <a href="#contact" onClick={() => setMobileNavOpen(false)} className="min-h-11 text-[15px] font-medium leading-[44px] text-slate-600">Contact Us</a>
                <button
                  type="button"
                  onClick={() => { setMobileNavOpen(false); navigate(isAuthenticated ? appEntryPath : ROUTES.signIn); }}
                  className="mt-2 min-h-11 rounded-full border border-slate-200 text-[15px] font-semibold text-slate-700"
                >
                  {isAuthenticated ? "Go to app" : "Sign In"}
                </button>
                <button
                  type="button"
                  onClick={() => { setMobileNavOpen(false); navigate(ROUTES.signUp); }}
                  className="brand-primary-interactive mt-2 min-h-11 rounded-full text-[15px] font-semibold sm:hidden"
                >
                  Get Started
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.nav>

      <main>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-slate-50 px-6 pb-20 pt-32">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <motion.div
              initial={false}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              {/* Intent toggle — flips the hero copy and where search sends you. */}
              <div className="mb-6 inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm" role="group" aria-label="What do you want to do?">
                {(["work", "hire"] as const).map((intent) => (
                  <button
                    key={intent}
                    type="button"
                    onClick={() => setHeroIntent(intent)}
                    aria-pressed={heroIntent === intent}
                    className={`min-h-11 rounded-full px-6 text-[14px] font-semibold transition ${
                      heroIntent === intent ? "bg-[#1C4D8D] text-white" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {intent === "work" ? "I want to work" : "I want to hire"}
                  </button>
                ))}
              </div>

              <h1 className="text-[48px] lg:text-[56px] font-bold leading-tight text-gray-900 mb-6">
                {heroCopy.leadIn}<br />
                <span className="text-[#1C4D8D]">{heroCopy.highlight}</span><br />
                {heroCopy.trailing}
              </h1>

              <p className="text-[16px] text-gray-600 mb-8 leading-relaxed">{heroCopy.subhead}</p>

              {/* Search */}
              <form
                role="search"
                onSubmit={(event) => {
                  event.preventDefault();
                  goToSearch({ query: heroQuery });
                }}
                className="flex flex-col gap-3 sm:flex-row sm:items-center"
              >
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">{heroCopy.placeholder}</span>
                  <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
                  <input
                    type="search"
                    value={heroQuery}
                    onChange={(event) => setHeroQuery(event.target.value)}
                    placeholder={heroCopy.placeholder}
                    className="h-14 w-full rounded-full border border-slate-200 bg-white pl-13 pr-4 text-[15px] text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#1C4D8D] focus:ring-2 focus:ring-[#1C4D8D]/20"
                    style={{ paddingLeft: "3.25rem" }}
                  />
                </label>
                <button
                  type="submit"
                  className="brand-primary-interactive inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-full px-8 text-[15px] font-semibold transition hover:opacity-90"
                >
                  {heroCopy.action}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
              </form>

              {/* Quick category chips, from the real category list */}
              {chipCategories.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {chipCategories.map((category) => (
                    <button
                      key={category._id}
                      type="button"
                      onClick={() => goToSearch({ categoryId: category._id })}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 transition hover:border-[#1C4D8D] hover:text-[#1C4D8D]"
                    >
                      {category.name}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  ))}
                </div>
              ) : null}

              <p className="mt-5 text-[13px] text-slate-500">
                <button type="button" onClick={() => navigate(ROUTES.signUp)} className="font-bold text-[#1C4D8D] hover:underline">
                  Create a free account
                </button>{" "}
                · No credit card required · Free forever
              </p>
            </motion.div>

            {/* Right Content - Illustration */}
            <motion.div 
              initial={false}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="relative"
              style={{ scale }}
            >
              {/* PLACEHOLDER HERO IMAGE — deliberately blank.
                  Set `heroPhoto` to a path under /media/ to fill the slot; the
                  grey block swaps to the image with no other change needed. No
                  real person's photo should go in here until it is cleared with
                  them, and note that client/public is served to anyone. */}
              <div className="relative w-full overflow-hidden rounded-[32px] border border-slate-200 bg-[#EAF1FB] p-4 shadow-[0_28px_70px_rgba(15,41,84,0.18)] sm:p-6 lg:p-7">
                {heroPhoto ? (
                  <img
                    src={heroPhoto}
                    alt=""
                    className="aspect-[4/3] w-full rounded-[20px] object-cover"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="aspect-[4/3] w-full rounded-[20px] border border-slate-200 bg-slate-100"
                  />
                )}

                {/* Attribution is a stand-in too — replace with that person's
                    details once the photo above is filled in. */}
                <figure className="mt-4 rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(15,41,84,0.08)] sm:mt-5 sm:p-5">
                  <blockquote className="text-[13px] font-semibold leading-snug text-[#0F2954] sm:text-[15px]">
                    &ldquo;We built MicroJobs so finding real work near you doesn&rsquo;t depend on
                    who you already know.&rdquo;
                  </blockquote>
                  <p className="mt-1.5 text-[11px] text-slate-500 sm:text-[12px]">
                    Team member &middot; Micro Jobs
                  </p>
                </figure>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section with Animated Counters */}
      <section className="relative overflow-hidden bg-slate-50 px-6 py-20">
        <motion.div 
          className="absolute -top-20 -right-20 w-96 h-96 bg-[#1C4D8D]/5 rounded-full blur-3xl"
          animate={{ rotate: 360 }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        />
        
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <motion.h2 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[36px] font-bold text-gray-900 mb-3"
          >
            Join Micro Jobs Today and Experience
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mb-16 text-[36px] font-bold text-[#1C4D8D]"
          >
            The Power of Numbers
          </motion.p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { value: 95, label: "Users were hired through Micro Jobs in the past year" },
              { value: 98, label: "Users were the placement among trusted Employers" },
              { value: 90, label: "Users were job placement with top companies" },
            ].map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
                whileHover={{ y: -10, boxShadow: "0 20px 40px rgba(73, 136, 196, 0.2)" }}
                className="bg-white/80 backdrop-blur-sm rounded-[24px] p-8 shadow-lg border border-white/50"
              >
                <motion.div 
                  className="mb-2 text-[48px] font-bold text-[#1C4D8D]"
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.2 + 0.3, type: "spring", stiffness: 200 }}
                >
                  <AnimatedCounter target={stat.value} suffix="%" />
                </motion.div>
                <p className="text-[14px] text-gray-600">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Micro Jobs Section with 3D Effect */}
      <section className="py-20 px-6 relative scroll-mt-24" id="features">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-[36px] font-bold text-gray-900 mb-2">
              Why <span className="text-[#1C4D8D]">Micro Jobs?</span>
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed text-gray-600">
              We start in your community — cleaning, delivery, tutoring, repairs, child care and more, right in your city.
              When an employer is ready to hire beyond their area, we open the post nationwide and help them run it end to end.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Local first */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.05, rotateY: 5 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="bg-white rounded-[24px] p-8 border border-gray-100 hover:shadow-2xl transition-all perspective-1000"
            >
              <h3 className="text-[22px] font-bold text-gray-900 mb-3">Local jobs, first</h3>
              <p className="text-[14px] text-gray-600 leading-relaxed mb-6">
                Set your city and see work happening around you. Every listing is matched to your area first, so the commute is short and the pay is real.
              </p>
              <div className="space-y-3 rounded-[16px] bg-slate-50 p-4">
                {[
                  ["Cleaning", "In your barangay"],
                  ["Delivery", "Same-day routes"],
                  ["Tutoring", "After school"],
                ].map(([label, detail], i) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.15 }}
                    className="flex items-center justify-between"
                  >
                    <span className="text-[12px] font-semibold text-gray-700">{label}</span>
                    <span className="text-[12px] text-gray-500">{detail}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* National reach */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.05, rotateY: -5 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="bg-white rounded-[24px] p-8 border border-gray-100 hover:shadow-2xl transition-all"
            >
              <h3 className="text-[22px] font-bold text-gray-900 mb-3">National when you need it</h3>
              <p className="text-[14px] text-gray-600 leading-relaxed mb-6">
                Hiring outside your city? If the employer allows it, we open the listing nationwide and support the whole process — from applicants to interviews to payout.
              </p>
              <div className="rounded-[16px] bg-[#ECFDF5] p-6 text-center">
                <p className="text-[14px] font-semibold text-gray-900">Local by default</p>
                <p className="text-[14px] font-semibold text-[#047857]">Nationwide on request</p>
              </div>
            </motion.div>

            {/* Verified people */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.05 }}
              className="bg-white rounded-[24px] p-8 border border-gray-100 hover:shadow-2xl transition-all"
            >
              <h3 className="text-[22px] font-bold text-gray-900 mb-3">People you can verify</h3>
              <p className="text-[14px] text-gray-600 leading-relaxed">
                Employers and workers both go through ID and address checks, and every finished job leaves a public review. You know who you are working with before you commit.
              </p>
            </motion.div>

            {/* Paid safely */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.05 }}
              className="bg-white rounded-[24px] p-8 border border-gray-100 hover:shadow-2xl transition-all"
            >
              <h3 className="text-[22px] font-bold text-gray-900 mb-3">Get paid, safely</h3>
              <p className="text-[14px] text-gray-600 leading-relaxed">
                Pay is secured in escrow the moment a job is posted and released when the work is accepted. Apply, track your applications, schedule interviews, and cash out — all in one place.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How it works — one intent at a time. The toggle swaps the copy and the
          media together, so the section never explains both sides at once. */}
      <section className="scroll-mt-24 border-t border-slate-100 bg-white px-6 py-20" id="help">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <h2 className="text-[36px] font-bold text-gray-900">How it works</h2>

            <div
              className="inline-flex self-start rounded-full border border-slate-200 bg-white p-1 md:self-auto"
              role="group"
              aria-label="Show how MicroJobs works"
            >
              {(["hire", "work"] as const).map((intent) => (
                <button
                  key={intent}
                  type="button"
                  onClick={() => setHowItWorksIntent(intent)}
                  aria-pressed={howItWorksIntent === intent}
                  className={`min-h-11 rounded-full px-6 text-[14px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] ${
                    howItWorksIntent === intent
                      ? "bg-[#1C4D8D] text-white"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {intent === "hire" ? "For hiring" : "For finding work"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-3">
            {howItWorksSteps.map((step, index) => (
              <motion.article
                key={`${howItWorksIntent}-${step.title}`}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{
                  duration: prefersReducedMotion ? 0 : 0.24,
                  delay: prefersReducedMotion ? 0 : index * 0.04,
                }}
              >
                <div className="relative aspect-[8/5] overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
                  {step.video ? (
                    <>
                      <video
                        ref={demoVideoRef}
                        // Remounting on intent change restarts the right clip
                        // instead of leaving the previous one mid-scrub.
                        key={howItWorksIntent}
                        className="h-full w-full object-cover"
                        src={step.video}
                        poster={step.poster}
                        aria-label={step.mediaLabel}
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        autoPlay={!prefersReducedMotion}
                        onPlay={() => setIsDemoPlaying(true)}
                        onPause={() => setIsDemoPlaying(false)}
                      />
                      <button
                        type="button"
                        onClick={toggleDemoPlayback}
                        aria-label={isDemoPlaying ? "Pause the demo" : "Play the demo"}
                        className="absolute bottom-4 right-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#1C4D8D] shadow-md transition hover:opacity-90 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D]"
                      >
                        {isDemoPlaying ? (
                          <Pause className="h-4 w-4" aria-hidden />
                        ) : (
                          <Play className="h-4 w-4" aria-hidden />
                        )}
                      </button>
                    </>
                  ) : (
                    <img
                      src={step.image}
                      alt={step.mediaLabel}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover object-top"
                    />
                  )}
                </div>

                <h3 className="mt-6 text-[22px] font-bold text-gray-900">{step.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-gray-600">{step.description}</p>

                {step.action ? (
                  <button
                    type="button"
                    onClick={() => goToSearch({ intent: howItWorksIntent })}
                    className="brand-primary-interactive mt-6 inline-flex min-h-11 items-center gap-2 rounded-full px-7 text-[15px] font-semibold transition hover:opacity-90 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] focus-visible:ring-offset-2"
                  >
                    {step.action}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* Find Your Match Jobs with Stagger Animation */}
      <section className="py-20 px-6 scroll-mt-24" id="jobs">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="mb-2 text-[36px] font-bold text-[#1C4D8D]">
              Find Your Match
            </h2>
            <p className="text-[36px] font-bold text-gray-900">Job Here</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobCards.map((job, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ 
                  y: -10, 
                  boxShadow: "0 20px 40px rgba(73, 136, 196, 0.2)",
                  rotateY: 5
                }}
                className="bg-white rounded-[24px] p-6 border border-gray-100 hover:shadow-xl transition-all cursor-pointer group"
              onClick={() => navigate(getJobsPath)}
              >
                {/* Real imagery only — the job's photo, or the employer's
                    profile picture. Neither present falls back to their
                    initial rather than a generic icon. */}
                {job.image ? (
                  <img
                    src={job.image}
                    alt=""
                    loading="lazy"
                    className="mb-4 h-16 w-16 rounded-[16px] border border-slate-200 object-cover"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="mb-4 flex h-16 w-16 items-center justify-center rounded-[16px] bg-[#1C4D8D] text-[24px] font-bold text-white"
                  >
                    {job.company.trim().charAt(0).toUpperCase() || "M"}
                  </div>
                )}

                <h3 className="text-[18px] font-bold text-gray-900 mb-2 group-hover:opacity-80 transition-colors">{job.title}</h3>
                
                <div className="flex items-center gap-2 text-[13px] text-gray-600 mb-1">
                  <Briefcase className="w-4 h-4" />
                  <span>{job.company}</span>
                </div>
                
                <div className="flex items-center gap-2 text-[13px] text-gray-600 mb-4">
                  <MapPin className="w-4 h-4" />
                  <span>{job.location}</span>
                </div>
                
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-100">
                  <span className="text-[16px] font-bold text-gray-900">{job.salary}</span>
                  {/* Anyone can read the listing; applying needs an account, so
                      signed-out visitors get an explicit sign-up CTA rather than
                      a chevron that dumps them on a login wall. */}
                  {isAuthenticated ? (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(getJobsPath);
                      }}
                      aria-label={`View ${job.title}`}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1C4D8D] text-white transition-all group-hover:shadow-lg"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </motion.button>
                  ) : (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(`${ROUTES.signUp}?role=worker`);
                      }}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[#1C4D8D] px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] focus-visible:ring-offset-2"
                    >
                      Sign up to apply
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {!isJobsLoading && jobCards.length === 0 ? (
            <div className="mx-auto max-w-xl rounded-2xl border border-[#1C4D8D]/15 bg-white p-6 text-center text-sm text-slate-600">
              {jobsLoadError || 'No jobs are available right now. Please check back soon.'}
            </div>
          ) : null}

          {!isAuthenticated && jobCards.length > 0 ? (
            <p className="mx-auto mt-8 max-w-2xl text-center text-[14px] leading-6 text-slate-600">
              Browsing jobs is free and open to everyone. Create an account and finish
              verification to apply, message employers, and get paid through escrow.
            </p>
          ) : null}

          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-12"
          >
            <motion.button
              whileHover={{ scale: 1.1 }}
              onClick={() => navigate(getJobsPath)}
              className="text-[14px] font-semibold text-[#1C4D8D] hover:opacity-80 transition-colors"
            >
              Show More →
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* Team Section
          PLACEHOLDER CONTENT — the photo slots are deliberately empty and the
          names/roles/quotes below are stand-ins. Fill each `photo` with a path
          under /media/ once real images are approved, and no real name should
          go in here until it is cleared with the person. */}
      <section className="bg-slate-50 px-6 py-20">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-[36px] font-bold text-gray-900 mb-2">Meet the team behind</h2>
            <p className="text-[36px] font-bold text-[#1C4D8D]">
              Micro Jobs
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                name: "Team member",
                role: "Add role",
                photo: null as string | null,
                text: '"We wanted work near you to be easy to find, whether you are hiring for an afternoon or looking for your next shift."',
              },
              {
                name: "Team member",
                role: "Add role",
                photo: null as string | null,
                text: '"Every job is funded before it goes live, so the pay is real and the person doing the work actually gets it."',
              },
            ].map((member, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: index === 0 ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                whileHover={{ y: -10, boxShadow: "0 20px 40px rgba(73, 136, 196, 0.2)" }}
                className="bg-white/80 backdrop-blur-sm rounded-[24px] p-8 shadow-lg border border-white/50"
              >
                <div className="mb-5 flex items-center gap-4">
                  {member.photo ? (
                    <img
                      src={member.photo}
                      alt=""
                      loading="lazy"
                      className="h-16 w-16 shrink-0 rounded-[16px] object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="h-16 w-16 shrink-0 rounded-[16px] border border-slate-200 bg-slate-100"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-[17px] font-bold text-[#0F2954]">{member.name}</p>
                    <p className="mt-1 text-[13px] text-gray-600">{member.role}</p>
                  </div>
                </div>
                <p className="text-[14px] text-gray-600 leading-relaxed">
                  {member.text}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section with Gradient Animation */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            whileHover={{ scale: 1.02 }}
            className="relative overflow-hidden rounded-[32px] bg-[#1C4D8D] p-12 shadow-2xl"
          >
            <motion.div 
              className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl"
              animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.2, 0.1] }}
              transition={{ duration: 5, repeat: Infinity }}
            />
            <motion.div 
              className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl"
              animate={{ scale: [1.5, 1, 1.5], opacity: [0.1, 0.2, 0.1] }}
              transition={{ duration: 5, repeat: Infinity }}
            />
            
            <div className="relative z-10">
              <motion.h2 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-[36px] font-bold text-white mb-4"
              >
                Ready to Find Your Dream Job?
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="text-[16px] text-white/90 mb-8"
              >
                Join thousands of professionals who have already found their perfect match on Micro Jobs
              </motion.p>
              <motion.button
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                whileHover={{ scale: 1.1, boxShadow: "0 20px 40px rgba(255, 255, 255, 0.3)" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(ROUTES.signUp)}
                className="inline-flex items-center gap-2 text-[16px] font-semibold text-[#1C4D8D] px-8 py-4 rounded-full bg-white hover:shadow-xl transition-all"
              >
                Get Started for Free
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>

      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-6 scroll-mt-24" id="contact">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <motion.div whileHover={{ scale: 1.05 }}>
                <MicroJobsLogo
                  variant="light"
                  className="cursor-pointer mb-4"
                  onClick={() => navigate(ROUTES.home)}
                />
              </motion.div>
              <p className="text-[13px] text-gray-400">
                © 2026 Micro Jobs. All rights reserved.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <h3 className="text-[14px] font-semibold mb-4">Resources</h3>
              <ul className="space-y-2">
                <li><a href="#jobs" className="text-[13px] text-gray-400 hover:text-white transition-colors">Jobs</a></li>
                <li><a href="#employers" className="text-[13px] text-gray-400 hover:text-white transition-colors">Employers</a></li>
                <li><a href="#features" className="text-[13px] text-gray-400 hover:text-white transition-colors">Companies</a></li>
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <h3 className="text-[14px] font-semibold mb-4">Company</h3>
              <ul className="space-y-2">
                <li><a href="#features" className="text-[13px] text-gray-400 hover:text-white transition-colors">About Us</a></li>
                <li><a href="#contact" className="text-[13px] text-gray-400 hover:text-white transition-colors">Contact</a></li>
                <li><a href="#help" className="text-[13px] text-gray-400 hover:text-white transition-colors">Help</a></li>
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
            >
              <h3 className="text-[14px] font-semibold mb-4">Legal</h3>
              <ul className="space-y-2">
                <li>
                  <button
                    type="button"
                    onClick={() => navigate(ROUTES.legalDoc("terms"))}
                    className="text-[13px] text-gray-400 hover:text-white transition-colors"
                  >
                    Terms of Service
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigate(ROUTES.legalDoc("privacy"))}
                    className="text-[13px] text-gray-400 hover:text-white transition-colors"
                  >
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigate(ROUTES.legalDoc("cookies"))}
                    className="text-[13px] text-gray-400 hover:text-white transition-colors"
                  >
                    Cookie Policy
                  </button>
                </li>
                <li>
                  {/* Reopens the consent dialog after a choice has been made —
                      otherwise the decision would be irreversible. */}
                  <button
                    type="button"
                    onClick={openCookiePreferences}
                    className="text-[13px] text-gray-400 hover:text-white transition-colors"
                  >
                    Your privacy choices
                  </button>
                </li>
              </ul>
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="border-t border-gray-800 pt-8"
          >
            <p className="text-[12px] text-gray-500 text-center">
              Made by Computer Security 3rd Year Block 1 - COMSEC 01
            </p>
          </motion.div>
        </div>
      </footer>
    </div>
  );
}
