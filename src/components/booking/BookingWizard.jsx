'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DateTimeStep } from './DateTimeStep';
import { DetailsStep } from './DetailsStep';
import { ServiceStep } from './ServiceStep';
import { Stepper } from './Stepper';
import { TicketCard } from './TicketCard';

const EMPTY_CONTACT = { clientName: '', clientPhone: '' };

/**
 * `pick` ({ service, at }) comes from the hero quick-pick: it starts a fresh booking for that
 * service and jumps to the date step. `at` makes picking the same service twice still count.
 */
export function BookingWizard({ settings, onOpenCancel, pick }) {
  const [step, setStep] = useState(1);
  const [service, setService] = useState(null);
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [contact, setContact] = useState(EMPTY_CONTACT);
  const [appointment, setAppointment] = useState(null);
  const wizardRef = useRef(null);
  const headingRef = useRef(null);
  const shownStep = useRef(step);

  // On every step change: back to the top of the wizard and focus the step heading.
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    wizardRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  useEffect(() => {
    if (!pick?.service) return;
    setAppointment(null);
    setDate(null);
    setTime(null);
    setService(pick.service);
    setStep(2);
  }, [pick]);

  const chooseService = (next) => {
    if (service?.key !== next.key) {
      setDate(null);
      setTime(null);
    }
    setService(next);
    setStep(2);
  };

  const changeDate = useCallback((next) => {
    setDate(next);
    setTime(null);
  }, []);

  const changeContact = useCallback((key, value) => setContact((c) => ({ ...c, [key]: value })), []);

  const booked = useCallback((result) => {
    setAppointment(result);
    setStep(4);
  }, []);

  const slotTaken = useCallback(() => {
    setTime(null);
    setStep(2);
  }, []);

  const reset = useCallback(() => {
    setAppointment(null);
    setService(null);
    setDate(null);
    setTime(null);
    setStep(1);
  }, []);

  // Steps that need earlier choices fall back to the first step if those are missing.
  let content;
  if (step === 4 && appointment) {
    content = <TicketCard appointment={appointment} settings={settings} onReset={reset} headingRef={headingRef} />;
  } else if (step === 3 && service && date && time) {
    content = (
      <div className="glass p-4 sm:p-6">
        <DetailsStep
          service={service}
          date={date}
          time={time}
          contact={contact}
          onContactChange={changeContact}
          onEdit={() => setStep(2)}
          onBooked={booked}
          onSlotTaken={slotTaken}
          onOpenCancel={onOpenCancel}
          headingRef={headingRef}
        />
      </div>
    );
  } else if (step >= 2 && service) {
    content = (
      <div className="glass p-4 sm:p-6">
        <DateTimeStep
          service={service}
          date={date}
          time={time}
          onDateChange={changeDate}
          onTimeChange={setTime}
          onBack={() => setStep(1)}
          onContinue={() => setStep(3)}
          headingRef={headingRef}
          phone={settings.phone}
        />
      </div>
    );
  } else {
    content = (
      <div className="glass p-4 sm:p-6">
        <ServiceStep services={settings.services} selectedKey={service?.key} onSelect={chooseService} headingRef={headingRef} phone={settings.phone} />
      </div>
    );
  }

  return (
    <section ref={wizardRef} aria-label="Pasos de tu reserva">
      <Stepper step={step} />
      <div key={step} className="animate-fade-up">
        {content}
      </div>
    </section>
  );
}
