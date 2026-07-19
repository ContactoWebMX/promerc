import { Card } from "@/components/ui/card";
import { RequestResetForm } from "./request-form";

export default function ResetPasswordRequestPage() {
  return (
    <Card className="w-full max-w-sm">
      <div className="flex flex-col items-center gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">Recuperar contraseña</h1>
        <RequestResetForm />
      </div>
    </Card>
  );
}
