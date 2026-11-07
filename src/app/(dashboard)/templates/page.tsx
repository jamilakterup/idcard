"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import { Plus, CreditCard, Pencil, Trash2, Play } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { templateService } from "@/services/template.service";
import { toast } from "sonner";
import Swal from "sweetalert2";

export default function TemplatesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: () => templateService.getAll(),
  });
  const del = useMutation({
    mutationFn: (id: string) => templateService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Deleted");
    },
    onError: () => toast.error("Failed to delete"),
  });

  const handleDelete = async (id: string, name: string) => {
    const r = await Swal.fire({
      title: "Delete template?",
      text: `Delete "${name}"? This cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Delete",
    });
    if (r.isConfirmed) del.mutate(id);
  };

  const templates = data?.data?.templates || [];

  return (
    <div>
      <Header title="My Templates" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">My Templates</h2>
            <p className="text-muted-foreground">Manage your saved ID card designs</p>
          </div>
          <Button asChild>
            <Link href="/create">
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Link>
          </Button>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : templates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <CreditCard className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="mb-2 text-lg font-medium">No templates yet</p>
              <Button asChild className="mt-4">
                <Link href="/create">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Template
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {templates.map((t) => (
              <Card key={t._id} className="overflow-hidden group">
                <div className="relative aspect-[3/4] max-h-48 bg-muted flex items-center justify-center overflow-hidden">
                  {t.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.thumbnail}
                      alt={t.templateName}
                      className="h-full w-full object-contain bg-white"
                    />
                  ) : (
                    <CreditCard className="h-10 w-10 text-primary/40" />
                  )}
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base truncate">{t.templateName}</CardTitle>
                  <CardDescription>
                    {new Date(t.createdAt).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <Link href={`/create?template=${t._id}`}>
                      <Pencil className="mr-1 h-3 w-3" />
                      Edit
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <Link href={`/create?use=${t._id}`}>
                      <Play className="mr-1 h-3 w-3" />
                      Use
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => handleDelete(t._id, t.templateName)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
