import { useEffect, useMemo, useState } from 'react';
import { MessageSquareReply, Star, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  reactToReview,
  replyToReview,
  type ProfileReview,
  type ReviewSort,
  type ReviewSummary,
} from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '../../lib/toast';
import { ROUTES } from '../../utils/routes';

const SORT_OPTIONS: Array<{ value: ReviewSort; label: string }> = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'highest', label: 'Highest Rated' },
  { value: 'lowest', label: 'Lowest Rated' },
  { value: 'helpful', label: 'Most Helpful' },
];

const getReviewerName = (review: ProfileReview) =>
  review.reviewer?.companyName ||
  `${review.reviewer?.firstName || ''} ${review.reviewer?.lastName || ''}`.trim() ||
  'Verified user';

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export function ProfileReviews({
  profileOwnerId,
  profileOwnerName,
  summary,
  reviews,
  sort: controlledSort,
  onSortChange,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: {
  profileOwnerId: string;
  profileOwnerName: string;
  summary: ReviewSummary;
  reviews: ProfileReview[];
  sort?: ReviewSort;
  onSortChange?: (sort: ReviewSort) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<ProfileReview[]>(reviews);
  const [localSort, setLocalSort] = useState<ReviewSort>('recent');
  const [reactionPending, setReactionPending] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [replyPending, setReplyPending] = useState(false);

  useEffect(() => setItems(reviews), [reviews]);

  const sort = controlledSort ?? localSort;
  const changeSort = (nextSort: ReviewSort) => {
    if (onSortChange) onSortChange(nextSort);
    else setLocalSort(nextSort);
  };

  const sortedReviews = useMemo(() => {
    const recent = (left: ProfileReview, right: ProfileReview) =>
      new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
    const next = [...items];
    if (sort === 'highest') return next.sort((a, b) => b.rating - a.rating || recent(a, b));
    if (sort === 'lowest') return next.sort((a, b) => a.rating - b.rating || recent(a, b));
    if (sort === 'helpful') {
      return next.sort((a, b) =>
        (b.likeCount - b.dislikeCount) - (a.likeCount - a.dislikeCount) ||
        b.likeCount - a.likeCount ||
        recent(a, b)
      );
    }
    return next.sort(recent);
  }, [items, sort]);

  const updateItem = (updated: ProfileReview) => {
    setItems((current) => current.map((review) => review._id === updated._id ? updated : review));
  };

  const handleReaction = async (review: ProfileReview, selected: 'like' | 'dislike') => {
    if (reactionPending) return;
    const previous = review.viewerReaction || null;
    const nextReaction = previous === selected ? null : selected;
    const optimistic = {
      ...review,
      viewerReaction: nextReaction,
      likeCount: Math.max(0, review.likeCount - (previous === 'like' ? 1 : 0) + (nextReaction === 'like' ? 1 : 0)),
      dislikeCount: Math.max(0, review.dislikeCount - (previous === 'dislike' ? 1 : 0) + (nextReaction === 'dislike' ? 1 : 0)),
    } as ProfileReview;

    setReactionPending(review._id);
    updateItem(optimistic);
    try {
      const response = await reactToReview(review._id, nextReaction);
      updateItem(response.review);
    } catch (error: any) {
      updateItem(review);
      toast.error(error?.message || 'Failed to update reaction.');
    } finally {
      setReactionPending(null);
    }
  };

  const openReply = (review: ProfileReview) => {
    setReplyTarget(review._id);
    setReplyDraft(review.ownerReply || '');
  };

  const saveReply = async (reviewId: string) => {
    const reply = replyDraft.trim();
    if (!reply) {
      toast.error('Write a reply before saving.');
      return;
    }
    setReplyPending(true);
    try {
      const response = await replyToReview(reviewId, reply);
      updateItem(response.review);
      setReplyTarget(null);
      setReplyDraft('');
      toast.success('Reply saved.');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save reply.');
    } finally {
      setReplyPending(false);
    }
  };

  const isProfileOwner = String(user?.id || '') === String(profileOwnerId);
  const total = Number(summary.totalReviews || 0);
  const average = Number(summary.averageRating || 0);
  const percentage = Number(summary.percentage || 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6" aria-labelledby="ratings-reviews-heading">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 id="ratings-reviews-heading" className="text-xl font-bold text-slate-950">Ratings &amp; Reviews</h2>
          <p className="mt-1 text-sm text-slate-500">Verified feedback from completed jobs.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
          Sort
          <select value={sort} onChange={(event) => changeSort(event.target.value as ReviewSort)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500">
            {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-5 grid gap-5 rounded-2xl bg-slate-50 p-5 md:grid-cols-[220px_1fr]">
        <div className="flex flex-col justify-center md:border-r md:border-slate-200 md:pr-5">
          <p className="text-4xl font-bold text-slate-950">{average.toFixed(1)} <span className="text-lg font-semibold text-slate-500">/ 5</span></p>
          <div className="mt-2 flex gap-1" aria-label={`${average.toFixed(1)} out of 5 stars`}>
            {[1, 2, 3, 4, 5].map((star) => <Star key={star} className={`h-5 w-5 ${star <= Math.round(average) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />)}
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-700">{percentage}% Overall Rating</p>
          <p className="mt-1 text-sm text-slate-500">Based on {total} review{total === 1 ? '' : 's'}</p>
        </div>

        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = Number(summary.ratingBreakdown?.[star as 1 | 2 | 3 | 4 | 5] || 0);
            const width = total ? Math.round((count / total) * 100) : 0;
            return (
              <div key={star} className="grid grid-cols-[58px_1fr_78px] items-center gap-3 text-xs text-slate-600">
                <span>{star} Star{star === 1 ? '' : 's'}</span>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-amber-400" style={{ width: `${width}%` }} /></div>
                <span className="text-right">{count} review{count === 1 ? '' : 's'}</span>
              </div>
            );
          })}
        </div>
      </div>

      {sortedReviews.length ? (
        <div className="mt-6 space-y-4">
          {sortedReviews.map((review) => {
            const reviewerName = getReviewerName(review);
            const canReply = Boolean(review.canReply || isProfileOwner);
            return (
              <article key={review._id} className="rounded-2xl border border-slate-200 p-4 md:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-800">{reviewerName.charAt(0).toUpperCase()}</div>
                    <div className="min-w-0">
                      {review.reviewer?._id ? (
                        <button type="button" onClick={() => navigate(`${ROUTES.publicProfile(review.reviewer!._id!)}?viewAs=${review.reviewerRole}`)} className="truncate text-left text-sm font-bold text-slate-950 hover:text-blue-700 hover:underline">{reviewerName}</button>
                      ) : <p className="truncate text-sm font-bold text-slate-950">{reviewerName}</p>}
                      <p className="mt-0.5 text-xs text-slate-500">{formatDate(review.createdAt)}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="flex gap-0.5" aria-label={`${review.rating} out of 5 stars`}>
                      {[1, 2, 3, 4, 5].map((star) => <Star key={star} className={`h-4 w-4 ${star <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />)}
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-600">{Number(review.rating).toFixed(1)}</p>
                  </div>
                </div>

                <p className="mt-3 text-xs font-medium text-blue-700">Completed job: {review.job?.title || 'Job details unavailable'}</p>
                <p className={`mt-3 whitespace-pre-line text-sm leading-6 ${review.comment ? 'text-slate-700' : 'italic text-slate-400'}`}>{review.comment || 'Star rating only.'}</p>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <button type="button" disabled={reactionPending === review._id} onClick={() => handleReaction(review, 'like')} aria-pressed={review.viewerReaction === 'like'} className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition ${review.viewerReaction === 'like' ? 'bg-blue-100 text-blue-800' : 'text-slate-600 hover:bg-slate-100'}`}>
                    <ThumbsUp className="h-4 w-4" /> {review.likeCount}
                  </button>
                  <button type="button" disabled={reactionPending === review._id} onClick={() => handleReaction(review, 'dislike')} aria-pressed={review.viewerReaction === 'dislike'} className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition ${review.viewerReaction === 'dislike' ? 'bg-rose-100 text-rose-800' : 'text-slate-600 hover:bg-slate-100'}`}>
                    <ThumbsDown className="h-4 w-4" /> {review.dislikeCount}
                  </button>
                  {canReply ? (
                    <button type="button" onClick={() => openReply(review)} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                      <MessageSquareReply className="h-4 w-4" /> {review.ownerReply ? 'Edit reply' : 'Reply'}
                    </button>
                  ) : null}
                </div>

                {review.ownerReply ? (
                  <div className="mt-3 rounded-xl border-l-4 border-blue-500 bg-blue-50 p-4">
                    <p className="text-xs font-bold text-blue-900">{isProfileOwner ? 'My Reply' : `${profileOwnerName}'s Reply`}</p>
                    <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-700">{review.ownerReply}</p>
                    {review.ownerReplyAt ? <p className="mt-2 text-xs text-slate-500">{formatDate(review.ownerReplyAt)}</p> : null}
                  </div>
                ) : null}

                {replyTarget === review._id ? (
                  <div className="mt-3 rounded-xl bg-slate-50 p-4">
                    <label htmlFor={`reply-${review._id}`} className="text-sm font-semibold text-slate-700">Reply as profile owner</label>
                    <textarea id={`reply-${review._id}`} value={replyDraft} onChange={(event) => setReplyDraft(event.target.value.slice(0, 2000))} rows={3} maxLength={2000} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Write a professional reply…" />
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-400">{replyDraft.length}/2000</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setReplyTarget(null)} disabled={replyPending} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Cancel</button>
                        <button type="button" onClick={() => saveReply(review._id)} disabled={replyPending || !replyDraft.trim()} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{replyPending ? 'Saving…' : 'Save reply'}</button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
          {hasMore && onLoadMore ? (
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingMore}
              className="mx-auto block min-h-10 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Load more reviews'}
            </button>
          ) : null}
        </div>
      ) : <p className="mt-6 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">No verified reviews yet.</p>}
    </section>
  );
}
