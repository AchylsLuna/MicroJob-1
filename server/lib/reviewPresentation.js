const toId = (value) => String(value?._id || value || '');

export function serializeReview(review, viewerId = null) {
  const value = review?.toObject ? review.toObject() : review;
  if (!value) return null;

  const likedBy = Array.isArray(value.likedBy) ? value.likedBy.map(toId) : [];
  const dislikedBy = Array.isArray(value.dislikedBy) ? value.dislikedBy.map(toId) : [];
  const requesterId = toId(viewerId);
  const response = {
    ...value,
    criteria: value.criteria instanceof Map ? Object.fromEntries(value.criteria) : value.criteria || {},
    likeCount: likedBy.length,
    dislikeCount: dislikedBy.length,
    viewerReaction: requesterId
      ? likedBy.includes(requesterId)
        ? 'like'
        : dislikedBy.includes(requesterId)
          ? 'dislike'
          : null
      : null,
    canReply: Boolean(requesterId && requesterId === toId(value.reviewee)),
  };

  delete response.likedBy;
  delete response.dislikedBy;
  return response;
}

export function sortReviews(reviews, sort = 'recent') {
  const items = [...reviews];
  const recent = (left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0);

  if (sort === 'highest') {
    return items.sort((left, right) => Number(right.rating) - Number(left.rating) || recent(left, right));
  }
  if (sort === 'lowest') {
    return items.sort((left, right) => Number(left.rating) - Number(right.rating) || recent(left, right));
  }
  if (sort === 'helpful') {
    return items.sort((left, right) => {
      const leftScore = Number(left.likeCount || 0) - Number(left.dislikeCount || 0);
      const rightScore = Number(right.likeCount || 0) - Number(right.dislikeCount || 0);
      return rightScore - leftScore || Number(right.likeCount || 0) - Number(left.likeCount || 0) || recent(left, right);
    });
  }
  return items.sort(recent);
}
