/**
 * Validates that redirect path starts with a single '/' and never '//' or external scheme.
 */
export function getSafeNext(user, rawNext) {
  if (user?.role === 'admin') return '/admin';
  if (user?.role === 'reception') return '/reception';
  if (
    rawNext &&
    typeof rawNext === 'string' &&
    rawNext.startsWith('/') &&
    !rawNext.startsWith('//') &&
    !rawNext.startsWith('/\\')
  ) {
    return rawNext;
  }
  return '/';
}
