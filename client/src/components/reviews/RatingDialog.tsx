import { useState } from 'react';
import { Star } from 'lucide-react';
import { createReview } from '../../services/api';
import { Dialog } from '../ui';

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
    // On `ui`'s Dialog rather than a hand-rolled `fixed inset-0`. That brings
    // the height cap and internal scrolling this dialog never had -- a star
    // row, a five-row textarea and a button pair do not fit a landscape phone,
    // and with no cap the panel simply overflowed and the Submit button could
    // not be reached. It also brings the focus trap, Escape handling, the
    // portal and the z-100 layer, none of which this had.
    <Dialog
      open
      title={`Rate ${target.roleLabel}`}
      description={`${target.name} · ${target.jobTitle}`}
      onClose={onClose}
      closeDisabled={submitting}
    >
      <fieldset>
        <legend className="text-sm font-semibold text-slate-700">Overall rating</legend>
        <div className="mt-2 flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              // h-11/w-11 rather than `p-1` around the icon: the padded icon
              // measured 40px, under the 44px tap-target floor.
              className="flex h-11 w-11 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
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
        className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
      <div className="mt-1 text-right text-xs text-slate-400">{comment.length}/2000</div>

      {error ? <p className="mt-3 text-sm text-red-600" role="alert">{error}</p> : null}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} disabled={submitting} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700">Cancel</button>
        <button type="button" onClick={handleSubmit} disabled={submitting || !rating} className="min-h-11 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
          {submitting ? 'Submitting…' : 'Submit rating'}
        </button>
      </div>
    </Dialog>
  );
}
