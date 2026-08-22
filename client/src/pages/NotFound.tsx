import { useLocation, useNavigate } from "react-router-dom";
import { Button, StatusState } from "../components/ui";
import { ROUTES } from "../utils/routes";

// Mounted at the App.tsx catch-all route. Unlike a bare `<Navigate to={ROUTES.home} />`,
// this surfaces the URL that was actually requested rather than silently discarding it --
// useful for a typo'd link, an expired share link, or an un-migrated legacy path.
export default function NotFound() {
  const location = useLocation();
  const navigate = useNavigate();
  const attemptedPath = `${location.pathname}${location.search}${location.hash}`;

  return (
    <main className="flex min-h-[70vh] items-center justify-center p-6">
      <StatusState
        tone="error"
        title="Page not found"
        description={`We couldn't find ${attemptedPath}. It may have moved or the link may be out of date.`}
        action={<Button onClick={() => navigate(ROUTES.home)}>Go home</Button>}
      />
    </main>
  );
}
