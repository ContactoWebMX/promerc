import { RequestResetForm } from "./request-form";

export default function ResetPasswordRequestPage() {
  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-2xl font-semibold">Recuperar contraseña</h1>
      <RequestResetForm />
    </div>
  );
}
