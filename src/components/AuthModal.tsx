import React, { useState } from 'react';
import { Lock, User, X, ShieldCheck, AlertCircle } from 'lucide-react';
import { loginBureau } from '../services/api';
import { useI18n } from '../i18n';

interface AuthModalProps {
  isDefaultPassword: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isDefaultPassword,
  onClose,
  onAuthenticated,
}) => {
  const { lang, t } = useI18n();
  const [username, setUsername] = useState('president');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await loginBureau(username.trim(), password);
    setLoading(false);
    if (res.ok) {
      onAuthenticated();
      onClose();
    } else {
      setError(res.error || t('authWrongPassword'));
    }
  };

  const quickUsers = [
    { id: 'president', label: t('rolePresident') },
    { id: 'tresorier', label: t('roleTreasurer') },
    { id: 'technique', label: t('roleTechnical') },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 no-print">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {t('authTitle')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {t('authDesc')}
        </p>

        {isDefaultPassword && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
            <div>
              <strong>{t('authDefaultHint')}</strong>
            </div>
            <div className="font-mono text-[10px]">
              {t('authDefaultUsersHint')}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {quickUsers.map((qu) => (
            <button
              key={qu.id}
              type="button"
              onClick={() => setUsername(qu.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                username === qu.id
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              {qu.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              {lang === 'ar' ? 'اسم المستخدم' : "Identifiant (compte Bureau)"}
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                dir="ltr"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full ps-9 pe-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              {t('authPasswordLabel')}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('authPasswordPlaceholder')}
                className="w-full ps-9 pe-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                autoFocus
                required
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-500 cursor-pointer"
            >
              {t('authStayResident')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-xs cursor-pointer"
            >
              {loading
                ? lang === 'ar'
                  ? 'جاري التحقق...'
                  : 'Vérification...'
                : lang === 'ar'
                ? 'دخول'
                : 'Se connecter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
