function sortValueForSignature(value) {
  if (Array.isArray(value)) {
    return value.map(sortValueForSignature);
  }
  if (value && typeof value === 'object') {
    const sorted = {};
    Object.keys(value)
      .sort()
      .forEach((key) => {
        if (value[key] !== undefined) {
          sorted[key] = sortValueForSignature(value[key]);
        }
      });
    return sorted;
  }
  return value;
}

/**
 * Genera una firma determinística JSON para comparar estados locales vs remotos
 * sin falsos positivos por orden de propiedades y evitar bucles de eco.
 */
export function createSectionSignature(value) {
  try {
    return JSON.stringify(sortValueForSignature(value));
  } catch {
    return String(Date.now());
  }
}

/**
 * Cola serializada de auto-guardado con soporte para:
 * - Debounce configurable para escritura continua en inputs.
 * - Modo inmediato (`immediate: true`) coalescido en microtask para cambios discretos simultáneos.
 * - Serialización en vuelo: si cambia algo mientras se guarda A, encola B para no perder el último cambio.
 * - `flush()` síncrono/awaitable al hacer blur, cambiar pestaña o cerrar modal.
 */
export function createDebouncedAutoSaver({ delayMs = 650, onSave, onError } = {}) {
  let timerId = null;
  let microtaskQueued = false;
  let hasPendingValue = false;
  let pendingValue = undefined;

  let inFlight = false;
  let hasQueuedValue = false;
  let queuedValue = undefined;
  let activeDrainPromise = null;

  const startDrain = () => {
    if (activeDrainPromise) return activeDrainPromise;
    inFlight = true;
    activeDrainPromise = (async () => {
      try {
        while (hasQueuedValue) {
          const nextToSave = queuedValue;
          queuedValue = undefined;
          hasQueuedValue = false;
          try {
            if (typeof onSave === 'function') {
              await onSave(nextToSave);
            }
          } catch (err) {
            if (typeof onError === 'function') {
              onError(err);
            }
          }
        }
      } finally {
        inFlight = false;
        activeDrainPromise = null;
      }
    })();
    return activeDrainPromise;
  };

  const runPending = () => {
    microtaskQueued = false;
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    if (!hasPendingValue) {
      return activeDrainPromise || Promise.resolve();
    }
    const nextValue = pendingValue;
    pendingValue = undefined;
    hasPendingValue = false;

    queuedValue = nextValue;
    hasQueuedValue = true;
    return startDrain();
  };

  return {
    schedule(value, { immediate = false } = {}) {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      pendingValue = value;
      hasPendingValue = true;

      if (immediate) {
        if (!microtaskQueued) {
          microtaskQueued = true;
          Promise.resolve().then(() => {
            if (microtaskQueued) {
              runPending();
            }
          });
        }
        return;
      }

      timerId = setTimeout(() => {
        timerId = null;
        runPending();
      }, delayMs);
    },

    flush() {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      microtaskQueued = false;
      if (hasPendingValue) {
        return runPending();
      }
      return activeDrainPromise || Promise.resolve();
    },

    cancel() {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      microtaskQueued = false;
      hasPendingValue = false;
      pendingValue = undefined;
      hasQueuedValue = false;
      queuedValue = undefined;
    },

    isBusyOrPending() {
      return Boolean(
        timerId !== null || microtaskQueued || hasPendingValue || inFlight || hasQueuedValue
      );
    },
  };
}

function isMissingNumberInput(raw) {
  return raw === '' || raw === null || raw === undefined;
}

function deriveUnlockModeLocal(enableDiamonds, enableAds) {
  if (!enableDiamonds && !enableAds) return 'free';
  if (!enableDiamonds && enableAds) return 'ads_only';
  if (enableDiamonds && !enableAds) return 'diamonds_only';
  return 'hybrid';
}

export function validateAccessPolicyDraft(draft) {
  if (!draft || typeof draft !== 'object') {
    return { valid: false, reason: 'Configuración de acceso inválida.' };
  }

  const normalizedInputMode = draft.unlockMode === 'coins_only' ? 'diamonds_only' : draft.unlockMode;
  const resolvedMode = ['free', 'ads_only', 'diamonds_only', 'hybrid'].includes(normalizedInputMode)
    ? normalizedInputMode
    : deriveUnlockModeLocal(Boolean(draft.enableDiamondCharges), Boolean(draft.enableRewardedAds));

  if (isMissingNumberInput(draft.adDurationSeconds)) {
    return { valid: false, reason: 'La duración del anuncio debe estar entre 5 y 60 segundos.' };
  }
  const cleanDuration = Math.floor(Number(draft.adDurationSeconds));
  if (!Number.isFinite(cleanDuration) || cleanDuration < 5 || cleanDuration > 60) {
    return { valid: false, reason: 'La duración del anuncio debe estar entre 5 y 60 segundos.' };
  }

  const cleanDirectLink = String(draft.monetagDirectLink || '').trim();
  if (cleanDirectLink && !/^https?:\/\//i.test(cleanDirectLink)) {
    return {
      valid: false,
      reason: 'El Direct Link de Monetag debe comenzar con https:// o http://',
    };
  }

  const diamondFields = [
    ['unlockChatDiamonds', 'Chat Directo'],
    ['unlockLikeDiamonds', 'Ver 1 Like / Foto'],
    ['unlockAllLikesDiamonds', 'Ver Todos Likes'],
    ['unlockExclusivePhotoDiamonds', 'Foto VIP'],
  ];

  const cleanDiamonds = {};
  for (const [key, label] of diamondFields) {
    if (isMissingNumberInput(draft[key])) {
      return { valid: false, reason: `Completa el costo en Diamantes para ${label}.` };
    }
    const parsed = Math.floor(Number(draft[key]));
    if (!Number.isFinite(parsed) || parsed < 1) {
      return { valid: false, reason: `El costo de ${label} debe ser al menos 1 💎.` };
    }
    cleanDiamonds[key] = parsed;
  }

  if (isMissingNumberInput(draft.estimatedAdCpmUSD)) {
    return { valid: false, reason: 'El CPM estimado debe ser al menos $0.10 USD.' };
  }
  const parsedCpm = Number(draft.estimatedAdCpmUSD);
  if (!Number.isFinite(parsedCpm) || parsedCpm < 0.1) {
    return { valid: false, reason: 'El CPM estimado debe ser al menos $0.10 USD.' };
  }

  return {
    valid: true,
    payload: {
      unlockMode: resolvedMode,
      enableDiamondCharges: resolvedMode === 'diamonds_only' || resolvedMode === 'hybrid',
      enableRewardedAds: resolvedMode === 'ads_only' || resolvedMode === 'hybrid',
      adDurationSeconds: cleanDuration,
      monetagDirectLink: cleanDirectLink,
      unlockLikeDiamonds: cleanDiamonds.unlockLikeDiamonds,
      unlockAllLikesDiamonds: cleanDiamonds.unlockAllLikesDiamonds,
      unlockChatDiamonds: cleanDiamonds.unlockChatDiamonds,
      unlockExclusivePhotoDiamonds: cleanDiamonds.unlockExclusivePhotoDiamonds,
      estimatedAdCpmUSD: Number(parsedCpm.toFixed(2)),
    },
  };
}

export function validateProPlansDraft({ proPlansDraft, boostPlansDraft, giftsDraft }) {
  if (!Array.isArray(proPlansDraft) || proPlansDraft.length === 0) {
    return { valid: false, reason: 'Debe existir al menos un plan PRO válido.' };
  }

  const sanitizedProPlans = [];
  for (const plan of proPlansDraft) {
    if (isMissingNumberInput(plan?.durationDays) || isMissingNumberInput(plan?.priceUSD)) {
      return { valid: false, reason: 'Completa la duración y el precio USD de cada plan PRO.' };
    }
    const durationDays = Math.floor(Number(plan.durationDays));
    const priceUSD = Number(plan.priceUSD);
    if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 365) {
      return { valid: false, reason: 'La duración de cada plan PRO debe ser entre 1 y 365 días.' };
    }
    if (!Number.isFinite(priceUSD) || priceUSD < 0.99 || priceUSD > 500) {
      return { valid: false, reason: 'El precio USD de cada plan PRO debe ser al menos $0.99.' };
    }
    const rawDiamonds = plan.priceDiamonds ?? 250;
    const priceDiamonds = Math.max(10, Math.floor(Number(rawDiamonds) || 250));
    sanitizedProPlans.push({
      ...plan,
      durationDays,
      priceUSD: Number(priceUSD.toFixed(2)),
      priceDiamonds,
    });
  }

  const sanitizedBoostPlans = [];
  if (Array.isArray(boostPlansDraft)) {
    for (const plan of boostPlansDraft) {
      const rawCost = plan?.costDiamonds ?? plan?.costCoins;
      if (isMissingNumberInput(plan?.durationHours) || isMissingNumberInput(rawCost)) {
        return { valid: false, reason: 'Completa la duración y el costo en 💎 de Boost VIP.' };
      }
      const durationHours = Math.floor(Number(plan.durationHours));
      const costDiamonds = Math.floor(Number(rawCost));
      if (!Number.isFinite(durationHours) || durationHours < 1 || durationHours > 720) {
        return { valid: false, reason: 'La duración del Boost VIP debe ser entre 1 y 720 horas.' };
      }
      if (!Number.isFinite(costDiamonds) || costDiamonds < 10) {
        return { valid: false, reason: 'El costo del Boost VIP debe ser al menos 10 💎.' };
      }
      const { costCoins: _omitLegacyCostCoins, ...rest } = plan;
      sanitizedBoostPlans.push({
        ...rest,
        durationHours,
        costDiamonds,
      });
    }
  }

  const sanitizedGifts = [];
  if (Array.isArray(giftsDraft)) {
    for (const gift of giftsDraft) {
      if (isMissingNumberInput(gift?.price)) {
        return { valid: false, reason: `Ingresa un precio válido para ${gift?.name || 'regalo'}.` };
      }
      const price = Math.floor(Number(gift.price));
      if (!Number.isFinite(price) || price < 1 || price > 50000) {
        return { valid: false, reason: 'Cada regalo debe costar entre 1 y 50,000 💎.' };
      }
      sanitizedGifts.push({
        id: gift.id,
        name: gift.name,
        icon: gift.icon,
        price,
        accent: gift.accent,
        tagline: gift.tagline,
      });
    }
  }

  return {
    valid: true,
    payload: {
      proPlans: sanitizedProPlans,
      boostPlans: sanitizedBoostPlans.length > 0 ? sanitizedBoostPlans : null,
      virtualGifts: sanitizedGifts.length > 0 ? sanitizedGifts : null,
    },
  };
}

export function validateEconomyDraft({
  baseDiamondPrice,
  creatorSharePct,
  minWithdrawDiamonds,
  packagesDraft,
}) {
  if (
    isMissingNumberInput(baseDiamondPrice) ||
    isMissingNumberInput(creatorSharePct) ||
    isMissingNumberInput(minWithdrawDiamonds)
  ) {
    return { valid: false, reason: 'Completa el valor base, % de retiro y mínimo de diamantes.' };
  }

  const cleanBase = Number(baseDiamondPrice);
  const cleanSharePct = Number(creatorSharePct);
  const cleanMin = Math.floor(Number(minWithdrawDiamonds));

  if (!Number.isFinite(cleanBase) || cleanBase <= 0 || cleanBase > 5) {
    return {
      valid: false,
      reason: 'El precio base por diamante debe ser mayor a $0 y menor o igual a $5.00 USD.',
    };
  }
  if (!Number.isFinite(cleanSharePct) || cleanSharePct < 5 || cleanSharePct > 95) {
    return { valid: false, reason: 'El porcentaje de retiro debe estar entre 5% y 95%.' };
  }
  if (!Number.isFinite(cleanMin) || cleanMin < 100) {
    return { valid: false, reason: 'El retiro mínimo debe ser al menos 100 diamantes.' };
  }

  if (!Array.isArray(packagesDraft) || packagesDraft.length === 0) {
    return { valid: false, reason: 'Debe haber al menos un paquete de diamantes.' };
  }

  const sanitizedPackages = [];
  for (const pkg of packagesDraft) {
    const rawUnits = pkg?.diamonds ?? pkg?.coins;
    if (isMissingNumberInput(rawUnits) || isMissingNumberInput(pkg?.priceUSD)) {
      return { valid: false, reason: `Completa cantidad y precio USD de ${pkg?.label || 'paquete'}.` };
    }
    const units = Math.floor(Number(rawUnits));
    const priceUSD = Number(pkg.priceUSD);
    if (!Number.isFinite(units) || units < 10) {
      return { valid: false, reason: 'Cada paquete debe incluir al menos 10 diamantes.' };
    }
    if (!Number.isFinite(priceUSD) || priceUSD < 0.5) {
      return { valid: false, reason: 'El precio mínimo por paquete es $0.50 USD.' };
    }
    const { coins: _omitLegacyCoins, ...rest } = pkg;
    sanitizedPackages.push({
      ...rest,
      diamonds: units,
      priceUSD: Number(priceUSD.toFixed(2)),
    });
  }

  return {
    valid: true,
    payload: {
      baseDiamondValueUSD: Number(cleanBase.toFixed(4)),
      creatorShareRatio: Number((cleanSharePct / 100).toFixed(4)),
      minWithdrawalDiamonds: cleanMin,
      diamondPackages: sanitizedPackages,
    },
  };
}

export function validatePayoutAccountDraft({ methodId, methodName, accountValue, holderName = '' }) {
  const cleanAccount = String(accountValue || '').trim();
  if (cleanAccount.length < 4) {
    return {
      valid: false,
      reason: 'Ingresa al menos 4 caracteres en tu cuenta para guardar automáticamente.',
    };
  }
  return {
    valid: true,
    payload: {
      methodId: String(methodId || 'binance_pay'),
      methodName: String(methodName || 'Binance Pay (USDT)'),
      accountValue: cleanAccount,
      holderName: String(holderName || '').trim(),
    },
  };
}

export function validateProfileDraft(draft, minAge = 18) {
  if (!draft || typeof draft !== 'object') {
    return { valid: false, reason: 'Datos de perfil incompletos.' };
  }
  const cleanName = String(draft.name || '').trim();
  if (!cleanName) {
    return { valid: false, reason: 'Tu nombre no puede estar vacío.' };
  }
  if (isMissingNumberInput(draft.age)) {
    return { valid: false, reason: `Ingresa una edad válida (mín. ${minAge} años).` };
  }
  const cleanAge = Math.floor(Number(draft.age));
  if (!Number.isFinite(cleanAge) || cleanAge < minAge || cleanAge > 99) {
    return { valid: false, reason: `La edad permitida es de ${minAge} a 99 años.` };
  }

  const photos = Array.isArray(draft.photos) ? draft.photos.filter(Boolean) : [];
  const primaryPhoto = photos[0] || '';
  const exclusivePhotoUrls = Array.isArray(draft.exclusivePhotoUrls)
    ? Array.from(
        new Set(
          draft.exclusivePhotoUrls.filter(
            (url) =>
              typeof url === 'string' &&
              url.trim().length > 0 &&
              url !== primaryPhoto &&
              photos.includes(url)
          )
        )
      )
    : [];

  return {
    valid: true,
    payload: {
      name: cleanName,
      age: cleanAge,
      gender: draft.gender,
      interestedIn: draft.interestedIn,
      countryCode: draft.countryCode,
      city: String(draft.city || '').trim(),
      lookingFor: draft.lookingFor,
      bio: String(draft.bio || '').trim(),
      height: String(draft.height || '').trim(),
      job: String(draft.job || '').trim(),
      education: String(draft.education || '').trim(),
      lifestyle: String(draft.lifestyle || '').trim(),
      interests: Array.isArray(draft.interests) ? draft.interests : [],
      photos,
      exclusivePhotoUrls,
      prompts: [
        String(draft.prompts?.[0] || '').trim(),
        String(draft.prompts?.[1] || '').trim(),
      ],
    },
  };
}
