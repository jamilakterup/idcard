"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Ban, CheckCircle, Eye } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminService } from "@/services/admin.service";
import { toast } from "sonner";
import Swal from "sweetalert2";
import { User } from "@/types";

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", page, search, statusFilter],
    queryFn: () => adminService.getUsers({ page, limit: 10, search: search || undefined, status: statusFilter || undefined }),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACTIVE" | "SUSPENDED" }) => adminService.updateStatus(id, status),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success(v.status === "SUSPENDED" ? "User suspended" : "User activated");
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      toast.error(err.response?.data?.message || err.message || "Action failed");
    },
  });

  const handleStatus = async (user: User, newStatus: "ACTIVE" | "SUSPENDED") => {
    const action = newStatus === "SUSPENDED" ? "suspend" : "activate";
    const r = await Swal.fire({
      title: `${action === "suspend" ? "Suspend" : "Activate"} user?`,
      text: `${action} ${user.name} (${user.email})?`,
      icon: action === "suspend" ? "warning" : "question",
      showCancelButton: true,
      confirmButtonColor: action === "suspend" ? "#ef4444" : "#22c55e",
      confirmButtonText: action === "suspend" ? "Suspend" : "Activate",
    });
    if (r.isConfirmed) statusMut.mutate({ id: user.id, status: newStatus });
  };

  const users = data?.data?.users || [];
  const pagination = data?.data?.pagination;

  return (
    <div>
      <Header title="User Management" />
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Users</h2>
          <p className="text-muted-foreground">Manage registered accounts</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name or email..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">{pagination ? `${pagination.total} users` : "Users"}</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
            ) : users.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground">No users found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="pb-3 font-medium">Name</th>
                      <th className="pb-3 font-medium">Email</th>
                      <th className="pb-3 font-medium">Registered</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Last Login</th>
                      <th className="pb-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b border-border/50">
                        <td className="py-3 font-medium">{user.name}</td>
                        <td className="py-3 text-muted-foreground">{user.email}</td>
                        <td className="py-3 text-muted-foreground">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</td>
                        <td className="py-3"><Badge variant={user.status === "ACTIVE" ? "success" : "warning"}>{user.status}</Badge></td>
                        <td className="py-3 text-muted-foreground">{user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : "Never"}</td>
                        <td className="py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" title="View"><Eye className="h-4 w-4" /></Button>
                            {user.status === "ACTIVE" ? (
                              <Button variant="ghost" size="icon" title="Suspend" className="text-amber-600" onClick={() => handleStatus(user, "SUSPENDED")}>
                                <Ban className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button variant="ghost" size="icon" title="Activate" className="text-emerald-600" onClick={() => handleStatus(user, "ACTIVE")}>
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.totalPages}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
