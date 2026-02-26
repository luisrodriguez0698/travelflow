'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  UserPlus,
  Search,
  Loader2,
  Shield,
  Mail,
  Trash2,
  Pencil,
  Plus,
  Users,
  UserCog,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { sendInvite } from '@/lib/actions/send-invite';
import { resendInvite } from '@/lib/actions/resend-invite';

const MAX_USERS = 5;
import { ALL_MODULES, MODULE_LABELS } from '@/lib/permissions';
import type { ModulePermission } from '@/lib/permissions';

interface User {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  roleId: string | null;
  createdAt: string;
  roleRef: { id: string; name: string } | null;
}

interface Role {
  id: string;
  name: string;
  permissions: string[];
  isDefault: boolean;
  _count: { users: number; invitations: number };
}

interface Invitation {
  id: string;
  email: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  role: { name: string };
}

type TabType = 'users' | 'roles' | 'invitations';

export default function UsersPage() {
  const { data: session } = useSession();
  const currentUserId = (session?.user as any)?.id;

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('users');

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Roles state
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  // Invitations state
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(true);

  // Modals
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditRoleModalOpen, setIsEditRoleModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isDeleteRoleDialogOpen, setIsDeleteRoleDialogOpen] = useState(false);

  // Form data
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editRoleId, setEditRoleId] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleFormData, setRoleFormData] = useState({ name: '', permissions: [] as string[] });
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<Role | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '15',
        search,
      });
      const res = await fetch(`/api/users?${params}`);
      const data = await res.json();
      if (res.ok) {
        setUsers(data.data);
        setTotalPages(data.pagination.totalPages);
        setTotal(data.pagination.total);
        setTotalCount(data.pagination.totalCount ?? data.pagination.total);
      }
    } catch {
      toast.error('Error al cargar usuarios');
    } finally {
      setUsersLoading(false);
    }
  }, [currentPage, search]);

  // Fetch roles
  const fetchRoles = useCallback(async () => {
    setRolesLoading(true);
    try {
      const res = await fetch('/api/roles');
      const data = await res.json();
      if (res.ok) {
        setRoles(data.data);
      }
    } catch {
      toast.error('Error al cargar roles');
    } finally {
      setRolesLoading(false);
    }
  }, []);

  // Fetch invitations
  const fetchInvitations = useCallback(async () => {
    setInvitationsLoading(true);
    try {
      const res = await fetch('/api/invitations');
      const data = await res.json();
      if (res.ok) {
        setInvitations(data.data);
      }
    } catch {
      toast.error('Error al cargar invitaciones');
    } finally {
      setInvitationsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  useEffect(() => {
    if (activeTab === 'invitations') {
      fetchInvitations();
    }
  }, [activeTab, fetchInvitations]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Send invite
  const handleSendInvite = async () => {
    if (!inviteEmail || !inviteRoleId) {
      toast.error('Email y rol son requeridos');
      return;
    }
    setIsSubmitting(true);
    try {
      await sendInvite(inviteEmail, inviteRoleId);
      toast.success('Invitación enviada correctamente');
      setIsInviteModalOpen(false);
      setInviteEmail('');
      setInviteRoleId('');
      fetchInvitations();
    } catch (err: any) {
      toast.error(err.message || 'Error al enviar invitación');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend invitation
  const handleResendInvite = async (invitationId: string) => {
    setResendingId(invitationId);
    try {
      await resendInvite(invitationId);
      toast.success('Invitación reenviada correctamente');
      fetchInvitations();
    } catch (err: any) {
      toast.error(err.message || 'Error al reenviar invitación');
    } finally {
      setResendingId(null);
    }
  };

  // Update user role
  const handleUpdateRole = async () => {
    if (!selectedUser || !editRoleId) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId: editRoleId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Rol actualizado');
      setIsEditRoleModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || 'Error al actualizar rol');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete user
  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/users?id=${selectedUser.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Usuario eliminado');
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar usuario');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create/Edit role
  const handleSaveRole = async () => {
    if (!roleFormData.name || roleFormData.permissions.length === 0) {
      toast.error('Nombre y al menos un permiso requeridos');
      return;
    }
    setIsSubmitting(true);
    try {
      const url = selectedRole ? `/api/roles/${selectedRole.id}` : '/api/roles';
      const method = selectedRole ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roleFormData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(selectedRole ? 'Rol actualizado' : 'Rol creado');
      setIsRoleModalOpen(false);
      setSelectedRole(null);
      setRoleFormData({ name: '', permissions: [] });
      fetchRoles();
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar rol');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete role
  const handleDeleteRole = async () => {
    if (!deleteRoleTarget) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/roles/${deleteRoleTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Rol eliminado');
      setIsDeleteRoleDialogOpen(false);
      setDeleteRoleTarget(null);
      fetchRoles();
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar rol');
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePermission = (perm: string) => {
    setRoleFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

  const tabClasses = (tab: TabType) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      activeTab === tab
        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
    }`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Usuarios</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gestiona los usuarios, roles y permisos de tu agencia
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            onClick={() => setIsInviteModalOpen(true)}
            disabled={totalCount >= MAX_USERS}
            className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Invitar Usuario
          </Button>
          <span className={`text-xs font-medium ${totalCount >= MAX_USERS ? 'text-red-500' : 'text-muted-foreground'}`}>
            {totalCount}/{MAX_USERS} usuarios
            {totalCount >= MAX_USERS && ' · Límite alcanzado'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-4">
          <button onClick={() => setActiveTab('users')} className={tabClasses('users')}>
            <Users className="w-4 h-4 inline mr-1.5" />
            Usuarios ({total})
          </button>
          <button onClick={() => setActiveTab('roles')} className={tabClasses('roles')}>
            <Shield className="w-4 h-4 inline mr-1.5" />
            Roles ({roles.length})
          </button>
          <button onClick={() => setActiveTab('invitations')} className={tabClasses('invitations')}>
            <Mail className="w-4 h-4 inline mr-1.5" />
            Invitaciones
          </button>
        </nav>
      </div>

      {/* Tab: Users */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="hidden md:table-cell">Rol</TableHead>
                  <TableHead className="hidden md:table-cell">Registro</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      No se encontraron usuarios
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.name || 'Sin nombre'}
                        {user.id === currentUserId && (
                          <Badge variant="outline" className="ml-2 text-xs">Tú</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-600 dark:text-gray-400">
                        {user.email}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                          {user.roleRef?.name || user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-gray-500">
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        {user.id !== currentUserId && (
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedUser(user);
                                setEditRoleId(user.roleId || '');
                                setIsEditRoleModalOpen(true);
                              }}
                              title="Editar rol"
                            >
                              <UserCog className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedUser(user);
                                setIsDeleteDialogOpen(true);
                              }}
                              className="text-red-500 hover:text-red-700"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Mostrando {(currentPage - 1) * 15 + 1} a {Math.min(currentPage * 15, total)} de {total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Roles */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setSelectedRole(null);
                setRoleFormData({ name: '', permissions: [] });
                setIsRoleModalOpen(true);
              }}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Rol
            </Button>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Permisos</TableHead>
                  <TableHead className="hidden md:table-cell">Usuarios</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rolesLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                    </TableCell>
                  </TableRow>
                ) : roles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                      No hay roles creados
                    </TableCell>
                  </TableRow>
                ) : (
                  roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">
                        {role.name}
                        {role.isDefault && (
                          <Badge variant="outline" className="ml-2 text-xs">Default</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(role.permissions as string[]).map((p) => (
                            <Badge key={p} variant="secondary" className="text-xs">
                              {MODULE_LABELS[p as ModulePermission] || p}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-gray-500">
                        {role._count.users}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedRole(role);
                              setRoleFormData({
                                name: role.name,
                                permissions: role.permissions as string[],
                              });
                              setIsRoleModalOpen(true);
                            }}
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {!role.isDefault && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setDeleteRoleTarget(role);
                                setIsDeleteRoleDialogOpen(true);
                              }}
                              className="text-red-500 hover:text-red-700"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Tab: Invitations */}
      {activeTab === 'invitations' && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden md:table-cell">Enviada</TableHead>
                <TableHead className="hidden md:table-cell">Expira</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitationsLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                  </TableCell>
                </TableRow>
              ) : invitations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    <Mail className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    No hay invitaciones enviadas
                  </TableCell>
                </TableRow>
              ) : (
                invitations.map((inv) => {
                  // expiresAt = lastSentAt + 7 days → lastSentAt = expiresAt - 7 days
                  const lastSentAt = new Date(new Date(inv.expiresAt).getTime() - 7 * 24 * 60 * 60 * 1000);
                  const hoursSinceSent = (Date.now() - lastSentAt.getTime()) / (1000 * 60 * 60);
                  const canResend = inv.status === 'PENDING' && hoursSinceSent >= 24;

                  return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{inv.role.name}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          inv.status === 'PENDING'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : inv.status === 'ACCEPTED'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }
                      >
                        {inv.status === 'PENDING' && <Clock className="w-3 h-3 mr-1 inline" />}
                        {inv.status === 'PENDING'
                          ? 'Pendiente'
                          : inv.status === 'ACCEPTED'
                            ? 'Aceptada'
                            : 'Expirada'}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-gray-500">
                      {formatDate(inv.createdAt)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-gray-500">
                      {formatDate(inv.expiresAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {canResend && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                          disabled={resendingId === inv.id}
                          onClick={() => handleResendInvite(inv.id)}
                        >
                          {resendingId === inv.id ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3 mr-1" />
                          )}
                          Reenviar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modal: Invite User */}
      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitar Usuario</DialogTitle>
            <DialogDescription>
              Envía una invitación por correo electrónico para unirse a tu agencia
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Correo electrónico *</Label>
              <Input
                type="email"
                placeholder="usuario@ejemplo.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label>Rol *</Label>
              <Select value={inviteRoleId} onValueChange={setInviteRoleId} disabled={isSubmitting}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsInviteModalOpen(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button
                onClick={handleSendInvite}
                disabled={isSubmitting}
                className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</>
                ) : (
                  <><Mail className="w-4 h-4 mr-2" />Enviar Invitación</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Edit User Role */}
      <Dialog open={isEditRoleModalOpen} onOpenChange={setIsEditRoleModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar Rol</DialogTitle>
            <DialogDescription>
              Cambia el rol de {selectedUser?.name || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nuevo Rol</Label>
              <Select value={editRoleId} onValueChange={setEditRoleId} disabled={isSubmitting}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsEditRoleModalOpen(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateRole} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Delete User */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Usuario</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de eliminar a <strong>{selectedUser?.name || selectedUser?.email}</strong>?
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal: Create/Edit Role */}
      <Dialog open={isRoleModalOpen} onOpenChange={setIsRoleModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedRole ? 'Editar Rol' : 'Nuevo Rol'}</DialogTitle>
            <DialogDescription>
              {selectedRole ? 'Modifica el nombre y permisos del rol' : 'Crea un nuevo rol con permisos específicos'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nombre del rol *</Label>
              <Input
                placeholder="Ej: Supervisor"
                value={roleFormData.name}
                onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label>Permisos *</Label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_MODULES.map((mod) => (
                  <label
                    key={mod}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      roleFormData.permissions.includes(mod)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={roleFormData.permissions.includes(mod)}
                      onChange={() => togglePermission(mod)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-medium">
                      {MODULE_LABELS[mod]}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsRoleModalOpen(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button
                onClick={handleSaveRole}
                disabled={isSubmitting}
                className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {selectedRole ? 'Actualizar' : 'Crear Rol'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Delete Role */}
      <AlertDialog open={isDeleteRoleDialogOpen} onOpenChange={setIsDeleteRoleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Rol</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de eliminar el rol <strong>{deleteRoleTarget?.name}</strong>?
              {deleteRoleTarget && deleteRoleTarget._count.users > 0 && (
                <span className="block mt-2 text-red-500">
                  Este rol tiene {deleteRoleTarget._count.users} usuario(s) asignado(s) y no puede eliminarse.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRole}
              disabled={isSubmitting || (deleteRoleTarget?._count.users ?? 0) > 0}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
