import React from 'react';
import { Printer, X, Megaphone } from 'lucide-react';
import {
  BuildingInfo,
  Notice,
  Apartment,
  Vendor,
  AssemblyMinutes,
  HouseRuleSection,
} from '../../types';
import { formatDateFr, formatMonthName, formatDZD } from '../../utils/helpers';
import { useI18n } from '../../i18n';

interface NoticePrintModalProps {
  notice?: Notice | null;
  unpaidNotice?: {
    month: string;
    unpaidApts: Apartment[];
  } | null;
  minutes?: AssemblyMinutes | null;
  houseRules?: HouseRuleSection[] | null;
  apartments?: Apartment[];
  building: BuildingInfo;
  vendors?: Vendor[];
  onClose: () => void;
}

export const NoticePrintModal: React.FC<NoticePrintModalProps> = ({
  notice,
  unpaidNotice,
  minutes,
  houseRules,
  apartments = [],
  building,
  vendors = [],
  onClose,
}) => {
  const { lang, t } = useI18n();
  if (!notice && !unpaidNotice && !minutes && !houseRules) return null;

  const elevatorVendor = vendors.find(
    (v) => v.specialty.toLowerCase().includes('ascenseur') || v.name.toLowerCase().includes('ascenseur')
  );
  const isAnnual = (building.feeFrequency || 'annuel') === 'annuel';

  const modalTitle = minutes
    ? lang === 'ar'
      ? 'محضر الجمعية العامة وقائمة الحضور'
      : "Procès-Verbal d'Assemblée Générale & Feuille de Présence"
    : houseRules
    ? lang === 'ar'
      ? 'النظام الداخلي الرسمي (للعرض في البهو)'
      : 'Règlement Intérieur Officiel (Affichage Hall)'
    : unpaidNotice
    ? lang === 'ar'
      ? 'قائمة الاشتراكات غير المسددة (للعرض في البهو)'
      : 'État des Cotisations Impayées (Affichage Hall)'
    : lang === 'ar'
    ? 'إعلان رسمي للعرض في البهو'
    : 'Avis Officiel pour Affichage dans le Hall';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:static print:bg-transparent print:p-0 print:block">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-6 my-8 print:border-none print:shadow-none print:p-0 print:my-0 print:max-w-none">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 no-print">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{modalTitle}</h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{t('printA4')}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Paper Canvas */}
        <div className="p-8 sm:p-10 bg-white text-slate-900 border border-slate-300 rounded-xl print-card print:border-none print:p-0 space-y-6">
          <div className="border-b-2 border-slate-900 pb-4 text-center space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
              {t('republicHeader')}
            </p>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              {t('syndicOfficialHeader')}
            </h1>
            <p className="text-sm font-bold text-slate-700">
              {building.residenceName} — {building.buildingNumber}
            </p>
            <p className="text-xs text-slate-500">
              {building.wilaya} · {building.gestImmoAgency}
            </p>
          </div>

          {notice && (
            <div className="space-y-6">
              <div className="text-center bg-slate-100 p-4 rounded-lg border border-slate-200">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  {lang === 'ar' ? 'بلاغ رسمي' : 'COMMUNICATION OFFICIELLE'}
                </span>
                <h2 className="text-xl font-black text-slate-900 uppercase">{notice.title}</h2>
                <p className="text-xs text-slate-600 mt-1">
                  {lang === 'ar' ? 'موجه إلى:' : "À l'attention de :"} <strong>{notice.targetAudience}</strong>
                </p>
              </div>

              <div className="text-sm sm:text-base leading-relaxed text-slate-800 whitespace-pre-line px-2">
                {notice.message}
              </div>

              <div className="p-4 bg-slate-50 border-s-4 border-slate-900 text-xs text-slate-700 space-y-1">
                <p>
                  <strong>{lang === 'ar' ? 'للاستفسار أو الطوارئ:' : 'Pour toute urgence ou question :'}</strong>
                </p>
                <p>
                  {building.syndicPresident} — <span dir="ltr">{building.syndicPhone}</span>
                </p>
                {elevatorVendor && (
                  <p>
                    {elevatorVendor.name} : <span dir="ltr">{elevatorVendor.phone}</span>
                    {elevatorVendor.secondaryPhone ? ` / ${elevatorVendor.secondaryPhone}` : ''}
                  </p>
                )}
              </div>
            </div>
          )}

          {unpaidNotice && (
            <div className="space-y-4">
              <div className="text-center bg-slate-100 p-3 rounded border border-slate-200">
                <h2 className="text-base font-black text-slate-900 uppercase">
                  {lang === 'ar' ? 'وضعية الاشتراكات غير المسددة —' : 'État des Cotisations Impayées —'}{' '}
                  {formatMonthName(unpaidNotice.month, lang)}
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  {lang === 'ar'
                    ? isAnnual
                      ? 'قيمة الاشتراك السنوي:'
                      : 'قيمة الاشتراك الشهري:'
                    : isAnnual
                    ? 'Montant de la cotisation annuelle :'
                    : 'Montant de la cotisation mensuelle :'}{' '}
                  <strong>{formatDZD(building.standardMonthlyFeeDZD, lang)}</strong>
                </p>
              </div>

              <div className="border border-slate-300 rounded overflow-hidden">
                <table className="w-full text-start text-xs">
                  <thead className="bg-slate-100 border-b border-slate-300 font-bold">
                    <tr>
                      <th className="py-2 px-3">{lang === 'ar' ? 'الباب' : 'Porte'}</th>
                      <th className="py-2 px-3">{lang === 'ar' ? 'الطابق' : 'Étage'}</th>
                      <th className="py-2 px-3">{lang === 'ar' ? 'النوع' : 'Type'}</th>
                      <th className="py-2 px-3">{t('residentCol')}</th>
                      <th className="py-2 px-3 text-end">{lang === 'ar' ? 'المبلغ المستحق' : 'Montant Dû'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {unpaidNotice.unpaidApts.map((apt) => (
                      <tr key={apt.id}>
                        <td className="py-2 px-3 font-bold">{apt.number}</td>
                        <td className="py-2 px-3">
                          {apt.floor === 0
                            ? lang === 'ar'
                              ? 'الطابق الأرضي'
                              : 'RDC'
                            : `${lang === 'ar' ? 'الطابق' : 'Étage'} ${apt.floor}`}
                        </td>
                        <td className="py-2 px-3 font-mono">{apt.type}</td>
                        <td className="py-2 px-3">{apt.resident.name}</td>
                        <td className="py-2 px-3 text-end font-mono font-bold">
                          {formatDZD(building.standardMonthlyFeeDZD, lang)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-slate-700 text-center font-medium bg-slate-50 p-2.5 rounded border border-slate-200">
                {building.syndicPresident} — <span dir="ltr">{building.syndicPhone}</span>
              </p>
            </div>
          )}

          {minutes && (
            <div className="space-y-5 text-xs">
              <div className="text-center bg-slate-100 p-3.5 rounded border border-slate-200">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  AG {minutes.type.toUpperCase()}
                </span>
                <h2 className="text-lg font-black text-slate-900 mt-0.5">{minutes.title}</h2>
                <p className="text-xs text-slate-600 mt-1">
                  <strong>{formatDateFr(minutes.date, lang)}</strong> · <strong dir="ltr">{minutes.time}</strong> — {minutes.location}
                </p>
              </div>

              <div>
                <h3 className="font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
                  {lang === 'ar' ? 'أولاً: جدول الأعمال' : 'I. Ordre du Jour'}
                </h3>
                <ol className="list-decimal list-inside space-y-1 text-slate-800">
                  {minutes.agenda.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ol>
              </div>

              <div>
                <h3 className="font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
                  {lang === 'ar' ? 'ثانياً: القرارات المتخذة' : 'II. Résolutions et Décisions Adoptées'}
                </h3>
                <ul className="list-disc list-inside space-y-1.5 text-slate-800">
                  {minutes.decisions.map((dec, idx) => (
                    <li key={idx}>{dec}</li>
                  ))}
                </ul>
              </div>

              {minutes.notes && (
                <p className="italic text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200">
                  {minutes.notes}
                </p>
              )}

              <div>
                <h3 className="font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
                  {lang === 'ar'
                    ? `ثالثاً: ورقة الحضور والإمضاء (${minutes.presentApartmentIds.length} شقة حاضرة)`
                    : `III. Feuille de Présence & Émargement (${minutes.presentApartmentIds.length} logements présents)`}
                </h3>
                <div className="border border-slate-300 rounded overflow-hidden">
                  <table className="w-full text-start text-[11px]">
                    <thead className="bg-slate-100 border-b border-slate-300 font-bold">
                      <tr>
                        <th className="py-1.5 px-2">{lang === 'ar' ? 'الباب' : 'Porte'}</th>
                        <th className="py-1.5 px-2">{t('residentCol')}</th>
                        <th className="py-1.5 px-2 text-center">{lang === 'ar' ? 'حاضر' : 'Présent'}</th>
                        <th className="py-1.5 px-2">{lang === 'ar' ? 'الإمضاء' : 'Signature'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {apartments.map((apt) => {
                        const isPresent = minutes.presentApartmentIds.includes(apt.id);
                        return (
                          <tr key={apt.id}>
                            <td className="py-1.5 px-2 font-bold">{apt.number}</td>
                            <td className="py-1.5 px-2">{apt.resident.name}</td>
                            <td className="py-1.5 px-2 text-center font-bold">{isPresent ? '✓' : '—'}</td>
                            <td className="py-1.5 px-2 text-slate-400">__________________</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 pt-4">
                <div className="text-center border border-dashed border-slate-300 rounded p-3 h-24 flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    {lang === 'ar' ? 'رئيس الجلسة' : 'Président de Séance'}
                  </span>
                  <span className="font-bold text-slate-900">{minutes.presidentName}</span>
                </div>
                <div className="text-center border border-dashed border-slate-300 rounded p-3 h-24 flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    {lang === 'ar' ? 'أمين الجلسة' : 'Secrétaire de Séance'}
                  </span>
                  <span className="font-bold text-slate-900">{minutes.secretaryName}</span>
                </div>
              </div>
            </div>
          )}

          {houseRules && (
            <div className="space-y-4 text-xs">
              <div className="text-center bg-slate-100 p-3.5 rounded border border-slate-200">
                <h2 className="text-lg font-black text-slate-900 uppercase">{t('houseRulesHeader')}</h2>
                <p className="text-xs text-slate-600 mt-0.5">{t('houseRulesSub')}</p>
              </div>

              {houseRules.map((section) => (
                <div key={section.id} className="space-y-1.5">
                  <h3 className="font-bold text-sm text-slate-900 border-b border-slate-300 pb-0.5">
                    {section.title}
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-slate-800 leading-relaxed">
                    {section.items.filter(Boolean).map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {!minutes && (
            <div className="pt-6 border-t border-slate-200 flex justify-between items-end text-xs">
              <div>
                <p className="text-slate-500">
                  {t('madeAt')} {building.wilaya}, {t('onDate')} {formatDateFr(new Date().toISOString(), lang)}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">{t('displayedInHall')}</p>
              </div>

              <div className="text-center border border-dashed border-slate-300 rounded p-4 w-52 h-28 flex flex-col justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-500">{t('syndicStamp')}</span>
                <span className="text-xs font-bold text-slate-900">{building.syndicPresident}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
