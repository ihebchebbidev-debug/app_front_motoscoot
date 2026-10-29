
import React, { useState } from 'react';
import { MapPin, Phone, Mail, Send, CheckCircle2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BasePageProps } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Section } from './ui/Section';
import { useSubmitContact } from '../hooks/useContact';
import { useToast } from '../context/ToastContext';
import SEO from './common/SEO';

const contactSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Adresse email invalide"),
  message: z.string().min(10, "Le message doit contenir au moins 10 caractères"),
});

type ContactFormData = z.infer<typeof contactSchema>;

const S = {
  Page: "min-h-screen bg-card font-sans pb-12",
  HeaderTitle: "text-3xl md:text-5xl font-black text-gray-900 tracking-tighter mb-2",
  Grid: "grid grid-cols-1 lg:grid-cols-12 gap-12 items-start",
  Sidebar: "lg:col-span-4 space-y-6",
  FormArea: "lg:col-span-8 bg-card rounded-3xl p-8 md:p-12 border border-gray-100 shadow-sm",
  InfoCard: "bg-gray-50 rounded-2xl p-8 border border-gray-100"
};

const Contact: React.FC<BasePageProps> = ({ onNavigate }) => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const submitContact = useSubmitContact();
  const { addToast } = useToast();
  
  const { 
    register, 
    handleSubmit, 
    reset,
    formState: { errors, isSubmitting } 
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema)
  });

  const onSubmit = async (data: ContactFormData) => {
    try {
      // Zod schema enforces these fields are required at runtime, but
      // react-hook-form's resolver inference widens them to optional in TS,
      // so we narrow back to the API's ContactPayload shape explicitly.
      await submitContact.mutateAsync({
        name: data.name,
        email: data.email,
        message: data.message,
      });
      setIsSubmitted(true);
      reset();
      addToast('Merci ! Votre message a bien été envoyé.', 'success');
      setTimeout(() => setIsSubmitted(false), 5000);
    } catch (err: any) {
      addToast(err?.message || "Impossible d'envoyer le message. Réessayez.", 'error');
    }
  };

  return (
    <div className={S.Page}>
      <SEO
        title="Contact Moto-Scoot.tn — Support & Partenariats en Tunisie"
        description="Contactez l'équipe Moto-Scoot.tn : support utilisateur, partenariats professionnels, presse. Réponse sous 24h, du lundi au vendredi."
        url="/contact"
        keywords={['contact MotoScoot', 'support moto Tunisie', 'partenariat moto']}
        breadcrumbs={[
          { name: 'Accueil', url: '/' },
          { name: 'Contact', url: '/contact' },
        ]}
      />
      <Section className="pt-12">
        <div className="mb-12 animate-fade-in-up text-center md:text-left">
          <h1 className={S.HeaderTitle}>Contactez-nous</h1>
          <p className="text-gray-500 font-medium text-lg">Support utilisateur ou partenariat professionnel.</p>
        </div>

        <div className={S.Grid}>
          <aside className={S.Sidebar}>
            <div className={S.InfoCard}>
               <h3 className="font-black text-[12px] text-gray-400 uppercase tracking-widest mb-8">Coordonnées</h3>
               <div className="space-y-6">
                  <div className="flex gap-4">
                    <MapPin className="text-primary-600 shrink-0" size={20} /> 
                    <p className="text-sm font-bold text-gray-700">3, Rue Mami - 2070 La Marsa, Tunisie</p>
                  </div>
                  <div className="flex gap-4">
                    <Phone className="text-primary-600 shrink-0" size={20} /> 
                    <p className="text-sm font-bold text-gray-700">29 249 512</p>
                  </div>
                  <div className="flex gap-4">
                    <Mail className="text-primary-600 shrink-0" size={20} /> 
                    <p className="text-sm font-bold text-gray-700">contact@moto-scoot.tn</p>
                  </div>
               </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
               <h3 className="font-black text-[10px] text-gray-400 uppercase tracking-widest mb-4">Mentions Légales</h3>
               <p className="text-[11px] leading-relaxed text-gray-500 font-medium">
                 MotoScoot est une marque déposée auprès de l'INORPI. L'utilisation du site moto-scoot.tn ou moto-scoot.tn ainsi que de la marque MotoScoot sont la propriété exclusive de <a href="https://magma-studio.tn" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">Magma Studio</a>.
               </p>
            </div>
          </aside>

          <main className={S.FormArea}>
            {isSubmitted ? (
              <div className="text-center py-20 animate-scale-in">
                <CheckCircle2 size={64} className="text-success-500 mx-auto mb-6" />
                <h2 className="text-2xl font-black text-gray-900 mb-2">Message envoyé !</h2>
                <p className="text-gray-500 font-medium">Nous vous répondrons sous 24h ouvrées.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input 
                    label="Nom complet" 
                    placeholder="Votre nom" 
                    {...register('name')}
                    error={errors.name?.message}
                  />
                  <Input 
                    label="Email" 
                    type="email" 
                    placeholder="votre@email.com" 
                    {...register('email')}
                    error={errors.email?.message}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[12px] font-black text-gray-400 uppercase tracking-widest ml-1">Message</label>
                  <textarea 
                    rows={6} 
                    className={`w-full px-5 py-4 rounded-xl bg-gray-50 border outline-none font-medium text-gray-700 resize-none transition-all focus:bg-card ${errors.message ? 'border-red-500 focus:border-red-500' : 'border-gray-100 focus:border-primary-600'}`}
                    placeholder="Comment pouvons-nous vous aider ?"
                    {...register('message')}
                  />
                  {errors.message && <p className="text-[12px] font-bold text-red-600 ml-1">{errors.message.message}</p>}
                </div>
                <Button 
                  variant="dark" 
                  fullWidth 
                  size="xl" 
                  type="submit" 
                  isLoading={isSubmitting}
                  rightIcon={!isSubmitting && <Send size={18}/>}
                >
                  Envoyer le message
                </Button>
              </form>
            )}
          </main>
        </div>
      </Section>
    </div>
  );
};

export default Contact;
