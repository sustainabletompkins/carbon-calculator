import { useAuth } from "../../contexts/AuthContext";
import { Button, Card, Alert } from "../ui";

/**
 * Gate for the admin section.
 *  - not signed in      → Google sign-in prompt
 *  - signed in, no claim → "not authorized" with sign-out
 *  - admin              → renders children
 *
 * This is a UX gate only. Real enforcement lives in firestore.rules and the
 * requireAdmin middleware in server.js, both of which check the same claim.
 */
export default function RequireAdmin({ children }) {
  const { user, isAdmin, loading, signIn, signOut } = useAuth();

  if (loading) {
    return (
      <div className="max-w-md mx-auto p-8 text-center text-muted">Checking access…</div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto p-8">
        <Card>
          <h1 className="text-2xl font-bold text-text mb-2">Admin sign in</h1>
          <p className="text-muted mb-6">
            Sign in with the Google account that has been granted admin access.
          </p>
          <Button onClick={() => signIn().catch((e) => console.error(e))} className="w-full">
            Sign in with Google
          </Button>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto p-8">
        <Card>
          <Alert variant="warning" title="Not authorized">
            {user.email} does not have admin access. Ask an existing admin to grant it.
          </Alert>
          <Button variant="ghost" onClick={signOut} className="w-full mt-6">
            Sign out
          </Button>
        </Card>
      </div>
    );
  }

  return children;
}
