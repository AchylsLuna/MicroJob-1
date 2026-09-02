import { ROUTES } from "../utils/routes";

export type WorkerNavigationItem = {
  label: string;
  path: string;
};

export const workerPrimaryNavigation: WorkerNavigationItem[] = [
  { label: "Find Jobs", path: ROUTES.worker.findJobs },
  { label: "Applied Jobs", path: ROUTES.worker.appliedJobs },
  { label: "Messages", path: ROUTES.worker.messages },
];

export const workerMoreNavigation: WorkerNavigationItem[] = [
  { label: "Saved Jobs", path: ROUTES.worker.savedJobs },
  { label: "E-Wallet", path: ROUTES.worker.eWallet },
  { label: "Support", path: ROUTES.worker.support },
  { label: "Settings", path: ROUTES.worker.settings },
];
