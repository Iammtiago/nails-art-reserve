'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, apiPut } from '@/lib/api';
import { useAdmin } from '@/components/admin/AdminContext';
import { useToast } from '@/components/ui/Toast';
import { BookingSection } from './BookingSection';
import { BusinessSection } from './BusinessSection';
import { ColorsSection } from './ColorsSection';
import { ConfigStats } from './ConfigStats';
import { HoursSection } from './HoursSection';
import { LogoSection } from './LogoSection';
import { SaveBar } from './SaveBar';
import { ServicesSection } from './ServicesSection';
import { SECTION_LABELS, buildPayload, dirtyKeys, dropErrorsFor, mapServerErrors, safeTheme, toEditable, validateDraft } from './configModel';

const FOCUS_SELECTOR = '[aria-invalid="true"], [data-config-alert]';

/** Keeps a draft of the full settings, saves only the changed top-level keys. */
export function ConfigEditor({ initial }) {
  const { reloadSettings, handleError } = useAdmin();
  const toast = useToast();
  const router = useRouter();
  const rootRef = useRef(null);

  const [form, setForm] = useState(() => {
    const editable = toEditable(initial);
    return { original: editable, draft: editable };
  });
  const [serverErrors, setServerErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);

  const { draft, original } = form;
  const clientErrors = useMemo(() => validateDraft(draft), [draft]);
  const errors = useMemo(() => ({ ...serverErrors, ...clientErrors }), [serverErrors, clientErrors]);
  const dirty = useMemo(() => dirtyKeys(draft, original), [draft, original]);
  const isDirty = dirty.length > 0;
  const dirtySections = useMemo(() => [...new Set(dirty.map((key) => SECTION_LABELS[key]))], [dirty]);
  const previewColors = useMemo(() => safeTheme(draft.themeColors, original.themeColors), [draft.themeColors, original.themeColors]);

  const updateKey = useCallback((key, value) => {
    setForm((f) => ({ ...f, draft: { ...f.draft, [key]: typeof value === 'function' ? value(f.draft[key]) : value } }));
    setServerErrors((prev) => dropErrorsFor(prev, key));
  }, []);

  const discard = useCallback(() => {
    setForm((f) => ({ ...f, draft: f.original }));
    setServerErrors({});
    toast.info('Descartamos los cambios.');
  }, [toast]);

  const save = async () => {
    if (!isDirty || saving) return;
    const blocking = Object.entries(clientErrors).filter(([path]) => dirty.includes(path.split('.')[0]));
    if (blocking.length) {
      toast.error(blocking[0][1]);
      setFocusRequest((n) => n + 1);
      return;
    }
    setSaving(true);
    try {
      const response = await apiPut('/api/settings', buildPayload(draft, dirty));
      const next = toEditable(response.settings);
      setForm({ original: next, draft: next });
      setServerErrors({});
      toast.success('Configuración guardada');
      reloadSettings();
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        setServerErrors(mapServerErrors(error.details));
        toast.error(error.details[0]?.message || error.message);
        setFocusRequest((n) => n + 1);
      } else {
        handleError(error);
      }
    } finally {
      setSaving(false);
    }
  };

  const saveRef = useRef(save);
  saveRef.current = save;

  // Move focus to the first field with an error after a failed save.
  useEffect(() => {
    if (!focusRequest) return;
    const target = rootRef.current?.querySelector(FOCUS_SELECTOR);
    if (!target) return;
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    target.focus({ preventScroll: true });
  }, [focusRequest]);

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (!isDirty) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  // Ctrl/⌘ + S saves.
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const onSubmit = (event) => {
    event.preventDefault();
    save();
  };

  return (
    <form ref={rootRef} noValidate onSubmit={onSubmit} aria-label="Configuración del negocio">
      <ConfigStats draft={draft} previewColors={previewColors} />

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2 lg:items-start">
        <BusinessSection
          businessName={draft.businessName}
          phone={draft.phone}
          instagramUrl={draft.instagramUrl}
          errors={errors}
          onChange={updateKey}
          delay={100}
        />
        <LogoSection
          logoUrl={draft.logoUrl}
          businessName={draft.businessName}
          error={errors.logoUrl}
          onChange={(value) => updateKey('logoUrl', value)}
          delay={150}
        />
        <HoursSection
          hours={draft.workingHours}
          errors={errors}
          onChange={(value) => updateKey('workingHours', value)}
          delay={200}
          className="lg:col-span-2"
        />
        <ServicesSection services={draft.services} errors={errors} onChange={(value) => updateKey('services', value)} delay={250} />
        <BookingSection booking={draft.booking} errors={errors} onChange={(value) => updateKey('booking', value)} delay={300} />
        <ColorsSection
          colors={draft.themeColors}
          previewColors={previewColors}
          logoUrl={draft.logoUrl}
          businessName={draft.businessName}
          errors={errors}
          onChange={(value) => updateKey('themeColors', value)}
          delay={300}
          className="lg:col-span-2"
        />
      </div>

      {isDirty ? <SaveBar sections={dirtySections} saving={saving} onDiscard={discard} /> : null}
    </form>
  );
}
