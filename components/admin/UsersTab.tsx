import React, { useEffect, useState } from 'react';
import { Search, Ban, ShieldCheck, Shield, ShieldOff, Trash2, Camera, X } from 'lucide-react';
import { useAdminUsersPaginated, useBanUser, useSetUserRole, useRemoveUserRole, useDeleteUser, useSetUserAvatar } from '../../hooks/useAdmin';
import { useUser } from '../../context/UserContext';
import { useToast } from '../../context/ToastContext';
import type { AdminUser } from '../../services/adminApi';
import { AdminTable } from './AdminPrimitives';
import { AdminPagination } from './AdminPagination';
import { AdminImageUpload } from './AdminImageUpload';
import { useConfirm } from './ConfirmDialog';

const ROLE_FILTERS = [
  { key: '',          label: 'Tous' },
  { key: 'user',      label: 'Utilisateurs' },
  { key: 'pro',       label: 'Pros' },
  { key: 'admin',     label: 'Admins' },
  { key: 'moderator', label: 'Modérateurs' },
];

const PAGE_SIZE = 25;

export const UsersTab: React.FC = () => {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);

  // Debounce search so we don't hit the backend on every keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 whenever filters change so the user doesn't land on a
  // page beyond the new result set.
  useEffect(() => { setPage(1); }, [debouncedSearch, role]);

  const { data, isLoading, isFetching } = useAdminUsersPaginated({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    role: role || undefined,
  });

  const users = Array.isArray(data?.users) ? data!.users : [];
  const total = data?.total ?? 0;
  const totalPages = data?.total_pages ?? 1;

  const banUser = useBanUser();
  const setUserRole = useSetUserRole();
  const removeUserRole = useRemoveUserRole();
  const deleteUser = useDeleteUser();
  const setUserAvatar = useSetUserAvatar();
  const { addToast } = useToast();
  const { user: currentUser } = useUser();
  const { confirm, dialog: confirmDialog } = useConfirm();

  // Profile-photo editor: which user is being edited + the draft URL
  // (uploaded via AdminImageUpload → same storage as every other image).
  const [avatarUser, setAvatarUser] = useState<AdminUser | null>(null);
  const [avatarDraft, setAvatarDraft] = useState('');

  const openAvatarEditor = (u: AdminUser) => {
    setAvatarUser(u);
    setAvatarDraft(u.avatar_url || '');
  };

  const saveAvatar = async () => {
    if (!avatarUser) return;
    try {
      await setUserAvatar.mutateAsync({ userId: avatarUser.id, avatarUrl: avatarDraft || null });
      addToast(avatarDraft ? 'Photo de profil enregistrée' : 'Photo de profil retirée', 'success');
      setAvatarUser(null);
    } catch (e: any) {
      addToast(e?.message || "Échec de l'enregistrement", 'error');
    }
  };

  const toggleBan = async (userId: string, currentlyActive: boolean) => {
    try {
      await banUser.mutateAsync({ userId, ban: currentlyActive });
      addToast(currentlyActive ? 'Utilisateur banni' : 'Utilisateur réactivé', 'success');
    } catch (e: any) {
      addToast(e?.message || 'Action impossible', 'error');
    }
  };

  const promote = async (userId: string, newRole: 'pro' | 'admin') => {
    try {
      await setUserRole.mutateAsync({ userId, role: newRole });
      addToast(`Rôle ${newRole} attribué`, 'success');
    } catch (e: any) {
      addToast(e?.message || 'Échec de la promotion', 'error');
    }
  };

  const demote = async (userId: string, role: 'pro' | 'admin' | 'moderator') => {
    const ok = await confirm({
      title: `Retirer le rôle "${role}" ?`,
      message: 'Cet utilisateur perdra immédiatement les permissions associées.',
      confirmLabel: 'Retirer',
      variant: 'warning',
    });
    if (!ok) return;
    try {
      await removeUserRole.mutateAsync({ userId, role });
      addToast(`Rôle ${role} retiré`, 'success');
    } catch (e: any) {
      addToast(e?.message || 'Échec du retrait', 'error');
    }
  };

  const handleDelete = async (userId: string, fullName: string) => {
    const ok = await confirm({
      title: `Supprimer "${fullName}" ?`,
      message:
        "Cette action est définitive. Le compte ET toutes ses annonces seront " +
        "supprimés (vues, favoris, contacts, partages, conversations). Impossible à annuler.",
      confirmLabel: 'Supprimer définitivement',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const res: any = await deleteUser.mutateAsync(userId);
      const n = res?.listings_deleted ?? 0;
      addToast(
        n > 0
          ? `Utilisateur supprimé (${n} annonce${n > 1 ? 's' : ''} retirée${n > 1 ? 's' : ''}).`
          : 'Utilisateur supprimé.',
        'success'
      );
    } catch (e: any) {
      addToast(e?.data?.error || e?.message || 'Suppression impossible', 'error');
    }
  };
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <h2 className="hidden md:block text-2xl font-black text-gray-900">Utilisateurs</h2>
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom, email, téléphone, ville, rôle…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:border-primary-600"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {ROLE_FILTERS.map((r) => (
          <button
            key={r.key || 'all'}
            onClick={() => setRole(r.key)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              role === r.key
                ? 'bg-primary-600 text-white'
                : 'bg-card border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <AdminTable
        columns={['Utilisateur', 'Contact', 'Rôles', 'Statut', 'Actions']}
        loading={isLoading}
        rowCount={users.length}
        empty="Aucun utilisateur trouvé."
      >
        {users.map((u) => (
          <tr key={u.id} className="hover:bg-gray-50 transition-colors">
            <td className="p-4">
              <div className="flex items-center gap-3">
                {u.avatar_url ? (
                  <img
                    src={u.avatar_url}
                    alt={u.full_name}
                    className="w-10 h-10 rounded-full object-cover border border-gray-200 shrink-0"
                  />
                ) : (
                  <span className="w-10 h-10 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center text-sm font-black shrink-0">
                    {(u.full_name || u.email || '?').trim().charAt(0).toUpperCase()}
                  </span>
                )}
                <div>
                  <p className="font-bold text-gray-900">{u.full_name}</p>
                  <p className="text-xs text-gray-500">Inscrit le {new Date(u.created_at).toLocaleDateString('fr-FR')}</p>
                </div>
              </div>
            </td>
            <td className="p-4 text-sm">
              <p className="text-gray-900">{u.email}</p>
              <p className="text-xs text-gray-500">{u.phone || '—'}</p>
            </td>
            <td className="p-4">
              <div className="flex flex-wrap gap-1">
                {(Array.isArray(u.roles) && u.roles.length ? u.roles : ['user']).map((r) => (
                  <span key={r} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-bold">
                    {r}
                  </span>
                ))}
              </div>
            </td>
            <td className="p-4">
              {u.is_active ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 text-green-600 text-xs font-bold">Actif</span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-xs font-bold">Banni</span>
              )}
            </td>
            <td className="p-4">
              <div className="flex items-center justify-end gap-2 flex-wrap">
                <button
                  onClick={() => openAvatarEditor(u)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-bold"
                  title="Ajouter ou modifier la photo de profil"
                >
                  <Camera size={14} /> Photo
                </button>
                {!u.roles?.includes('pro') ? (
                  <button
                    onClick={() => promote(u.id, 'pro')}
                    disabled={setUserRole.isPending}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold disabled:opacity-60"
                  >
                    <Shield size={14} /> Pro
                  </button>
                ) : (
                  <button
                    onClick={() => demote(u.id, 'pro')}
                    disabled={removeUserRole.isPending}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-purple-300 text-purple-700 hover:bg-purple-50 text-xs font-bold disabled:opacity-60"
                    title="Retirer le rôle Pro"
                  >
                    <ShieldOff size={14} /> Pro
                  </button>
                )}
                {!u.roles?.includes('admin') ? (
                  <button
                    onClick={() => promote(u.id, 'admin')}
                    disabled={setUserRole.isPending}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-60"
                  >
                    <ShieldCheck size={14} /> Admin
                  </button>
                ) : (
                  // Self-demotion is blocked server-side; hide the button so
                  // admins don't try to lock themselves out.
                  String(u.id) !== String(currentUser?.id) && (
                    <button
                      onClick={() => demote(u.id, 'admin')}
                      disabled={removeUserRole.isPending}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 text-xs font-bold disabled:opacity-60"
                      title="Retirer le rôle Admin"
                    >
                      <ShieldOff size={14} /> Admin
                    </button>
                  )
                )}
                <button
                  onClick={() => toggleBan(u.id, u.is_active)}
                  disabled={banUser.isPending || String(u.id) === String(currentUser?.id)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-white text-xs font-bold disabled:opacity-60 ${
                    u.is_active ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-800'
                  }`}
                >
                  <Ban size={14} /> {u.is_active ? 'Bannir' : 'Réactiver'}
                </button>
                {String(u.id) !== String(currentUser?.id) && (
                  <button
                    onClick={() => handleDelete(u.id, u.full_name)}
                    disabled={deleteUser.isPending}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 text-xs font-bold disabled:opacity-60"
                    title="Supprimer définitivement (compte + annonces)"
                  >
                    <Trash2 size={14} /> Supprimer
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminPagination
        currentPage={page}
        totalPages={totalPages}
        total={total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        isFetching={isFetching && !isLoading}
      />
      {avatarUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAvatarUser(null)}>
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-gray-900">Photo de profil</h3>
              <button
                onClick={() => setAvatarUser(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-600">
              <span className="font-bold">{avatarUser.full_name}</span> — {avatarUser.email}
            </p>
            <AdminImageUpload
              value={avatarDraft}
              onChange={setAvatarDraft}
              label="Photo de profil du client"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setAvatarUser(null)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 text-sm font-bold hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={saveAvatar}
                disabled={setUserAvatar.isPending}
                className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold disabled:opacity-60"
              >
                {setUserAvatar.isPending ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
};

export default UsersTab;
