import { useState } from 'react';
import { Star, X } from 'lucide-react';
import { createReview } from '../../services/api';

export type RatingTarget = {
  applicationId: string;
  name: string;
  jobTitle: string;
  roleLabel: 'worker' | 'employer';
};

export function RatingDialog({
  target,
  onClose,
  onSubmitted,
}: {
  target: RatingTarget;
  onClose: () => void;
  onSubmitted: () => void | Promise<void>;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!rating) {
      setError('Choose a rating from 1 to 5 stars.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const trimmedComment = comment.trim();
      await createReview({
        applicationId: target.applicationId,
        rating,
        ...(trimmedComment ? { comment: trimmedComment } : {}),
      });
      await onSubmitted();
      onClose();
    } catch (requestError: any) {
      setError(requestError?.message || 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="rating-dialog-title">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="rating-dialog-title" className="text-xl font-bold text-slate-950">Rate {target.roleLabel}</h2>
            <p className="mt-1 text-sm text-slate-500">{target.name} · {target.jobTitle}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close rating dialog">
            <X className="h-5 w-5" />
          </button>
        </div>

        <fieldset className="mt-6">
          <legend className="text-sm font-semibold text-slate-700">Overall rating</legend>
          <div className="mt-2 flex gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                className="rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                aria-label={`${value} star${value === 1 ? '' : 's'}`}
                aria-pressed={rating === value}
              >
                <Star className={`h-8 w-8 ${value <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
              </button>
            ))}
          </div>
        </fieldset>

        <label className="mt-5 block text-sm font-semibold text-slate-700" htmlFor="review-comment">
          Written comment <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(event) => setComment(event.target.value.slice(0, 2000))}
          rows={5}
          placeholder="Optional: share something about your experience."
          className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        <div className="mt-1 text-right text-xs text-slate-400">{comment.length}/2000</div>

        {error ? <p className="mt-3 text-sm text-red-600" role="alert">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={submitting || !rating} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? 'Submitting…' : 'Submit rating'}
          </button>
        </div>
      </div>
    </div>
  );
}
