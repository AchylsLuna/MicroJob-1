export const DEFAULT_JOB_CATEGORIES = [
  'Construction',
  'Electrical',
  'Plumbing',
  'Carpentry',
  'Cleaning Services',
  'Driving',
  'Delivery Services',
  'Landscaping',
  'Maintenance',
  'Other Skilled Jobs',
];

export async function ensureDefaultJobCategories(CategoryModel) {
  if (!CategoryModel) return;

  await CategoryModel.bulkWrite(
    DEFAULT_JOB_CATEGORIES.map((name, order) => ({
      updateOne: {
        filter: { name },
        update: { $setOnInsert: { name }, $set: { order } },
        upsert: true,
      },
    })),
    { ordered: false }
  );
}
