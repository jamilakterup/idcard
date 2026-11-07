"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import Swal from "sweetalert2";
import { CreditCard, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth-store";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setUser } = useAuthStore();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await authService.login(data);
      if (res.success && res.data?.user) {
        setUser(res.data.user);
        toast.success("Welcome back!");
        router.push(res.data.user.role === "SUPERADMIN" ? "/admin" : "/dashboard");
      }
    } catch (e: unknown) {
      const err = e as { isSuspended?: boolean; response?: { data?: { message?: string } }; message?: string };
      if (err.isSuspended || err.response?.data?.message === "ACCOUNT_SUSPENDED" || err.message === "ACCOUNT_SUSPENDED") {
        await Swal.fire({
          icon: "error",
          title: "Account Suspended",
          text: "Your account has been suspended by the Super Admin. Please contact the website authority to resolve this issue and request account reactivation.",
          confirmButtonText: "Contact Authority",
          confirmButtonColor: "#3b82f6",
        });
      } else {
        toast.error(err.response?.data?.message || err.message || "Invalid credentials");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
      <Card className="relative z-10 w-full max-w-md border-border/50 shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <CreditCard className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
          <CardDescription>Sign in to your ID Studio account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" {...register("email")} disabled={loading} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
              </div>
              <div className="relative">
                <Input id="password" type={show ? "text" : "password"} placeholder="••••••••" {...register("password")} disabled={loading} />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShow(!show)}>
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account? <Link href="/register" className="text-primary hover:underline">Create one</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
