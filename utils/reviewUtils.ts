export function publishedReviewAverage(reviews: Array<{ rating: number }>): number | null {
  const ratings = reviews.map(review => Number(review.rating)).filter(rating => Number.isFinite(rating) && rating >= 1 && rating <= 5);
  return ratings.length ? Math.round(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length * 10) / 10 : null;
}

/** Only explicitly verified, visible third-party feedback may enter review markup. */
export function verifiedReviewMarkup(rows: Array<{ rating?: unknown; is_verified?: boolean; author_name?: string; content?: string; created_at?: string }>) {
  const reviews = rows.filter(row => row.is_verified === true && row.author_name?.trim() && row.content?.trim() && Number(row.rating) >= 1 && Number(row.rating) <= 5);
  if (!reviews.length) return {};
  return {
    review: reviews.map(row => ({ '@type': 'Review', author: { '@type': 'Person', name: row.author_name }, reviewBody: row.content, datePublished: row.created_at, reviewRating: { '@type': 'Rating', ratingValue: Number(row.rating), bestRating: 5, worstRating: 1 } })),
    aggregateRating: { '@type': 'AggregateRating', ratingValue: publishedReviewAverage(reviews.map(row => ({ rating: Number(row.rating) }))), reviewCount: reviews.length, bestRating: 5, worstRating: 1 },
  };
}