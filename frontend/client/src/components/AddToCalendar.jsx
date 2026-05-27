'use client';

import Button from '@/components/Button'
import { useTranslation } from 'next-i18next'
import { CalendarDays } from 'lucide-react'


export default function AddToCalendar(props) {
    const { electionURL, eventTitle, eventDescription } = props;
    const { t } = useTranslation();

    const downloadIcsFile = () => {
        const begin = 'VALUE=DATE:20260527';
        const end =  'VALUE=DATE:20260528';
        const dtstamp = '20260521T105500Z';
        const uid = 'abstimmmung21-2026';

        const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:opn.vote',
            'CALSCALE:GREGORIAN',
            'BEGIN:VEVENT',
            `DTSTAMP:${dtstamp}`,
            `DTSTART;${begin}`,
            `DTEND;${end}`,
            `UID:${uid}`,
            `SUMMARY:${eventTitle}`,
            `DESCRIPTION:${eventDescription}`,
            `LOCATION:${electionURL}`,
            'BEGIN:VALARM',
            'TRIGGER:-PT12H',
            'ACTION:DISPLAY',
            'END:VALARM',
            'END:VEVENT',
            'END:VCALENDAR',
        ].join('\r\n');

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = 'opnVote.ics';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => URL.revokeObjectURL(url), 0);
    };
    return (
        <>
            <Button
                onClick={downloadIcsFile}
                type="primary"
                style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', gap: '10px', marginTop: '20px' }}
            >
                <div style={{ alignSelf: 'center' }}>
                    <CalendarDays stroke={'#ffffff'} strokeWidth={'3'} width={20} />
                </div>
                {t("common.button.addToCalendar")}
            </Button>
        </>
    );
}
