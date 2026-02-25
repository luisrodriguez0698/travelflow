import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: {
    signIn: '/login',
  },
});

export const config = {
  matcher: [
    '/((?!login|register|forgot-password|reset-password|auth|api/auth|api/signup|_next/static|_next/image|favicon\\.ico|public).*)',
  ],
};
