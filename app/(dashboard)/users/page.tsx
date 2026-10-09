'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from '@/components/ui/responsive-dialog';
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
  UserX,
  UserCheck,
  Crown,
  Lock,
  EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { sendInvite, type PendingInvite } from '@/lib/actions/send-invite';
import { resendInvite } from '@/lib/actions/resend-invite';
import { useCan } from '@/hooks/use-can';
import { UserAvatar } from '@/components/user-avatar';
import { usePresence } from '@/components/realtime-provider';
import { CreatorHistoryButton } from '@/components/record-history';

const MAX_USERS = 5;
import {
  ALL_MODULES,
  MODULE_LABELS,
  MODULE_ACTIONS,
  ACTION_LABELS,
  PAYMENTS_LABEL,
  isProtectedRole,
  resolvePermissionList,
  toStoredPermissions,
} from '@/lib/permissions';
import type { ModulePermission, PermissionAction } from '@/lib/permissions';
import { RowsSkeleton } from '@/components/skeletons';

const MATRIX_ACTIONS: PermissionAction[] = ['view', 'create', 'edit', 'delete', 'payments'];

/** Resumen legible de los permisos de un rol: "Ventas · ver, abonos". */
function describePermissions(stored: string[]) {
  const effective = resolvePermissionList(stored);
  return ALL_MODULES.filter((m) => effective.includes(m)).map((m) => {
    const extra = MODULE_ACTIONS[m].filter((a) => a !== 'view' && effective.includes(`${m}:${a}`));
    const full = extra.length === MODULE_ACTIONS[m].length - 1;
    const words = extra.map((a) => (a === 'payments' ? (m === 'ventas' ? 'abonos' : 'pagos') : ACTION_LABELS[a].toLowerCase()));
    return { module: m, label: MODULE_LABELS[m], detail: full ? null : words.length ? `ver, ${words.join(', ')}` : 'solo ver' };
  });
}

interface User {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  roleId: string | null;
  isActive: boolean;
  isOwner: boolean;
  avatar?: string | null;
  createdAt: string;
  roleRef: { id: string; name: string } | null;
}

interface Role {
  id: string;
  name: string;
  permissions: string[];
  isDefault: boolean;
  ownDataOnly?: boolean;
  _count: { users: number; invitations: number };
}

interface Invitation {
  id: string;
  email: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  role: { name: string };
  /** El correo ya tiene cuenta: la invitacion no podra aceptarse */
  blockedReason?: string | null;
}

const RESEND_COOLDOWN_HOURS = 24;

type TabType = 'users' | 'roles' | 'invitations';

export default function UsersPage() {
  const can = useCan();
  const { isOnline } = usePresence();
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
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isDeleteRoleDialogOpen, setIsDeleteRoleDialogOpen] = useState(false);

  // Form data
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editUserForm, setEditUserForm] = useState({ name: '', phone: '', roleId: '' });
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleFormData, setRoleFormData] = useState({ name: '', permissions: [] as string[], ownDataOnly: false });
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<Role | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  // Invitacion pendiente detectada al invitar: se ofrece reenviarla
  const [pendingInvite, setPendingInvite] = useState<PendingInvite | null>(null);
  const [cancelInviteTarget, setCancelInviteTarget] = useState<Invitation | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

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
      const result = await sendInvite(inviteEmail, inviteRoleId);
      if (!result.success) {
        if (result.code === 'PENDING_INVITE' && result.pending) {
          // Nunca dos modales de Radix abiertos a la vez: al cerrar el de arriba
          // el <body> se queda con pointer-events:none y la pagina se "congela".
          const pending = result.pending;
          setIsInviteModalOpen(false);
          setTimeout(() => setPendingInvite(pending), 200);
          return;
        }
        throw new Error(result.error);
      }
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

  // Reenviar la invitacion pendiente detectada al invitar (con el rol elegido ahora)
  const handleResendPending = async () => {
    if (!pendingInvite) return;
    setIsSubmitting(true);
    try {
      const result = await resendInvite(pendingInvite.id, inviteRoleId || undefined);
      if (!result.success) throw new Error(result.error);
      toast.success(`Invitación reenviada a ${pendingInvite.email}`);
      setPendingInvite(null);
      setIsInviteModalOpen(false);
      setInviteEmail('');
      setInviteRoleId('');
      fetchInvitations();
    } catch (err: any) {
      toast.error(err.message || 'Error al reenviar invitación');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancelar invitacion
  const handleCancelInvite = async () => {
    if (!cancelInviteTarget) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/invitations?id=${cancelInviteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Invitación cancelada');
      setCancelInviteTarget(null);
      fetchInvitations();
    } catch (err: any) {
      toast.error(err.message || 'Error al cancelar la invitación');
    } finally {
      setIsSubmitting(false);
    }
  };

  // expiresAt = ultimo envio + 7 dias -> horas que faltan para poder reenviar
  const hoursUntilResend = (inv: Invitation) => {
    const lastSentAt = new Date(inv.expiresAt).getTime() - 7 * 24 * 60 * 60 * 1000;
    return Math.max(0, Math.ceil(RESEND_COOLDOWN_HOURS - (Date.now() - lastSentAt) / (1000 * 60 * 60)));
  };

  const renderInvitationStatus = (inv: Invitation) => {
    if (inv.status === 'PENDING' && inv.blockedReason) {
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" title={inv.blockedReason}>
          No se puede aceptar
        </Badge>
      );
    }
    const styles: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      ACCEPTED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      EXPIRED: 'bg-muted text-foreground/80',
    };
    const labels: Record<string, string> = { PENDING: 'Pendiente', ACCEPTED: 'Aceptada', EXPIRED: 'Expirada' };
    return (
      <Badge className={styles[inv.status] || styles.EXPIRED}>
        {inv.status === 'PENDING' && <Clock className="w-3 h-3 mr-1 inline" />}
        {labels[inv.status] || inv.status}
      </Badge>
    );
  };

  const renderInvitationActions = (inv: Invitation) => {
    if (inv.status === 'ACCEPTED') return null;
    const wait = hoursUntilResend(inv);
    const canResend = inv.status === 'PENDING' && !inv.blockedReason && can('usuarios', 'create');
    return (
      <div className="flex justify-end items-center gap-1">
        {canResend && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
            disabled={resendingId === inv.id || wait > 0}
            title={wait > 0 ? `Podrás reenviarla en ${wait} h` : 'Reenviar invitación'}
            onClick={() => handleResendInvite(inv.id)}
          >
            {resendingId === inv.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            {wait > 0 ? `Reenviar en ${wait} h` : 'Reenviar'}
          </Button>
        )}
        {can('usuarios', 'delete') && (<Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-red-500 hover:text-red-700"
          title="Cancelar invitación"
          onClick={() => setCancelInviteTarget(inv)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>)}
      </div>
    );
  };

  // Resend invitation
  const handleResendInvite = async (invitationId: string) => {
    setResendingId(invitationId);
    try {
      const result = await resendInvite(invitationId);
      if (!result.success) throw new Error(result.error);
      toast.success('Invitación reenviada correctamente');
      fetchInvitations();
    } catch (err: any) {
      toast.error(err.message || 'Error al reenviar invitación');
    } finally {
      setResendingId(null);
    }
  };

  // Update user (name, phone, role)
  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    if (!editUserForm.name.trim() || !editUserForm.roleId) {
      toast.error('Nombre y rol son requeridos');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editUserForm.name,
          phone: editUserForm.phone || null,
          roleId: editUserForm.roleId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Usuario actualizado');
      setIsEditUserModalOpen(false);
      fetchUsers();
      fetchRoles();
    } catch (err: any) {
      toast.error(err.message || 'Error al actualizar usuario');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Activate / deactivate user
  const handleToggleActive = async (user: User) => {
    setTogglingId(user.id);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(user.isActive ? 'Usuario desactivado' : 'Usuario activado');
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || 'Error al cambiar el estado del usuario');
    } finally {
      setTogglingId(null);
    }
  };

  // The owner and the current user can't be edited, deactivated or deleted here
  const canManageUser = (user: User) => user.id !== currentUserId && !user.isOwner;

  const openEditUser = (user: User) => {
    setSelectedUser(user);
    setEditUserForm({ name: user.name || '', phone: user.phone || '', roleId: user.roleId || '' });
    setIsEditUserModalOpen(true);
  };

  const renderUserBadges = (user: User) => (
    <>
      {user.id === currentUserId && (
        <Badge variant="outline" className="ml-2 text-xs">Tú</Badge>
      )}
      {user.isOwner && (
        <Badge className="ml-2 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
          <Crown className="w-3 h-3 mr-1" />
          Propietario
        </Badge>
      )}
      {!user.isActive && (
        <Badge className="ml-2 text-xs bg-muted text-foreground/80">
          Inactivo
        </Badge>
      )}
    </>
  );

  const renderUserActions = (user: User) => (
      <div className="flex justify-end items-center gap-1">
        <CreatorHistoryButton entity="users" entityId={user.id} title={user.name || user.email} />
        {canManageUser(user) && (<>
        {can('usuarios', 'edit') && (<Button variant="ghost" size="icon" onClick={() => openEditUser(user)} title="Editar">
          <UserCog className="w-4 h-4" />
        </Button>)}
        {can('usuarios', 'edit') && (<Button
          variant="ghost"
          size="icon"
          onClick={() => handleToggleActive(user)}
          disabled={togglingId === user.id}
          className={user.isActive ? 'text-amber-600 hover:text-amber-700' : 'text-green-600 hover:text-green-700'}
          title={user.isActive ? 'Desactivar' : 'Activar'}
        >
          {togglingId === user.id ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : user.isActive ? (
            <UserX className="w-4 h-4" />
          ) : (
            <UserCheck className="w-4 h-4" />
          )}
        </Button>)}
        {can('usuarios', 'delete') && (<Button
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
        </Button>)}
        </>)}
      </div>
    );

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
        // Se guarda en formato explicito: "ventas:view", "ventas:edit"...
        body: JSON.stringify({ ...roleFormData, permissions: toStoredPermissions(roleFormData.permissions) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(selectedRole ? 'Rol actualizado' : 'Rol creado');
      setIsRoleModalOpen(false);
      setSelectedRole(null);
      setRoleFormData({ name: '', permissions: [], ownDataOnly: false });
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

  // Marcar crear/editar/eliminar/pagos marca "ver"; quitar "ver" quita todo el apartado
  const togglePermission = (module: ModulePermission, action: PermissionAction) => {
    setRoleFormData((prev) => {
      const set = new Set(prev.permissions);
      if (action === 'view') {
        if (set.has(module)) {
          set.delete(module);
          MODULE_ACTIONS[module].forEach((a) => set.delete(`${module}:${a}`));
        } else {
          set.add(module);
        }
      } else {
        const key = `${module}:${action}`;
        if (set.has(key)) set.delete(key);
        else {
          set.add(key);
          set.add(module);
        }
      }
      return { ...prev, permissions: [...set] };
    });
  };

  // Clic en el nombre del apartado: todo / nada
  const toggleModuleAll = (module: ModulePermission) => {
    setRoleFormData((prev) => {
      const set = new Set(prev.permissions);
      const keys = [module, ...MODULE_ACTIONS[module].filter((a) => a !== 'view').map((a) => `${module}:${a}`)];
      const allOn = keys.every((k) => set.has(k));
      keys.forEach((k) => (allOn ? set.delete(k) : set.add(k)));
      return { ...prev, permissions: [...set] };
    });
  };

  const hasPerm = (module: ModulePermission, action: PermissionAction) =>
    action === 'view' ? roleFormData.permissions.includes(module) : roleFormData.permissions.includes(`${module}:${action}`);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

  const tabClasses = (tab: TabType) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      activeTab === tab
        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    }`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuarios</h1>
          <p className="text-muted-foreground">
            Gestiona los usuarios, roles y permisos de tu agencia
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {can('usuarios', 'create') && (<Button
            data-tour="page-action"
            onClick={() => setIsInviteModalOpen(true)}
            disabled={totalCount >= MAX_USERS}
            variant="gradient"
            className="disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Invitar Usuario
          </Button>)}
          <span className={`text-xs font-medium ${totalCount >= MAX_USERS ? 'text-red-500' : 'text-muted-foreground'}`}>
            {totalCount}/{MAX_USERS} usuarios
            {totalCount >= MAX_USERS && ' · Límite alcanzado'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav data-tour="page-tabs" className="flex space-x-4">
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="search"
              name="user-search"
              autoComplete="off"
              placeholder="Buscar por nombre o correo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Mobile/tablet: stacked cards (no horizontal scroll) */}
          <div className="lg:hidden bg-card rounded-lg border divide-y divide-border">
            {usersLoading ? (
              <div className="text-center py-8">
                <RowsSkeleton rows={3} />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No se encontraron usuarios</div>
            ) : (
              users.map((user) => (
                <div key={user.id} className={`p-4 space-y-2 ${!user.isActive ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar name={user.name || user.email} src={user.avatar} className="w-10 h-10 text-sm" online={isOnline(user.id)} />
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {user.name || 'Sin nombre'}
                          {renderUserBadges(user)}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 shrink-0">
                      {user.roleRef?.name || user.role}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{formatDate(user.createdAt)}</span>
                    {renderUserActions(user)}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop/tablet-landscape: full table */}
          <div className="hidden lg:block bg-card rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Registro</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <RowsSkeleton rows={3} />
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No se encontraron usuarios
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id} className={!user.isActive ? 'opacity-60' : undefined}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <UserAvatar name={user.name || user.email} src={user.avatar} className="w-9 h-9" online={isOnline(user.id)} />
                          <span>
                            {user.name || 'Sin nombre'}
                            {renderUserBadges(user)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                          {user.roleRef?.name || user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        {renderUserActions(user)}
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
              <p className="text-sm text-muted-foreground">
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
            {can('usuarios', 'create') && (<Button
              onClick={() => {
                setSelectedRole(null);
                setRoleFormData({ name: '', permissions: [], ownDataOnly: false });
                setIsRoleModalOpen(true);
              }}
              variant="gradient"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Rol
            </Button>)}
          </div>

          {/* Mobile/tablet: stacked cards (no horizontal scroll) */}
          <div className="lg:hidden bg-card rounded-lg border divide-y divide-border">
            {rolesLoading ? (
              <div className="text-center py-8">
                <RowsSkeleton rows={3} />
              </div>
            ) : roles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No hay roles creados</div>
            ) : (
              roles.map((role) => (
                <div key={role.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">
                      {role.name}
                      {role.isDefault && <Badge variant="outline" className="ml-2 text-xs">Default</Badge>}
                      {role.ownDataOnly && <Badge variant="outline" className="ml-2 text-xs">Solo lo suyo</Badge>}
                      {isProtectedRole(role) && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          <Lock className="w-3 h-3 mr-1" />
                          Protegido
                        </Badge>
                      )}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                    <CreatorHistoryButton entity="roles" entityId={role.id} title={`Rol ${role.name}`} size="sm" />
                    {!isProtectedRole(role) && (
                    <div className="flex gap-1 shrink-0">
                      {can('usuarios', 'edit') && (<Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedRole(role);
                          setRoleFormData({ name: role.name, permissions: resolvePermissionList(role.permissions), ownDataOnly: !!role.ownDataOnly });
                          setIsRoleModalOpen(true);
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>)}
                      {can('usuarios', 'delete') && (<Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDeleteRoleTarget(role);
                          setIsDeleteRoleDialogOpen(true);
                        }}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>)}
                    </div>
                    )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {describePermissions(role.permissions).map((d) => (
                      <Badge key={d.module} variant="secondary" className="text-xs font-normal">
                        <span className="font-medium">{d.label}</span>
                        {d.detail && <span className="opacity-70">&nbsp;· {d.detail}</span>}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">{role._count.users} usuario{role._count.users !== 1 ? 's' : ''}</p>
                </div>
              ))
            )}
          </div>

          {/* Desktop/tablet-landscape: full table */}
          <div className="hidden lg:block bg-card rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Permisos</TableHead>
                  <TableHead>Usuarios</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rolesLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <RowsSkeleton rows={3} />
                    </TableCell>
                  </TableRow>
                ) : roles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
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
                        {role.ownDataOnly && (
                          <Badge variant="outline" className="ml-2 text-xs">Solo lo suyo</Badge>
                        )}
                        {isProtectedRole(role) && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            <Lock className="w-3 h-3 mr-1" />
                            Protegido
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {describePermissions(role.permissions).map((d) => (
                            <Badge key={d.module} variant="secondary" className="text-xs font-normal">
                              <span className="font-medium">{d.label}</span>
                              {d.detail && <span className="opacity-70">&nbsp;· {d.detail}</span>}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {role._count.users}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-1">
                        <CreatorHistoryButton entity="roles" entityId={role.id} title={`Rol ${role.name}`} />
                        {!isProtectedRole(role) && (
                        <div className="flex justify-end gap-1">
                          {can('usuarios', 'edit') && (<Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedRole(role);
                              setRoleFormData({
                                name: role.name,
                                permissions: resolvePermissionList(role.permissions),
                                ownDataOnly: !!role.ownDataOnly,
                              });
                              setIsRoleModalOpen(true);
                            }}
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>)}
                          {can('usuarios', 'delete') && (<Button
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
                          </Button>)}
                        </div>
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
        <>
        {/* Mobile/tablet: stacked cards (no horizontal scroll) */}
        <div className="lg:hidden bg-card rounded-lg border divide-y divide-border">
          {invitationsLoading ? (
            <div className="text-center py-8">
              <RowsSkeleton rows={3} />
            </div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
              No hay invitaciones enviadas
            </div>
          ) : (
            invitations.map((inv) => (
              <div key={inv.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{inv.email}</p>
                    <Badge variant="secondary" className="mt-1">{inv.role.name}</Badge>
                  </div>
                  {renderInvitationStatus(inv)}
                </div>
                {inv.status === 'PENDING' && inv.blockedReason && (
                  <p className="text-xs text-red-600 dark:text-red-400">{inv.blockedReason}. Cancélala.</p>
                )}
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Enviada: {formatDate(inv.createdAt)}</span>
                  <span>Expira: {formatDate(inv.expiresAt)}</span>
                </div>
                {renderInvitationActions(inv)}
              </div>
            ))
          )}
        </div>

        {/* Desktop/tablet-landscape: full table */}
        <div className="hidden lg:block bg-card rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Enviada</TableHead>
                <TableHead>Expira</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitationsLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <RowsSkeleton rows={3} />
                  </TableCell>
                </TableRow>
              ) : invitations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <Mail className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                    No hay invitaciones enviadas
                  </TableCell>
                </TableRow>
              ) : (
                invitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">
                      {inv.email}
                      {inv.status === 'PENDING' && inv.blockedReason && (
                        <p className="text-xs font-normal text-red-600 dark:text-red-400 mt-0.5">{inv.blockedReason}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{inv.role.name}</Badge>
                    </TableCell>
                    <TableCell>{renderInvitationStatus(inv)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(inv.createdAt)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(inv.expiresAt)}</TableCell>
                    <TableCell className="text-right">{renderInvitationActions(inv)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        </>
      )}

      {/* Dialog: cancelar invitacion */}
      <AlertDialog open={!!cancelInviteTarget} onOpenChange={(open) => { if (!open && !isSubmitting) setCancelInviteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar invitación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Cancelar la invitación a <strong>{cancelInviteTarget?.email}</strong>? El enlace del correo dejará de
              funcionar. Podrás invitarlo de nuevo cuando quieras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleCancelInvite(); }}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Cancelar invitación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                name="invite-email"
                autoComplete="off"
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
                variant="gradient"
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

      {/* Dialog: ya existe una invitacion pendiente para ese correo */}
      <AlertDialog
        open={!!pendingInvite}
        onOpenChange={(open) => {
          if (open || isSubmitting) return;
          setPendingInvite(null);
          // Cancelar regresa al formulario (con los datos) por si quiere cambiar el correo
          setTimeout(() => setIsInviteModalOpen(true), 200);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-500" />
              Ya invitaste a este correo
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Le enviaste una invitación a <strong className="text-foreground">{pendingInvite?.email}</strong> el{' '}
                  {pendingInvite && formatDate(pendingInvite.sentAt)} y todavía no la acepta.
                </p>
                <p>¿Quieres reenviarla? Le llegará un correo nuevo y tendrá 7 días más para aceptarla.</p>
                {pendingInvite && inviteRoleId && inviteRoleId !== pendingInvite.roleId && (
                  <p className="rounded-md bg-muted px-3 py-2">
                    El rol cambiará de <strong className="text-foreground">{pendingInvite.roleName}</strong> a{' '}
                    <strong className="text-foreground">{roles.find((r) => r.id === inviteRoleId)?.name}</strong>.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleResendPending(); }}
              disabled={isSubmitting}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Reenviar invitación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal: Edit User */}
      <Dialog open={isEditUserModalOpen} onOpenChange={setIsEditUserModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>{selectedUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nombre completo *</Label>
              <Input
                value={editUserForm.name}
                onChange={(e) => setEditUserForm({ ...editUserForm, name: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                placeholder="9611234567"
                value={editUserForm.phone}
                onChange={(e) => setEditUserForm({ ...editUserForm, phone: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label>Rol *</Label>
              <Select
                value={editUserForm.roleId}
                onValueChange={(roleId) => setEditUserForm({ ...editUserForm, roleId })}
                disabled={isSubmitting}
              >
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
              <Button variant="outline" onClick={() => setIsEditUserModalOpen(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateUser} disabled={isSubmitting} variant="gradient">
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
              Perderá el acceso al sistema y ya no aparecerá en la lista, pero su historial
              (ventas, pagos, cotizaciones) se conserva con su nombre.
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
              <p className="text-xs text-muted-foreground">
                Marcar crear, editar, eliminar o pagos activa "Ver". Haz clic en el nombre del apartado para marcar o quitar todo.
              </p>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-xs text-muted-foreground">
                      <th className="text-left font-medium px-3 py-2">Apartado</th>
                      {MATRIX_ACTIONS.map((a) => (
                        <th key={a} className="font-medium px-2 py-2 text-center w-16">{ACTION_LABELS[a]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {ALL_MODULES.map((mod) => (
                      <tr key={mod} className={roleFormData.permissions.includes(mod) ? 'bg-blue-50/50 dark:bg-blue-950/20' : undefined}>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => toggleModuleAll(mod)}
                            disabled={isSubmitting}
                            className="font-medium text-left hover:text-blue-600 dark:hover:text-blue-400"
                            title="Marcar / quitar todo"
                          >
                            {MODULE_LABELS[mod]}
                          </button>
                        </td>
                        {MATRIX_ACTIONS.map((action) => (
                          <td key={action} className="px-2 py-2 text-center">
                            {MODULE_ACTIONS[mod].includes(action) ? (
                              <input
                                type="checkbox"
                                checked={hasPerm(mod, action)}
                                onChange={() => togglePermission(mod, action)}
                                disabled={isSubmitting}
                                className="h-4 w-4 rounded border-border accent-blue-600 cursor-pointer"
                                aria-label={`${MODULE_LABELS[mod]}: ${action === 'payments' ? PAYMENTS_LABEL[mod] : ACTION_LABELS[action]}`}
                                title={action === 'payments' ? PAYMENTS_LABEL[mod] : undefined}
                              />
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                <b>Pagos:</b> en Ventas es registrar abonos de clientes; en Proveedores, registrar pagos a proveedores.
              </p>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-lg border p-3 bg-muted/30">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <EyeOff className="w-4 h-4 text-blue-500" />
                  Solo ve sus propios registros
                </Label>
                <p className="text-xs text-muted-foreground">
                  Sus usuarios solo verán las ventas y cotizaciones que ellos crearon, y los clientes que dieron de alta o a
                  los que les vendieron. Los catálogos (hoteles, destinos, etc.) se ven completos.
                </p>
              </div>
              <Switch
                checked={roleFormData.ownDataOnly}
                onCheckedChange={(v) => setRoleFormData((p) => ({ ...p, ownDataOnly: v }))}
                disabled={isSubmitting}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsRoleModalOpen(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button
                onClick={handleSaveRole}
                disabled={isSubmitting}
                variant="gradient"
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
