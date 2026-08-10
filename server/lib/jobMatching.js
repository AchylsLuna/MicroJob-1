const STOP_WORDS = new Set([
  'and', 'the', 'for', 'with', 'from', 'that', 'this', 'your', 'you', 'our',
  'are', 'will', 'job', 'work', 'worker', 'needed', 'need', 'services', 'service',
  'other', 'years', 'year', 'experience', 'skilled',
]);

const CATEGORY_KEYWORDS = {
  construction: ['construction', 'builder', 'building', 'masonry', 'mason', 'concrete', 'foreman'],
  electrical: ['electrical', 'electrician', 'electric', 'wiring', 'wire', 'circuit', 'installation'],
  plumbing: ['plumbing', 'plumber', 'pipe', 'pipes', 'drain', 'faucet', 'water'],
  carpentry: ['carpentry', 'carpenter', 'wood', 'woodwork', 'cabinet', 'furniture'],
  'cleaning services': ['cleaning', 'cleaner', 'housekeeping', 'janitor', 'sanitation'],
  driving: ['driving', 'driver', 'vehicle', 'chauffeur', 'license'],
  'delivery services': ['delivery', 'courier', 'rider', 'logistics', 'dispatch'],
  landscaping: ['landscaping', 'gardener', 'gardening', 'lawn', 'plants', 'groundskeeping'],
  maintenance: ['maintenance', 'repair', 'technician', 'handyman', 'troubleshooting', 'preventive'],
  'other skilled jobs': ['skilled', 'technician', 'specialist', 'trade'],
};

const normalize = (value = '') => String(value)
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const tokenize = (...values) => {
  const tokens = values
    .flat(Infinity)
    .flatMap((value) => normalize(value).split(/\s+/))
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
  return new Set(tokens);
};

const valueList = (values = [], fields = []) => (Array.isArray(values) ? values : [])
  .flatMap((value) => {
    if (typeof value === 'string') return [value];
    return fields.map((field) => value?.[field]).filter(Boolean);
  });

const getCategory = (job) => {
  const category = job?.category;
  if (category && typeof category === 'object') {
    return { id: String(category._id || ''), name: String(category.name || '') };
  }
  return { id: String(category || ''), name: '' };
};

const overlapRatio = (source, target) => {
  if (!target.size) return 0;
  let matches = 0;
  target.forEach((token) => {
    if (source.has(token)) matches += 1;
  });
  return matches / target.size;
};

const phraseMatchRatio = (workerTokens, phrases = []) => {
  const normalizedPhrases = phrases.map((value) => tokenize(value)).filter((tokens) => tokens.size);
  if (!normalizedPhrases.length) return 0;
  const matched = normalizedPhrases.filter((tokens) => overlapRatio(workerTokens, tokens) >= 0.5).length;
  return matched / normalizedPhrases.length;
};

export function scoreJobForWorker(job, worker) {
  const workerSkills = valueList(worker?.skills, ['name', 'description']);
  const experienceValues = valueList(worker?.workExperience, ['title', 'description', 'company']);
  const preferences = valueList(worker?.jobPreferences);
  const workerSkillTokens = tokenize(workerSkills);
  const workerExperienceTokens = tokenize(experienceValues, worker?.totalExperience);
  const workerProfileTokens = tokenize(worker?.jobPosition, worker?.about, preferences);
  const allWorkerTokens = new Set([
    ...workerSkillTokens,
    ...workerExperienceTokens,
    ...workerProfileTokens,
  ]);

  const jobSkills = valueList(job?.skills);
  const jobRequirementValues = valueList(job?.requirements);
  const jobSkillTokens = tokenize(jobSkills, jobRequirementValues);
  const jobProfileTokens = tokenize(job?.title, job?.description, jobSkills, jobRequirementValues);
  const category = getCategory(job);
  const categoryName = normalize(category.name);
  const categoryTokens = tokenize(category.name, CATEGORY_KEYWORDS[categoryName] || []);
  const preferredCategoryIds = new Set(
    (Array.isArray(worker?.preferredCategories) ? worker.preferredCategories : [])
      .map((item) => String(item?._id || item || ''))
      .filter(Boolean)
  );
  const preferredCategoryNames = new Set(
    (Array.isArray(worker?.preferredCategories) ? worker.preferredCategories : [])
      .map((item) => normalize(item?.name || ''))
      .filter(Boolean)
  );

  let categoryScore = 0;
  if (
    (category.id && preferredCategoryIds.has(category.id)) ||
    (categoryName && preferredCategoryNames.has(categoryName))
  ) {
    categoryScore = 30;
  } else if (categoryTokens.size && overlapRatio(allWorkerTokens, categoryTokens) > 0) {
    categoryScore = 20;
  }

  const skillsRatio = Math.max(
    phraseMatchRatio(allWorkerTokens, jobSkills),
    overlapRatio(allWorkerTokens, jobSkillTokens)
  );
  const skillScore = Math.min(40, Math.round(skillsRatio * 40));
  const experienceScore = Math.min(15, Math.round(overlapRatio(workerExperienceTokens, jobProfileTokens) * 30));
  const profileScore = Math.min(10, Math.round(overlapRatio(workerProfileTokens, jobProfileTokens) * 20));

  const locationText = normalize(job?.location);
  const workerLocations = [worker?.city, worker?.province].map(normalize).filter(Boolean);
  const locationScore = workerLocations.some((location) => locationText.includes(location)) ? 5 : 0;

  const percentage = Math.max(0, Math.min(100, categoryScore + skillScore + experienceScore + profileScore + locationScore));
  const reasons = [];
  if (categoryScore === 30) reasons.push('Preferred category');
  else if (categoryScore > 0) reasons.push('Category fits your profile');
  if (skillScore >= 12) reasons.push('Matching skills');
  if (experienceScore >= 5) reasons.push('Relevant experience');
  if (profileScore >= 4) reasons.push('Matches your job preferences');
  if (locationScore) reasons.push('Near your location');

  const level = percentage >= 80
    ? 'Excellent match'
    : percentage >= 60
      ? 'Strong match'
      : percentage >= 40
        ? 'Good match'
        : 'Potential match';

  return { percentage, level, reasons };
}

export const isRecommendableJob = (job, now = new Date()) => {
  if (!job || job.status !== 'Available') return false;
  const deadline = new Date(job.deadline);
  return !Number.isNaN(deadline.getTime()) && deadline >= now;
};

