import React from 'react';
import type {User} from '../types';
import {useLanguage} from '../contexts/LanguageContext';

export default function MyWorkView({currentUser}: {currentUser: User | null}) {
    const {language} = useLanguage();
    const ka = language === 'ka';
    // Never infer identity from a shared name, phone number, or editable email.
    const records = (currentUser?.workRecords || []).filter(r => r.userId === currentUser?.id);
    return <section className="p-4 md:p-8 max-w-4xl mx-auto w-full space-y-4">
        <h1 className="text-2xl font-semibold">{ka ? 'ჩემი სამუშაო და ანაზღაურება' : 'My work & earnings'}</h1>
        <p>{ka ? 'აქ ჩანს თქვენს ანგარიშთან დაკავშირებული სამუშაო ჩანაწერები. დარიცხვა არ ნიშნავს თანხის გადახდას. ვალუტისა და გადახდის სტატუსის დასაზუსტებლად დაუკავშირდით დამსაქმებელს.' : 'Work records linked to your account. Recorded earnings do not confirm payment. Confirm currency and payment status with your employer.'}</p>
        {!records.length && <p role="status">{ka ? 'თქვენს ანგარიშთან დაკავშირებული ჩანაწერები ჯერ არ არის.' : 'No work records have been linked to your account yet.'}</p>}
        <ul className="space-y-3">{records.map(r => <li key={r.id} className="border rounded-xl p-4 bg-white text-slate-900">
            <p className="font-semibold">{r.organizationName}</p><p>{r.date} · {r.workType}</p>
            <p>{ka ? 'დარიცხული თანხა' : 'Recorded earnings'}: {r.moneyEarned}</p>
        </li>)}</ul>
    </section>;
}
