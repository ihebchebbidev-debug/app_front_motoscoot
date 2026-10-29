import React, { useState } from 'react';
import { Mail, Check, Loader2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { newsletterApi } from '../services/miscApi';
import { useToast } from '../context/ToastContext';

interface NewsletterProps {
  variant?: 'inline' | 'section';
  className?: string;
}

const Newsletter: React.FC<NewsletterProps> = ({ variant = 'section', className = '' }) => {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const { addToast } = useToast();

  const subscribe = useMutation({
    mutationFn: (e: string) => newsletterApi.subscribe(e),
    onSuccess: () => {
      setDone(true);
      setEmail('');
      addToast('Merci ! Vous êtes inscrit à la newsletter.', 'success');
    },
    onError: (err: any) => addToast(err?.message || 'Inscription impossible', 'error'),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      addToast('Email invalide', 'error');
      return;
    }
    subscribe.mutate(email.trim().toLowerCase());
  };

  if (done && variant === 'inline') {
    return (
      <p className={`flex items-center gap-2 text-sm font-bold text-green-500 ${className}`}>
        <Check size={16} /> Inscription confirmée !
      </p>
    );
  }

  return (
    <form onSubmit={submit} className={`flex flex-col sm:flex-row gap-2 ${className}`}>
      <div className="flex-1 relative">
        <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="votre@email.com"
          aria-label="Adresse email"
          className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-primary-600"
        />
      </div>
      <button
        type="submit"
        disabled={subscribe.isPending}
        className="inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
      >
        {subscribe.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
        S'inscrire
      </button>
    </form>
  );
};

export default Newsletter;
