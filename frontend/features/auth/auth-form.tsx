'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { registerSchema, loginSchema, userResponseSchema } from '@corewise/types';
import { ArrowRight, Cpu, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeSelect } from '@/components/theme-select';
import { ChipIllustration } from '@/components/chip-illustration';
import { apiData, ApiClientError } from '@/lib/api';

type Values = { name?: string; email: string; password: string };
export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const registering = mode === 'register';
  const router = useRouter();
  const client = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(registering ? registerSchema : loginSchema),
    defaultValues: { email: '', password: '', ...(registering ? { name: '' } : {}) },
  });
  async function submit(values: Values) {
    try {
      const result = await apiData(`/api/auth/${mode}`, userResponseSchema, {
        method: 'POST',
        body: JSON.stringify(values),
      });
      client.clear();
      client.setQueryData(['current-user'], result.data);
      const next = new URLSearchParams(window.location.search).get('next');
      router.replace(
        next &&
          [
            '/',
            '/hardware-library',
            '/profile',
            '/settings',
            '/workload-analyzer',
            '/cpu-vs-gpu',
            '/ml-predictions',
            '/benchmark-lab',
            '/explainability',
            '/ai-assistant',
            '/reports',
            '/system-monitor',
            '/settings',
          ].includes(next)
          ? next
          : '/hardware-library',
      );
      router.refresh();
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Unable to sign in. Please try again.',
      });
      if (error instanceof ApiClientError && error.fields)
        for (const key of ['name', 'email', 'password'] as const) {
          if (error.fields[key]?.[0]) setError(key, { message: error.fields[key][0] });
        }
    }
  }
  return (
    <div className="auth-page">
      <header className="auth-header">
        <Link className="auth-brand" href="/">
          <Cpu size={25} />
          <strong>
            CoreWise <span>AI</span>
          </strong>
        </Link>
        <ThemeSelect />
      </header>
      <div className="auth-layout">
        <section className="auth-story">
          <span className="eyebrow">INTELLIGENCE BEHIND EVERY COMPUTE DECISION</span>
          <h1>
            Your hardware.
            <br />
            <span>Your advantage.</span>
          </h1>
          <p>
            A personal workspace for the systems you build, the workloads you run, and the decisions
            that come next.
          </p>
          <ChipIllustration />
          <div className="auth-trust">
            <ShieldCheck size={19} />
            <span>Private by design. Your hardware profiles belong to you.</span>
          </div>
        </section>
        <section className="panel auth-card">
          <span className="auth-lock">
            <LockKeyhole size={22} />
          </span>
          <div className="eyebrow">YOUR COREWISE WORKSPACE</div>
          <h2>{registering ? 'Create your account' : 'Welcome back'}</h2>
          <p>
            {registering
              ? 'Start building your hardware library.'
              : 'Sign in to your hardware intelligence workspace.'}
          </p>
          <form onSubmit={handleSubmit(submit)} noValidate>
            {registering && (
              <div className="field">
                <label htmlFor="name">Full name</label>
                <input
                  id="name"
                  autoComplete="name"
                  {...register('name')}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? 'name-error' : undefined}
                />
                {errors.name && (
                  <small id="name-error" className="field-error">
                    {errors.name.message}
                  </small>
                )}
              </div>
            )}
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...register('email')}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
              />
              {errors.email && (
                <small id="email-error" className="field-error">
                  {errors.email.message}
                </small>
              )}
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete={registering ? 'new-password' : 'current-password'}
                {...register('password')}
                aria-invalid={!!errors.password}
                aria-describedby={
                  errors.password ? 'password-error' : registering ? 'password-hint' : undefined
                }
              />
              {registering && (
                <small id="password-hint">
                  Use 12–128 characters. A long, unique passphrase works well.
                </small>
              )}
              {errors.password && (
                <small id="password-error" className="field-error">
                  {errors.password.message}
                </small>
              )}
            </div>
            {errors.root && (
              <div className="form-error" role="alert">
                {errors.root.message}
              </div>
            )}
            <Button className="auth-submit" disabled={isSubmitting}>
              {isSubmitting
                ? 'Securing your workspace…'
                : registering
                  ? 'Create account'
                  : 'Sign in'}
              <ArrowRight size={16} />
            </Button>
          </form>
          <p className="auth-alternate">
            {registering ? 'Already have an account?' : 'New to CoreWise?'}{' '}
            <Link href={registering ? '/login' : '/register'}>
              {registering ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
          <div className="auth-footnote">
            <LockKeyhole size={12} />
            Your session stays in a secure, HttpOnly cookie.
          </div>
        </section>
      </div>
      <footer className="auth-footer">CoreWise AI · Precision. Performance. Clarity.</footer>
    </div>
  );
}
