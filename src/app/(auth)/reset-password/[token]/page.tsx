import { ResetForm } from "./reset-form";

export default async function ResetPasswordTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-2xl font-semibold">Nueva contraseña</h1>
      <ResetForm token={token} />
    </div>
  );
}
