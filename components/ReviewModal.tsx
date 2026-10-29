import React, { useState, useEffect } from 'react';
import { Star, X, ShieldAlert } from 'lucide-react';
import { useUser } from '../context/UserContext';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (review: { name: string; rating: number; text: string }) => void;
  garageName: string;
  submitting?: boolean;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({ isOpen, onClose, onSubmit, garageName, submitting = false }) => {
  const { user } = useUser();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setName(`${user.firstName} ${user.lastName}`);
    }
  }, [user]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError('Veuillez sélectionner une note.');
      return;
    }
    if (!name.trim() || !text.trim()) {
      setError('Veuillez remplir tous les champs.');
      return;
    }

    onSubmit({ name, rating, text });
    
    // Reset form
    setRating(0);
    if (!user) setName('');
    setText('');
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-black text-gray-900">Donner votre avis</h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <p className="text-sm text-gray-600 font-medium">
            Partagez votre expérience avec <span className="font-bold text-gray-900">{garageName}</span>
          </p>

          {/* Rating Selector */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-sm font-bold text-gray-700 uppercase tracking-widest">Votre note</span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="p-1 transition-transform hover:scale-110 focus:outline-none"
                >
                  <Star 
                    size={32} 
                    className={`transition-colors ${
                      star <= (hoveredRating || rating) 
                        ? "text-warning-400 fill-warning-400" 
                        : "text-gray-200 fill-gray-200"
                    }`} 
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2">Votre nom</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                readOnly={!!user}
                placeholder="Ex: Sami Ben Amor"
                className={`w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all font-medium ${user ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2">Votre commentaire</label>
              <textarea 
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Racontez-nous votre expérience en détail..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all font-medium resize-none"
              ></textarea>
            </div>
          </div>

          {/* Disclaimer for fake reviews */}
          <div className="bg-orange-50 rounded-xl p-3 flex items-start gap-3 border border-orange-100">
            <ShieldAlert size={18} className="text-primary-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-gray-700 leading-relaxed font-medium">
              Afin de lutter contre les faux avis et la concurrence déloyale, votre avis doit refléter une expérience réelle. Tout avis frauduleux sera supprimé et peut entraîner la suspension de votre compte.
            </p>
          </div>

          {error && <p className="text-sm font-bold text-red-500">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button 
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-6 py-3 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button 
              type="submit"
              disabled={submitting}
              className="flex-1 px-6 py-3 rounded-xl font-black text-white bg-primary-600 hover:bg-primary-700 transition-colors uppercase tracking-widest text-[13px] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Publication…' : 'Publier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
