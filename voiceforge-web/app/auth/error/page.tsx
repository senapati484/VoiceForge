import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  let errorMessage = "An error occurred during authentication.";

  switch (error) {
    case "Configuration":
      errorMessage = "There is a problem with the server configuration.";
      break;
    case "AccessDenied":
      errorMessage = "Access denied. You do not have permission to sign in.";
      break;
    case "Verification":
      errorMessage = "The verification token has expired or is invalid.";
      break;
    case "OAuthSignin":
      errorMessage = "Error signing in with OAuth provider.";
      break;
    case "OAuthCallback":
      errorMessage = "Error during OAuth callback.";
      break;
    case "OAuthCreateAccount":
      errorMessage = "Could not create OAuth account.";
      break;
    case "EmailCreateAccount":
      errorMessage = "Could not create email account.";
      break;
    case "Callback":
      errorMessage = "Error during callback.";
      break;
    case "OAuthAccountNotLinked":
      errorMessage = "This account is not linked to your profile.";
      break;
    case "EmailSignin":
      errorMessage = "Error sending email sign-in link.";
      break;
    case "CredentialsSignin":
      errorMessage = "Invalid credentials. Please check your email and code.";
      break;
    case "SessionRequired":
      errorMessage = "You must be signed in to access this page.";
      break;
    default:
      if (error) {
        errorMessage = `Error: ${error}`;
      }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-md border-slate-200 bg-white shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold tracking-tight">Authentication Error</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-center">
          <p className="text-slate-600">{errorMessage}</p>
          <Button asChild className="w-full">
            <Link href="/login">Back to Login</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
