"use client";

import { LockKeyhole } from "lucide-react";

type NoPermissionProps = {
  title?: string;
  message?: string;
};

export default function NoPermission({
  title = "Sin permiso",
  message = "Tu rol no tiene acceso a esta sección.",
}: NoPermissionProps) {
  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <section className="w-full max-w-lg bg-white rounded-[32px] border border-slate-200 shadow-sm p-8 text-center">
        <div className="w-16 h-16 rounded-3xl bg-[#244C5A]/10 text-[#244C5A] flex items-center justify-center mx-auto">
          <LockKeyhole size={30} />
        </div>

        <h1 className="text-2xl font-black text-slate-900 mt-5">{title}</h1>
        <p className="text-slate-500 mt-2">{message}</p>
      </section>
    </main>
  );
}
