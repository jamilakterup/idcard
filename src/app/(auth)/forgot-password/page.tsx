"use client";
import Link from "next/link";
import { CreditCard, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
      <Card className="relative z-10 w-full max-w-md border-border/50 shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <CreditCard className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">Reset password</CardTitle>
          <CardDescription>Password reset email flow coming soon</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" disabled />
            </div>
            <Button type="submit" className="w-full" disabled>Send Reset Link</Button>
          </form>
          <p className="mt-6 text-center text-sm">
            <Link href="/login" className="inline-flex items-center gap-1 text-primary hover:underline">
              <ArrowLeft className="h-3 w-3" /> Back to login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
