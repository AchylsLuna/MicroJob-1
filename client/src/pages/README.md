# Pages Organization

This folder contains all the application pages organized by user type.

Canonical roles used by the app:
- `user`
- `employer`
- `admin`

## Folder Structure

### `/worker` - Worker-specific pages
Pages only accessible to users looking for work:
- `AppliedJobs.tsx` - View all jobs the worker has applied to with status tracking
- `SavedJobs.tsx` - View bookmarked/saved jobs for later

### `/employer` - Employer-specific pages  
Pages only accessible to users hiring talent:
- `PostJob.tsx` - Create and post new job listings

Legacy route mapping:
- Legacy Doctor routes are redirected to Employer routes (`/employer/*`).

### `/shared` - Shared pages
Pages accessible to all user types (exports from parent):
- Dashboard
- FindJobs
- JobDetails
- Settings
- Home
- SignIn/SignUp

### Root Level Pages
Root level pages should be avoided for new features. Add new routes under role-specific folders (`worker`, `employer`, `admin`) or shared pages.

## Usage

```typescript
// Import worker pages
import { AppliedJobs, SavedJobs } from './pages/worker';

// Import employer pages
import { PostJob } from './pages/employer';

// Import shared pages
import { Dashboard, Settings } from './pages/shared';
```

## Routes

- `/worker/applied-jobs` - Applied jobs tracking
- `/worker/saved-jobs` - Bookmarked jobs
- `/employer/post-job` - Post new job listing
- All other routes remain at root level
