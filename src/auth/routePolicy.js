/** @typedef {'admin'|'farmer'} UserRole */
/** @param {UserRole} requiredRole @param {UserRole|null} authenticatedRole @param {boolean} loading */
export function protectedRouteDecision(requiredRole, authenticatedRole, loading) {
  if (loading) return 'loading';
  if (!authenticatedRole) return '/login';
  if (authenticatedRole !== requiredRole) return authenticatedRole === 'admin' ? '/admin/dashboard' : '/farmer/dashboard';
  return 'allow';
}
