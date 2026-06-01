'use client';

import Button from '@/components/Button';
import { useTranslation } from 'next-i18next';
import { CalendarDays } from 'lucide-react';


export default function AddToCalendar(props) {
    const { eventDate, electionURL, eventTitle, eventDescription, electionId } = props;
    const { t } = useTranslation();


    const formatToIcsDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    };

    const formatToIcsDateTime = (datetime) => {
        const date = formatToIcsDate(datetime);
        const hours = String(datetime.getUTCHours()).padStart(2, '0');
        const minutes = String(datetime.getUTCMinutes()).padStart(2, '0');
        const seconds = String(datetime.getUTCSeconds()).padStart(2, '0');

        const utc = 'Z';
        return `${date}T${hours}${minutes}${seconds}${utc}`;
    };

    function addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    const downloadIcsFile = () => {
        const begin = `VALUE=DATE:${formatToIcsDate(eventDate)}`;
        const end =  `VALUE=DATE:${formatToIcsDate(addDays(eventDate, 1))}`;
        const dtstamp = `${formatToIcsDateTime(new Date())}`;
        const uid = 'voting-' + electionId + '@opn.vote';
        // output isn't text/html, it's text/calendar, i.e. &-escaped stuff is useless.
        // but escaping was applied by the translation or use-as-prop function
        // since we only have slashes to worry about for now, restore those.
        const eventDescriptionUnescaped = eventDescription.replaceAll(/&#x2f;/gi, '/');

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
            `DESCRIPTION:${eventDescriptionUnescaped}`,
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
