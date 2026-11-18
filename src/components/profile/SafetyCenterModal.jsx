import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Flag,
  ShieldCheck,
  Unlock,
  UserX,
} from 'lucide-react';
import {
  blockUser,
  getUserById,
  subscribeUserReports,
  unblockUser,
} from '../../services/userService';
import { getPrimaryPhoto, toMillis } from '../../utils/formatters';
import LuxuryModalHeader from '../layout/LuxuryModalHeader';

function formatReportDate(ts) {
  const ms = toMillis(ts);
  if (!ms) return 'Reciente';
  try {
    return new Intl.DateTimeFormat('es', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ms));
  } catch {
    return 'Reciente';
  }
}

function getStatusBadge(status) {
  if (status === 'resolved' || status === 'reviewed') {
    return {
      label: 'Revisado',
      classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      Icon: CheckCircle2,
    };
  }
  if (status === 'dismissed') {
    return {
      label: 'Cerrado',
      classes: 'bg-zinc-100 text-zinc-600 border-zinc-200',
      Icon: CheckCircle2,
    };
  }
  return {
    label: 'En revisión',
    classes: 'bg-amber-50 text-amber-800 border-amber-200',
    Icon: Clock,
  };
}

export default function SafetyCenterModal({
  isOpen,
  onClose,
  userProfile,
  initialTab = 'blocked',
  onSelectProfile,
  onSuccess,
  onError,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [blockedProfiles, setBlockedProfiles] = useState({});
  const [reports, setReports] = useState([]);
  const [reportUserMap, setReportUserMap] = useState({});
  const [reportsError, setReportsError] = useState('');
  const [busyUid, setBusyUid] = useState('');
  const fetchedReportUsersRef = useRef(new Set());

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Reiniciar estado local si cambia de perfil
  useEffect(() => {
    setBlockedProfiles({});
    setReports([]);
    setReportUserMap({});
    setReportsError('');
    fetchedReportUsersRef.current = new Set();
  }, [userProfile?.uid]);

  const blockedIds = useMemo(
    () => Array.from(new Set(userProfile?.blockedUsers || [])).filter(Boolean),
    [userProfile?.blockedUsers]
  );

  // Cargar datos reales de cada usuario bloqueado por este perfil
  useEffect(() => {
    if (!isOpen || !userProfile?.uid) return;
    if (blockedIds.length === 0) {
      setBlockedProfiles({});
      return;
    }

    let cancelled = false;
    Promise.all(
      blockedIds.map(async (uid) => {
        try {
          const profile = await getUserById(uid);
          return [uid, profile];
        } catch {
          return [uid, null];
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      const map = {};
      entries.forEach(([uid, profile]) => {
        map[uid] = profile;
      });
      setBlockedProfiles(map);
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, userProfile?.uid, blockedIds]);

  // Suscripción en tiempo real a los reportes creados ÚNICAMENTE por este perfil
  useEffect(() => {
    if (!isOpen || !userProfile?.uid) return;
    setReportsError('');
    const unsub = subscribeUserReports(
      userProfile.uid,
      (list) => {
        setReportsError('');
        setReports(list);
      },
      (err) => {
        if (err?.code === 'permission-denied') {
          setReportsError(
            'Tu historial de reportes requiere actualizar las reglas de Firestore (firestore.rules) para lectura por reporterId.'
          );
        } else {
          setReportsError(err?.message || 'No se pudieron cargar tus reportes.');
        }
      }
    );
    return () => unsub();
  }, [isOpen, userProfile?.uid]);

  // Completar nombre y foto de reportes antiguos si no tenían snapshot
  useEffect(() => {
    if (!isOpen || reports.length === 0) return;
    const missingIds = Array.from(
      new Set(
        reports
          .filter((r) => r.reportedUserId && !r.reportedUserName && !fetchedReportUsersRef.current.has(r.reportedUserId))
          .map((r) => r.reportedUserId)
      )
    );
    if (missingIds.length === 0) return;
    missingIds.forEach((id) => fetchedReportUsersRef.current.add(id));

    let cancelled = false;
    Promise.all(
      missingIds.map(async (uid) => {
        try {
          const u = await getUserById(uid);
          return [uid, u];
        } catch {
          return [uid, null];
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      setReportUserMap((prev) => {
        const next = { ...prev };
        entries.forEach(([uid, u]) => {
          if (u) next[uid] = u;
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, reports]);

  if (!isOpen || !userProfile?.uid) return null;

  const blockedSet = new Set(blockedIds);

  const handleUnblock = async (targetUid, displayName) => {
    if (!targetUid || busyUid) return;
    setBusyUid(targetUid);
    try {
      await unblockUser(userProfile.uid, targetUid);
      onSuccess?.(
        displayName
          ? `Desbloqueaste a ${displayName}.`
          : 'Usuario desbloqueado correctamente.'
      );
    } catch (err) {
      onError?.(err.message || 'No se pudo desbloquear este perfil.');
    } finally {
      setBusyUid('');
    }
  };

  const handleBlockFromReport = async (targetUid, displayName) => {
    if (!targetUid || busyUid) return;
    setBusyUid(targetUid);
    try {
      await blockUser(userProfile.uid, targetUid);
      onSuccess?.(
        displayName ? `Bloqueaste a ${displayName}.` : 'Perfil bloqueado correctamente.'
      );
    } catch (err) {
      onError?.(err.message || 'No se pudo bloquear este perfil.');
    } finally {
      setBusyUid('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md max-h-[92dvh] bg-[#FAF7F9] rounded-t-[32px] sm:rounded-[32px] flex flex-col overflow-hidden shadow-2xl animate-sheet-up">
        <LuxuryModalHeader
          icon={ShieldCheck}
          iconClassName="bg-gradient-to-br from-[#FF2E54] to-rose-500 text-white shadow-lg shadow-[#FF2E54]/25"
          eyebrow="Centro de Seguridad"
          title="Bloqueados y Reportes"
          subtitle={`Historial privado de ${userProfile.name}`}
          onClose={onClose}
          closeLabel="Cerrar"
        />

        {/* Pestañas */}
        <div className="px-4 pt-3 bg-[#FAF7F9]">
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-zinc-200/75 border border-zinc-200">
            <button
              type="button"
              onClick={() => setActiveTab('blocked')}
              className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                activeTab === 'blocked'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Ban className="w-3.5 h-3.5 text-[#FF2E54]" />
              Bloqueados ({blockedIds.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reports')}
              className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                activeTab === 'reports'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Flag className="w-3.5 h-3.5 text-amber-600" />
              Mis Reportes ({reports.length})
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3 bg-[#FAF7F9]">
          <div className="p-3 rounded-2xl bg-white border border-zinc-200/80 text-[11px] font-medium text-zinc-600 leading-relaxed flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Cada usuario es independiente: esta lista muestra únicamente las personas que{' '}
              <strong className="text-zinc-900">tú</strong> bloqueaste o reportaste desde tu cuenta.
            </span>
          </div>

          {activeTab === 'blocked' ? (
            blockedIds.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center shadow-card space-y-2.5">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-zinc-100 text-zinc-500 flex items-center justify-center">
                  <UserX className="w-6 h-6" />
                </div>
                <p className="text-sm font-extrabold text-zinc-900">No tienes perfiles bloqueados</p>
                <p className="text-xs text-zinc-500 max-w-[240px] mx-auto leading-relaxed">
                  Si bloqueas a alguien desde un perfil o dentro de un chat, aparecerá aquí y dejará de ver tus chats o salir en tu mazo.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {blockedIds.map((uid) => {
                  const profile = blockedProfiles[uid];
                  const displayName = profile?.name || 'Perfil no disponible';
                  return (
                    <div
                      key={uid}
                      className="p-3.5 rounded-2xl bg-white border border-zinc-200/80 shadow-card flex items-center justify-between gap-3"
                    >
                      <div
                        onClick={() => profile && onSelectProfile?.(profile)}
                        className={`flex items-center gap-3 min-w-0 flex-1 ${
                          profile && onSelectProfile ? 'cursor-pointer' : ''
                        }`}
                      >
                        <img
                          src={getPrimaryPhoto(profile || { name: '?' }, 160)}
                          alt={displayName}
                          className="w-12 h-12 rounded-2xl object-cover bg-zinc-100 border border-zinc-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-zinc-900 truncate">
                            {displayName}
                            {profile?.age ? `, ${profile.age}` : ''}
                          </p>
                          <p className="text-[11px] font-medium text-zinc-500 truncate">
                            {profile
                              ? `${profile.country?.flag || '🌎'} ${profile.city || profile.country?.name || 'Global'}`
                              : `ID: ${uid.slice(0, 8)}...`}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={busyUid === uid}
                        onClick={() => handleUnblock(uid, profile?.name)}
                        className="shrink-0 px-3.5 py-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-extrabold flex items-center gap-1.5 disabled:opacity-50 active:scale-95 transition"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        {busyUid === uid ? '...' : 'Desbloquear'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          ) : reportsError ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-1.5">
              <p className="font-extrabold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                Permiso pendiente en Firestore
              </p>
              <p className="leading-relaxed text-amber-800">{reportsError}</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center shadow-card space-y-2.5">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Flag className="w-6 h-6" />
              </div>
              <p className="text-sm font-extrabold text-zinc-900">No has enviado reportes</p>
              <p className="text-xs text-zinc-500 max-w-[240px] mx-auto leading-relaxed">
                Cuando reportes a un usuario por comportamiento inapropiado o perfil falso, podrás ver aquí el seguimiento de cada reporte.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {reports.map((rep) => {
                const fetchedPeer = reportUserMap[rep.reportedUserId] || blockedProfiles[rep.reportedUserId];
                const reportedName = rep.reportedUserName || fetchedPeer?.name || 'Usuario reportado';
                const reportedPhoto =
                  rep.reportedUserPhoto || getPrimaryPhoto(fetchedPeer || { name: reportedName }, 160);
                const badge = getStatusBadge(rep.status);
                const StatusIcon = badge.Icon;
                const isBlocked = blockedSet.has(rep.reportedUserId);

                return (
                  <div
                    key={rep.id}
                    className="p-3.5 rounded-2xl bg-white border border-zinc-200/80 shadow-card space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={reportedPhoto}
                          alt={reportedName}
                          className="w-11 h-11 rounded-2xl object-cover bg-zinc-100 border border-zinc-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-zinc-900 truncate">
                            {reportedName}
                          </p>
                          <p className="text-[11px] font-medium text-zinc-400">
                            {formatReportDate(rep.createdAt)}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`shrink-0 px-2.5 py-1 rounded-full border text-[10px] font-extrabold inline-flex items-center gap-1 ${badge.classes}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {badge.label}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/70 space-y-1">
                      <p className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                        <Flag className="w-3.5 h-3.5 text-[#FF2E54] shrink-0" />
                        <span>{rep.reason}</span>
                      </p>
                      {rep.details && (
                        <p className="text-[11px] text-zinc-600 leading-relaxed pl-5">
                          “{rep.details}”
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <span
                        className={`text-[11px] font-bold flex items-center gap-1 ${
                          isBlocked ? 'text-rose-600' : 'text-zinc-500'
                        }`}
                      >
                        {isBlocked ? (
                          <>
                            <Ban className="w-3 h-3" /> Bloqueado actualmente
                          </>
                        ) : (
                          'No está en tu lista de bloqueo'
                        )}
                      </span>

                      {rep.reportedUserId && (
                        isBlocked ? (
                          <button
                            type="button"
                            disabled={busyUid === rep.reportedUserId}
                            onClick={() => handleUnblock(rep.reportedUserId, reportedName)}
                            className="px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[11px] font-extrabold transition"
                          >
                            Desbloquear
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busyUid === rep.reportedUserId}
                            onClick={() => handleBlockFromReport(rep.reportedUserId, reportedName)}
                            className="px-3 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 text-[#FF2E54] text-[11px] font-extrabold transition"
                          >
                            Bloquear
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
