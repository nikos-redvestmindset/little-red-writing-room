import Image from "next/image";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <Image
          src="/login-image.png"
          alt="Little Red Writing Room"
          fill
          className="object-cover"
          priority
        />
      </div>

      <div className="flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-12 text-center lg:hidden">
            <h2 className="text-2xl font-light italic tracking-tight text-primary">
              Little Red Writing Room
            </h2>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
