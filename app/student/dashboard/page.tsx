import LogoutButton from "@/components/auth/LogoutButton";

export default function StudentDashboardPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">
              Student Dashboard
            </h1>

            <p className="mt-3 text-zinc-600">
              You are signed in as a Student.
            </p>
          </div>

          <LogoutButton />
        </div>
      </div>
    </main>
  );
}