import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-2xl font-semibold">PROMERC</h1>
      <LoginForm />
    </div>
  );
}
